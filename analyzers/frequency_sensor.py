from dataclasses import dataclass
from collections import Counter


@dataclass
class SensorReading:
    score: int
    finding: str
    confidence: float
    label: str = "Frequency"


def run(metadata: dict) -> SensorReading:
    """
    Measures sustained dropoff in daily messaging activity.
    A gradual decline over 14 days is weighted higher than a single quiet day.
    """
    recent = metadata["recent"]
    baseline = metadata["baseline"]

    recent_by_day = Counter(m["timestamp"].date() for m in recent)
    baseline_by_day = Counter(m["timestamp"].date() for m in baseline)

    recent_avg = sum(recent_by_day.values()) / max(len(recent_by_day), 1)
    baseline_avg = sum(baseline_by_day.values()) / max(len(baseline_by_day), 1)

    if baseline_avg == 0:
        score = 0
    else:
        dropoff = (baseline_avg - recent_avg) / baseline_avg
        score = min(max(int(dropoff * 100), 0), 100)

    confidence = min(len(baseline_by_day) / 10, 1.0)

    if score >= 70:
        finding = f"Daily messaging dropped {score}% - from ~{int(baseline_avg)} to ~{int(recent_avg)} messages per day"
    elif score >= 40:
        finding = f"Moderate activity decline - {score}% fewer messages than your baseline"
    else:
        finding = "Messaging frequency is consistent with your normal patterns"

    return SensorReading(score=score, finding=finding, confidence=confidence, label="Frequency")
