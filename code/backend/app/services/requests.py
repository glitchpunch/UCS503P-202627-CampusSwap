"""Feature 1: a student submits (or withdraws) a ranked swap request."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import DomainError
from app.models import Preference, Room, Student, SwapRequest
from app.services.events import log

MAX_CHOICES = 5
ACTIVE_STATUSES = ("open", "matched")


def active_request(db: Session, student: Student) -> SwapRequest | None:
    return db.scalar(
        select(SwapRequest).where(SwapRequest.student_id == student.id, SwapRequest.status.in_(ACTIVE_STATUSES))
    )


def submit_request(db: Session, student: Student, room_ids: list[int], now: datetime) -> SwapRequest:
    if not room_ids:
        raise DomainError(400, "empty_list", "Pick at least one room.")
    if len(room_ids) > MAX_CHOICES:
        raise DomainError(400, "too_many", f"You can rank at most {MAX_CHOICES} rooms.")
    if len(set(room_ids)) != len(room_ids):
        raise DomainError(400, "duplicate_room", "Each room can appear only once in your list.")
    seat = student.seat
    if seat is None:
        raise DomainError(409, "no_seat", "You have no room allocated, so there is nothing to swap.")
    if active_request(db, student) is not None:
        raise DomainError(409, "already_active", "You already have an active request. Withdraw it first.")

    rooms = {r.id: r for r in db.scalars(select(Room).where(Room.id.in_(room_ids)))}
    for room_id in room_ids:
        room = rooms.get(room_id)
        if room is None:
            raise DomainError(400, "unknown_room", f"Room {room_id} does not exist.")
        if room.id == seat.room_id:
            raise DomainError(400, "own_room", "You can't rank the room you already live in.")
        if room.hostel.gender != student.gender:
            raise DomainError(400, "wrong_hostel_gender", f"{room.label} is not in a hostel you can live in.")

    request = SwapRequest(
        student=student, seat=seat, status="open", created_at=now, updated_at=now,
        preferences=[Preference(rank=rank, room_id=room_id) for rank, room_id in enumerate(room_ids, start=1)],
    )
    db.add(request)
    db.flush()  # gives the request its id
    request.tracking_id = f"CS-{now.year}-{request.id:04d}"
    log(db, now, "request_submitted",
        f"Request {request.tracking_id} submitted with {len(room_ids)} ranked room(s).", student_id=student.id)
    db.flush()
    return request


def withdraw_request(db: Session, student: Student, now: datetime) -> SwapRequest:
    request = active_request(db, student)
    if request is None:
        raise DomainError(404, "no_request", "You have no active request.")
    if request.status == "matched":
        raise DomainError(409, "in_cycle", "You are in a proposed swap. Decline it instead of withdrawing.")
    request.status = "withdrawn"
    request.updated_at = now
    log(db, now, "request_withdrawn", f"Request {request.tracking_id} withdrawn.", student_id=student.id)
    db.flush()
    return request
