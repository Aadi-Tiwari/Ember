from dataclasses import dataclass
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer


@dataclass
class SensorReading:
    score: int
    finding: str
    confidence: float
    label: str = "Sentiment"


_analyzer = SentimentIntensityAnalyzer()


def run(text: str) -> SensorReading:
    """
    Optional 6th sensor - only runs if the user voluntarily pastes a message.
    Scores emotional tone using VADER. Negative compound = higher risk score.
    """
    if not text or not text.strip():
        return SensorReading(score=0, finding="No text provided", confidence=0.0, label="Sentiment")

    scores = _analyzer.polarity_scores(text)
    compound = scores["compound"]

    # Convert VADER compound (-1 to 1) to burnout risk (0 to 100)
    # Negative sentiment = higher risk
    risk = int((1 - compound) / 2 * 100)
    score = min(max(risk, 0), 100)

    confidence = 0.7

    if score >= 70:
        finding = f"Strong negative sentiment detected in your message - emotional tone signals distress"
    elif score >= 40:
        finding = f"Mildly negative tone in your message - some emotional strain present"
    else:
        finding = "Neutral or positive sentiment in your message"

    return SensorReading(score=score, finding=finding, confidence=confidence, label="Sentiment")
