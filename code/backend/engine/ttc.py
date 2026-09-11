"""Top Trading Cycles (Shapley & Scarf, 1974), as in proposal section 5.2.

Each round:
  1. every remaining participant points at the owner of their best seat that
     is still available (or at themselves if none is left);
  2. every closed loop of pointers is a valid swap chain, carried out at once;
  3. those participants and their seats leave; repeat until nobody is left.
Someone who points at themselves keeps their own seat (unmatched).
"""
from __future__ import annotations

from collections.abc import Iterable

from .structures import Cycle, MatchResult, Participant, Round, validate


def top_trading_cycles(participants: Iterable[Participant]) -> MatchResult:
    active = validate(participants)
    owner_of = {p.seat: p.id for p in active.values()}
    assignment: dict[int, int] = {}
    cycles: list[Cycle] = []
    unmatched: list[int] = []
    rounds: list[Round] = []

    # cursor[pid] = position in p.wants of the seat p currently points at.
    # Seats never come back once taken, so a pointer only moves forward, and
    # only needs recomputing when the participant it points at has left.
    cursor = {pid: 0 for pid in active}
    pointers: dict[int, int] = {}

    while active:
        for pid, p in active.items():
            if pointers.get(pid) not in active:
                cursor[pid], pointers[pid] = _advance(p, cursor[pid], owner_of)
        round_cycles: list[Cycle] = []
        kept: list[int] = []
        taking_part = len(active)
        for members in _find_cycles(pointers):
            if len(members) == 1:
                kept.append(members[0])
            else:
                round_cycles.append(Cycle(members))
                for i, pid in enumerate(members):
                    giver = members[(i + 1) % len(members)]
                    assignment[pid] = active[giver].seat
            for pid in members:
                del owner_of[active[pid].seat]
                del active[pid]
                del pointers[pid]
        cycles.extend(round_cycles)
        unmatched.extend(kept)
        rounds.append(Round(len(rounds) + 1, taking_part, tuple(round_cycles), tuple(kept)))

    return MatchResult(tuple(cycles), tuple(sorted(unmatched)), assignment, tuple(rounds))


def _advance(p: Participant, start: int, owner_of: dict[int, int]) -> tuple[int, int]:
    """From p.wants[start:], find p's best still-available seat.

    Returns (its position in p.wants, the participant who owns it). If nothing
    is left, or p's own seat comes first, p points at itself.
    """
    for i in range(start, len(p.wants)):
        seat = p.wants[i]
        if seat == p.seat:
            return i, p.id  # everything after this is worse than staying
        owner = owner_of.get(seat)
        if owner is not None:
            return i, owner
    return len(p.wants), p.id


def _find_cycles(pointers: dict[int, int]) -> list[tuple[int, ...]]:
    """All cycles in a graph where every node points at exactly one node.

    Such a graph always has at least one cycle (proposal section 5.1).
    Nodes are visited in id order so the output never depends on input order.
    """
    done: set[int] = set()
    found: list[tuple[int, ...]] = []
    for start in sorted(pointers):
        if start in done:
            continue
        path: list[int] = []
        position: dict[int, int] = {}
        node = start
        while node not in done and node not in position:
            position[node] = len(path)
            path.append(node)
            node = pointers[node]
        if node in position:  # walked back onto this path: a new cycle
            found.append(_rotate(path[position[node]:]))
        done.update(path)
    return found


def _rotate(members: list[int]) -> tuple[int, ...]:
    i = members.index(min(members))
    return tuple(members[i:] + members[:i])
