"""
Activity Monitor - run this in a separate terminal.

Tracks mouse velocity, typing cadence, and idle time using pynput.
Sends vitals to the PulseCheck backend every 10 seconds.
No keystrokes are recorded - only timing/frequency.

Usage:
    python monitor/activity_monitor.py
"""
import math
import time
from collections import deque
from datetime import datetime, timezone
from threading import Lock

import requests
from pynput import keyboard, mouse

API_URL = "http://localhost:8000/ingest"
SEND_INTERVAL = 8  # seconds between vitals pushes


class ActivityTracker:
    def __init__(self):
        self._lock = Lock()
        self._mouse_positions: deque = deque()  # (ts, x, y)
        self._clicks: deque = deque()           # ts
        self._key_events: deque = deque()       # ts
        self._last_activity: float = time.time()

    def on_move(self, x, y):
        now = time.time()
        with self._lock:
            self._mouse_positions.append((now, x, y))
            self._last_activity = now
            cutoff = now - 120
            while self._mouse_positions and self._mouse_positions[0][0] < cutoff:
                self._mouse_positions.popleft()

    def on_click(self, x, y, button, pressed):
        if pressed:
            now = time.time()
            with self._lock:
                self._clicks.append(now)
                self._last_activity = now
                cutoff = now - 300
                while self._clicks and self._clicks[0] < cutoff:
                    self._clicks.popleft()

    def on_press(self, key):
        now = time.time()
        with self._lock:
            self._key_events.append(now)
            self._last_activity = now
            cutoff = now - 300
            while self._key_events and self._key_events[0] < cutoff:
                self._key_events.popleft()

    def get_vitals(self) -> dict:
        now = time.time()
        with self._lock:
            # Mouse velocity: pixels/second over last 60 seconds
            recent = [(t, x, y) for t, x, y in self._mouse_positions if t > now - 60]
            velocity = 0.0
            if len(recent) >= 2:
                total_dist = sum(
                    math.hypot(recent[i][1] - recent[i-1][1], recent[i][2] - recent[i-1][2])
                    for i in range(1, len(recent))
                )
                span = recent[-1][0] - recent[0][0]
                velocity = total_dist / span if span > 0 else 0.0

            # Click rate per minute (5-min window)
            clicks = [t for t in self._clicks if t > now - 300]
            click_rate = len(clicks) / 5.0

            # Key rate per minute (5-min window)
            keys = [t for t in self._key_events if t > now - 300]
            key_rate = len(keys) / 5.0

            # Idle: seconds since last activity, capped at 300
            idle_secs = min(now - self._last_activity, 300)
            idle_ratio = idle_secs / 300.0

        return {
            "type": "vitals",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "mouse_velocity_px_s": round(velocity, 1),
            "click_rate_per_min": round(click_rate, 1),
            "key_rate_per_min": round(key_rate, 1),
            "idle_ratio": round(idle_ratio, 3),
        }


def main():
    tracker = ActivityTracker()

    mouse_listener = mouse.Listener(on_move=tracker.on_move, on_click=tracker.on_click)
    kb_listener = keyboard.Listener(on_press=tracker.on_press)

    mouse_listener.start()
    kb_listener.start()

    print(f"[PulseCheck] Activity monitor running. Sending to {API_URL} every {SEND_INTERVAL}s")
    print("[PulseCheck] Move your mouse or type to generate data. Ctrl+C to stop.\n")

    while True:
        time.sleep(SEND_INTERVAL)
        v = tracker.get_vitals()
        try:
            requests.post(API_URL, json=v, timeout=3)
            print(
                f"  mouse={v['mouse_velocity_px_s']:.0f}px/s  "
                f"keys={v['key_rate_per_min']:.0f}/min  "
                f"idle={v['idle_ratio']*100:.0f}%"
            )
        except Exception as e:
            print(f"  [warn] send failed: {e}")


if __name__ == "__main__":
    main()
