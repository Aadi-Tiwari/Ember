"""
Persona-conditioned scoring utilities.

Instead of comparing users to population averages, every sensor computes
deviation from the user's own baseline. Score = how much YOU changed,
not whether you're below some fixed threshold.

Math: z = (your_current - your_mean) / your_std
3-sigma deviation maps to risk score 100.
"""
import numpy as np
from collections import defaultdict
from typing import Callable


def daily_values(msgs: list, metric_fn: Callable) -> list[float]:
    """Groups messages by calendar day and applies metric_fn to each day's msgs."""
    by_day: dict = defaultdict(list)
    for m in msgs:
        by_day[m["timestamp"].date()].append(m)
    return [metric_fn(day_msgs) for day_msgs in sorted(by_day.items(), key=lambda x: x[0])]


def zscore_risk(
    baseline_vals: list,
    current_vals: list,
    higher_is_worse: bool = True,
) -> tuple[int, float]:
    """
    Computes risk score and z-score from personal baseline.

    Returns:
        (risk_score 0-100, z_score)
        z-score > 0 means current is worse than baseline
        3-sigma → risk 100
    """
    if not baseline_vals or not current_vals:
        return 0, 0.0

    bl = np.array(baseline_vals, dtype=float)
    cu = np.array(current_vals, dtype=float)

    bl_mean = float(np.mean(bl))
    # Floor at 10% of baseline mean to avoid division by near-zero
    bl_std = max(float(np.std(bl)), max(bl_mean * 0.1, 0.001))
    cu_mean = float(np.mean(cu))

    z = (cu_mean - bl_mean) / bl_std
    if not higher_is_worse:
        z = -z  # flip: lower current than baseline = positive risk signal

    risk = min(100, max(0, int(z * 33.3)))
    return risk, round(z, 2)
