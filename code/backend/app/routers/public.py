from fastapi import APIRouter

from app.deps import DB, Now
from app.services.views import public_stats

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get("/stats")
def stats(db: DB, now: Now) -> dict:
    """Numbers for the login page. No login needed, no personal data."""
    return public_stats(db, now)
