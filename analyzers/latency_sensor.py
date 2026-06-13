from dataclasses import dataclass
from statistics import median


@dataclass
class SensorReading:
    score: int
    finding: str
    confidence: float
    label: str = "Latency"


def _reply_gaps(msgs: list) -> list[float]:
    """Calculates time gaps between messages in the same channel (reply proxy)."""
    by_channel: dict = {}
    for m in msgs:
        ch = m["channel_hash"]
        if ch not in by_channel:
            by_channel[ch] = []
        by_channel[ch].append(m["timestamp"])

    gaps = []
    for timestamps in by_channel.values():
        sorted_ts = sorted(timestamps)
        for i in range(1, len(sorted_ts)):
            gap = (sorted_ts[i] - sorted_ts[i - 1]).total_seconds()
            if 0 < gap < 86400:
                gaps.append(gap)

    return gaps


def run(metadata: dict) -> SensorReading:
    """
    Measures increase in response latency as a proxy for social withdrawal.
    Slowing down before replying signals cognitive fatigue and disengagement.
    """
    recent_gaps = _reply_gaps(metadata["recent"])
    baseline_gaps = _reply_gaps(metadata["baseline"])

    if not baseline_gaps or not recent_gaps:
        return SensorReading(score=0, finding="Insufficient data for latency analysis", confidence=0.0, label="Latency")

    recent_med = median(recent_gaps)
    baseline_med = median(baseline_gaps)

    increase = (recent_med - baseline_med) / max(baseline_med, 1)
    score = min(max(int(increase * 60), 0), 100)
    confidence = min(len(recent_gaps) / 20, 1.0)

    recent_min = int(recent_med / 60)

    if score >= 70:
        finding = f"Reply time increased {int(increase * 100)}% - averaging {recent_min} minutes per response"
    elif score >= 40:
        finding = f"Moderate latency increase - responses taking {recent_min} minutes on average"
    else:
        finding = "Response times are consistent with your normal patterns"

    return SensorReading(score=score, finding=finding, confidence=confidence, label="Latency")
