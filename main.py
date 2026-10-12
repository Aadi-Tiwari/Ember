import asyncio
import json
import math
import os
import re
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Literal

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from engine.event_store import store, Event
from db.database import init_db

# Load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Supports Groq (free), OpenAI, or any OpenAI-compatible provider
# Priority: GROQ_API_KEY > OPENAI_API_KEY
GROQ_KEY    = os.getenv("GROQ_API_KEY", "")
OPENAI_KEY  = os.getenv("OPENAI_API_KEY", "")
AI_KEY      = GROQ_KEY or OPENAI_KEY
AI_BASE_URL = "https://api.groq.com/openai/v1" if GROQ_KEY else "https://api.openai.com/v1"
AI_MODEL    = "openai/gpt-oss-120b" if GROQ_KEY else "gpt-4o-mini"

AI_SYSTEM = """You are Ember, a compassionate mental wellness companion inside Ember - a burnout early detection app.

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


app = FastAPI(title="Ember", lifespan=lifespan)

from auth.router import router as auth_router

app.include_router(auth_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/ingest")
async def ingest(event: dict):
    sensor_fields = {
        "vitals": {"mouse_velocity_px_s": (0, None), "key_rate_per_min": (0, None), "idle_ratio": (0, 1)},
        "emotion": {**{key: (0, 1) for key in ("happy", "sad", "angry", "fearful", "disgusted", "neutral", "eye_openness", "perclos")}, "head_pitch": (-180, 180)},
        "voice": {**{key: (0, 1) for key in ("energy", "cadence", "pitch_variation", "jitter", "spectral_centroid")}, "pitch_hz": (-1, None)},
        "chat": {},
    }
    event_type = event.get("type")
    if not isinstance(event_type, str) or event_type not in sensor_fields:
        raise HTTPException(422, "Unsupported event type")
    for field, (minimum, maximum) in sensor_fields[event_type].items():
        if field not in event:
            continue
        value = event[field]
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise HTTPException(422, f"Invalid sensor value: {field}")
        try:
            finite = math.isfinite(value)
        except OverflowError:
            finite = False
        if (not finite
                or (minimum is not None and value < minimum) or (maximum is not None and value > maximum)):
            raise HTTPException(422, f"Invalid sensor value: {field}")
    if event_type == "chat" and not isinstance(event.get("text", ""), str):
        raise HTTPException(422, "Chat text must be a string")
    ts_raw = event.get("timestamp")
    try:
        ts = datetime.fromisoformat(str(ts_raw).replace("Z", "+00:00")) if ts_raw else datetime.now(timezone.utc)
    except ValueError:
        ts = datetime.now(timezone.utc)
    store.add(Event(type=event_type, timestamp=ts, data=event))
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


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class ChatBody(BaseModel):
    messages: list[ChatMessage] = Field(default_factory=list)
    last_user_message: str = ""


@app.post("/api/chat")
async def ai_chat(body: ChatBody):
    """AI wellness chat - works with Groq (free) or OpenAI."""
    if not AI_KEY:
        return {
            "reply": "Chat is unavailable right now. You can continue using the activity dashboard.",
            "error": True,
        }

    messages = [message.model_dump() for message in body.messages]
    # Seed with a system-level greeting trigger if conversation is empty
    api_messages = messages if messages else [{"role": "user", "content": "begin"}]

    try:
        from openai import AsyncOpenAI
        async with AsyncOpenAI(api_key=AI_KEY, base_url=AI_BASE_URL, timeout=20) as client:
            response = await client.chat.completions.create(
                model=AI_MODEL,
                max_completion_tokens=2048,
                messages=[{"role": "system", "content": AI_SYSTEM}] + api_messages,
            )
        raw = response.choices[0].message.content or ""

        # Strip <assessment> block before sending to user
        match = re.search(r"<assessment>(.*?)</assessment>", raw, re.DOTALL)
        reply = re.sub(r"<assessment>.*?</assessment>", "", raw, flags=re.DOTALL).strip()

        if match:
            try:
                assessment = json.loads(match.group(1).strip())
                store.add(Event(
                    type="chat",
                    timestamp=datetime.now(timezone.utc),
                    data={
                        "text":             body.last_user_message,
                        "ai_score":         max(0, min(100, int(assessment.get("score", 50)))),
                        "finding":          assessment.get("finding", ""),
                        "dominant_emotion": assessment.get("dominant_emotion", ""),
                    },
                ))
            except Exception:
                pass

        return {"reply": reply or "I'm here for you. How are you feeling?"}

    except Exception:
        return {"reply": "Chat could not respond. Please try again shortly.", "error": True}


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
