import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

_model = SentenceTransformer("all-MiniLM-L6-v2")


def fuse(readings: list) -> int:
    """
    Combines sensor readings using embedding-based consensus.
    Sensors whose findings cluster together in semantic space get higher weight.
    Sensors that agree geometrically amplify each other - outliers are suppressed.
    """
    active = [r for r in readings if r.confidence > 0]

    if not active:
        return 0

    if len(active) == 1:
        return active[0].score

    findings = [r.finding for r in active]
    embeddings = _model.encode(findings)

    # Average cosine similarity to all others = geometric agreement score
    sim_matrix = cosine_similarity(embeddings)
    agreement_weights = sim_matrix.mean(axis=1)

    # Combine with confidence to get final weight per sensor
    confidence_weights = np.array([r.confidence for r in active])
    combined_weights = agreement_weights * confidence_weights
    combined_weights = combined_weights / combined_weights.sum()

    scores = np.array([r.score for r in active])
    fused = float(np.dot(scores, combined_weights))

    return min(max(int(fused), 0), 100)
