import asyncio
import json
from datetime import datetime, timezone

from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from data.parser import parse_export, load_sample
from api.stream import handle
from engine.event_store import store, Event

app = FastAPI(title="PulseCheck")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- existing batch endpoints ----------

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


# ---------- live monitoring endpoints ----------

@app.post("/ingest")
async def ingest(event: dict):
    """Receives events from the activity monitor and Discord bot."""
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
    """
    Pushes current analysis to the frontend every 5 seconds.
    Runs vitals sensor immediately when data arrives, adds message sensors
    once enough Discord data has accumulated.
    """
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
        await ws.send_text(json.dumps({
            "type": "waiting",
            "message": "Waiting for activity monitor...",
        }))
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
            {
                "label": r.label,
                "score": r.score,
                "finding": r.finding,
                "confidence": round(r.confidence, 2),
            }
            for r in readings
        ],
        "risk_score": risk_score,
        "vitals": {
            "mouse_velocity": vitals.get("mouse_velocity_px_s", 0),
            "key_rate": vitals.get("key_rate_per_min", 0),
            "idle_ratio": vitals.get("idle_ratio", 0),
        },
        "sources": {
            "activity": True,
            "discord": msg_count >= 10,
        },
    }))


@app.get("/health")
async def health():
    return {"status": "ok", "events": store.message_count(), "vitals": store.get_vitals() is not None}


@app.get("/counselor-data")
async def counselor_data():
    """
    Groups ingested message events by author_hash and runs per-author analysis.
    Returns real behavioral risk scores - no hardcoded data.
    If Discord bot is connected, each person in the server appears as a row.
    """
    from collections import defaultdict
    from analyzers import timing, frequency, volume
    from engine.anomaly_filter import filter_readings
    from engine.signal_fusion import fuse

    by_author = store.get_messages_by_author()
    now = datetime.now(timezone.utc)
    results = []

    for author, data in by_author.items():
        if len(data["recent"]) < 3 and len(data["baseline"]) < 3:
            continue

        metadata = {"recent": data["recent"], "baseline": data["baseline"]}
        loop = asyncio.get_event_loop()
        readings = list(await asyncio.gather(
            loop.run_in_executor(None, timing, metadata),
            loop.run_in_executor(None, frequency, metadata),
            loop.run_in_executor(None, volume, metadata),
        ))

        filtered = filter_readings(readings)
        risk_score = round(fuse(filtered))

        ls: datetime = data["last_seen"]
        if ls.tzinfo is None:
            ls = ls.replace(tzinfo=timezone.utc)
        delta = now - ls
        secs = delta.total_seconds()
        if secs < 60:
            last_active = "just now"
        elif secs < 3600:
            last_active = f"{int(secs / 60)}m ago"
        elif secs < 86400:
            last_active = f"{int(secs / 3600)}h ago"
        else:
            last_active = f"{int(delta.days)}d ago"

        trend = "rising" if risk_score >= 60 else "falling" if risk_score < 30 else "stable"

        results.append({
            "id": author[:8],
            "score": risk_score,
            "trend": trend,
            "last_active": last_active,
            "days_to_threshold": max(1, round(30 - risk_score * 0.28)) if risk_score >= 60 else None,
        })

    # Sort by risk score descending
    results.sort(key=lambda r: r["score"], reverse=True)

    # Prepend live user if vitals exist
    vitals = store.get_vitals()
    if vitals:
        from analyzers.vitals_sensor import run as vitals_run
        reading = vitals_run(vitals)
        filtered = filter_readings([reading])
        live_score = round(fuse(filtered))
        trend = "rising" if live_score >= 60 else "falling" if live_score < 30 else "stable"
        results.insert(0, {
            "id": "You (live)",
            "score": live_score,
            "trend": trend,
            "last_active": "now",
            "days_to_threshold": max(1, round(30 - live_score * 0.28)) if live_score >= 60 else None,
            "is_live": True,
        })

    return {
        "students": results,
        "has_discord": store.message_count() >= 3,
    }


@app.get("/live-score")
async def live_score():
    """Returns the latest risk score from the event store for the counselor view."""
    vitals = store.get_vitals()
    if vitals is None:
        return {"score": None, "sources": {"activity": False, "discord": False}}

    from analyzers.vitals_sensor import run as vitals_run
    reading = vitals_run(vitals)

    from engine.anomaly_filter import filter_readings
    from engine.signal_fusion import fuse
    filtered = filter_readings([reading])
    risk_score = fuse(filtered)

    return {
        "score": risk_score,
        "sources": {"activity": True, "discord": store.message_count() >= 10},
    }
