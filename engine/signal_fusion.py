def fuse(readings: list) -> tuple[int, list[dict]]:
    """Summarize heuristic signals for the live view, separate from AI assessment."""
    active = [reading for reading in readings if reading.confidence > 0]
    total = sum(reading.confidence for reading in active)
    if not total:
        return 0, []
    score = int(sum(reading.score * reading.confidence for reading in active) / total)
    weights = sorted(
        [{"label": reading.label, "pct": round(reading.confidence / total * 100, 1),
          "zscore": getattr(reading, "zscore", 0.0)} for reading in active],
        key=lambda weight: weight["pct"], reverse=True,
    )
    return max(0, min(100, score)), weights
