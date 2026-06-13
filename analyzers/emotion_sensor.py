from dataclasses import dataclass


@dataclass
class SensorReading:
    score: int
    finding: str
    confidence: float
    label: str = "Emotion"
    zscore: float = 0.0


def run(emotion: dict) -> SensorReading:
    """
    Scores facial emotion + eye openness (fatigue proxy).
    Negative affect + drooping eyes = burnout signal.
    All inference runs in the browser - no video transmitted.
    """
    happy     = float(emotion.get("happy", 0))
    sad       = float(emotion.get("sad", 0))
    angry     = float(emotion.get("angry", 0))
    fearful   = float(emotion.get("fearful", 0))
    disgusted = float(emotion.get("disgusted", 0))
    neutral   = float(emotion.get("neutral", 0))
    eye_open  = float(emotion.get("eye_openness", 0.3))  # EAR: 0.3 = normal, <0.2 = drowsy

    # Emotion risk
    emotion_raw = (sad * 3.0 + fearful * 2.5 + disgusted * 1.5
                   + angry * 1.5 + neutral * 0.5 - happy * 2.0)
    emotion_score = min(100, max(0, int(emotion_raw * 50)))

    # Eye fatigue risk (EAR < 0.18 = very drowsy)
    if eye_open < 0.18:
        eye_score = 80
        eye_label = "very drowsy eyes"
    elif eye_open < 0.22:
        eye_score = 50
        eye_label = "tired eyes"
    else:
        eye_score = 0
        eye_label = None

    score = min(100, int(emotion_score * 0.7 + eye_score * 0.3))

    dom = max(
        [("happy", happy), ("sad", sad), ("angry", angry),
         ("fearful", fearful), ("disgusted", disgusted), ("neutral", neutral)],
        key=lambda x: x[1],
    )

    flags = []
    if dom[1] > 0.4 and dom[0] != "happy":
        flags.append(f"{dom[0]} expression ({dom[1]*100:.0f}%)")
    if eye_label:
        flags.append(eye_label)

    if flags:
        finding = "Facial signals: " + ", ".join(flags)
    else:
        finding = f"Face normal - {dom[0]} ({dom[1]*100:.0f}%), eyes alert"

    confidence = min(0.92, dom[1] + 0.4)
    return SensorReading(score=score, finding=finding, confidence=confidence, label="Emotion", zscore=0.0)
