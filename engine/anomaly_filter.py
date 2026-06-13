import numpy as np


def filter_readings(readings: list) -> list:
    """
    Removes statistically anomalous readings before fusion.
    One sensor firing at 95 while four others sit at 20 is noise, not signal.
    """
    if len(readings) < 3:
        return readings

    scores = np.array([r.score for r in readings])
    mean = np.mean(scores)
    std = np.std(scores)

    filtered = []
    for reading in readings:
        if std == 0 or abs(reading.score - mean) <= 2 * std:
            filtered.append(reading)
        else:
            # Preserve the reading but zero out confidence so fusion ignores it
            from dataclasses import replace
            filtered.append(replace(reading, confidence=0.0))

    return filtered
