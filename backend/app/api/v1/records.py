from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.api.deps import DbSession, EditorUser, ReadUser
from app.db.models import (
    AnnualHistory,
    CancerMortality,
    ConsolidadoRecord,
    Eps,
    Indicator,
    MonthlyRecord,
    Population,
    Program,
    RiskFactor,
)
from app.schemas.common import Page
from app.schemas.records import (
    AnnualHistoryCreate,
    AnnualHistoryRead,
    AnnualHistoryUpdate,
    CancerMortalityCreate,
    CancerMortalityRead,
    CancerMortalityUpdate,
    ConsolidadoCreate,
    ConsolidadoRead,
    ConsolidadoUpdate,
    MonthlyRecordCreate,
    MonthlyRecordRead,
    MonthlyRecordUpdate,
    PopulationCreate,
    PopulationRead,
    PopulationUpdate,
    RiskFactorCreate,
    RiskFactorRead,
    RiskFactorUpdate,
)
from app.services.common import (
    apply_updates,
    commit,
    get_or_404,
    log_audit,
    model_to_dict,
    paginate,
)

router = APIRouter(prefix="/data", tags=["data"])


def monthly_read(
    record: MonthlyRecord,
    program_name: str | None = None,
    indicator_name: str | None = None,
    eps_name: str | None = None,
) -> MonthlyRecordRead:
    data = MonthlyRecordRead.model_validate(record)
    data.program_name = program_name or record.program.name
    data.indicator_name = indicator_name or record.indicator.name
    data.eps_name = eps_name or record.eps.name
    return data


def validate_monthly_refs(
    db: DbSession,
    payload: MonthlyRecordCreate | MonthlyRecordUpdate,
    current: MonthlyRecord | None = None,
) -> None:
    data = payload.model_dump(exclude_unset=True)
    program_id = data.get("program_id", current.program_id if current else None)
    indicator_id = data.get("indicator_id", current.indicator_id if current else None)
    eps_id = data.get("eps_id")
    if program_id is not None:
        get_or_404(db, Program, program_id, "Programa")
    if eps_id is not None:
        get_or_404(db, Eps, eps_id, "EPS")
    if indicator_id is not None:
        indicator = get_or_404(db, Indicator, indicator_id, "Indicador")
        if program_id is not None and indicator.program_id != program_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="El indicador no pertenece al programa seleccionado",
            )


@router.get("/monthly", response_model=Page[MonthlyRecordRead])
def list_monthly(
    db: DbSession,
    _: ReadUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    program_id: int | None = None,
    indicator_id: int | None = None,
    eps_id: int | None = None,
    year: int | None = None,
    month: int | None = Query(default=None, ge=1, le=12),
    program: str | None = None,
    indicator: str | None = None,
    eps: str | None = None,
) -> Page[MonthlyRecordRead]:
    stmt = (
        select(MonthlyRecord, Program.name, Indicator.name, Eps.name)
        .join(Program, MonthlyRecord.program_id == Program.id)
        .join(Indicator, MonthlyRecord.indicator_id == Indicator.id)
        .join(Eps, MonthlyRecord.eps_id == Eps.id)
        .order_by(MonthlyRecord.year.desc(), MonthlyRecord.month.desc(), Program.name, Eps.name)
    )
    if program_id is not None:
        stmt = stmt.where(MonthlyRecord.program_id == program_id)
    if indicator_id is not None:
        stmt = stmt.where(MonthlyRecord.indicator_id == indicator_id)
    if eps_id is not None:
        stmt = stmt.where(MonthlyRecord.eps_id == eps_id)
    if year is not None:
        stmt = stmt.where(MonthlyRecord.year == year)
    if month is not None:
        stmt = stmt.where(MonthlyRecord.month == month)
    if program:
        stmt = stmt.where(Program.name.ilike(f"%{program}%"))
    if indicator:
        stmt = stmt.where(Indicator.name.ilike(f"%{indicator}%"))
    if eps:
        stmt = stmt.where(Eps.name.ilike(f"%{eps}%"))
    rows, total = paginate(db, stmt, page, page_size)
    return Page(
        items=[monthly_read(*row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/monthly", response_model=MonthlyRecordRead, status_code=status.HTTP_201_CREATED)
def create_monthly(
    db: DbSession, payload: MonthlyRecordCreate, actor: EditorUser
) -> MonthlyRecordRead:
    validate_monthly_refs(db, payload)
    obj = MonthlyRecord(**payload.model_dump())
    db.add(obj)
    db.flush()
    log_audit(db, actor, "create", "monthly_record", obj.id, after=model_to_dict(obj))
    commit(db)
    db.refresh(obj)
    return monthly_read(obj)


@router.get("/monthly/{record_id}", response_model=MonthlyRecordRead)
def get_monthly(db: DbSession, record_id: int, _: ReadUser) -> MonthlyRecordRead:
    return monthly_read(get_or_404(db, MonthlyRecord, record_id, "Registro mensual"))


@router.patch("/monthly/{record_id}", response_model=MonthlyRecordRead)
def update_monthly(
    db: DbSession, record_id: int, payload: MonthlyRecordUpdate, actor: EditorUser
) -> MonthlyRecordRead:
    obj = get_or_404(db, MonthlyRecord, record_id, "Registro mensual")
    validate_monthly_refs(db, payload, obj)
    before = model_to_dict(obj)
    apply_updates(obj, payload)
    db.flush()
    log_audit(
        db, actor, "update", "monthly_record", obj.id, before=before, after=model_to_dict(obj)
    )
    commit(db)
    db.refresh(obj)
    return monthly_read(obj)


@router.delete("/monthly/{record_id}", response_model=MonthlyRecordRead)
def delete_monthly(db: DbSession, record_id: int, actor: EditorUser) -> MonthlyRecordRead:
    obj = get_or_404(db, MonthlyRecord, record_id, "Registro mensual")
    before = model_to_dict(obj)
    result = monthly_read(obj)
    db.delete(obj)
    log_audit(db, actor, "delete", "monthly_record", record_id, before=before)
    commit(db)
    return result


def _simple_list(
    db: DbSession,
    stmt,
    model,
    read_schema,
    page: int,
    page_size: int,
) -> Page:
    rows, total = paginate(db, stmt, page, page_size)
    return Page(
        items=[read_schema.model_validate(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/annual-history", response_model=Page[AnnualHistoryRead])
def list_annual_history(
    db: DbSession,
    _: ReadUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(500, ge=1, le=500),
    indicator_name: str | None = None,
    eps_name: str | None = None,
    year: int | None = None,
) -> Page[AnnualHistoryRead]:
    stmt = select(AnnualHistory).order_by(AnnualHistory.year, AnnualHistory.indicator_name)
    if indicator_name:
        stmt = stmt.where(AnnualHistory.indicator_name.ilike(f"%{indicator_name}%"))
    if eps_name:
        stmt = stmt.where(AnnualHistory.eps_name.ilike(f"%{eps_name}%"))
    if year is not None:
        stmt = stmt.where(AnnualHistory.year == year)
    return _simple_list(db, stmt, AnnualHistory, AnnualHistoryRead, page, page_size)


@router.post("/annual-history", response_model=AnnualHistoryRead, status_code=201)
def create_annual_history(
    db: DbSession, payload: AnnualHistoryCreate, actor: EditorUser
) -> AnnualHistory:
    obj = AnnualHistory(**payload.model_dump())
    db.add(obj)
    db.flush()
    log_audit(db, actor, "create", "annual_history", obj.id, after=model_to_dict(obj))
    commit(db)
    db.refresh(obj)
    return obj


@router.patch("/annual-history/{record_id}", response_model=AnnualHistoryRead)
def update_annual_history(
    db: DbSession, record_id: int, payload: AnnualHistoryUpdate, actor: EditorUser
) -> AnnualHistory:
    obj = get_or_404(db, AnnualHistory, record_id, "Registro histórico")
    before = model_to_dict(obj)
    apply_updates(obj, payload)
    db.flush()
    log_audit(
        db, actor, "update", "annual_history", obj.id, before=before, after=model_to_dict(obj)
    )
    commit(db)
    db.refresh(obj)
    return obj


@router.delete("/annual-history/{record_id}", response_model=AnnualHistoryRead)
def delete_annual_history(db: DbSession, record_id: int, actor: EditorUser) -> AnnualHistory:
    obj = get_or_404(db, AnnualHistory, record_id, "Registro histórico")
    before = model_to_dict(obj)
    db.delete(obj)
    log_audit(db, actor, "delete", "annual_history", record_id, before=before)
    commit(db)
    return obj


@router.get("/cancer-mortality", response_model=Page[CancerMortalityRead])
def list_cancer_mortality(
    db: DbSession,
    _: ReadUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(500, ge=1, le=500),
    indicator: str | None = None,
    year: int | None = None,
) -> Page[CancerMortalityRead]:
    stmt = select(CancerMortality).order_by(CancerMortality.year, CancerMortality.indicator)
    if indicator:
        stmt = stmt.where(CancerMortality.indicator.ilike(f"%{indicator}%"))
    if year is not None:
        stmt = stmt.where(CancerMortality.year == year)
    return _simple_list(db, stmt, CancerMortality, CancerMortalityRead, page, page_size)


@router.post("/cancer-mortality", response_model=CancerMortalityRead, status_code=201)
def create_cancer_mortality(
    db: DbSession, payload: CancerMortalityCreate, actor: EditorUser
) -> CancerMortality:
    obj = CancerMortality(**payload.model_dump())
    db.add(obj)
    db.flush()
    log_audit(db, actor, "create", "cancer_mortality", obj.id, after=model_to_dict(obj))
    commit(db)
    db.refresh(obj)
    return obj


@router.patch("/cancer-mortality/{record_id}", response_model=CancerMortalityRead)
def update_cancer_mortality(
    db: DbSession, record_id: int, payload: CancerMortalityUpdate, actor: EditorUser
) -> CancerMortality:
    obj = get_or_404(db, CancerMortality, record_id, "Registro de mortalidad")
    before = model_to_dict(obj)
    apply_updates(obj, payload)
    db.flush()
    log_audit(
        db, actor, "update", "cancer_mortality", obj.id, before=before, after=model_to_dict(obj)
    )
    commit(db)
    db.refresh(obj)
    return obj


@router.delete("/cancer-mortality/{record_id}", response_model=CancerMortalityRead)
def delete_cancer_mortality(db: DbSession, record_id: int, actor: EditorUser) -> CancerMortality:
    obj = get_or_404(db, CancerMortality, record_id, "Registro de mortalidad")
    before = model_to_dict(obj)
    db.delete(obj)
    log_audit(db, actor, "delete", "cancer_mortality", record_id, before=before)
    commit(db)
    return obj


@router.get("/population", response_model=Page[PopulationRead])
def list_population(
    db: DbSession,
    _: ReadUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(500, ge=1, le=500),
    year_from: int | None = None,
    year_to: int | None = None,
) -> Page[PopulationRead]:
    stmt = select(Population).order_by(Population.year)
    if year_from is not None:
        stmt = stmt.where(Population.year >= year_from)
    if year_to is not None:
        stmt = stmt.where(Population.year <= year_to)
    return _simple_list(db, stmt, Population, PopulationRead, page, page_size)


@router.post("/population", response_model=PopulationRead, status_code=201)
def create_population(db: DbSession, payload: PopulationCreate, actor: EditorUser) -> Population:
    obj = Population(**payload.model_dump())
    db.add(obj)
    db.flush()
    log_audit(db, actor, "create", "population", obj.id, after=model_to_dict(obj))
    commit(db)
    db.refresh(obj)
    return obj


@router.patch("/population/{record_id}", response_model=PopulationRead)
def update_population(
    db: DbSession, record_id: int, payload: PopulationUpdate, actor: EditorUser
) -> Population:
    obj = get_or_404(db, Population, record_id, "Registro de población")
    before = model_to_dict(obj)
    apply_updates(obj, payload)
    db.flush()
    log_audit(db, actor, "update", "population", obj.id, before=before, after=model_to_dict(obj))
    commit(db)
    db.refresh(obj)
    return obj


@router.delete("/population/{record_id}", response_model=PopulationRead)
def delete_population(db: DbSession, record_id: int, actor: EditorUser) -> Population:
    obj = get_or_404(db, Population, record_id, "Registro de población")
    before = model_to_dict(obj)
    db.delete(obj)
    log_audit(db, actor, "delete", "population", record_id, before=before)
    commit(db)
    return obj


@router.get("/risk-factors", response_model=Page[RiskFactorRead])
def list_risk_factors(
    db: DbSession,
    _: ReadUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(500, ge=1, le=500),
    age_group: str | None = None,
    indicator_name: str | None = None,
) -> Page[RiskFactorRead]:
    stmt = select(RiskFactor).order_by(RiskFactor.age_group, RiskFactor.indicator_name)
    if age_group:
        stmt = stmt.where(RiskFactor.age_group.ilike(f"%{age_group}%"))
    if indicator_name:
        stmt = stmt.where(RiskFactor.indicator_name.ilike(f"%{indicator_name}%"))
    return _simple_list(db, stmt, RiskFactor, RiskFactorRead, page, page_size)


@router.post("/risk-factors", response_model=RiskFactorRead, status_code=201)
def create_risk_factor(
    db: DbSession, payload: RiskFactorCreate, actor: EditorUser
) -> RiskFactor:
    obj = RiskFactor(**payload.model_dump())
    db.add(obj)
    db.flush()
    log_audit(db, actor, "create", "risk_factor", obj.id, after=model_to_dict(obj))
    commit(db)
    db.refresh(obj)
    return obj


@router.patch("/risk-factors/{record_id}", response_model=RiskFactorRead)
def update_risk_factor(
    db: DbSession, record_id: int, payload: RiskFactorUpdate, actor: EditorUser
) -> RiskFactor:
    obj = get_or_404(db, RiskFactor, record_id, "Factor de riesgo")
    before = model_to_dict(obj)
    apply_updates(obj, payload)
    db.flush()
    log_audit(db, actor, "update", "risk_factor", obj.id, before=before, after=model_to_dict(obj))
    commit(db)
    db.refresh(obj)
    return obj


@router.delete("/risk-factors/{record_id}", response_model=RiskFactorRead)
def delete_risk_factor(db: DbSession, record_id: int, actor: EditorUser) -> RiskFactor:
    obj = get_or_404(db, RiskFactor, record_id, "Factor de riesgo")
    before = model_to_dict(obj)
    db.delete(obj)
    log_audit(db, actor, "delete", "risk_factor", record_id, before=before)
    commit(db)
    return obj


@router.get("/consolidado", response_model=Page[ConsolidadoRead])
def list_consolidado(
    db: DbSession,
    _: ReadUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(500, ge=1, le=500),
    program: str | None = None,
    indicator: str | None = None,
    eps: str | None = None,
) -> Page[ConsolidadoRead]:
    stmt = select(ConsolidadoRecord).order_by(
        ConsolidadoRecord.program, ConsolidadoRecord.indicator, ConsolidadoRecord.eps
    )
    if program:
        stmt = stmt.where(ConsolidadoRecord.program.ilike(f"%{program}%"))
    if indicator:
        stmt = stmt.where(ConsolidadoRecord.indicator.ilike(f"%{indicator}%"))
    if eps:
        stmt = stmt.where(ConsolidadoRecord.eps.ilike(f"%{eps}%"))
    return _simple_list(db, stmt, ConsolidadoRecord, ConsolidadoRead, page, page_size)


@router.post("/consolidado", response_model=ConsolidadoRead, status_code=201)
def create_consolidado(
    db: DbSession, payload: ConsolidadoCreate, actor: EditorUser
) -> ConsolidadoRecord:
    obj = ConsolidadoRecord(**payload.model_dump())
    db.add(obj)
    db.flush()
    log_audit(db, actor, "create", "consolidado", obj.id, after=model_to_dict(obj))
    commit(db)
    db.refresh(obj)
    return obj


@router.patch("/consolidado/{record_id}", response_model=ConsolidadoRead)
def update_consolidado(
    db: DbSession, record_id: int, payload: ConsolidadoUpdate, actor: EditorUser
) -> ConsolidadoRecord:
    obj = get_or_404(db, ConsolidadoRecord, record_id, "Registro consolidado")
    before = model_to_dict(obj)
    apply_updates(obj, payload)
    db.flush()
    log_audit(db, actor, "update", "consolidado", obj.id, before=before, after=model_to_dict(obj))
    commit(db)
    db.refresh(obj)
    return obj


@router.delete("/consolidado/{record_id}", response_model=ConsolidadoRead)
def delete_consolidado(db: DbSession, record_id: int, actor: EditorUser) -> ConsolidadoRecord:
    obj = get_or_404(db, ConsolidadoRecord, record_id, "Registro consolidado")
    before = model_to_dict(obj)
    db.delete(obj)
    log_audit(db, actor, "delete", "consolidado", record_id, before=before)
    commit(db)
    return obj


@router.get("/annual-history/{record_id}", response_model=AnnualHistoryRead)
def get_annual_history(db: DbSession, record_id: int, _: ReadUser) -> AnnualHistory:
    return get_or_404(db, AnnualHistory, record_id, "Registro histórico")


@router.get("/cancer-mortality/{record_id}", response_model=CancerMortalityRead)
def get_cancer_mortality(db: DbSession, record_id: int, _: ReadUser) -> CancerMortality:
    return get_or_404(db, CancerMortality, record_id, "Registro de mortalidad")


@router.get("/population/{record_id}", response_model=PopulationRead)
def get_population(db: DbSession, record_id: int, _: ReadUser) -> Population:
    return get_or_404(db, Population, record_id, "Registro de población")


@router.get("/risk-factors/{record_id}", response_model=RiskFactorRead)
def get_risk_factor(db: DbSession, record_id: int, _: ReadUser) -> RiskFactor:
    return get_or_404(db, RiskFactor, record_id, "Factor de riesgo")


@router.get("/consolidado/{record_id}", response_model=ConsolidadoRead)
def get_consolidado(db: DbSession, record_id: int, _: ReadUser) -> ConsolidadoRecord:
    return get_or_404(db, ConsolidadoRecord, record_id, "Registro consolidado")
