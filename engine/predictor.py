import numpy as np
from collections import defaultdict
from datetime import date


def predict_days(score: int, metadata: dict) -> int | None:
    """
    Projects the current rate of change forward to estimate days until threshold.
    Returns None if the trend is stable or improving.
    """
    if score >= 70:
        return 0

    recent = metadata["recent"]
    if len(recent) < 7:
        return None

    by_day: dict = defaultdict(int)
    for m in recent:
        by_day[m["timestamp"].date()] += 1

    sorted_days = sorted(by_day.keys())
    if len(sorted_days) < 3:
        return None

    daily_counts = [by_day[d] for d in sorted_days]
    x = np.arange(len(daily_counts))
    slope = np.polyfit(x, daily_counts, 1)[0]

    if slope >= 0:
        return None

    start = daily_counts[0]
    critical = start * 0.2
    current = daily_counts[-1]

    if current <= critical:
        return 1

    days = int((current - critical) / abs(slope))
    return max(days, 1)


def find_divergence_day(metadata: dict) -> int | None:
    """
    Finds how many days ago behavioral patterns first diverged from personal baseline.
    Computes rolling daily activity vs baseline mean + 1 std.
    Returns days_ago (1-14) or None if no clear divergence.
    """
    recent = metadata["recent"]
    baseline = metadata["baseline"]

    if len(recent) < 5 or len(baseline) < 5:
        return None

    # Build baseline statistics: msgs per day
    bl_by_day: dict = defaultdict(int)
    for m in baseline:
        bl_by_day[m["timestamp"].date()] += 1
    bl_counts = list(bl_by_day.values())
    if not bl_counts:
        return None

    bl_mean = np.mean(bl_counts)
    bl_std = max(np.std(bl_counts), bl_mean * 0.1 + 0.5)
    threshold = bl_mean - 1.5 * bl_std  # 1.5 sigma below baseline

    # Walk through recent days in chronological order
    rc_by_day: dict = defaultdict(int)
    for m in recent:
        rc_by_day[m["timestamp"].date()] += 1

    today = max(rc_by_day.keys()) if rc_by_day else date.today()
    sorted_recent_days = sorted(rc_by_day.keys())

    first_divergence: date | None = None
    for d in sorted_recent_days:
        if rc_by_day[d] <= threshold:
            first_divergence = d
            break

    if first_divergence is None:
        return None

    days_ago = (today - first_divergence).days
    return max(1, min(days_ago, 14))
