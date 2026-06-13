import asyncio
import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from engine.event_store import store, Event
from db.database import init_db


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


@app.post("/ingest")
async def ingest(event: dict):
    """Receives vitals, emotion, and voice events from the browser."""
    ts_raw = event.get("timestamp")
    try:
        ts = datetime.fromisoformat(str(ts_raw).replace("Z", "+00:00")) if ts_raw else datetime.now(timezone.utc)
    except ValueError:
        ts = datetime.now(timezone.utc)
    store.add(Event(type=event.get("type", "unknown"), timestamp=ts, data=event))
    return {"ok": True}


@app.websocket("/ws/live")
async def live_stream(ws: WebSocket):
    """Pushes fused sensor analysis to the frontend every 4 seconds."""
    await ws.accept()
    try:
        while True:
            await asyncio.sleep(2)
            await _push(ws)
    except (WebSocketDisconnect, Exception):
        pass


async def _push(ws: WebSocket):
    if not store.any_data():
        await ws.send_text(json.dumps({"type": "waiting"}))
        return

    readings = []

    vitals = store.get_vitals()
    if vitals:
        from analyzers.vitals_sensor import run as vitals_run
        readings.append(vitals_run(vitals))

    emotion = store.get_emotion()
    if emotion:
        from analyzers.emotion_sensor import run as emotion_run
        readings.append(emotion_run(emotion))

    voice = store.get_voice()
    if voice:
        from analyzers.voice_sensor import run as voice_run
        readings.append(voice_run(voice))

    if not readings:
        return

    from engine.anomaly_filter import filter_readings
    from engine.signal_fusion import fuse
    filtered = filter_readings(readings)
    risk_score, attention_weights = fuse(filtered)

    await ws.send_text(json.dumps({
        "type": "update",
        "readings": [
            {
                "label": r.label,
                "score": r.score,
                "finding": r.finding,
                "confidence": round(r.confidence, 2),
                "zscore": round(getattr(r, "zscore", 0.0), 2),
            }
            for r in readings
        ],
        "risk_score": risk_score,
        "attention_weights": attention_weights,
        "sources": {
            "activity": vitals is not None,
            "emotion": emotion is not None,
            "voice": voice is not None,
        },
        "vitals": {
            "mouse_velocity": vitals.get("mouse_velocity_px_s", 0) if vitals else 0,
            "key_rate": vitals.get("key_rate_per_min", 0) if vitals else 0,
            "idle_ratio": vitals.get("idle_ratio", 0) if vitals else 0,
        },
    }))


@app.get("/counselor-data")
async def counselor_data():
    from db.database import get_db
    from engine.signal_fusion import fuse
    from engine.anomaly_filter import filter_readings
    import hashlib

    results = []
    now = datetime.now(timezone.utc)

    async with get_db() as db:
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
        try:
            ts = datetime.fromisoformat(r["timestamp"].replace("Z", "+00:00"))
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
        results.append({
            "id": hashlib.sha256(r["id"].encode()).hexdigest()[:8],
            "score": score,
            "trend": trend,
            "last_active": last_active,
            "days_to_threshold": r["days_to_threshold"],
            "is_live": False,
            "is_me": False,
        })

    vitals = store.get_vitals()
    if vitals:
        from analyzers.vitals_sensor import run as vr
        reading = vr(vitals)
        filtered = filter_readings([reading])
        live_score, _ = fuse(filtered)
        live_score = round(live_score)
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

    return {"students": results}


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "sensors": {
            "activity": store.get_vitals() is not None,
            "emotion": store.get_emotion() is not None,
            "voice": store.get_voice() is not None,
        },
    }
