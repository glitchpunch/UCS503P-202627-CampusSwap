import pytest

from engine import Cycle, Participant, validate


def test_acceptable_is_whole_list_when_own_seat_not_listed():
    p = Participant(id=1, seat=10, wants=(20, 30))
    assert p.acceptable() == (20, 30)


def test_acceptable_stops_before_own_seat():
    p = Participant(id=1, seat=10, wants=(20, 10, 30))
    assert p.acceptable() == (20,)


def test_cycle_length():
    assert len(Cycle((1, 2, 3))) == 3


def test_validate_returns_participants_by_id():
    a = Participant(1, 10, (20,))
    b = Participant(2, 20, (10,))
    assert validate([b, a]) == {1: a, 2: b}


def test_validate_rejects_duplicate_ids():
    with pytest.raises(ValueError, match="duplicate participant id 1"):
        validate([Participant(1, 10, ()), Participant(1, 20, ())])


def test_validate_rejects_shared_seat():
    with pytest.raises(ValueError, match="seat 10 owned by both 1 and 2"):
        validate([Participant(1, 10, ()), Participant(2, 10, ())])
