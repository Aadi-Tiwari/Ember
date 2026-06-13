from dataclasses import dataclass
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

_analyzer = SentimentIntensityAnalyzer()


@dataclass
class SensorReading:
    score: int
    finding: str
    confidence: float
    label: str = "Chat"
    zscore: float = 0.0


def run(data) -> SensorReading:
    """
    Scores chat/text sentiment.
    Accepts either a raw string (VADER) or a dict with an AI-assessed score
    (when the Claude chat endpoint has already evaluated the conversation).
    """
    # Claude AI assessment path (higher confidence than VADER)
    if isinstance(data, dict):
        if "ai_score" in data:
            score   = int(data["ai_score"])
            finding = data.get("finding", f"AI assessed burnout risk: {score}/100")
            emotion = data.get("dominant_emotion", "")
            if emotion:
                finding = f"Conversation signals: {emotion} - {finding}"
            return SensorReading(score=score, finding=finding, confidence=0.88, label="Chat", zscore=0.0)
        text = data.get("text", "")
    else:
        text = str(data)

    # VADER fallback for plain text
    if not text.strip():
        return SensorReading(score=0, finding="No text provided", confidence=0.0, label="Chat", zscore=0.0)

    scores   = _analyzer.polarity_scores(text)
    compound = scores["compound"]
    score    = min(max(int((1 - compound) / 2 * 100), 0), 100)

    if score >= 70:
        finding = "Strong negative sentiment - emotional tone signals distress"
    elif score >= 40:
        finding = "Mild negative tone - some emotional strain present"
    else:
        finding = "Neutral or positive sentiment"

    return SensorReading(score=score, finding=finding, confidence=0.70, label="Chat", zscore=0.0)
