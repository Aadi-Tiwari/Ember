from dataclasses import dataclass
from collections import defaultdict
from .zscore import zscore_risk


@dataclass
class SensorReading:
    score: int
    finding: str
    confidence: float
    label: str = "Social Graph"
    zscore: float = 0.0


def _weekly_channel_counts(msgs: list) -> list[int]:
    """Returns unique channel count per 7-day window."""
    if not msgs:
        return []
    by_week: dict = defaultdict(set)
    for m in msgs:
        week = m["timestamp"].isocalendar()[1]
        by_week[week].add(m["channel_hash"])
    return [len(v) for v in by_week.values()]


def run(metadata: dict) -> SensorReading:
    """
    Tracks contraction of unique conversations relative to YOUR baseline.
    An introvert's small social graph won't flag - only shrinkage matters.
    """
    recent = metadata["recent"]
    baseline = metadata["baseline"]

    bl_weekly = _weekly_channel_counts(baseline)
    cu_weekly = _weekly_channel_counts(recent)

    recent_channels = len(set(m["channel_hash"] for m in recent))
    baseline_channels = len(set(m["channel_hash"] for m in baseline))

    if not bl_weekly or not cu_weekly:
        return SensorReading(score=0, finding="Insufficient baseline data", confidence=0.0, label="Social Graph", zscore=0.0)

    score, z = zscore_risk(bl_weekly, cu_weekly, higher_is_worse=False)
    confidence = min(baseline_channels / 5, 1.0)

    if score >= 70:
        finding = f"Social circle shrank from {baseline_channels} to {recent_channels} active conversations ({z:+.1f}σ below your baseline)"
    elif score >= 40:
        finding = f"Moderate social withdrawal from your baseline ({z:+.1f}σ)"
    else:
        finding = f"Social engagement consistent with your normal patterns ({z:+.1f}σ)"

    return SensorReading(score=score, finding=finding, confidence=confidence, label="Social Graph", zscore=z)
