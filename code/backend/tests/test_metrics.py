from engine import Cycle, MatchResult, cycle_length_counts, match_yield


def result(*cycles):
    assignment = {pid: 0 for c in cycles for pid in c.members}
    return MatchResult(tuple(cycles), (), assignment)


def test_match_yield_is_percent_of_pool_matched():
    assert match_yield(result(Cycle((1, 2)), Cycle((3, 4, 5))), pool_size=8) == 62.5


def test_match_yield_of_empty_pool_is_zero():
    assert match_yield(result(), pool_size=0) == 0.0


def test_cycle_length_counts():
    r = result(Cycle((1, 2)), Cycle((3, 4, 5)), Cycle((6, 7)))
    assert cycle_length_counts(r) == {2: 2, 3: 1}
