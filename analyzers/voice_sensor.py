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
    Uses autocorrelation pitch, jitter, and spectral centroid for stress detection.
    All processing happens in the browser - no audio is ever transmitted.
    """
    energy      = float(voice.get("energy", 0.5))
    cadence     = float(voice.get("cadence", 0.5))
    pitch_hz    = float(voice.get("pitch_hz", -1))
    pitch_var   = float(voice.get("pitch_variation", 0.5))
    jitter      = float(voice.get("jitter", 0.0))
    centroid    = float(voice.get("spectral_centroid", 0.3))

    # Low energy = physical/cognitive fatigue
    energy_score = max(0, int((0.35 - energy) / 0.35 * 100)) if energy < 0.35 else 0

    # Low cadence = withdrawn / disengaged
    cadence_score = max(0, int((0.3 - cadence) / 0.3 * 80)) if cadence < 0.3 else 0

    # Low pitch variation = flat affect / monotone (burnout marker)
    affect_score = max(0, int((0.2 - pitch_var) / 0.2 * 70)) if pitch_var < 0.2 else 0

    # Elevated jitter = vocal instability (stress/fatigue marker)
    jitter_score = min(80, int(jitter * 200)) if jitter > 0.05 else 0

    # Spectral centroid - very high = tension, very low = low energy
    centroid_score = 0
    if centroid > 0.7:
        centroid_score = int((centroid - 0.7) / 0.3 * 50)
    elif centroid < 0.1 and cadence > 0.1:
        centroid_score = int((0.1 - centroid) / 0.1 * 30)

    score = min(100, int(
        energy_score  * 0.30 +
        cadence_score * 0.25 +
        affect_score  * 0.20 +
        jitter_score  * 0.15 +
        centroid_score * 0.10
    ))

    flags = []
    if energy < 0.2:
        flags.append("very low vocal energy")
    elif energy < 0.35:
        flags.append(f"low energy ({energy:.2f})")
    if cadence < 0.2:
        flags.append("rarely speaking")
    if pitch_var < 0.1:
        flags.append("flat monotone affect")
    if jitter > 0.15:
        flags.append(f"vocal instability ({jitter*100:.0f}% jitter)")
    if pitch_hz > 0:
        if pitch_hz > 250:
            flags.append(f"elevated pitch {pitch_hz:.0f}Hz")

    if flags:
        finding = "Voice signals: " + ", ".join(flags)
    else:
        finding = (
            f"Voice normal - energy {energy:.2f}, "
            f"cadence {cadence:.2f}"
            + (f", pitch {pitch_hz:.0f}Hz" if pitch_hz > 0 else "")
        )

    confidence = min(0.9, cadence * 1.5 + 0.1)
    return SensorReading(score=score, finding=finding, confidence=confidence, label="Voice", zscore=0.0)
