# P3: Matching engine

You own the algorithm, the heart of the project. Read [Matching engine](../matching-engine.md) first.

## Your files

| File | What it does |
|---|---|
| `code/backend/engine/structures.py` | `Participant`, `Cycle`, `Round`, `MatchResult`, `validate()` |
| `engine/ttc.py` | `top_trading_cycles()` |
| `engine/pairwise.py` | `pairwise_swaps()`, the 1:1-only comparison |
| `engine/metrics.py` | `match_yield()`, `cycle_length_counts()` |
| `app/services/matching.py` | The glue: turns requests into participants, saves the result |
| `tests/test_ttc.py`, `test_pairwise.py`, `test_metrics.py`, `test_structures.py` | Engine tests |

## The data the engine sees

`Participant(id, seat, wants)`: `id` is the request, `seat` is the bed they own, and `wants`
is a tuple of seat IDs, best first. `acceptable()` cuts the list at the participant's own
seat, because anything after it is worse than staying.

The engine never sees rooms or names. `matching.py → _wanted_seats` turns "rank 1: room X,
rank 2: room Y" into "X's seats, then Y's seats".

## Walk through `top_trading_cycles()`

1. `validate()`: no duplicate IDs, no seat owned twice.
2. `owner_of[seat] = participant`, only for participants still in play.
3. Each round, every participant whose target has left gets a new pointer from
   `_advance()`: walk forward through `wants` from `cursor[pid]` to the first seat still
   owned by someone in play (or point at yourself). **Pointers only move forward**,
   because a taken seat never comes back. That's what makes it fast.
4. `_find_cycles()` walks the pointers from each unvisited node in ID order until it
   returns to a node on the current path (a new cycle) or to a finished node (no new cycle).
5. Cycles of length 1 = "keep your room". Longer cycles: each member gets the next
   member's seat. Remove them all; record a `Round` for the trace; repeat.

`_rotate()` starts each cycle at its smallest ID, so results are identical whatever order
the input comes in (tested by shuffling 20 times).

## Why a cycle always exists

Every participant points at exactly one participant. Start anywhere and follow the arrows:
there are only finitely many people, so you must eventually revisit someone. The part from
the first visit to the revisit is a cycle. (Proposal §5.1.)

## Why TTC and not Gale-Shapley?

Gale-Shapley (deferred acceptance) is for **two sides** that both have preferences, like
students and colleges. Our problem has **one side**: students who already own rooms and want
to trade. That's a *housing market*, and TTC is the standard answer to it. It's the only
method that is strategy-proof, Pareto efficient and never leaves anyone worse off in that setting.

## Complexity

Finding cycles is one pass over *n* participants per round. There can be up to *n* rounds,
so the worst case is **O(n²)**. Pointer moves add up to at most the total length of all
preference lists. Test: 2,000 students in about 0.1 s.

## The comparison and the metric

`pairwise_swaps()` lists every pair who want each other's rooms, sorts by combined rank, and
takes pairs greedily with nobody in two pairs. `match_yield = matched / pool × 100`.
The demo pool: TTC 75%, pairwise 16.7%.

## Questions you may get

**Can a student get a worse room than they have?** No. They only point at seats they ranked
above their own; if none is left, they point at themselves and keep their room. Tested on
50 random pools.

**Can lying about preferences help?** No. TTC is strategy-proof: your best move is always to
rank honestly (Roth, 1982).

**What if two people want the same room?** The owner of that room decides by whom *they*
point at; the other person falls through to their next choice in a later round.

**What about double rooms?** Each bed is a seat. Ranking a room means ranking its seats in ID
order, so either occupant who is in the pool can be your partner.

**How would you reuse it for faculty slots?** Replace "seat" with "lecture slot" and
"wants" with preferred slots. The engine doesn't change.

## If the demo breaks

Run `python -m pytest code/backend/tests/test_ttc.py -v`. If those pass, the engine is fine
and the problem is elsewhere.
