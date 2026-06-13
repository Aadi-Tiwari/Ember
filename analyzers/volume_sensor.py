from dataclasses import dataclass


@dataclass
class SensorReading:
    score: int
    finding: str
    confidence: float
    label: str = "Volume"


def run(metadata: dict) -> SensorReading:
    """
    Measures compression in average message length over time.
    Shorter messages signal declining cognitive energy and emotional flatness.
    """
    recent = metadata["recent"]
    baseline = metadata["baseline"]

    if not recent or not baseline:
        return SensorReading(score=0, finding="Insufficient data for volume analysis", confidence=0.0, label="Volume")

    recent_avg = sum(m["char_count"] for m in recent) / len(recent)
    baseline_avg = sum(m["char_count"] for m in baseline) / len(baseline)

    if baseline_avg == 0:
        score = 0
    else:
        compression = (baseline_avg - recent_avg) / baseline_avg
        recent_short_ratio = sum(1 for m in recent if m["char_count"] <= 5) / len(recent)
        score = min(max(int((compression * 70) + (recent_short_ratio * 30)), 0), 100)

    confidence = min(len(recent) / 30, 1.0)
    recent_short_pct = int(sum(1 for m in recent if m["char_count"] <= 5) / max(len(recent), 1) * 100)

    if score >= 70:
        finding = f"Message length dropped from ~{int(baseline_avg)} to ~{int(recent_avg)} characters. {recent_short_pct}% of messages are now under 5 characters"
    elif score >= 40:
        finding = f"Messages getting shorter - average {int(recent_avg)} chars vs {int(baseline_avg)} chars baseline"
    else:
        finding = "Message length is consistent with your normal communication style"

    return SensorReading(score=score, finding=finding, confidence=confidence, label="Volume")
