"""Evaluation metrics from proposal section 6."""
from __future__ import annotations

from .structures import MatchResult


def match_yield(result: MatchResult, pool_size: int) -> float:
    """Match Yield: percent of the pool placed in a swap chain."""
    if pool_size == 0:
        return 0.0
    return round(100 * len(result.assignment) / pool_size, 1)


def cycle_length_counts(result: MatchResult) -> dict[int, int]:
    """How many chains had 2 students, 3 students, and so on."""
    counts: dict[int, int] = {}
    for cycle in result.cycles:
        counts[len(cycle)] = counts.get(len(cycle), 0) + 1
    return dict(sorted(counts.items()))
