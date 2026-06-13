from dataclasses import dataclass


@dataclass
class SensorReading:
    score: int
    finding: str
    confidence: float
    label: str = "Social Graph"


def run(metadata: dict) -> SensorReading:
    """
    Tracks shrinkage in the number of unique conversations.
    A contracting social circle is one of the earliest withdrawal indicators.
    """
    recent = metadata["recent"]
    baseline = metadata["baseline"]

    recent_contacts = len(set(m["channel_hash"] for m in recent))
    baseline_contacts = len(set(m["channel_hash"] for m in baseline))

    if baseline_contacts == 0:
        return SensorReading(score=0, finding="Insufficient baseline data", confidence=0.0, label="Social Graph")

    shrinkage = (baseline_contacts - recent_contacts) / baseline_contacts
    score = min(max(int(shrinkage * 100), 0), 100)
    confidence = min(baseline_contacts / 5, 1.0)

    if score >= 70:
        finding = f"Active conversations dropped from {baseline_contacts} to {recent_contacts} - social circle significantly contracted"
    elif score >= 40:
        finding = f"Moderate social withdrawal - {baseline_contacts - recent_contacts} fewer active conversations than baseline"
    else:
        finding = "Social engagement is consistent with your normal patterns"

    return SensorReading(score=score, finding=finding, confidence=confidence, label="Social Graph")
