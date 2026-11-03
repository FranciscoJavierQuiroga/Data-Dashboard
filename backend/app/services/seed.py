from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.db.models import (
    AnnualHistory,
    CancerMortality,
    ImportBatch,
    MonthlyRecord,
    Population,
    User,
)
from app.services.import_service import apply_dataset
from app.services.importers.base import ParsedDataset
from app.services.importers.normalization import (
    clean_int,
    clean_number,
    month_number,
    normalize_eps,
    normalize_indicator,
    normalize_program,
)

logger = logging.getLogger(__name__)


def ensure_admin(db: Session) -> User:
    email = settings.admin_email.lower().strip()
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(
            email=email,
            full_name=settings.admin_name,
            hashed_password=hash_password(settings.admin_password),
            role="admin",
            active=True,
        )
        db.add(user)
        db.flush()
        logger.info("Usuario administrador creado: %s", email)
    return user


def _read_json(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8-sig") as file:
        data = json.load(file)
    return data if isinstance(data, list) else []


def _seed_batch(
    db: Session, user: User, filename: str, dataset_type: str, parsed: ParsedDataset
) -> None:
    batch = ImportBatch(
        filename=f"seed/{filename}",
        original_name=filename,
        sha256=f"seed-{dataset_type}-{filename}",
        dataset_type=dataset_type,
        status="uploaded",
        uploaded_by_id=user.id,
    )
    db.add(batch)
    db.flush()
    apply_dataset(db, parsed, batch)


def _monthly_from_json(rows: list[dict[str, Any]]) -> ParsedDataset:
    parsed = ParsedDataset(dataset_type="consolidado")
    seen: set[tuple[str, str, str, int]] = set()
    for row in rows:
        program = normalize_program(row.get("PROGRAMA"))
        indicator = normalize_indicator(row.get("TIPO_INDICADOR"))
        eps = normalize_eps(row.get("EPS"))
        month = month_number(row.get("MES"))
        value = clean_number(row.get("VALOR_MES"))
        if not program or not indicator or not eps or month is None or value is None:
            continue
        key = (program, indicator, eps, month)
        if key in seen:
            continue
        seen.add(key)
        parsed.rows.append(
            {
                "program": program,
                "indicator": indicator,
                "eps": eps,
                "year": 2026,
                "month": month,
                "value": value,
                "target": clean_number(row.get("META_2026")),
                "population": clean_int(row.get("POBLACION_CORTE")),
                "source_accumulated": clean_number(row.get("ACUMULADO_ACTIVIDADES")),
                "source_pct_execution": clean_number(row.get("PCT_EJECUCION")),
                "numerator": None,
                "denominator": None,
                "estimation": None,
                "line_base": None,
            }
        )
    parsed.summary = {"monthly_rows": len(parsed.rows), "source": "operativo_mensual.json"}
    return parsed


def _consolidado_from_json(rows: list[dict[str, Any]]) -> ParsedDataset:
    parsed = ParsedDataset(dataset_type="consolidado")
    for row in rows:
        execution = clean_number(row.get("EJECUCION"))
        parsed.consolidado_rows.append(
            {
                "program": normalize_program(row.get("PROGRAMA")),
                "indicator": normalize_indicator(row.get("TIPO_INDICADOR")),
                "indicator_name": row.get("NOMBRE_INDICADOR"),
                "eps": normalize_eps(row.get("EPS")),
                "execution": execution,
                "compliance_advance": clean_number(row.get("Avance_Cumplimiento")),
            }
        )
    parsed.summary = {
        "consolidado_rows": len(parsed.consolidado_rows),
        "source": "consolidado_eps.json",
    }
    return parsed


def _historico_from_json(rows: list[dict[str, Any]]) -> ParsedDataset:
    parsed = ParsedDataset(dataset_type="historico")
    for row in rows:
        value = clean_number(row.get("VALOR"))
        year = clean_int(row.get("AÑO") or row.get("AÃ‘O"))
        if value is None or year is None:
            continue
        parsed.rows.append(
            {
                "indicator_name": row.get("INDICADOR_CLEAN"),
                "eps_name": row.get("EPS_CLEAN"),
                "year": year,
                "value": value,
            }
        )
    parsed.summary = {"rows": len(parsed.rows), "source": "historico.json"}
    return parsed


def _cancer_from_json(rows: list[dict[str, Any]]) -> ParsedDataset:
    parsed = ParsedDataset(dataset_type="comportamiento")
    for row in rows:
        cases = clean_int(row.get("cases"))
        year = clean_int(row.get("year"))
        if cases is None or year is None or not row.get("indicador"):
            continue
        parsed.rows.append({"indicator": row["indicador"], "year": year, "cases": cases})
    parsed.summary = {"rows": len(parsed.rows), "source": "comportamiento_cancer.json"}
    return parsed


def _population_from_json(rows: list[dict[str, Any]]) -> ParsedDataset:
    parsed = ParsedDataset(dataset_type="poblacion")
    for row in rows:
        year = clean_int(row.get("year"))
        population = clean_int(row.get("poblacion"))
        if year is None or population is None:
            continue
        parsed.rows.append({"year": year, "population": population})
    parsed.summary = {"rows": len(parsed.rows), "source": "poblacion_sogamoso.json"}
    return parsed


def seed_from_json(db: Session, data_dir: str | Path | None = None) -> dict[str, int]:
    base = Path(data_dir or settings.seed_data_dir)
    counts = {
        "monthly": 0,
        "consolidado": 0,
        "historico": 0,
        "comportamiento": 0,
        "poblacion": 0,
    }
    user = ensure_admin(db)
    if not base.exists():
        db.commit()
        logger.warning("No existe el directorio de datos semilla: %s", base)
        return counts

    if db.scalar(select(func.count()).select_from(MonthlyRecord)) == 0:
        path = base / "operativo_mensual.json"
        if path.exists():
            parsed = _monthly_from_json(_read_json(path))
            _seed_batch(db, user, path.name, "consolidado", parsed)
            counts["monthly"] = len(parsed.rows)

    seeded = db.scalar(
        select(func.count())
        .select_from(ImportBatch)
        .where(ImportBatch.filename == "seed/consolidado_eps.json")
    )
    if seeded == 0:
        path = base / "consolidado_eps.json"
        if path.exists():
            parsed = _consolidado_from_json(_read_json(path))
            _seed_batch(db, user, path.name, "consolidado", parsed)
            counts["consolidado"] = len(parsed.consolidado_rows)

    if db.scalar(select(func.count()).select_from(AnnualHistory)) == 0:
        path = base / "historico.json"
        if path.exists():
            parsed = _historico_from_json(_read_json(path))
            _seed_batch(db, user, path.name, "historico", parsed)
            counts["historico"] = len(parsed.rows)

    if db.scalar(select(func.count()).select_from(CancerMortality)) == 0:
        path = base / "comportamiento_cancer.json"
        if path.exists():
            parsed = _cancer_from_json(_read_json(path))
            _seed_batch(db, user, path.name, "comportamiento", parsed)
            counts["comportamiento"] = len(parsed.rows)

    if db.scalar(select(func.count()).select_from(Population)) == 0:
        path = base / "poblacion_sogamoso.json"
        if path.exists():
            parsed = _population_from_json(_read_json(path))
            _seed_batch(db, user, path.name, "poblacion", parsed)
            counts["poblacion"] = len(parsed.rows)

    db.commit()
    logger.info("Datos semilla cargados: %s", counts)
    return counts
