import numpy as np
from collections import defaultdict


def predict_days(score: int) -> int | None:
    """
    Simple threshold-based projection.
    Returns estimated days until critical threshold based on current score trajectory.
    """
    if score >= 80:
        return 0
    if score >= 60:
        return max(1, int((100 - score) / 5))
    return None
