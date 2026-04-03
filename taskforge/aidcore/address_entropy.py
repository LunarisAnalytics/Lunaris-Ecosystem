import math
from typing import List, Dict, Any

def compute_shannon_entropy(addresses: List[str]) -> float:
    """
    Compute Shannon entropy (bits) of an address sequence.
    """
    if not addresses:
        return 0.0
    freq: Dict[str, int] = {}
    for a in addresses:
        freq[a] = freq.get(a, 0) + 1
    total = len(addresses)
    entropy = 0.0
    for count in freq.values():
        p = count / total
        entropy -= p * math.log2(p)
    return round(entropy, 4)


def entropy_distribution(addresses: List[str]) -> Dict[str, Any]:
    """
    Return frequency distribution and probabilities used in entropy calculation.
    """
    if not addresses:
        return {"total": 0, "distribution": {}, "probabilities": {}}
    freq: Dict[str, int] = {}
    for a in addresses:
        freq[a] = freq.get(a, 0) + 1
    total = len(addresses)
    probabilities = {a: round(c / total, 4) for a, c in freq.items()}
    return {
        "total": total,
        "distribution": freq,
        "probabilities": probabilities
    }


def normalized_entropy(addresses: List[str]) -> float:
    """
    Compute entropy normalized to [0.0–1.0].
    Useful for comparing across different sequence lengths.
    """
    if not addresses:
        return 0.0
    raw_entropy = compute_shannon_entropy(addresses)
    max_entropy = math.log2(len(set(addresses))) if addresses else 1
    return round(raw_entropy / max_entropy, 4) if max_entropy > 0 else 0.0


def classify_entropy(entropy: float) -> str:
    """
    Classify entropy score into qualitative buckets.
    """
    if entropy < 1:
        return "Very Low"
    elif entropy < 2:
        return "Low"
    elif entropy < 3:
        return "Moderate"
    elif entropy < 4:
        return "High"
    return "Very High"
