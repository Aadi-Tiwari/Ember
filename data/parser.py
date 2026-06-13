import json
import hashlib
from datetime import datetime, timezone


def parse_export(raw: dict) -> dict:
    """
    Strips all message content. Keeps only behavioral metadata.
    Returns two 14-day windows for drift comparison.
    """
    messages = []

    for msg in raw.get("messages", []):
        content = msg.get("content", "")
        ts_raw = msg.get("timestamp", "")

        try:
            ts = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
        except Exception:
            continue

        messages.append({
            "timestamp": ts,
            "char_count": len(content),
            "is_reply": msg.get("referenced_message") is not None,
            "author_hash": hashlib.md5(
                msg.get("author", {}).get("id", "").encode()
            ).hexdigest()[:8],
            "channel_hash": hashlib.md5(
                msg.get("channel_id", "").encode()
            ).hexdigest()[:8],
        })

    now = datetime.now(timezone.utc)

    recent = [m for m in messages if (now - m["timestamp"]).days <= 14]
    baseline = [m for m in messages if 14 < (now - m["timestamp"]).days <= 28]

    return {"recent": recent, "baseline": baseline}


def load_sample(name: str) -> dict:
    """Loads pre-built demo scenario (healthy or crisis)."""
    import os
    path = os.path.join(os.path.dirname(__file__), f"sample_{name}.json")
    with open(path) as f:
        return parse_export(json.load(f))
