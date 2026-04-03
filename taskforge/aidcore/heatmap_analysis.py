from typing import List, Tuple, Dict

def generate_activity_heatmap(
    timestamps: List[int],
    counts: List[int],
    buckets: int = 10,
    normalize: bool = True
) -> List[float]:
    """
    Bucket activity counts into 'buckets' time intervals,
    returning either raw counts or normalized [0.0–1.0].

    - timestamps: list of epoch ms timestamps.
    - counts: list of integer counts per timestamp.
    - buckets: number of intervals to split into.
    - normalize: scale values relative to the maximum.
    """
    if not timestamps or not counts or len(timestamps) != len(counts):
        return []

    t_min, t_max = min(timestamps), max(timestamps)
    span = t_max - t_min or 1
    bucket_size = span / buckets

    agg = [0] * buckets
    for t, c in zip(timestamps, counts):
        idx = min(buckets - 1, int((t - t_min) / bucket_size))
        agg[idx] += c

    if normalize:
        m = max(agg) or 1
        return [round(val / m, 4) for val in agg]
    return agg


def heatmap_with_labels(
    timestamps: List[int],
    counts: List[int],
    buckets: int = 10,
    normalize: bool = True
) -> List[Tuple[str, float]]:
    """
    Produce heatmap with human-readable labels for each bucket.
    Labels are returned as "start–end" timestamp ranges.
    """
    if not timestamps or not counts:
        return []

    t_min, t_max = min(timestamps), max(timestamps)
    span = t_max - t_min or 1
    bucket_size = span / buckets

    values = generate_activity_heatmap(timestamps, counts, buckets, normalize)
    labeled = []
    for i, v in enumerate(values):
        start = int(t_min + i * bucket_size)
        end = int(t_min + (i + 1) * bucket_size)
        labeled.append((f"{start}-{end}", v))
    return labeled


def summarize_heatmap(values: List[float]) -> Dict[str, float]:
    """
    Compute summary statistics from heatmap values.
    """
    if not values:
        return {"min": 0.0, "max": 0.0, "avg": 0.0}

    total = sum(values)
    return {
        "min": min(values),
        "max": max(values),
        "avg": round(total / len(values), 4),
    }
