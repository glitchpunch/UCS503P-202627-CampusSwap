import random
import time

from engine import Cycle, Participant, top_trading_cycles


def P(pid, seat, *wants):
    return Participant(pid, seat, tuple(wants))


def test_empty_pool():
    r = top_trading_cycles([])
    assert r.cycles == () and r.unmatched == () and r.assignment == {} and r.rounds == ()


def test_two_way_swap():
    r = top_trading_cycles([P(1, 10, 20), P(2, 20, 10)])
    assert r.cycles == (Cycle((1, 2)),)
    assert r.assignment == {1: 20, 2: 10}
    assert r.unmatched == ()


def test_three_way_cycle_that_no_pair_could_do():
    # 1 wants 2's seat, 2 wants 3's, 3 wants 1's.
    r = top_trading_cycles([P(1, 10, 20), P(2, 20, 30), P(3, 30, 10)])
    assert r.cycles == (Cycle((1, 2, 3)),)
    assert r.assignment == {1: 20, 2: 30, 3: 10}


def test_cycle_is_rotated_to_start_at_smallest_id():
    r = top_trading_cycles([P(5, 50, 70), P(7, 70, 60), P(6, 60, 50)])
    assert r.cycles == (Cycle((5, 7, 6)),)


def test_nobody_wants_you_back_means_unmatched():
    # 1 wants 2's seat but 2 wants nothing: 2 keeps, then 1 has nothing left.
    r = top_trading_cycles([P(1, 10, 20), P(2, 20)])
    assert r.cycles == ()
    assert r.unmatched == (1, 2)
    assert r.assignment == {}


def test_top_choice_wins_and_loser_falls_through():
    # 2 and 3 both want seat 10, but 1 (its owner) wants 2's seat first,
    # so 1<->2 close a cycle in round 1 and 3 has nothing left.
    r = top_trading_cycles([P(1, 10, 20, 30), P(2, 20, 10), P(3, 30, 10)])
    assert r.cycles == (Cycle((1, 2)),)
    assert r.unmatched == (3,)


def test_second_choice_used_when_first_is_gone():
    # Round 1: 1<->2 swap. Round 2: 3's first choice (seat 10) is gone,
    # so 3 points at its second choice (seat 40) and closes with 4.
    r = top_trading_cycles([P(1, 10, 20), P(2, 20, 10), P(3, 30, 10, 40), P(4, 40, 30)])
    assert r.cycles == (Cycle((1, 2)), Cycle((3, 4)))
    assert r.assignment[3] == 40
    assert len(r.rounds) == 2


def test_listing_own_seat_means_rest_is_worse_than_staying():
    r = top_trading_cycles([P(1, 10, 10, 20), P(2, 20, 10)])
    assert r.cycles == ()
    assert r.unmatched == (1, 2)


def test_unknown_seats_are_ignored():
    r = top_trading_cycles([P(1, 10, 999, 20), P(2, 20, 10)])
    assert r.cycles == (Cycle((1, 2)),)


def test_double_room_seats_are_tried_in_listed_order():
    # Room has seats 21 and 22; only 22's owner is in the pool.
    r = top_trading_cycles([P(1, 10, 21, 22), P(2, 22, 10)])
    assert r.assignment == {1: 22, 2: 10}


def test_round_trace_records_cycles_and_kept():
    r = top_trading_cycles([P(1, 10, 20), P(2, 20, 10), P(3, 30)])
    first = r.rounds[0]
    assert first.number == 1
    assert first.active == 3
    assert first.cycles == (Cycle((1, 2)),)
    assert first.kept == (3,)


def test_same_result_whatever_the_input_order():
    people = [P(1, 10, 20, 30), P(2, 20, 30), P(3, 30, 10), P(4, 40, 10), P(5, 50, 40)]
    expected = top_trading_cycles(people)
    for seed in range(20):
        shuffled = people[:]
        random.Random(seed).shuffle(shuffled)
        assert top_trading_cycles(shuffled) == expected


def _random_pool(n, seed):
    rng = random.Random(seed)
    seats = [i * 10 for i in range(1, n + 1)]
    pool = []
    for i, seat in enumerate(seats, start=1):
        others = [s for s in seats if s != seat]
        pool.append(P(i, seat, *rng.sample(others, k=min(5, len(others)))))
    return pool


def test_random_pools_obey_the_basic_guarantees():
    for seed in range(50):
        pool = _random_pool(40, seed)
        by_id = {p.id: p for p in pool}
        r = top_trading_cycles(pool)
        matched = set(r.assignment)
        # everyone ends up matched or unmatched, never both
        assert matched | set(r.unmatched) == set(by_id)
        assert not matched & set(r.unmatched)
        # nobody is moved to a seat they didn't ask for (no one is made worse off)
        for pid, seat in r.assignment.items():
            assert seat in by_id[pid].acceptable()
        # seats only change hands among matched people, and never twice
        received = list(r.assignment.values())
        assert len(received) == len(set(received))
        assert set(received) == {by_id[pid].seat for pid in matched}
        # every cycle is really closed
        for c in r.cycles:
            for i, pid in enumerate(c.members):
                nxt = c.members[(i + 1) % len(c)]
                assert r.assignment[pid] == by_id[nxt].seat


def test_two_thousand_students_run_quickly():
    pool = _random_pool(2000, seed=7)
    start = time.perf_counter()
    top_trading_cycles(pool)
    assert time.perf_counter() - start < 2.0
