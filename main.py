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
