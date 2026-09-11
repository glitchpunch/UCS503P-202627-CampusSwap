from engine import Cycle, Participant, pairwise_swaps, top_trading_cycles


def P(pid, seat, *wants):
    return Participant(pid, seat, tuple(wants))


def test_direct_swap_found():
    r = pairwise_swaps([P(1, 10, 20), P(2, 20, 10)])
    assert r.cycles == (Cycle((1, 2)),)
    assert r.assignment == {1: 20, 2: 10}


def test_three_way_chain_is_invisible_to_pairwise_but_not_to_ttc():
    pool = [P(1, 10, 20), P(2, 20, 30), P(3, 30, 10)]
    assert pairwise_swaps(pool).assignment == {}
    assert pairwise_swaps(pool).unmatched == (1, 2, 3)
    assert len(top_trading_cycles(pool).assignment) == 3


def test_best_combined_rank_pair_is_chosen_first():
    # 1 could pair with 2 (ranks 1+0) or 3 (ranks 0+0). Pair 1-3 is better.
    pool = [P(1, 10, 30, 20), P(2, 20, 10), P(3, 30, 10)]
    r = pairwise_swaps(pool)
    assert r.cycles == (Cycle((1, 3)),)
    assert r.unmatched == (2,)


def test_seat_after_own_seat_is_not_acceptable():
    r = pairwise_swaps([P(1, 10, 10, 20), P(2, 20, 10)])
    assert r.assignment == {}


def test_nobody_is_in_two_pairs():
    pool = [P(1, 10, 20, 30), P(2, 20, 10), P(3, 30, 10)]
    r = pairwise_swaps(pool)
    ids = [pid for c in r.cycles for pid in c.members]
    assert len(ids) == len(set(ids))
