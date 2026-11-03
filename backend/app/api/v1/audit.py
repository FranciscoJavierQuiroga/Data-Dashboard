from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.deps import AdminUser, DbSession
from app.db.models import AuditLog
from app.schemas.audit import AuditRead
from app.schemas.common import Page
from app.services.common import paginate

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=Page[AuditRead])
def list_audit(
    db: DbSession,
    _: AdminUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    entity: str | None = None,
    action: str | None = None,
) -> Page[AuditRead]:
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())
    if entity:
        stmt = stmt.where(AuditLog.entity == entity)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    rows, total = paginate(db, stmt, page, page_size)
    return Page(
        items=[AuditRead.model_validate(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )
