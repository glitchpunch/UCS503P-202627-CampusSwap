"""Synthetic demo data for CampusSwap.

Everything here is made up (hostels, names, roll numbers, emails) so it can
never be mistaken for real student records.

Demo logins (password for all: campus123):
  warden@thapar.edu                      admin
  student1@thapar.edu .. student3@thapar.edu   students with no request yet,
      living in single rooms Hostel M A-101, B-101, A-201. For a live 3-way
      swap: student1 ranks B-101, student2 ranks A-201, student3 ranks A-101.

The pre-built pool is designed so TTC finds one 2-way, one 3-way and one
4-way chain, and leaves 3 students unmatched.
"""
from __future__ import annotations

import itertools
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.clock import utcnow
from app.models import Admin, Hostel, Room, Seat, Student
from app.security import hash_password

DEMO_PASSWORD = "campus123"

HOSTELS = [
    ("J", "Hostel J", "M", "Dr. A. Verma"),
    ("M", "Hostel M", "M", "Dr. R. Singh"),
    ("K", "Hostel K", "F", "Dr. P. Kaur"),
    ("N", "Hostel N", "F", "Dr. S. Mehta"),
]
TAGS = ["Near mess", "Lift nearby", "Corner room", "Balcony", "Quiet wing", "Garden facing"]
FIRST_M = ["Aarav", "Vihaan", "Kabir", "Arjun", "Rohan", "Ishaan", "Dev", "Karan", "Yash", "Aditya"]
FIRST_F = ["Ananya", "Diya", "Isha", "Meera", "Riya", "Saanvi", "Tara", "Kavya", "Nisha", "Pooja"]
SURNAMES = ["Sharma", "Gill", "Mehta", "Bansal", "Kapoor", "Sethi", "Arora", "Malhotra", "Sandhu", "Jain"]
BRANCHES = ["COE", "ECE", "ME", "EE", "CSBS", "BT"]

# (owner's hostel, room, [ranked wanted rooms in the same hostel])
POOL = [
    # 2-way: J A-101 <-> J B-101
    ("J", "A-101", ["B-101", "A-201"]),
    ("J", "B-101", ["A-101"]),
    # 3-way: J A-201 -> J B-201 -> J A-301 -> J A-201
    ("J", "A-201", ["B-201", "B-101"]),
    ("J", "B-201", ["A-301"]),
    ("J", "A-301", ["A-201", "A-101"]),
    # 4-way: K A-101 -> K B-101 -> K A-201 -> K B-201 -> K A-101
    ("K", "A-101", ["B-101"]),
    ("K", "B-101", ["A-201", "A-301"]),
    ("K", "A-201", ["B-201"]),
    ("K", "B-201", ["A-101"]),
    # unmatched: their choices are taken by others first, or nobody offers them
    ("J", "B-301", ["A-101", "B-101"]),
    ("J", "A-102", ["A-101"]),
    ("K", "A-301", ["B-301"]),
]
DEMO_STUDENT_ROOMS = ["A-101", "B-101", "A-201"]  # in Hostel M


def seed(db: Session, now: datetime | None = None) -> None:
    from app.services.requests import submit_request

    now = now or utcnow()
    password_hash = hash_password(DEMO_PASSWORD)  # one hash reused: demo data only
    db.add(Admin(email="warden@thapar.edu", name="Warden Office", password_hash=password_hash))

    counter = itertools.count(1)
    for code, name, gender, warden in HOSTELS:
        hostel = Hostel(code=code, name=name, gender=gender, warden_name=warden)
        db.add(hostel)
        for block, floor, i in itertools.product("AB", (1, 2, 3), (1, 2, 3)):
            seater = i  # room 1 single, room 2 double, room 3 triple on each floor
            n = next(counter)
            room = Room(
                hostel=hostel, block=block, floor=floor, number=f"{block}-{floor}0{i}",
                seater=seater, ac=(n % 3 != 0), washroom="attached" if seater == 1 else "common",
                tags=", ".join(TAGS[(n + k) % len(TAGS)] for k in range(2)),
            )
            db.add(room)
            for label in "ABC"[:seater]:
                db.add(Seat(room=room, label=label))
    db.flush()

    # one student per seat, in a stable order
    seats = db.scalars(select(Seat).join(Room).join(Hostel).order_by(Hostel.id, Room.id, Seat.id)).all()
    demo_emails = {("M", number): f"student{n}@thapar.edu" for n, number in enumerate(DEMO_STUDENT_ROOMS, start=1)}
    for k, seat in enumerate(seats, start=1):
        hostel = seat.room.hostel
        firsts = FIRST_M if hostel.gender == "M" else FIRST_F
        first, last = firsts[k % len(firsts)], SURNAMES[(k // len(firsts)) % len(SURNAMES)]
        email = demo_emails.get((hostel.code, seat.room.number), f"stu{k:03d}@thapar.edu")
        seat.occupant = Student(
            email=email, name=f"{first} {last}", password_hash=password_hash,
            roll_no=f"D24{k:04d}", gender=hostel.gender, year=1 + k % 4, branch=BRANCHES[k % len(BRANCHES)],
        )
    db.flush()

    def room(code: str, number: str) -> Room:
        return db.scalar(select(Room).join(Hostel).where(Hostel.code == code, Room.number == number))

    for offset, (code, number, wanted) in enumerate(POOL):
        owner = room(code, number).seats[0].occupant
        submit_request(db, owner, [room(code, w).id for w in wanted], now - timedelta(hours=len(POOL) - offset))
    db.commit()


if __name__ == "__main__":
    from app.db import DEFAULT_DB_PATH, make_engine, make_session_factory
    from app.models import Base

    DEFAULT_DB_PATH.unlink(missing_ok=True)
    engine = make_engine()
    Base.metadata.create_all(engine)
    with make_session_factory(engine)() as session:
        seed(session)
    print(f"Seeded {DEFAULT_DB_PATH}")
