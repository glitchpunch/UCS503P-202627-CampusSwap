from datetime import timedelta

import pytest
from sqlalchemy import select

from app.errors import DomainError
from app.models import Admin, Student, SwapCycle
from app.services.cycles import accept, approve, decline, expire_overdue
from app.services.matching import run_matching
from conftest import NOW


@pytest.fixture
def matched(seeded):
    run_matching(seeded, seeded.scalar(select(Admin)), "ttc", dry_run=False, now=NOW)
    return seeded


def cycle_of_len(db, n):
    return next(c for c in db.scalars(select(SwapCycle)).all() if len(c.members) == n)


def people(cycle):
    return [m.request.student for m in cycle.members]


def code_of(fn, *args):
    with pytest.raises(DomainError) as err:
        fn(*args)
    return err.value.code


def test_everyone_accepting_confirms_the_cycle(matched):
    cycle = cycle_of_len(matched, 3)
    for s in people(cycle):
        accept(matched, s, cycle.id, NOW)
    assert cycle.status == "confirmed"


def test_one_decline_dissolves_and_returns_others_to_pool(matched):
    cycle = cycle_of_len(matched, 3)
    a, b, c = people(cycle)
    accept(matched, a, cycle.id, NOW)
    decline(matched, b, cycle.id, NOW)
    assert cycle.status == "dissolved"
    by_student = {m.request.student_id: m.request.status for m in cycle.members}
    assert by_student == {a.id: "open", b.id: "withdrawn", c.id: "open"}


def test_approve_needs_everyone_confirmed(matched):
    cycle = cycle_of_len(matched, 2)
    admin = matched.scalar(select(Admin))
    assert code_of(approve, matched, admin, cycle.id, NOW) == "not_confirmed"


def test_approve_moves_students_into_their_new_seats(matched):
    cycle = cycle_of_len(matched, 2)
    before = {m.request.student_id: m.receives_seat_id for m in cycle.members}
    for s in people(cycle):
        accept(matched, s, cycle.id, NOW)
    approve(matched, matched.scalar(select(Admin)), cycle.id, NOW)
    assert cycle.status == "approved"
    for m in cycle.members:
        assert m.request.status == "completed"
        assert matched.get(Student, m.request.student_id).seat.id == before[m.request.student_id]


def test_deadline_dissolves_unanswered_cycles(matched):
    cycle = cycle_of_len(matched, 2)
    first, second = people(cycle)
    accept(matched, first, cycle.id, NOW)
    assert expire_overdue(matched, NOW + timedelta(hours=49)) == 3
    assert cycle.status == "dissolved"
    by_student = {m.request.student_id: m.request.status for m in cycle.members}
    assert by_student == {first.id: "open", second.id: "withdrawn"}


def test_answering_after_deadline_is_refused(matched):
    cycle = cycle_of_len(matched, 2)
    late = NOW + timedelta(hours=49)
    assert code_of(accept, matched, people(cycle)[0], cycle.id, late) == "cycle_closed"


def test_outsider_cannot_answer(matched):
    cycle = cycle_of_len(matched, 2)
    outsider = matched.scalar(select(Student).where(Student.email == "student1@thapar.edu"))
    assert code_of(accept, matched, outsider, cycle.id, NOW) == "not_member"


def test_answering_twice_is_refused(matched):
    cycle = cycle_of_len(matched, 3)
    s = people(cycle)[0]
    accept(matched, s, cycle.id, NOW)
    assert code_of(decline, matched, s, cycle.id, NOW) == "already_answered"
