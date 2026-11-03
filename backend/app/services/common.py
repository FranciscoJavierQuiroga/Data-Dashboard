from __future__ import annotations

from datetime import date, datetime
from typing import Any, TypeVar

from fastapi import HTTPException, status
from sqlalchemy import Select, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import AuditLog, Eps, Indicator, Program, User

T = TypeVar("T")


def get_or_404(db: Session, model: type[T], object_id: int, name: str = "Registro") -> T:
    obj = db.get(model, object_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{name} no encontrado")
    return obj


def commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El registro entra en conflicto con un valor único existente",
        ) from exc


def value_for_json(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def model_to_dict(obj: Any) -> dict[str, Any]:
    return {
        column.name: value_for_json(getattr(obj, column.name))
        for column in obj.__table__.columns
    }


def apply_updates(obj: Any, payload: Any) -> None:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)


def log_audit(
    db: Session,
    user: User | None,
    action: str,
    entity: str,
    entity_id: str | int | None,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
) -> None:
    db.add(
        AuditLog(
            user_id=user.id if user else None,
            action=action,
            entity=entity,
            entity_id=str(entity_id) if entity_id is not None else None,
            before=before,
            after=after,
        )
    )


def paginate(db: Session, stmt: Select, page: int, page_size: int) -> tuple[list[Any], int]:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 500)
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    items = list(db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all())
    return items, int(total)


def get_or_create_eps(db: Session, name: str, cache: dict[str, Eps] | None = None) -> Eps:
    if cache is not None and name in cache:
        return cache[name]
    obj = db.scalar(select(Eps).where(Eps.name == name))
    if obj is None:
        obj = Eps(name=name)
        db.add(obj)
        db.flush()
    if cache is not None:
        cache[name] = obj
    return obj


def get_or_create_program(
    db: Session, name: str, cache: dict[str, Program] | None = None
) -> Program:
    if cache is not None and name in cache:
        return cache[name]
    obj = db.scalar(select(Program).where(Program.name == name))
    if obj is None:
        obj = Program(name=name)
        db.add(obj)
        db.flush()
    if cache is not None:
        cache[name] = obj
    return obj


def get_or_create_indicator(
    db: Session,
    program: Program,
    name: str,
    kind: str,
    cache: dict[tuple[int, str], Indicator] | None = None,
) -> Indicator:
    key = (program.id, name)
    if cache is not None and key in cache:
        return cache[key]
    obj = db.scalar(
        select(Indicator).where(Indicator.program_id == program.id, Indicator.name == name)
    )
    if obj is None:
        obj = Indicator(program_id=program.id, name=name, kind=kind)
        db.add(obj)
        db.flush()
    if cache is not None:
        cache[key] = obj
    return obj
