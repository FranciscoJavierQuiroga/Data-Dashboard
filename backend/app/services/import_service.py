from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

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
from app.services.common import (
    get_or_create_eps,
    get_or_create_indicator,
    get_or_create_program,
    model_to_dict,
)
from app.services.importers.base import ParsedDataset
from app.services.importers.normalization import indicator_kind


@dataclass
class ImportApplyResult:
    inserted: int
    updated: int
    skipped: int


def _record_change(
    changes: list[dict[str, Any]],
    model: str,
    obj_id: int,
    action: str,
    before: dict[str, Any] | None,
) -> None:
    changes.append(
        {
            "model": model,
            "id": obj_id,
            "action": action,
            "before": before,
        }
    )


def apply_dataset(
    db: Session,
    parsed: ParsedDataset,
    batch: ImportBatch,
) -> ImportApplyResult:
    inserted = 0
    updated = 0
    skipped = 0
    changes: list[dict[str, Any]] = []
    eps_cache: dict[str, Eps] = {}
    program_cache: dict[str, Program] = {}
    indicator_cache: dict[tuple[int, str], Indicator] = {}

    if parsed.dataset_type == "consolidado":
        for row in parsed.rows:
            eps = get_or_create_eps(db, row["eps"], eps_cache)
            program = get_or_create_program(db, row["program"], program_cache)
            indicator = get_or_create_indicator(
                db,
                program,
                row["indicator"],
                indicator_kind(row["indicator"]),
                indicator_cache,
            )
            existing = db.scalar(
                select(MonthlyRecord).where(
                    MonthlyRecord.program_id == program.id,
                    MonthlyRecord.indicator_id == indicator.id,
                    MonthlyRecord.eps_id == eps.id,
                    MonthlyRecord.year == row["year"],
                    MonthlyRecord.month == row["month"],
                )
            )
            before = model_to_dict(existing) if existing else None
            if existing is None:
                existing = MonthlyRecord(
                    program_id=program.id,
                    indicator_id=indicator.id,
                    eps_id=eps.id,
                    year=row["year"],
                    month=row["month"],
                )
                db.add(existing)
                db.flush()
                inserted += 1
                action = "created"
            else:
                updated += 1
                action = "updated"
            existing.value = row["value"]
            existing.source_accumulated = row.get("source_accumulated")
            existing.source_pct_execution = row.get("source_pct_execution")
            existing.target = row.get("target")
            existing.population = row.get("population")
            existing.numerator = row.get("numerator")
            existing.denominator = row.get("denominator")
            existing.estimation = row.get("estimation")
            existing.line_base = row.get("line_base")
            existing.source_import_id = batch.id
            _record_change(changes, "monthly", existing.id, action, before)

        for row in parsed.consolidado_rows:
            program = get_or_create_program(db, row["program"], program_cache)
            indicator = get_or_create_indicator(
                db,
                program,
                row["indicator"],
                indicator_kind(row["indicator"]),
                indicator_cache,
            )
            get_or_create_eps(db, row["eps"], eps_cache)
            existing = db.scalar(
                select(ConsolidadoRecord).where(
                    ConsolidadoRecord.program == row["program"],
                    ConsolidadoRecord.indicator == row["indicator"],
                    ConsolidadoRecord.eps == row["eps"],
                )
            )
            before = model_to_dict(existing) if existing else None
            if existing is None:
                existing = ConsolidadoRecord(
                    program=row["program"],
                    indicator=row["indicator"],
                    eps=row["eps"],
                )
                db.add(existing)
                db.flush()
                inserted += 1
                action = "created"
            else:
                updated += 1
                action = "updated"
            existing.indicator_name = row.get("indicator_name")
            existing.execution = row.get("execution")
            existing.compliance_advance = row.get("compliance_advance")
            existing.source_import_id = batch.id
            _record_change(changes, "consolidado", existing.id, action, before)

    elif parsed.dataset_type == "historico":
        for row in parsed.rows:
            existing = db.scalar(
                select(AnnualHistory).where(
                    AnnualHistory.indicator_name == row["indicator_name"],
                    AnnualHistory.eps_name == row["eps_name"],
                    AnnualHistory.year == row["year"],
                )
            )
            before = model_to_dict(existing) if existing else None
            if existing is None:
                existing = AnnualHistory(
                    indicator_name=row["indicator_name"],
                    eps_name=row["eps_name"],
                    year=row["year"],
                    value=row["value"],
                )
                db.add(existing)
                db.flush()
                inserted += 1
                action = "created"
            else:
                updated += 1
                action = "updated"
                existing.value = row["value"]
            existing.source_import_id = batch.id
            _record_change(changes, "annual_history", existing.id, action, before)

    elif parsed.dataset_type == "comportamiento":
        for row in parsed.rows:
            existing = db.scalar(
                select(CancerMortality).where(
                    CancerMortality.indicator == row["indicator"],
                    CancerMortality.year == row["year"],
                )
            )
            before = model_to_dict(existing) if existing else None
            if existing is None:
                existing = CancerMortality(
                    indicator=row["indicator"],
                    year=row["year"],
                    cases=row["cases"],
                )
                db.add(existing)
                db.flush()
                inserted += 1
                action = "created"
            else:
                updated += 1
                action = "updated"
                existing.cases = row["cases"]
            existing.source_import_id = batch.id
            _record_change(changes, "cancer_mortality", existing.id, action, before)

    elif parsed.dataset_type == "poblacion":
        for row in parsed.rows:
            existing = db.scalar(select(Population).where(Population.year == row["year"]))
            before = model_to_dict(existing) if existing else None
            if existing is None:
                existing = Population(year=row["year"], population=row["population"])
                db.add(existing)
                db.flush()
                inserted += 1
                action = "created"
            else:
                updated += 1
                action = "updated"
                existing.population = row["population"]
            existing.source_import_id = batch.id
            _record_change(changes, "population", existing.id, action, before)

    elif parsed.dataset_type == "factores_riesgo":
        for row in parsed.rows:
            existing = db.scalar(
                select(RiskFactor).where(
                    RiskFactor.age_group == row["age_group"],
                    RiskFactor.indicator_name == row["indicator_name"],
                )
            )
            before = model_to_dict(existing) if existing else None
            if existing is None:
                existing = RiskFactor(
                    age_group=row["age_group"],
                    indicator_name=row["indicator_name"],
                )
                db.add(existing)
                db.flush()
                inserted += 1
                action = "created"
            else:
                updated += 1
                action = "updated"
            existing.value_pct = row.get("value_pct")
            existing.numerator = row.get("numerator")
            existing.denominator = row.get("denominator")
            existing.source_import_id = batch.id
            _record_change(changes, "risk_factor", existing.id, action, before)
    else:
        skipped = len(parsed.rows)

    batch.status = "committed"
    batch.row_count = len(parsed.rows) + len(parsed.consolidado_rows)
    batch.error_count = len(parsed.errors)
    batch.warning_count = len(parsed.warnings)
    batch.summary = parsed.summary
    batch.errors = parsed.errors
    batch.warnings = parsed.warnings
    batch.preview = parsed.preview
    batch.rollback_payload = {"changes": changes}
    batch.committed_at = datetime.now(UTC)
    db.flush()
    return ImportApplyResult(inserted=inserted, updated=updated, skipped=skipped)


MODEL_MAP = {
    "monthly": MonthlyRecord,
    "consolidado": ConsolidadoRecord,
    "annual_history": AnnualHistory,
    "cancer_mortality": CancerMortality,
    "population": Population,
    "risk_factor": RiskFactor,
}


def rollback_import(db: Session, batch: ImportBatch) -> int:
    if batch.status != "committed" or not batch.rollback_payload:
        raise ValueError("La importación no se puede revertir")
    changes = list(batch.rollback_payload.get("changes", []))
    reverted = 0
    for change in reversed(changes):
        model = MODEL_MAP.get(change.get("model"))
        if model is None:
            continue
        obj = db.get(model, change.get("id"))
        if obj is None:
            continue
        if change.get("action") == "created":
            db.delete(obj)
            reverted += 1
        else:
            before = change.get("before") or {}
            for field, value in before.items():
                if field in {"id", "created_at", "updated_at"}:
                    continue
                if hasattr(obj, field):
                    setattr(obj, field, value)
            reverted += 1
        db.flush()
    batch.status = "rolled_back"
    batch.rollback_payload = None
    db.flush()
    return reverted
