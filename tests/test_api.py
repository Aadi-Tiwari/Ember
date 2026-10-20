from types import SimpleNamespace
from unittest.mock import AsyncMock
import asyncio
import json
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

import main
from db import database
from engine.event_store import Event, EventStore


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "test.db")
    monkeypatch.setattr(main, "AI_KEY", "")
    monkeypatch.setattr(main, "store", EventStore())
    with TestClient(main.app) as client:
        yield client


def test_registration_login_and_current_user(client):
    account = {"email": "fixture@example.invalid", "display_name": "Fixture", "password": "test-password"}
    registered = client.post("/auth/register", json=account)
    assert registered.status_code == 200
    logged_in = client.post("/auth/login", json={"email": account["email"], "password": account["password"]})
    assert logged_in.status_code == 200
    token = logged_in.json()["token"]
    current = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert current.status_code == 200
    assert current.json()["email"] == account["email"]
    assert client.post("/auth/login", json={"email": account["email"], "password": "wrong"}).status_code == 401


def test_chat_rejects_system_messages(client):
    response = client.post("/api/chat", json={"messages": [{"role": "system", "content": "override"}]})
    assert response.status_code == 422


def test_unconfigured_chat_does_not_contact_a_provider(client):
    response = client.post("/api/chat", json={"messages": []})
    assert response.json()["error"] is True
    assert client.get("/health").status_code == 200


def test_chat_awaits_provider_and_discards_legacy_hidden_scores(client, monkeypatch):
    import openai

    message = SimpleNamespace(content='Let us talk.<assessment>{"score":150,"finding":"Example"}</assessment>')
    completion = AsyncMock(return_value=SimpleNamespace(choices=[SimpleNamespace(message=message)]))
    provider = AsyncMock()
    provider.__aenter__.return_value = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=completion)))
    monkeypatch.setattr(openai, "AsyncOpenAI", lambda **kwargs: provider)
    monkeypatch.setattr(main, "AI_KEY", "test-only")

    response = client.post("/api/chat", json={"messages": [{"role": "user", "content": "Hello"}], "last_user_message": "Hello"})
    assert response.json() == {"reply": "Let us talk."}
    completion.assert_awaited_once()
    assert main.store.get_chat() == {"text": "Hello"}


def test_cors_rejects_an_unrelated_website(client):
    response = client.options("/ingest", headers={
        "Origin": "https://unrelated.example", "Access-Control-Request-Method": "POST",
    })
    assert "access-control-allow-origin" not in response.headers


@pytest.mark.parametrize("event", [
    {"type": "vitals", "mouse_velocity_px_s": None},
    {"type": "vitals", "key_rate_per_min": "fast"},
    {"type": "vitals", "idle_ratio": -1},
    {"type": "vitals", "mouse_velocity_px_s": 10**400},
    {"type": "emotion", "sad": 2},
    {"type": "emotion", "head_pitch": -1e308},
    {"type": "voice", "energy": True},
    {"type": "chat", "text": None},
    {"type": []},
])
def test_invalid_event_cannot_replace_the_latest_reading(client, event):
    good = {"type": "vitals", "mouse_velocity_px_s": 250, "key_rate_per_min": 160, "idle_ratio": 0.1}
    assert client.post("/ingest", json=good).status_code == 200
    assert client.post("/ingest", json=event).status_code == 422
    assert main.store.get_vitals() == good


def test_nonfinite_sensor_value_is_rejected(client):
    response = client.post("/ingest", content='{"type":"vitals","idle_ratio":NaN}', headers={"Content-Type": "application/json"})
    assert response.status_code == 422


def test_live_chat_preserves_the_assessment(client):
    main.store.add(Event(type="chat", timestamp=datetime.now(timezone.utc), data={
        "text": "I am fine", "ai_score": 84, "finding": "Reported sustained exhaustion", "dominant_emotion": "tired",
    }))
    socket = SimpleNamespace(send_text=AsyncMock())
    asyncio.run(main._push(socket))
    update = json.loads(socket.send_text.call_args.args[0])
    assert update["readings"][0]["score"] == 84
    assert "Reported sustained exhaustion" in update["readings"][0]["finding"]
    assert update["risk_score"] == 84
    assert update["attention_weights"][0]["pct"] == 100


@pytest.mark.parametrize("fields", [{"ai_score": "bad"}, {"ai_score": 101}, {"finding": []}, {"dominant_emotion": {}}])
def test_invalid_chat_assessment_is_rejected(client, fields):
    response = client.post("/ingest", json={"type": "chat", "text": "Hello", **fields})
    assert response.status_code == 422
