from dataclasses import dataclass


@dataclass
class SensorReading:
    score: int
    finding: str
    confidence: float
    label: str = "Activity"
    zscore: float = 0.0


def run(vitals: dict) -> SensorReading:
    """
    Scores real-time behavioral vitals: mouse velocity, typing cadence, idle ratio.
    Low mouse velocity and typing rate indicate low energy / disengagement.
    """
    velocity = vitals.get("mouse_velocity_px_s", 300.0)
    key_rate = vitals.get("key_rate_per_min", 200.0)
    idle_ratio = vitals.get("idle_ratio", 0.15)

    # Mouse velocity: healthy 200-600 px/s, burnout <80 px/s
    if velocity >= 200:
        v_score = 0
    elif velocity >= 80:
        v_score = int((200 - velocity) / 120 * 55)
    else:
        v_score = 55 + int((80 - velocity) / 80 * 45)

    # Typing rate: healthy 150-400 kpm, burnout <50 kpm
    if key_rate >= 150:
        k_score = 0
    elif key_rate >= 50:
        k_score = int((150 - key_rate) / 100 * 55)
    else:
        k_score = 55 + int((50 - key_rate) / 50 * 45)

    # Idle ratio: healthy 10-35%, burnout >65%
    if idle_ratio <= 0.35:
        i_score = 0
    elif idle_ratio <= 0.65:
        i_score = int((idle_ratio - 0.35) / 0.30 * 60)
    else:
        i_score = 60 + int((idle_ratio - 0.65) / 0.35 * 40)

    score = min(100, int(v_score * 0.45 + k_score * 0.35 + i_score * 0.20))

    flags = []
    if velocity < 120:
        flags.append(f"sluggish mouse ({velocity:.0f}px/s)")
    if key_rate < 70 and velocity > 20:
        # Only flag low typing if mouse is moving (user is active but not typing)
        flags.append(f"low keyboard engagement ({key_rate:.0f}kpm)")
    if idle_ratio > 0.55:
        flags.append(f"long idle periods ({idle_ratio * 100:.0f}%)")

    if flags:
        finding = "Low energy signals: " + ", ".join(flags)
    else:
        finding = f"Normal activity - mouse {velocity:.0f}px/s, {key_rate:.0f} keys/min, {idle_ratio*100:.0f}% idle"

    return SensorReading(score=score, finding=finding, confidence=0.82, label="Activity")
