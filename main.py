import asyncio
import json
import os
import re
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from engine.event_store import store, Event
from db.database import init_db

# Load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")

AI_SYSTEM = """You are Pulse, a compassionate mental wellness companion inside PulseCheck - a burnout early detection app.

Your goals:
- Create a safe, non-judgmental space for the user to express how they truly feel
- Ask thoughtful follow-up questions about sleep, stress, workload, motivation, and mood
- Offer brief, practical support: breathing exercises, perspective shifts, small concrete steps
- Be warm, human, and genuinely curious - never clinical or robotic

Rules:
- Keep replies to 2-4 sentences maximum. Be concise.
- You are NOT a therapist. For serious concerns, recommend "988 Lifeline" or a counselor.
- Never be dismissive of how they feel.

After EVERY reply, you MUST append this exact block (it will be stripped before the user sees it):
<assessment>{"score": 0-100, "finding": "one short sentence", "dominant_emotion": "one word"}</assessment>

Score meaning: 0-29 = healthy, 30-59 = mild stress, 60-79 = high stress/burnout, 80-100 = critical.
Base score on: negative language, hopelessness, exhaustion, overwhelm, sleep issues, social withdrawal.

Start the very first message by warmly greeting the user and asking ONE open-ended question about how they are doing today."""


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


@app.post("/api/chat")
async def ai_chat(body: dict):
    """AI wellness chat powered by Claude. Replies + scores emotional state."""
    if not ANTHROPIC_KEY:
        return {"reply": "AI chat requires an ANTHROPIC_API_KEY in your .env file.", "error": True}

    messages = body.get("messages", [])

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=400,
            system=AI_SYSTEM,
            messages=messages if messages else [{"role": "user", "content": "hello"}],
        )
        raw = response.content[0].text

        # Extract assessment block
        match = re.search(r"<assessment>(.*?)</assessment>", raw, re.DOTALL)
        reply = re.sub(r"<assessment>.*?</assessment>", "", raw, flags=re.DOTALL).strip()

        if match:
            try:
                assessment = json.loads(match.group(1).strip())
                store.add(Event(
                    type="chat",
                    timestamp=datetime.now(timezone.utc),
                    data={
                        "text":             body.get("last_user_message", ""),
                        "ai_score":         int(assessment.get("score", 50)),
                        "finding":          assessment.get("finding", ""),
                        "dominant_emotion": assessment.get("dominant_emotion", ""),
                    },
                ))
            except Exception:
                pass

        return {"reply": reply or "I'm here for you. How are you feeling?"}

    except Exception as exc:
        return {"reply": "Something went wrong connecting to the AI. Check your API key.", "error": True}


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
