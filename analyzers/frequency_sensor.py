from dataclasses import dataclass
from collections import Counter
from .zscore import zscore_risk


@dataclass
class SensorReading:
    score: int
    finding: str
    confidence: float
    label: str = "Frequency"
    zscore: float = 0.0


def run(metadata: dict) -> SensorReading:
    """
    Measures sustained dropoff in daily messaging activity.
    Scores against YOUR normal output volume - a quiet person who gets quieter is the signal.
    """
    recent = metadata["recent"]
    baseline = metadata["baseline"]

    recent_by_day = Counter(m["timestamp"].date() for m in recent)
    baseline_by_day = Counter(m["timestamp"].date() for m in baseline)

    bl_daily = list(baseline_by_day.values())
    cu_daily = list(recent_by_day.values())

    if not bl_daily or not cu_daily:
        return SensorReading(score=0, finding="Insufficient data", confidence=0.0, label="Frequency", zscore=0.0)

    score, z = zscore_risk(bl_daily, cu_daily, higher_is_worse=False)
    confidence = min(len(baseline_by_day) / 10, 1.0)

    bl_avg = sum(bl_daily) / len(bl_daily)
    cu_avg = sum(cu_daily) / len(cu_daily)

    if score >= 70:
        finding = f"Activity dropped sharply - {cu_avg:.0f} msgs/day vs your baseline {bl_avg:.0f} ({z:+.1f}σ)"
    elif score >= 40:
        finding = f"Moderate activity decline from your baseline ({z:+.1f}σ)"
    else:
        finding = f"Messaging frequency consistent with your baseline ({z:+.1f}σ)"

    return SensorReading(score=score, finding=finding, confidence=confidence, label="Frequency", zscore=z)
