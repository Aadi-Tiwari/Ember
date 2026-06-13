from dataclasses import dataclass


@dataclass
class SensorReading:
    score: int
    finding: str
    confidence: float
    label: str = "Voice"
    zscore: float = 0.0


def run(voice: dict) -> SensorReading:
    """
    Scores voice patterns from Web Audio API analysis.
    Low energy + low cadence + flat pitch = burnout signal.
    All processing happens in the browser - no audio is ever transmitted.
    """
    energy = float(voice.get("energy", 0.5))          # 0-1, RMS amplitude
    cadence = float(voice.get("cadence", 0.5))         # 0-1, fraction of time speaking
    pitch_var = float(voice.get("pitch_variation", 0.5))  # 0-1, expressiveness

    # Low energy = physical/cognitive fatigue
    energy_score = max(0, int((0.35 - energy) / 0.35 * 100)) if energy < 0.35 else 0

    # Low cadence = withdrawn, not engaging
    cadence_score = max(0, int((0.3 - cadence) / 0.3 * 80)) if cadence < 0.3 else 0

    # Low pitch variation = flat affect, monotone speech
    affect_score = max(0, int((0.25 - pitch_var) / 0.25 * 90)) if pitch_var < 0.25 else 0

    score = min(100, int(energy_score * 0.4 + cadence_score * 0.3 + affect_score * 0.3))

    flags = []
    if energy < 0.2:
        flags.append("very low vocal energy")
    elif energy < 0.35:
        flags.append(f"low vocal energy ({energy:.2f})")
    if cadence < 0.2:
        flags.append("rarely speaking")
    if pitch_var < 0.15:
        flags.append("flat monotone affect")

    if flags:
        finding = "Voice signals: " + ", ".join(flags)
    else:
        finding = f"Voice patterns normal - energy {energy:.2f}, cadence {cadence:.2f}, affect {pitch_var:.2f}"

    confidence = min(0.9, cadence * 1.5 + 0.1)

    return SensorReading(score=score, finding=finding, confidence=confidence, label="Voice", zscore=0.0)
