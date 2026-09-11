import pytest
from sqlalchemy import func, select

from app.errors import DomainError
from app.models import Admin, MatchRun, SwapCycle, SwapRequest
from app.services.matching import run_matching
from conftest import NOW


def admin(db):
    return db.scalar(select(Admin))


def statuses(db):
    rows = db.execute(select(SwapRequest.status, func.count()).group_by(SwapRequest.status)).all()
    return dict(rows)


def test_seeded_pool_gives_one_2_3_and_4_way_chain(seeded):
    run = run_matching(seeded, admin(seeded), "ttc", dry_run=False, now=NOW)
    assert run.cycles_by_length == {"2": 1, "3": 1, "4": 1}
    assert (run.pool_size, run.matched, run.yield_pct) == (12, 9, 75.0)
    assert statuses(seeded) == {"matched": 9, "open": 3}


def test_each_member_receives_the_next_members_seat(seeded):
    run_matching(seeded, admin(seeded), "ttc", dry_run=False, now=NOW)
    for cycle in seeded.scalars(select(SwapCycle)).all():
        members = cycle.members
        for i, m in enumerate(members):
            assert m.receives_seat_id == members[(i + 1) % len(members)].gives_seat_id
            assert m.response == "pending"
            assert m.received_rank == 1  # the seeded pool is built so everyone matched gets their first choice
        assert cycle.status == "proposed"
        assert cycle.deadline > NOW


def test_dry_run_saves_the_run_but_changes_nothing(seeded):
    run = run_matching(seeded, admin(seeded), "ttc", dry_run=True, now=NOW)
    assert run.dry_run and run.matched == 9
    assert seeded.scalar(select(func.count(SwapCycle.id))) == 0
    assert statuses(seeded) == {"open": 12}


def test_pairwise_comparison_matches_fewer_than_ttc(seeded):
    pairwise = run_matching(seeded, admin(seeded), "pairwise", dry_run=True, now=NOW)
    assert pairwise.matched == 2
    assert pairwise.yield_pct == 16.7
    assert pairwise.cycles_by_length == {"2": 1}


def test_pairwise_cannot_save_real_swaps(seeded):
    with pytest.raises(DomainError) as err:
        run_matching(seeded, admin(seeded), "pairwise", dry_run=False, now=NOW)
    assert err.value.code == "pairwise_must_be_dry_run"


def test_unknown_algorithm_rejected(seeded):
    with pytest.raises(DomainError) as err:
        run_matching(seeded, admin(seeded), "magic", dry_run=True, now=NOW)
    assert err.value.code == "unknown_algorithm"


def test_empty_pool_gives_zero_yield(seeded):
    for r in seeded.scalars(select(SwapRequest)).all():
        r.status = "withdrawn"
    run = run_matching(seeded, admin(seeded), "ttc", dry_run=False, now=NOW)
    assert (run.pool_size, run.matched, run.yield_pct) == (0, 0, 0.0)
    assert run.cycles == []


def test_trace_explains_every_chain_in_plain_words(seeded):
    run = run_matching(seeded, admin(seeded), "ttc", dry_run=False, now=NOW)
    assert run.trace.count("Chain found") == 3
    assert "Matched 9 of 12 students (Match Yield 75.0%)" in run.trace


def test_second_run_only_sees_students_still_open(seeded):
    run_matching(seeded, admin(seeded), "ttc", dry_run=False, now=NOW)
    second = run_matching(seeded, admin(seeded), "ttc", dry_run=False, now=NOW)
    assert (second.pool_size, second.matched) == (3, 0)
    assert seeded.scalar(select(func.count(MatchRun.id))) == 2
