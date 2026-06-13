from dataclasses import dataclass
from collections import defaultdict
from .zscore import zscore_risk


@dataclass
class SensorReading:
    score: int
    finding: str
    confidence: float
    label: str = "Volume"
    zscore: float = 0.0


def _daily_avg_chars(msgs: list) -> list[float]:
    """Average message length per day."""
    by_day: dict = defaultdict(list)
    for m in msgs:
        by_day[m["timestamp"].date()].append(m["char_count"])
    return [sum(v) / len(v) for v in by_day.values() if v]


def run(metadata: dict) -> SensorReading:
    """
    Measures compression in average message length vs YOUR baseline.
    Naturally terse writers won't flag - only YOUR shift toward shorter messages matters.
    """
    recent = metadata["recent"]
    baseline = metadata["baseline"]

    if not recent or not baseline:
        return SensorReading(score=0, finding="Insufficient data", confidence=0.0, label="Volume", zscore=0.0)

    bl_daily = _daily_avg_chars(baseline)
    cu_daily = _daily_avg_chars(recent)

    if not bl_daily or not cu_daily:
        return SensorReading(score=0, finding="Insufficient data", confidence=0.0, label="Volume", zscore=0.0)

    score, z = zscore_risk(bl_daily, cu_daily, higher_is_worse=False)
    confidence = min(len(recent) / 30, 1.0)

    bl_avg = sum(bl_daily) / len(bl_daily)
    cu_avg = sum(cu_daily) / len(cu_daily)
    short_pct = int(sum(1 for m in recent if m["char_count"] <= 5) / max(len(recent), 1) * 100)

    if score >= 70:
        finding = f"Message length dropped to {cu_avg:.0f} chars vs your baseline {bl_avg:.0f} chars ({z:+.1f}σ)"
    elif score >= 40:
        finding = f"Messages getting shorter from your baseline ({z:+.1f}σ)"
    else:
        finding = f"Message length consistent with your normal style ({z:+.1f}σ)"

    return SensorReading(score=score, finding=finding, confidence=confidence, label="Volume", zscore=z)
