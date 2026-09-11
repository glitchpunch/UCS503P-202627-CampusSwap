import re

import pytest
from sqlalchemy import select

from app.errors import DomainError
from app.models import Event, Hostel, Room, Student
from app.services.requests import active_request, submit_request, withdraw_request
from conftest import NOW


def room(db, code, number):
    return db.scalar(select(Room).join(Hostel).where(Hostel.code == code, Room.number == number))


def student(db, n):
    return db.scalar(select(Student).where(Student.email == f"student{n}@thapar.edu"))


def rejects(code, db, who, room_ids):
    with pytest.raises(DomainError) as err:
        submit_request(db, who, room_ids, NOW)
    assert err.value.code == code


def test_submit_saves_ranked_open_request_with_tracking_id(seeded):
    s1 = student(seeded, 1)
    wanted = [room(seeded, "M", "B-101").id, room(seeded, "M", "A-201").id]
    req = submit_request(seeded, s1, wanted, NOW)
    assert req.status == "open"
    assert re.fullmatch(r"CS-2026-\d{4}", req.tracking_id)
    assert [p.room_id for p in req.preferences] == wanted
    assert [p.rank for p in req.preferences] == [1, 2]
    assert req.seat_id == s1.seat.id
    kinds = seeded.scalars(select(Event.kind).where(Event.student_id == s1.id)).all()
    assert kinds == ["request_submitted"]


def test_empty_list_rejected(seeded):
    rejects("empty_list", seeded, student(seeded, 1), [])


def test_more_than_five_rejected(seeded):
    ids = [r.id for r in seeded.scalars(select(Room).join(Hostel).where(Hostel.code == "M")).all()]
    rejects("too_many", seeded, student(seeded, 1), ids[1:7])


def test_duplicate_room_rejected(seeded):
    r = room(seeded, "M", "B-101").id
    rejects("duplicate_room", seeded, student(seeded, 1), [r, r])


def test_own_room_rejected(seeded):
    rejects("own_room", seeded, student(seeded, 1), [room(seeded, "M", "A-101").id])


def test_unknown_room_rejected(seeded):
    rejects("unknown_room", seeded, student(seeded, 1), [999999])


def test_room_in_other_gender_hostel_rejected(seeded):
    rejects("wrong_hostel_gender", seeded, student(seeded, 1), [room(seeded, "K", "A-101").id])


def test_student_without_seat_rejected(seeded):
    homeless = Student(email="new@thapar.edu", name="New Student", password_hash="x", gender="M")
    seeded.add(homeless)
    seeded.flush()
    rejects("no_seat", seeded, homeless, [room(seeded, "M", "B-101").id])


def test_second_active_request_rejected(seeded):
    s1 = student(seeded, 1)
    submit_request(seeded, s1, [room(seeded, "M", "B-101").id], NOW)
    rejects("already_active", seeded, s1, [room(seeded, "M", "A-201").id])


def test_withdraw_open_request(seeded):
    s1 = student(seeded, 1)
    submit_request(seeded, s1, [room(seeded, "M", "B-101").id], NOW)
    req = withdraw_request(seeded, s1, NOW)
    assert req.status == "withdrawn"
    assert active_request(seeded, s1) is None


def test_withdraw_without_request(seeded):
    with pytest.raises(DomainError) as err:
        withdraw_request(seeded, student(seeded, 1), NOW)
    assert err.value.code == "no_request"


def test_withdraw_while_matched_is_refused(seeded):
    s1 = student(seeded, 1)
    req = submit_request(seeded, s1, [room(seeded, "M", "B-101").id], NOW)
    req.status = "matched"
    with pytest.raises(DomainError) as err:
        withdraw_request(seeded, s1, NOW)
    assert err.value.code == "in_cycle"
