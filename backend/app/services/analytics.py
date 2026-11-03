from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import (
    AnnualHistory,
    CancerMortality,
    ConsolidadoRecord,
    Eps,
    Indicator,
    MonthlyRecord,
    Population,
    Program,
)
from app.services.importers.normalization import MONTHS
from app.services.projection import build_projection

EPS_ORDER = [
    "Nueva Eps",
    "Sanitas",
    "Coosalud",
    "Famisanar",
    "Salud Total",
    "Proteger",
    "Cajacopi",
]

KPI_MAP = {
    "Dt Cervix": [
        ("COBERTURA CCU", "Cobertura CCU"),
        ("COBERTURA ADN VPH", "Cobertura ADN VPH"),
    ],
    "Dt Mama": [
        ("COBERTURA EXAMEN CLINICO DE LA MAMA", "Examen Clínico Mama"),
        ("COBERTURA MAMOGRAFIA", "Cobertura Mamografía"),
    ],
    "Dt Prostata": [
        ("COBERTURA TACTO RECTAL", "Tacto Rectal"),
        ("COBERTURA PSA", "Cobertura PSA"),
    ],
    "Dt Colon Y Recto": [
        ("COBERTURA TAMIZACION SANGRE OCULTA EN HECES", "Cobertura SOMF"),
    ],
}

FUNNEL_CONFIG = {
    "Dt Cervix": {
        "stages": [
            ("COBERTURA CCU", "CCU Realizadas"),
            ("POSITIVIDAD CCU", "CCU Anormales"),
            ("COBERTURA ADN VPH", "ADN VPH Realizados"),
            ("POSITIVIDAD ADN VPH", "ADN VPH Positivos"),
            ("COBERTURA COLPOSCOPIA Y  BIOPSIA", "Colposcopia + Biopsia"),
        ],
        "elegible_label": "Mujeres 25-65 años",
    },
    "Dt Mama": {
        "stages": [
            ("COBERTURA EXAMEN CLINICO DE LA MAMA", "Examen Clínico Mama"),
            ("COBERTURA MAMOGRAFIA", "Mamografías"),
            ("POSITIVIDAD MAMOGRAFIA", "Mamografías BI-RADS 4+"),
            ("COBERTURA BIOPSIA DE MAMA", "Biopsias de Mama"),
        ],
        "elegible_label": "Mujeres 40-69 años",
    },
    "Dt Prostata": {
        "stages": [
            ("COBERTURA TACTO RECTAL", "Tacto Rectal"),
            ("COBERTURA PSA", "PSA"),
            ("COBERTURA  (PSA   Y TACTO RECTAL)", "Tamizaje Combinado"),
            ("POSITIVIDAD CANCER DE PROSTATA", "Resultados Anormales"),
            ("COBERTURA BIOPSIA DE PROSTATA", "Biopsias de Próstata"),
        ],
        "elegible_label": "Hombres 50-75 años",
    },
    "Dt Colon Y Recto": {
        "stages": [
            ("COBERTURA TAMIZACION SANGRE OCULTA EN HECES", "SOMF Realizadas"),
            ("POSITIVIDAD SANGRE OCULTA EN HECES", "SOMF Positivas"),
            ("COBERTURA COLONOSCOPIA", "Colonoscopias"),
        ],
        "elegible_label": "Personas 50-75 años",
    },
}

COVERAGE_INDICATORS = [
    "COBERTURA CCU",
    "COBERTURA TAMIZACION SANGRE OCULTA EN HECES",
    "COBERTURA MAMOGRAFIA",
    "COBERTURA PSA",
]

LOW_COVERAGE_INDICATORS = {
    "COBERTURA CCU",
    "COBERTURA ADN VPH",
    "COBERTURA MAMOGRAFIA",
    "COBERTURA PSA",
    "COBERTURA TACTO RECTAL",
    "COBERTURA TAMIZACION SANGRE OCULTA EN HECES",
}

LEGACY_PROGRAMS = {
    "Dt Cervix": "DT cervix",
    "Dt Mama": "DT mama",
    "Dt Prostata": "DT Prostata",
    "Dt Colon Y Recto": "DT Colon y Recto",
}

LEGACY_EPS = {
    "Nueva Eps": "Nueva_Eps",
    "Salud Total": "Salud_Total",
}


@dataclass
class Group:
    program: str
    indicator: str
    eps: str
    rows: list[MonthlyRecord] = field(default_factory=list)
    months: dict[int, float] = field(default_factory=dict)
    accumulated: float = 0.0
    target: float | None = None
    population: int | None = None
    source_pct: float | None = None

    @property
    def pct_execution(self) -> float | None:
        return self.source_pct


def _month_name(month: int) -> str:
    return MONTHS[month - 1] if 1 <= month <= 12 else str(month)


def load_groups(db: Session, year: int) -> tuple[dict[tuple[str, str, str], Group], int | None]:
    stmt = (
        select(MonthlyRecord, Program.name, Indicator.name, Eps.name)
        .join(Program, MonthlyRecord.program_id == Program.id)
        .join(Indicator, MonthlyRecord.indicator_id == Indicator.id)
        .join(Eps, MonthlyRecord.eps_id == Eps.id)
        .where(MonthlyRecord.year == year)
        .order_by(Program.name, Indicator.name, Eps.name, MonthlyRecord.month)
    )
    groups: dict[tuple[str, str, str], Group] = {}
    for record, program, indicator, eps in db.execute(stmt):
        key = (program, indicator, eps)
        group = groups.get(key)
        if group is None:
            group = Group(program=program, indicator=indicator, eps=eps)
            groups[key] = group
        group.rows.append(record)
        group.months[record.month] = group.months.get(record.month, 0.0) + record.value
        if group.target is None and record.target is not None:
            group.target = record.target
        if group.population is None and record.population is not None:
            group.population = record.population
        if group.source_pct is None and record.source_pct_execution is not None:
            group.source_pct = record.source_pct_execution

    for group in groups.values():
        source_accumulated = next(
            (row.source_accumulated for row in group.rows if row.source_accumulated is not None),
            None,
        )
        group.accumulated = (
            float(source_accumulated)
            if source_accumulated is not None
            else sum(row.value for row in group.rows)
        )

    latest_year = db.scalar(select(func.max(MonthlyRecord.year)))
    return groups, int(latest_year) if latest_year is not None else None


def _get(
    groups: dict[tuple[str, str, str], Group], program: str, indicator: str, eps: str
) -> Group | None:
    return groups.get((program, indicator, eps))


def build_kpis(groups: dict[tuple[str, str, str], Group]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for program, indicators in KPI_MAP.items():
        for indicator, label in indicators:
            selected = [
                group
                for (group_program, group_indicator, _), group in groups.items()
                if group_program == program and group_indicator == indicator
            ]
            if not selected:
                continue
            accumulated = sum(group.accumulated for group in selected)
            target = sum(group.target or 0 for group in selected)
            population = sum(group.population or 0 for group in selected)
            coverage = accumulated / population if population > 0 else None
            advance = accumulated / target if target > 0 else None
            result.append(
                {
                    "programa": program,
                    "indicador": indicator,
                    "label": label,
                    "acumulado_2026": accumulated,
                    "meta_2026": target,
                    "poblacion": population,
                    "tasa_cobertura": round(coverage, 4) if coverage is not None else None,
                    "pct_avance_meta": round(advance, 4) if advance is not None else None,
                }
            )
    return result


def build_funnel(groups: dict[tuple[str, str, str], Group]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for program, config in FUNNEL_CONFIG.items():
        available_eps = {eps for (group_program, _, eps) in groups if group_program == program}
        ordered_eps = [eps for eps in EPS_ORDER if eps in available_eps]
        ordered_eps.extend(sorted(available_eps - set(EPS_ORDER)))
        first_indicator = config["stages"][0][0]
        for eps in ordered_eps:
            first_group = _get(groups, program, first_indicator, eps)
            population = first_group.population if first_group else None
            for indicator, label in config["stages"]:
                group = _get(groups, program, indicator, eps)
                if group is None:
                    fallback_target = next(
                        (
                            candidate.target
                            for candidate in groups.values()
                            if candidate.program == program
                            and candidate.indicator == indicator
                            and candidate.target is not None
                        ),
                        None,
                    )
                    result.append(
                        {
                            "programa": program,
                            "eps": eps,
                            "stage": label,
                            "tipo_indicador": indicator,
                            "poblacion_elegible": population,
                            "acumulado": 0.0,
                            "meta": fallback_target,
                            "pct_ejecucion": 0.0 if fallback_target else None,
                            "enero": None,
                            "febrero": None,
                            "marzo": None,
                        }
                    )
                    continue
                result.append(
                    {
                        "programa": program,
                        "eps": eps,
                        "stage": label,
                        "tipo_indicador": indicator,
                        "poblacion_elegible": population,
                        "acumulado": group.accumulated,
                        "meta": group.target,
                        "pct_ejecucion": group.pct_execution,
                        "enero": group.months.get(1),
                        "febrero": group.months.get(2),
                        "marzo": group.months.get(3),
                    }
                )
    return result


def build_alerts(groups: dict[tuple[str, str, str], Group]) -> list[dict[str, Any]]:
    alerts: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str, str]] = set()

    def add(level: str, program: str, eps: str, kind: str, message: str) -> None:
        key = (level, program, eps, kind)
        if key in seen:
            return
        seen.add(key)
        alerts.append(
            {
                "nivel": level,
                "programa": program,
                "eps": eps,
                "tipo": kind,
                "mensaje": message,
            }
        )

    for program in FUNNEL_CONFIG:
        for eps in EPS_ORDER:
            positivity = _get(groups, program, "POSITIVIDAD MAMOGRAFIA", eps)
            biopsy = _get(groups, program, "COBERTURA BIOPSIA DE MAMA", eps)
            missing_biopsy = biopsy is None or biopsy.accumulated == 0
            if positivity and positivity.accumulated > 0 and missing_biopsy:
                add(
                    "crítico",
                    program,
                    eps,
                    "Biopsia pendiente",
                    f"{eps}: {int(positivity.accumulated)} mamografías BI-RADS 4+ "
                    "sin biopsia de mama confirmada",
                )

            positivity = _get(groups, program, "POSITIVIDAD CANCER DE PROSTATA", eps)
            biopsy = _get(groups, program, "COBERTURA BIOPSIA DE PROSTATA", eps)
            missing_biopsy = biopsy is None or biopsy.accumulated == 0
            if positivity and positivity.accumulated > 0 and missing_biopsy:
                add(
                    "crítico",
                    program,
                    eps,
                    "Biopsia pendiente",
                    f"{eps}: {int(positivity.accumulated)} tamizajes anormales de próstata "
                    "sin biopsia confirmada",
                )

            positivity = _get(groups, program, "POSITIVIDAD SANGRE OCULTA EN HECES", eps)
            colonoscopy = _get(groups, program, "COBERTURA COLONOSCOPIA", eps)
            missing_colonoscopy = colonoscopy is None or colonoscopy.accumulated == 0
            if positivity and positivity.accumulated > 0 and missing_colonoscopy:
                add(
                    "crítico",
                    program,
                    eps,
                    "Colonoscopia pendiente",
                    f"{eps}: {int(positivity.accumulated)} SOMF positivas sin colonoscopia",
                )

            abnormal = _get(groups, program, "POSITIVIDAD CCU", eps)
            colposcopy = _get(groups, program, "COBERTURA COLPOSCOPIA Y  BIOPSIA", eps)
            incomplete = (
                abnormal
                and colposcopy
                and abnormal.accumulated > 0
                and colposcopy.accumulated < abnormal.accumulated
            )
            if incomplete:
                add(
                    "alto",
                    program,
                    eps,
                    "Resolución incompleta",
                    f"{eps}: {int(abnormal.accumulated)} citologías anormales, solo "
                    f"{int(colposcopy.accumulated)} colposcopias/biopsias",
                )

    for group in groups.values():
        if group.indicator not in LOW_COVERAGE_INDICATORS:
            continue
        pct = group.pct_execution
        if pct is not None and pct < 0.10 and group.accumulated > 0:
            add(
                "medio",
                group.program,
                group.eps,
                "Cobertura baja",
                f"{group.eps}: {group.indicator} solo {pct * 100:.1f}% de meta",
            )

    order = {"crítico": 0, "alto": 1, "medio": 2}
    return sorted(
        alerts,
        key=lambda item: (order.get(item["nivel"], 9), item["programa"], item["eps"]),
    )


def build_monthly(groups: dict[tuple[str, str, str], Group]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for group in sorted(groups.values(), key=lambda item: (item.program, item.indicator, item.eps)):
        for record in sorted(group.rows, key=lambda item: item.month):
            result.append(
                {
                    "PROGRAMA": group.program,
                    "TIPO_INDICADOR": group.indicator,
                    "EPS": group.eps,
                    "MES": _month_name(record.month),
                    "VALOR_MES": record.value,
                    "ACUMULADO_ACTIVIDADES": group.accumulated,
                    "META_2026": group.target,
                    "PCT_EJECUCION": group.pct_execution,
                    "POBLACION_CORTE": group.population,
                }
            )
    return result


def build_burnup(groups: dict[tuple[str, str, str], Group]) -> list[dict[str, Any]]:
    by_program_month: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))
    for group in groups.values():
        if group.indicator not in COVERAGE_INDICATORS:
            continue
        for month, value in group.months.items():
            by_program_month[group.program][month] += value

    result: list[dict[str, Any]] = []
    for program in sorted(by_program_month):
        cumulative = 0.0
        for month in sorted(by_program_month[program]):
            value = by_program_month[program][month]
            cumulative += value
            result.append(
                {
                    "PROGRAMA": program,
                    "MES": _month_name(month),
                    "VALOR_MES": value,
                    "MES_ORDEN": month,
                    "ACUMULADO_CALCULADO": cumulative,
                }
            )
    return result


def build_consolidado(db: Session) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(ConsolidadoRecord).order_by(
            ConsolidadoRecord.program, ConsolidadoRecord.indicator, ConsolidadoRecord.eps
        )
    ).all()
    return [
        {
            "PROGRAMA": LEGACY_PROGRAMS.get(row.program, row.program),
            "TIPO_INDICADOR": row.indicator,
            "NOMBRE_INDICADOR": row.indicator_name,
            "EPS": LEGACY_EPS.get(row.eps, row.eps),
            "EJECUCION": row.execution,
            "Avance_Cumplimiento": row.compliance_advance,
        }
        for row in rows
    ]


def build_historico(db: Session) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(AnnualHistory).order_by(
            AnnualHistory.year, AnnualHistory.indicator_name, AnnualHistory.eps_name
        )
    ).all()
    return [
        {
            "INDICADOR_CLEAN": row.indicator_name,
            "EPS_CLEAN": row.eps_name,
            "AÑO": row.year,
            "VALOR": row.value,
        }
        for row in rows
    ]


def build_cancer(db: Session) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(CancerMortality).order_by(CancerMortality.indicator, CancerMortality.year)
    ).all()
    return [
        {"indicador": row.indicator, "year": row.year, "cases": row.cases} for row in rows
    ]


def build_population(db: Session) -> list[dict[str, Any]]:
    rows = db.scalars(select(Population).order_by(Population.year)).all()
    return [{"year": row.year, "poblacion": row.population} for row in rows]


def build_dashboard(db: Session, year: int | None = None) -> dict[str, Any]:
    latest_year = db.scalar(select(func.max(MonthlyRecord.year)))
    resolved_year = year or (int(latest_year) if latest_year is not None else 2026)
    groups, _ = load_groups(db, resolved_year)
    cancer = build_cancer(db)
    population = build_population(db)
    return {
        "anio": resolved_year,
        "kpis": build_kpis(groups),
        "funnel": build_funnel(groups),
        "historico": build_historico(db),
        "alertas": build_alerts(groups),
        "consolidado": build_consolidado(db),
        "burnup": build_burnup(groups),
        "mensual": build_monthly(groups),
        "comportamientoCancer": cancer,
        "poblacion": population,
        "proyeccionPoisson": build_projection(cancer, population),
    }
