from dataclasses import dataclass
from statistics import median
from collections import defaultdict
from .zscore import zscore_risk


@dataclass
class SensorReading:
    score: int
    finding: str
    confidence: float
    label: str = "Latency"
    zscore: float = 0.0


def _median_gap_by_day(msgs: list) -> dict:
    """Returns {date: median_gap_seconds} for each day."""
    by_channel: dict = defaultdict(list)
    for m in msgs:
        by_channel[m["channel_hash"]].append(m["timestamp"])

    gaps_by_day: dict = defaultdict(list)
    for timestamps in by_channel.values():
        for i in range(1, len(sorted(timestamps))):
            sorted_ts = sorted(timestamps)
            gap = (sorted_ts[i] - sorted_ts[i - 1]).total_seconds()
            if 0 < gap < 86400:
                gaps_by_day[sorted_ts[i].date()].append(gap)

    return {d: median(g) for d, g in gaps_by_day.items() if g}


def run(metadata: dict) -> SensorReading:
    """
    Measures increase in response latency vs YOUR personal baseline.
    Naturally slow responders won't trigger - only YOUR slowdown matters.
    """
    recent = metadata["recent"]
    baseline = metadata["baseline"]

    bl_by_day = _median_gap_by_day(baseline)
    cu_by_day = _median_gap_by_day(recent)

    if not bl_by_day or not cu_by_day:
        return SensorReading(score=0, finding="Insufficient data for latency analysis", confidence=0.0, label="Latency", zscore=0.0)

    bl_daily = list(bl_by_day.values())
    cu_daily = list(cu_by_day.values())

    score, z = zscore_risk(bl_daily, cu_daily, higher_is_worse=True)
    confidence = min(len(cu_daily) / 7, 1.0)

    cu_med_min = int(median(cu_daily) / 60)
    bl_med_min = int(median(bl_daily) / 60)

    if score >= 70:
        finding = f"Response time jumped to {cu_med_min}m vs your baseline {bl_med_min}m ({z:+.1f}σ)"
    elif score >= 40:
        finding = f"Replies slowing down from your normal pace ({z:+.1f}σ)"
    else:
        finding = f"Response times consistent with your baseline ({z:+.1f}σ)"

    return SensorReading(score=score, finding=finding, confidence=confidence, label="Latency", zscore=z)
