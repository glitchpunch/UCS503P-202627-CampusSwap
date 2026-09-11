"""The simpler baseline from proposal section 6.1: direct 1:1 swaps only.

Two students can swap when each listed the other's seat as acceptable.
Pairs with the best combined rank are taken first; nobody is in two pairs.
Used only to compare Match Yield against TTC, never to save real swaps.
"""
from __future__ import annotations

from collections.abc import Iterable

from .structures import Cycle, MatchResult, Participant, validate


def pairwise_swaps(participants: Iterable[Participant]) -> MatchResult:
    by_id = validate(participants)
    owner_of = {p.seat: p.id for p in by_id.values()}
    rank = {pid: {seat: r for r, seat in enumerate(p.acceptable())} for pid, p in by_id.items()}

    candidates: list[tuple[int, int, int, int]] = []
    for a, pa in by_id.items():
        for seat in pa.acceptable():
            b = owner_of.get(seat)
            if b is None or b <= a:
                continue  # each pair is considered once, from its smaller id
            if pa.seat in rank[b]:
                ra, rb = rank[a][seat], rank[b][pa.seat]
                candidates.append((ra + rb, max(ra, rb), a, b))
    candidates.sort()

    used: set[int] = set()
    cycles: list[Cycle] = []
    assignment: dict[int, int] = {}
    for _, _, a, b in candidates:
        if a in used or b in used:
            continue
        used.update((a, b))
        cycles.append(Cycle((a, b)))
        assignment[a] = by_id[b].seat
        assignment[b] = by_id[a].seat

    unmatched = tuple(pid for pid in by_id if pid not in used)
    return MatchResult(tuple(cycles), unmatched, assignment)
