import asyncio
import hashlib
import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from data.parser import parse_export, load_sample
from api.stream import handle
from engine.event_store import store, Event
from db.database import init_db, get_db
from auth.router import router as auth_router, get_current_user, optional_user


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="PulseCheck", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)


# ---------- helper ----------

def _anon(user_id: str) -> str:
    return hashlib.sha256(user_id.encode()).hexdigest()[:8]


# ---------- batch analysis endpoints ----------

@app.post("/parse")
async def parse_file(file: UploadFile = File(...)):
    raw = json.loads(await file.read())
    metadata = parse_export(raw)
    return {
        "recent_count": len(metadata["recent"]),
        "baseline_count": len(metadata["baseline"]),
        "metadata": {
            "recent": [{**m, "timestamp": m["timestamp"].isoformat()} for m in metadata["recent"]],
            "baseline": [{**m, "timestamp": m["timestamp"].isoformat()} for m in metadata["baseline"]],
        },
    }


@app.get("/demo/{scenario}")
async def demo(scenario: str):
    if scenario not in ("healthy", "crisis"):
        return {"error": "scenario must be healthy or crisis"}
    metadata = load_sample(scenario)
    return {
        "metadata": {
            "recent": [{**m, "timestamp": m["timestamp"].isoformat()} for m in metadata["recent"]],
            "baseline": [{**m, "timestamp": m["timestamp"].isoformat()} for m in metadata["baseline"]],
        }
    }


@app.websocket("/ws/analyze")
async def websocket_analyze(ws: WebSocket):
    await handle(ws)


# ---------- scan history ----------

@app.post("/scans")
async def save_scan(body: dict, user=Depends(get_current_user)):
    """Saves a completed scan result for the authenticated user."""
    async with get_db() as db:
        await db.execute(
            "INSERT INTO scans (user_id, timestamp, risk_score, days_to_threshold, readings, source) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                user["id"],
                body.get("timestamp", datetime.now(timezone.utc).isoformat()),
                body.get("risk_score", 0),
                body.get("days_to_threshold"),
                json.dumps(body.get("readings", [])),
                body.get("source", "upload"),
            ),
        )
        await db.commit()
    return {"ok": True}


@app.get("/scans")
async def get_scans(user=Depends(get_current_user)):
    """Returns the authenticated user's full scan history."""
    async with get_db() as db:
        async with db.execute(
            "SELECT id, timestamp, risk_score, days_to_threshold, readings, source "
            "FROM scans WHERE user_id = ? ORDER BY timestamp DESC LIMIT 30",
            (user["id"],),
        ) as cur:
            rows = await cur.fetchall()

    return {
        "scans": [
            {
                "id": r["id"],
                "timestamp": r["timestamp"],
                "risk_score": r["risk_score"],
                "days_to_threshold": r["days_to_threshold"],
                "readings": json.loads(r["readings"]),
                "source": r["source"],
            }
            for r in rows
        ]
    }


# ---------- live monitoring ----------

@app.post("/ingest")
async def ingest(event: dict):
    ts_raw = event.get("timestamp")
    if ts_raw:
        try:
            ts = datetime.fromisoformat(str(ts_raw).replace("Z", "+00:00"))
        except ValueError:
            ts = datetime.now(timezone.utc)
    else:
        ts = datetime.now(timezone.utc)

    store.add(Event(type=event.get("type", "unknown"), timestamp=ts, data=event))
    return {"ok": True}


@app.websocket("/ws/live")
async def live_stream(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            await asyncio.sleep(5)
            await _push_live(ws)
    except (WebSocketDisconnect, Exception):
        pass


async def _push_live(ws: WebSocket):
    vitals = store.get_vitals()
    if vitals is None:
        await ws.send_text(json.dumps({"type": "waiting"}))
        return

    from analyzers.vitals_sensor import run as vitals_run
    readings = [vitals_run(vitals)]

    msg_count = store.message_count()
    if msg_count >= 10:
        from analyzers import timing, frequency, latency, social, volume
        metadata = store.get_message_metadata()
        loop = asyncio.get_event_loop()
        msg_readings = await asyncio.gather(
            loop.run_in_executor(None, timing, metadata),
            loop.run_in_executor(None, frequency, metadata),
            loop.run_in_executor(None, latency, metadata),
            loop.run_in_executor(None, social, metadata),
            loop.run_in_executor(None, volume, metadata),
        )
        readings.extend(msg_readings)

    from engine.anomaly_filter import filter_readings
    from engine.signal_fusion import fuse
    filtered = filter_readings(readings)
    risk_score = fuse(filtered)

    await ws.send_text(json.dumps({
        "type": "update",
        "readings": [
            {"label": r.label, "score": r.score, "finding": r.finding, "confidence": round(r.confidence, 2)}
            for r in readings
        ],
        "risk_score": risk_score,
        "vitals": {
            "mouse_velocity": vitals.get("mouse_velocity_px_s", 0),
            "key_rate": vitals.get("key_rate_per_min", 0),
            "idle_ratio": vitals.get("idle_ratio", 0),
        },
        "sources": {"activity": True, "discord": msg_count >= 10},
    }))


# ---------- counselor dashboard ----------

@app.get("/counselor-data")
async def counselor_data(user=Depends(optional_user)):
    """
    Returns per-user risk scores from saved scans.
    IDs are anonymized - counselors never see names.
    """
    now = datetime.now(timezone.utc)
    results = []

    async with get_db() as db:
        # Latest scan per user
        async with db.execute("""
            SELECT u.id, s.risk_score, s.days_to_threshold, s.timestamp
            FROM users u
            JOIN scans s ON u.id = s.user_id
            WHERE s.id = (
                SELECT id FROM scans s2 WHERE s2.user_id = u.id ORDER BY s2.timestamp DESC LIMIT 1
            )
            ORDER BY s.risk_score DESC
        """) as cur:
            rows = await cur.fetchall()

    for r in rows:
        ts_str = r["timestamp"]
        try:
            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except Exception:
            ts = now
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)

        secs = (now - ts).total_seconds()
        if secs < 60:
            last_active = "just now"
        elif secs < 3600:
            last_active = f"{int(secs/60)}m ago"
        elif secs < 86400:
            last_active = f"{int(secs/3600)}h ago"
        else:
            last_active = f"{int(secs/86400)}d ago"

        score = round(r["risk_score"])
        trend = "rising" if score >= 60 else "falling" if score < 30 else "stable"

        # Mark as current user if authenticated
        is_me = user is not None and user["id"] == r["id"]

        results.append({
            "id": _anon(r["id"]),
            "score": score,
            "trend": trend,
            "last_active": last_active,
            "days_to_threshold": r["days_to_threshold"],
            "is_live": False,
            "is_me": is_me,
        })

    # Prepend live session if activity monitor is running
    vitals = store.get_vitals()
    if vitals is not None:
        from analyzers.vitals_sensor import run as vitals_run
        from engine.anomaly_filter import filter_readings
        from engine.signal_fusion import fuse
        reading = vitals_run(vitals)
        filtered = filter_readings([reading])
        live_score = round(fuse(filtered))
        trend = "rising" if live_score >= 60 else "falling" if live_score < 30 else "stable"
        results.insert(0, {
            "id": "Live session",
            "score": live_score,
            "trend": trend,
            "last_active": "now",
            "days_to_threshold": max(1, round(30 - live_score * 0.28)) if live_score >= 60 else None,
            "is_live": True,
            "is_me": True,
        })

    return {"students": results, "has_discord": store.message_count() >= 3}


@app.get("/live-score")
async def live_score():
    vitals = store.get_vitals()
    if vitals is None:
        return {"score": None}
    from analyzers.vitals_sensor import run as vitals_run
    from engine.anomaly_filter import filter_readings
    from engine.signal_fusion import fuse
    reading = vitals_run(vitals)
    filtered = filter_readings([reading])
    return {"score": round(fuse(filtered))}


@app.get("/health")
async def health():
    return {"status": "ok"}
