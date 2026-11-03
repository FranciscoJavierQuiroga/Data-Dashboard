from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import DbSession, EditorUser, ReadUser
from app.db.models import Eps, Indicator, Program
from app.schemas.catalog import (
    EpsCreate,
    EpsRead,
    EpsUpdate,
    IndicatorCreate,
    IndicatorRead,
    IndicatorUpdate,
    ProgramCreate,
    ProgramRead,
    ProgramUpdate,
)
from app.services.common import apply_updates, commit, get_or_404, log_audit, model_to_dict

router = APIRouter(prefix="/catalogs", tags=["catalogs"])


def indicator_read(indicator: Indicator, program_name: str | None = None) -> IndicatorRead:
    data = IndicatorRead.model_validate(indicator)
    data.program_name = program_name
    return data


@router.get("/eps", response_model=list[EpsRead])
def list_eps(
    db: DbSession,
    _: ReadUser,
    active: bool | None = None,
    search: str | None = None,
) -> list[Eps]:
    stmt = select(Eps).order_by(Eps.name)
    if active is not None:
        stmt = stmt.where(Eps.active == active)
    if search:
        stmt = stmt.where(Eps.name.ilike(f"%{search}%"))
    return list(db.scalars(stmt).all())


@router.post("/eps", response_model=EpsRead, status_code=status.HTTP_201_CREATED)
def create_eps(db: DbSession, payload: EpsCreate, actor: EditorUser) -> Eps:
    obj = Eps(**payload.model_dump())
    db.add(obj)
    db.flush()
    log_audit(db, actor, "create", "eps", obj.id, after=model_to_dict(obj))
    commit(db)
    db.refresh(obj)
    return obj


@router.patch("/eps/{eps_id}", response_model=EpsRead)
def update_eps(db: DbSession, eps_id: int, payload: EpsUpdate, actor: EditorUser) -> Eps:
    obj = get_or_404(db, Eps, eps_id, "EPS")
    before = model_to_dict(obj)
    apply_updates(obj, payload)
    db.flush()
    log_audit(db, actor, "update", "eps", obj.id, before=before, after=model_to_dict(obj))
    commit(db)
    db.refresh(obj)
    return obj


@router.delete("/eps/{eps_id}", response_model=EpsRead)
def delete_eps(db: DbSession, eps_id: int, actor: EditorUser) -> Eps:
    obj = get_or_404(db, Eps, eps_id, "EPS")
    if obj.monthly_records:
        raise HTTPException(
            status_code=409,
            detail="No se puede eliminar la EPS porque tiene registros mensuales asociados",
        )
    before = model_to_dict(obj)
    db.delete(obj)
    log_audit(db, actor, "delete", "eps", eps_id, before=before)
    commit(db)
    return obj


@router.get("/programs", response_model=list[ProgramRead])
def list_programs(
    db: DbSession,
    _: ReadUser,
    active: bool | None = None,
    search: str | None = None,
) -> list[Program]:
    stmt = select(Program).order_by(Program.name)
    if active is not None:
        stmt = stmt.where(Program.active == active)
    if search:
        stmt = stmt.where(Program.name.ilike(f"%{search}%"))
    return list(db.scalars(stmt).all())


@router.post("/programs", response_model=ProgramRead, status_code=status.HTTP_201_CREATED)
def create_program(db: DbSession, payload: ProgramCreate, actor: EditorUser) -> Program:
    obj = Program(**payload.model_dump())
    db.add(obj)
    db.flush()
    log_audit(db, actor, "create", "program", obj.id, after=model_to_dict(obj))
    commit(db)
    db.refresh(obj)
    return obj


@router.patch("/programs/{program_id}", response_model=ProgramRead)
def update_program(
    db: DbSession, program_id: int, payload: ProgramUpdate, actor: EditorUser
) -> Program:
    obj = get_or_404(db, Program, program_id, "Programa")
    before = model_to_dict(obj)
    apply_updates(obj, payload)
    db.flush()
    log_audit(db, actor, "update", "program", obj.id, before=before, after=model_to_dict(obj))
    commit(db)
    db.refresh(obj)
    return obj


@router.delete("/programs/{program_id}", response_model=ProgramRead)
def delete_program(db: DbSession, program_id: int, actor: EditorUser) -> Program:
    obj = get_or_404(db, Program, program_id, "Programa")
    if obj.monthly_records:
        raise HTTPException(
            status_code=409,
            detail="No se puede eliminar el programa porque tiene registros mensuales asociados",
        )
    if obj.indicators:
        raise HTTPException(
            status_code=409,
            detail="No se puede eliminar el programa porque tiene indicadores asociados",
        )
    before = model_to_dict(obj)
    db.delete(obj)
    log_audit(db, actor, "delete", "program", program_id, before=before)
    commit(db)
    return obj


@router.get("/indicators", response_model=list[IndicatorRead])
def list_indicators(
    db: DbSession,
    _: ReadUser,
    program_id: int | None = None,
    active: bool | None = None,
    search: str | None = None,
) -> list[IndicatorRead]:
    stmt = (
        select(Indicator, Program.name)
        .join(Program, Indicator.program_id == Program.id)
        .order_by(Program.name, Indicator.name)
    )
    if program_id is not None:
        stmt = stmt.where(Indicator.program_id == program_id)
    if active is not None:
        stmt = stmt.where(Indicator.active == active)
    if search:
        stmt = stmt.where(Indicator.name.ilike(f"%{search}%"))
    return [indicator_read(indicator, program_name) for indicator, program_name in db.execute(stmt)]


@router.post("/indicators", response_model=IndicatorRead, status_code=status.HTTP_201_CREATED)
def create_indicator(db: DbSession, payload: IndicatorCreate, actor: EditorUser) -> IndicatorRead:
    program = get_or_404(db, Program, payload.program_id, "Programa")
    obj = Indicator(**payload.model_dump())
    db.add(obj)
    db.flush()
    log_audit(db, actor, "create", "indicator", obj.id, after=model_to_dict(obj))
    commit(db)
    db.refresh(obj)
    return indicator_read(obj, program.name)


@router.patch("/indicators/{indicator_id}", response_model=IndicatorRead)
def update_indicator(
    db: DbSession, indicator_id: int, payload: IndicatorUpdate, actor: EditorUser
) -> IndicatorRead:
    obj = get_or_404(db, Indicator, indicator_id, "Indicador")
    if payload.program_id is not None:
        get_or_404(db, Program, payload.program_id, "Programa")
    before = model_to_dict(obj)
    apply_updates(obj, payload)
    db.flush()
    log_audit(db, actor, "update", "indicator", obj.id, before=before, after=model_to_dict(obj))
    commit(db)
    db.refresh(obj)
    program = get_or_404(db, Program, obj.program_id, "Programa")
    return indicator_read(obj, program.name)


@router.delete("/indicators/{indicator_id}", response_model=IndicatorRead)
def delete_indicator(db: DbSession, indicator_id: int, actor: EditorUser) -> IndicatorRead:
    obj = get_or_404(db, Indicator, indicator_id, "Indicador")
    if obj.monthly_records:
        raise HTTPException(
            status_code=409,
            detail="No se puede eliminar el indicador porque tiene registros mensuales asociados",
        )
    program = get_or_404(db, Program, obj.program_id, "Programa")
    before = model_to_dict(obj)
    db.delete(obj)
    log_audit(db, actor, "delete", "indicator", indicator_id, before=before)
    commit(db)
    return indicator_read(obj, program.name)
