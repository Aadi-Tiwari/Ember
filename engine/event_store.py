from dataclasses import dataclass
from datetime import datetime, timezone
from threading import RLock
from typing import Optional
from time import monotonic
from uuid import uuid4


@dataclass
class Event:
    type: str
    timestamp: datetime
    data: dict


class EventStore:
    def __init__(self):
        self._latest_vitals:   Optional[dict]  = None
        self._latest_emotion:  Optional[dict]  = None
        self._latest_voice:    Optional[dict]  = None
        self._latest_chat:     Optional[dict]  = None
        self._lock = RLock()
        self._received: dict[str, tuple[float, str]] = {}
        self._contexts: dict[str, tuple[float, dict]] = {}
        self.generation = 0

    def add(self, event: Event, generation: int | None = None) -> None:
        with self._lock:
            if generation is not None and generation != self.generation:
                return
            self._received[event.type] = (monotonic(), datetime.now(timezone.utc).isoformat())
            if   event.type == "vitals":  self._latest_vitals  = event.data
            elif event.type == "emotion": self._latest_emotion = event.data
            elif event.type == "voice":   self._latest_voice   = event.data
            elif event.type == "chat":    self._latest_chat    = event.data

    def snapshot(self) -> dict:
        with self._lock:
            now = monotonic()
            latest = {"vitals": self._latest_vitals, "emotion": self._latest_emotion,
                      "voice": self._latest_voice, "chat": self._latest_chat}
            return {
                source: {"data": dict(data), "received_at": self._received[source][1]}
                for source, data in latest.items()
                if data and now - self._received[source][0] <= (900 if source == "chat" else 30)
            }

    def clear(self) -> None:
        with self._lock:
            self._received.clear()
            self._contexts.clear()
            self.generation += 1
            self._latest_vitals = self._latest_emotion = self._latest_voice = self._latest_chat = None

    def capture_context(self) -> tuple[str, dict]:
        with self._lock:
            now = monotonic()
            self._contexts = {key: value for key, value in self._contexts.items() if now - value[0] < 900}
            if len(self._contexts) >= 10:
                del self._contexts[next(iter(self._contexts))]
            context_id = str(uuid4())
            snapshot = self.snapshot()
            self._contexts[context_id] = (now, snapshot)
            return context_id, snapshot

    def get_context(self, context_id: str) -> dict:
        with self._lock:
            captured = self._contexts.get(context_id)
            if captured is None or monotonic() - captured[0] >= 900:
                raise ValueError("The session snapshot expired. Refresh the check-in to capture it again.")
            return captured[1]

    def get_vitals(self) -> Optional[dict]:
        return self.snapshot().get("vitals", {}).get("data")

    def get_emotion(self) -> Optional[dict]:
        return self.snapshot().get("emotion", {}).get("data")

    def get_voice(self) -> Optional[dict]:
        return self.snapshot().get("voice", {}).get("data")

    def get_chat(self) -> Optional[dict]:
        return self.snapshot().get("chat", {}).get("data")

    def any_data(self) -> bool:
        return bool(self.snapshot())


store = EventStore()
