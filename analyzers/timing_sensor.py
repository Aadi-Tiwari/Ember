from dataclasses import dataclass


@dataclass
class SensorReading:
    score: int
    finding: str
    confidence: float
    label: str = "Timing"


def run(metadata: dict) -> SensorReading:
    """
    Detects sleep schedule drift by checking when messages are sent.
    Late-night activity increase relative to baseline signals sleep disruption.
    """
    recent = metadata["recent"]
    baseline = metadata["baseline"]

    def late_night_ratio(msgs: list) -> float:
        if not msgs:
            return 0.0
        late = sum(1 for m in msgs if m["timestamp"].hour >= 23 or m["timestamp"].hour <= 4)
        return late / len(msgs)

    recent_ratio = late_night_ratio(recent)
    baseline_ratio = late_night_ratio(baseline)

    if baseline_ratio == 0:
        drift = recent_ratio * 2
    else:
        drift = (recent_ratio - baseline_ratio) / baseline_ratio

    score = min(max(int(drift * 100), 0), 100)
    confidence = min(len(recent) / 50, 1.0)

    if score >= 70:
        finding = f"Late-night activity increased {int(drift * 100)}% - messaging pattern shifted significantly"
    elif score >= 40:
        finding = f"Mild sleep schedule drift detected - {int(recent_ratio * 100)}% of messages sent late at night"
    else:
        finding = "Sleep schedule appears consistent with your baseline"

    return SensorReading(score=score, finding=finding, confidence=confidence, label="Timing")
