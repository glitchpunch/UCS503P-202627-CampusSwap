from sqlalchemy import func, select

from app.models import Admin, Hostel, Seat, Student, SwapRequest
from app.security import verify_password
from seed import DEMO_PASSWORD, POOL


def test_seed_creates_hostels_and_fills_every_seat(seeded):
    assert seeded.scalar(select(func.count(Hostel.id))) == 4
    assert seeded.scalar(select(func.count(Seat.id)).where(Seat.occupant_id.is_(None))) == 0


def test_occupants_match_hostel_gender(seeded):
    for seat in seeded.scalars(select(Seat)).all():
        assert seat.occupant.gender == seat.room.hostel.gender


def test_demo_accounts_exist_and_log_in(seeded):
    admin = seeded.scalar(select(Admin))
    assert admin.email == "warden@thapar.edu"
    assert verify_password(DEMO_PASSWORD, admin.password_hash)
    for n in (1, 2, 3):
        student = seeded.scalar(select(Student).where(Student.email == f"student{n}@thapar.edu"))
        assert student.seat.room.hostel.code == "M"
        assert seeded.scalar(select(SwapRequest).where(SwapRequest.student_id == student.id)) is None


def test_prebuilt_pool_is_open(seeded):
    open_requests = seeded.scalars(select(SwapRequest).where(SwapRequest.status == "open")).all()
    assert len(open_requests) == len(POOL)
    assert all(r.tracking_id for r in open_requests)
