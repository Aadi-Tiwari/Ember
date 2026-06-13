from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
from threading import Lock
from typing import Optional


@dataclass
class Event:
    type: str
    timestamp: datetime
    data: dict


class EventStore:
    def __init__(self, max_events: int = 50_000):
        self._events:          deque[Event]    = deque(maxlen=max_events)
        self._latest_vitals:   Optional[dict]  = None
        self._latest_emotion:  Optional[dict]  = None
        self._latest_voice:    Optional[dict]  = None
        self._latest_chat:     Optional[dict]  = None
        self._lock = Lock()

    def add(self, event: Event) -> None:
        with self._lock:
            self._events.append(event)
            if   event.type == "vitals":  self._latest_vitals  = event.data
            elif event.type == "emotion": self._latest_emotion = event.data
            elif event.type == "voice":   self._latest_voice   = event.data
            elif event.type == "chat":    self._latest_chat    = event.data

    def get_vitals(self)  -> Optional[dict]: return self._latest_vitals
    def get_emotion(self) -> Optional[dict]: return self._latest_emotion
    def get_voice(self)   -> Optional[dict]: return self._latest_voice
    def get_chat(self)    -> Optional[dict]: return self._latest_chat

    def any_data(self) -> bool:
        with self._lock:
            return any([
                self._latest_vitals, self._latest_emotion,
                self._latest_voice,  self._latest_chat,
            ])


store = EventStore()
