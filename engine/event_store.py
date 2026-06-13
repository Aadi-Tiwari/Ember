"""
In-memory rolling event buffer.
Accepts events from the activity monitor and Discord bot,
provides rolling 14/28-day windows for the existing analyzers.
"""
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Optional


@dataclass
class Event:
    type: str
    timestamp: datetime
    data: dict


class EventStore:
    def __init__(self, max_events: int = 100_000):
        self._events: deque[Event] = deque(maxlen=max_events)
        self._latest_vitals: Optional[dict] = None
        self._lock = Lock()

    def add(self, event: Event) -> None:
        with self._lock:
            self._events.append(event)
            if event.type == "vitals":
                self._latest_vitals = event.data

    def get_vitals(self) -> Optional[dict]:
        with self._lock:
            return self._latest_vitals

    def get_message_metadata(self) -> dict:
        """
        Returns message events as the metadata dict expected by the existing analyzers.
        recent = last 14 days, baseline = 14-28 days ago.
        """
        now = datetime.now(timezone.utc)
        recent_cutoff = now - timedelta(days=14)
        baseline_cutoff = now - timedelta(days=28)

        with self._lock:
            messages = [e for e in self._events if e.type == "message"]

        recent, baseline = [], []
        for e in messages:
            ts = e.timestamp
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            entry = {**e.data, "timestamp": ts}
            if ts >= recent_cutoff:
                recent.append(entry)
            elif ts >= baseline_cutoff:
                baseline.append(entry)

        return {"recent": recent, "baseline": baseline}

    def message_count(self) -> int:
        with self._lock:
            return sum(1 for e in self._events if e.type == "message")

    def get_messages_by_author(self) -> dict:
        """
        Groups message events by author_hash.
        Returns {author_hash: {recent: [...], baseline: [...], last_seen: datetime}}
        Used by the counselor dashboard to show per-user risk scores.
        """
        now = datetime.now(timezone.utc)
        recent_cutoff = now - timedelta(days=14)
        baseline_cutoff = now - timedelta(days=28)

        with self._lock:
            messages = [e for e in self._events if e.type == "message"]

        by_author: dict = {}
        for e in messages:
            ts = e.timestamp
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)

            author = e.data.get("author_hash", "unknown")
            if author not in by_author:
                by_author[author] = {"recent": [], "baseline": [], "last_seen": ts}

            if ts > by_author[author]["last_seen"]:
                by_author[author]["last_seen"] = ts

            entry = {**e.data, "timestamp": ts}
            if ts >= recent_cutoff:
                by_author[author]["recent"].append(entry)
            elif ts >= baseline_cutoff:
                by_author[author]["baseline"].append(entry)

        return by_author


store = EventStore()
