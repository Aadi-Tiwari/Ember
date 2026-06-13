import numpy as np
from collections import defaultdict


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

    # Group messages by day and compute a simple daily activity score
    by_day: dict = defaultdict(int)
    for m in recent:
        by_day[m["timestamp"].date()] += 1

    sorted_days = sorted(by_day.keys())
    if len(sorted_days) < 3:
        return None

    daily_counts = [by_day[d] for d in sorted_days]

    # Fit linear trend - negative slope means activity is dropping
    x = np.arange(len(daily_counts))
    slope = np.polyfit(x, daily_counts, 1)[0]

    if slope >= 0:
        return None  # Stable or improving

    # Estimate days until activity drops to critical level (below 20% of start)
    start = daily_counts[0]
    critical = start * 0.2
    current = daily_counts[-1]

    if current <= critical:
        return 1

    days = int((current - critical) / abs(slope))
    return max(days, 1)
