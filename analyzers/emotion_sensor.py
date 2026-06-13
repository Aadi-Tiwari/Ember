from dataclasses import dataclass


@dataclass
class SensorReading:
    score: int
    finding: str
    confidence: float
    label: str = "Emotion"


def run(emotions: dict) -> SensorReading:
    """
    Scores facial emotion data from face-api.js.
    Negative affect (sad, fearful, disgusted, angry) raises score.
    Positive affect (happy) lowers score.
    Flat neutral is a mild signal.
    """
    happy = emotions.get("happy", 0)
    sad = emotions.get("sad", 0)
    angry = emotions.get("angry", 0)
    fearful = emotions.get("fearful", 0)
    disgusted = emotions.get("disgusted", 0)
    neutral = emotions.get("neutral", 0)

    raw = (sad * 3.0 + fearful * 2.5 + disgusted * 1.5 + angry * 1.5 + neutral * 0.5 - happy * 2.0)
    score = min(100, max(0, int(raw * 50)))

    dominant = max(emotions.items(), key=lambda x: x[1])
    name, val = dominant

    if score >= 70:
        finding = f"Significant distress signals - dominant: {name} ({val*100:.0f}%)"
    elif score >= 40:
        finding = f"Mild negative affect detected - {name} ({val*100:.0f}%)"
    else:
        finding = f"Positive engagement - {name} ({val*100:.0f}%)"

    return SensorReading(score=score, finding=finding, confidence=0.73, label="Emotion")
