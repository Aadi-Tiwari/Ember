from dataclasses import dataclass, field
from .zscore import daily_values, zscore_risk


@dataclass
class SensorReading:
    score: int
    finding: str
    confidence: float
    label: str = "Timing"
    zscore: float = 0.0


def _late_night_ratio(msgs: list) -> float:
    if not msgs:
        return 0.0
    late = sum(1 for m in msgs if m["timestamp"].hour >= 23 or m["timestamp"].hour <= 4)
    return late / len(msgs)


def run(metadata: dict) -> SensorReading:
    """
    Detects shift in messaging time toward late-night hours.
    Scores deviation from YOUR normal schedule, not a population threshold.
    Night-owl baseline? Late messages won't flag. Shift matters, not the hour.
    """
    recent = metadata["recent"]
    baseline = metadata["baseline"]

    bl_daily = daily_values(baseline, lambda kv: _late_night_ratio(kv[1]) if isinstance(kv, tuple) else _late_night_ratio(kv))
    cu_daily = daily_values(recent, lambda kv: _late_night_ratio(kv[1]) if isinstance(kv, tuple) else _late_night_ratio(kv))

    # Fallback to aggregate if no daily data
    if not bl_daily:
        bl_daily = [_late_night_ratio(baseline)]
    if not cu_daily:
        cu_daily = [_late_night_ratio(recent)]

    score, z = zscore_risk(bl_daily, cu_daily, higher_is_worse=True)
    confidence = min(len(baseline) / 50, 1.0)

    bl_mean = sum(bl_daily) / len(bl_daily) if bl_daily else 0
    cu_mean = sum(cu_daily) / len(cu_daily) if cu_daily else 0

    if score >= 70:
        finding = f"Sleep schedule shifted significantly - late-night messaging {cu_mean*100:.0f}% vs your baseline {bl_mean*100:.0f}% ({z:+.1f}σ)"
    elif score >= 40:
        finding = f"Mild circadian drift - late-night usage up from your baseline ({z:+.1f}σ)"
    else:
        finding = f"Sleep schedule consistent with your normal patterns ({z:+.1f}σ)"

    return SensorReading(score=score, finding=finding, confidence=confidence, label="Timing", zscore=z)
