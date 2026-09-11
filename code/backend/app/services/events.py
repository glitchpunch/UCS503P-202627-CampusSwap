"""Write one line to the audit log."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.models import Event


def log(db: Session, now: datetime, kind: str, message: str,
        student_id: int | None = None, cycle_id: int | None = None) -> None:
    db.add(Event(created_at=now, kind=kind, message=message, student_id=student_id, cycle_id=cycle_id))
