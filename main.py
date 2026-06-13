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
    ts_raw = event.get("timestamp")
    try:
        ts = datetime.fromisoformat(str(ts_raw).replace("Z", "+00:00")) if ts_raw else datetime.now(timezone.utc)
    except ValueError:
        ts = datetime.now(timezone.utc)
    store.add(Event(type=event.get("type", "unknown"), timestamp=ts, data=event))
    return {"ok": True}


@app.websocket("/ws/live")
async def live_stream(ws: WebSocket):
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

    chat = store.get_chat()
    if chat and chat.get("text"):
        from analyzers.sentiment_sensor import run as sentiment_run
        readings.append(sentiment_run(chat["text"]))

    if not readings:
        return

    from engine.anomaly_filter import filter_readings
    from engine.signal_fusion import fuse
    filtered      = filter_readings(readings)
    risk_score, attention_weights = fuse(filtered)

    await ws.send_text(json.dumps({
        "type": "update",
        "readings": [
            {
                "label":      r.label,
                "score":      r.score,
                "finding":    r.finding,
                "confidence": round(r.confidence, 2),
                "zscore":     round(getattr(r, "zscore", 0.0), 2),
            }
            for r in readings
        ],
        "risk_score":       risk_score,
        "attention_weights": attention_weights,
        "sources": {
            "activity": vitals   is not None,
            "emotion":  emotion  is not None,
            "voice":    voice    is not None,
            "chat":     chat     is not None,
        },
        "vitals": {
            "mouse_velocity": vitals.get("mouse_velocity_px_s", 0) if vitals else 0,
            "key_rate":       vitals.get("key_rate_per_min", 0)    if vitals else 0,
            "idle_ratio":     vitals.get("idle_ratio", 0)           if vitals else 0,
        },
    }))


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "sensors": {
            "activity": store.get_vitals()  is not None,
            "emotion":  store.get_emotion() is not None,
            "voice":    store.get_voice()   is not None,
            "chat":     store.get_chat()    is not None,
        },
    }
