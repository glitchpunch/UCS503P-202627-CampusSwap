from fastapi import APIRouter, Response

from app.deps import DB, CurrentAdmin, Now
from app.schemas import MatchRunIn
from app.services import cycles
from app.services.matching import compare_algorithms, run_matching
from app.services.views import admin_overview, admin_requests, export_csv, run_summary

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/overview")
def overview(db: DB, admin: CurrentAdmin) -> dict:
    return admin_overview(db)


@router.get("/requests")
def requests(db: DB, admin: CurrentAdmin) -> list[dict]:
    return admin_requests(db)


@router.post("/match-runs")
def match_run(body: MatchRunIn, db: DB, admin: CurrentAdmin, now: Now) -> dict:
    run = run_matching(db, admin, body.algorithm, body.dry_run, now)
    db.commit()
    return {**run_summary(run), "trace": run.trace}


@router.post("/compare")
def compare(db: DB, admin: CurrentAdmin, now: Now) -> dict:
    """Dry-run TTC and 1:1-only on the current pool; nothing is saved except the run records."""
    ttc, pairwise = compare_algorithms(db, admin, now)
    db.commit()
    return {"ttc": {**run_summary(ttc), "trace": ttc.trace},
            "pairwise": {**run_summary(pairwise), "trace": pairwise.trace}}


@router.post("/cycles/{cycle_id}/approve")
def approve(cycle_id: int, db: DB, admin: CurrentAdmin, now: Now) -> dict:
    cycle = cycles.approve(db, admin, cycle_id, now)
    db.commit()
    return {"cycle_id": cycle.id, "status": cycle.status}


@router.get("/export.csv")
def export(db: DB, admin: CurrentAdmin) -> Response:
    return Response(content=export_csv(db), media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="campusswap-requests.csv"'})
