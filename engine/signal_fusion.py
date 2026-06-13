import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

_model = SentenceTransformer("all-MiniLM-L6-v2")


def fuse(readings: list) -> tuple[int, list[dict]]:
    """
    Combines sensor readings using embedding-based consensus.
    Sensors whose findings cluster together in semantic space get higher weight.

    Returns:
        (risk_score, attention_weights)
        attention_weights: [{label, pct, zscore}] sorted by contribution descending
    """
    active = [r for r in readings if r.confidence > 0]

    if not active:
        return 0, []

    if len(active) == 1:
        return active[0].score, [{"label": active[0].label, "pct": 100, "zscore": getattr(active[0], "zscore", 0.0)}]

    findings = [r.finding for r in active]
    embeddings = _model.encode(findings)

    # Agreement weight = mean cosine similarity to all other sensors
    sim_matrix = cosine_similarity(embeddings)
    agreement_weights = sim_matrix.mean(axis=1)

    confidence_weights = np.array([r.confidence for r in active])
    combined = agreement_weights * confidence_weights
    combined = combined / combined.sum()

    scores = np.array([r.score for r in active])
    fused = float(np.dot(scores, combined))
    risk_score = min(max(int(fused), 0), 100)

    # Build attention weight list - what % of final score each sensor drove
    pcts = (combined * 100).round(1)
    weights = sorted(
        [
            {
                "label": r.label,
                "pct": float(pcts[i]),
                "zscore": getattr(r, "zscore", 0.0),
            }
            for i, r in enumerate(active)
        ],
        key=lambda x: x["pct"],
        reverse=True,
    )

    return risk_score, weights
