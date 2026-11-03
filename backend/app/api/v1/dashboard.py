from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.api.deps import DbSession, ReadUser
from app.db.models import (
    AnnualHistory,
    CancerMortality,
    ConsolidadoRecord,
    Eps,
    ImportBatch,
    Indicator,
    MonthlyRecord,
    Population,
    Program,
    RiskFactor,
)
from app.services.analytics import build_dashboard

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(
    db: DbSession,
    _: ReadUser,
    year: int | None = Query(default=None, ge=2000, le=2100),
) -> dict:
    return build_dashboard(db, year)


@router.get("/meta")
def dashboard_meta(db: DbSession, _: ReadUser) -> dict:
    def count(model) -> int:
        return int(db.scalar(select(func.count()).select_from(model)) or 0)

    latest_import = db.scalar(select(ImportBatch).order_by(ImportBatch.created_at.desc()))
    years = list(
        db.scalars(select(MonthlyRecord.year).distinct().order_by(MonthlyRecord.year)).all()
    )
    return {
        "counts": {
            "eps": count(Eps),
            "programs": count(Program),
            "indicators": count(Indicator),
            "monthly": count(MonthlyRecord),
            "annual_history": count(AnnualHistory),
            "cancer_mortality": count(CancerMortality),
            "population": count(Population),
            "risk_factors": count(RiskFactor),
            "consolidado": count(ConsolidadoRecord),
            "imports": count(ImportBatch),
        },
        "monthly_years": years,
        "latest_import": {
            "id": latest_import.id,
            "original_name": latest_import.original_name,
            "status": latest_import.status,
            "created_at": latest_import.created_at.isoformat() if latest_import else None,
        }
        if latest_import
        else None,
    }
