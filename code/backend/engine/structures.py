"""Plain data types shared by the matching algorithms.

The engine knows nothing about students, rooms or databases. It only sees
participants (one per open swap request), the seat each one owns, and the
seats each one wants, best first.
"""
from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass


@dataclass(frozen=True)
class Participant:
    """One open swap request.

    id:    unique number for this participant (the swap request id).
    seat:  the seat (bed) this participant owns and would give up.
    wants: seats this participant would move to, best first. Anything listed
           after the participant's own seat counts as worse than staying.
    """

    id: int
    seat: int
    wants: tuple[int, ...]

    def acceptable(self) -> tuple[int, ...]:
        """Seats this participant strictly prefers to the one they own."""
        if self.seat in self.wants:
            return self.wants[: self.wants.index(self.seat)]
        return self.wants


@dataclass(frozen=True)
class Cycle:
    """A closed swap chain.

    members[i] receives the seat of members[i + 1]; the last member
    receives the seat of the first member.
    """

    members: tuple[int, ...]

    def __len__(self) -> int:
        return len(self.members)


@dataclass(frozen=True)
class Round:
    """What happened in one TTC round (used for the admin trace)."""

    number: int
    active: int  # how many participants took part in this round
    cycles: tuple[Cycle, ...]
    kept: tuple[int, ...]  # pointed at themselves: keep their own seat


@dataclass(frozen=True)
class MatchResult:
    cycles: tuple[Cycle, ...]
    unmatched: tuple[int, ...]
    assignment: dict[int, int]  # matched participant id -> seat received
    rounds: tuple[Round, ...] = ()

    @property
    def matched_ids(self) -> tuple[int, ...]:
        return tuple(sorted(self.assignment))


def validate(participants: Iterable[Participant]) -> dict[int, Participant]:
    """Index participants by id; reject duplicate ids and shared seats."""
    by_id: dict[int, Participant] = {}
    owner_of: dict[int, int] = {}
    for p in participants:
        if p.id in by_id:
            raise ValueError(f"duplicate participant id {p.id}")
        if p.seat in owner_of:
            raise ValueError(f"seat {p.seat} owned by both {owner_of[p.seat]} and {p.id}")
        by_id[p.id] = p
        owner_of[p.seat] = p.id
    return dict(sorted(by_id.items()))
