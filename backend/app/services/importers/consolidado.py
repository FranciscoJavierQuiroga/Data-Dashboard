from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pandas as pd

from app.services.importers.base import ParsedDataset
from app.services.importers.normalization import (
    INDICATOR_ALIASES,
    PROGRAM_ALIASES,
    clean_int,
    clean_number,
    clean_text,
    find_column,
    month_columns,
    normalize_header,
    normalize_indicator,
    normalize_program,
)

KNOWN_PROGRAMS = set(PROGRAM_ALIASES.values())

EPS_SHEETS = {
    "NUEVA EPS": "Nueva Eps",
    "SANITAS": "Sanitas",
    "COOSALUD": "Coosalud",
    "FAMISANAR": "Famisanar",
    "SALUD TOTAL": "Salud Total",
    "PROTEGER": "Proteger",
    "CAJACOPI": "Cajacopi",
}

CONSOLIDADO_EPS_COLUMNS = {
    "NUEVA EPS": "Nueva Eps",
    "NUEVA_EPS": "Nueva Eps",
    "SANITAS": "Sanitas",
    "COOSALUD": "Coosalud",
    "FAMISANAR": "Famisanar",
    "SALUD TOTAL": "Salud Total",
    "SALUD_TOTAL": "Salud Total",
    "CAJACOPI": "Cajacopi",
    "PROTEGER": "Proteger",
}


def _year_from_header(value: Any, default: int) -> int:
    match = re.search(r"(20\d{2})", clean_text(value))
    return int(match.group(1)) if match else default


def _first_value(row: pd.Series, column: Any) -> Any:
    return row[column] if column is not None else None


def _parse_eps_sheet(
    path: Path,
    sheet: str,
    eps: str,
    parsed: ParsedDataset,
    default_year: int,
) -> None:
    frame = pd.read_excel(path, sheet_name=sheet, header=0, dtype=object)
    if frame.empty:
        parsed.add_warning(f"La hoja '{sheet}' no contiene filas")
        return
    columns = list(frame.columns)
    program_col = find_column(columns, "PROGRAMA", exact=True)
    indicator_col = find_column(columns, "TIPO INDICADOR")
    numerator_col = find_column(columns, "NUMERADOR")
    denominator_col = find_column(columns, "DENOMINADOR")
    population_col = find_column(columns, "POBLACION CORTE")
    estimation_col = find_column(columns, "ESTIMACION")
    meta_col = find_column(columns, "META 2026", "META")
    line_base_col = find_column(columns, "LINEA BASE")
    accumulated_col = find_column(columns, "ACUMULADO ACTIVIDADES")
    execution_col = find_column(columns, "% EJECUCION", "EJECUCION")
    months = month_columns(columns)

    missing = [
        name
        for name, column in (
            ("PROGRAMA", program_col),
            ("TIPO INDICADOR", indicator_col),
            ("META 2026", meta_col),
            ("ACUMULADO ACTIVIDADES", accumulated_col),
        )
        if column is None
    ]
    if missing:
        parsed.add_error(f"Faltan columnas en la hoja '{sheet}': {', '.join(missing)}", sheet=sheet)
        return

    year = _year_from_header(meta_col, default_year)
    seen: set[tuple[str, str, int]] = set()
    for row_number, (_, row) in enumerate(frame.iterrows(), start=2):
        raw_program = _first_value(row, program_col)
        raw_indicator = _first_value(row, indicator_col)
        if not clean_text(raw_program) or not clean_text(raw_indicator):
            continue
        program = normalize_program(raw_program)
        if program not in KNOWN_PROGRAMS:
            parsed.add_warning(f"Programa no reconocido en '{sheet}': {raw_program}")
            continue
        indicator = normalize_indicator(raw_indicator)
        if indicator not in INDICATOR_ALIASES.values():
            parsed.add_warning(f"Indicador no reconocido en '{sheet}': {raw_indicator}")
        target = clean_number(_first_value(row, meta_col))
        population = clean_int(_first_value(row, population_col))
        numerator = clean_number(_first_value(row, numerator_col))
        denominator = clean_number(_first_value(row, denominator_col))
        estimation = clean_number(_first_value(row, estimation_col))
        line_base = clean_number(_first_value(row, line_base_col))
        accumulated = clean_number(_first_value(row, accumulated_col))
        source_pct = clean_number(_first_value(row, execution_col))

        for month, column in months.items():
            value = clean_number(row[column])
            if value is None:
                continue
            key = (indicator, eps, month)
            if key in seen:
                parsed.add_warning(
                    f"Registro duplicado en '{sheet}' para {indicator} / {eps} / mes {month}"
                )
            seen.add(key)
            parsed.rows.append(
                {
                    "program": program,
                    "indicator": indicator,
                    "eps": eps,
                    "year": year,
                    "month": month,
                    "value": value,
                    "target": target,
                    "population": population,
                    "numerator": numerator,
                    "denominator": denominator,
                    "estimation": estimation,
                    "line_base": line_base,
                    "source_accumulated": accumulated,
                    "source_pct_execution": source_pct,
                    "source_sheet": sheet,
                    "source_row": row_number,
                }
            )


def _parse_consolidado_sheet(path: Path, parsed: ParsedDataset) -> None:
    try:
        frame = pd.read_excel(path, sheet_name="Consolidado", header=0, dtype=object)
    except ValueError:
        parsed.add_warning("El libro no contiene la hoja 'Consolidado'")
        return
    if frame.empty:
        parsed.add_warning("La hoja 'Consolidado' no contiene filas")
        return

    columns = list(frame.columns)
    program_col = find_column(columns, "PROGRAMA", exact=True)
    indicator_col = find_column(columns, "TIPO INDICADOR")
    name_col = find_column(columns, "NOMBRE INDICADOR")
    advance_col = find_column(columns, "AVANCE EN EL CUMPLIMIENTO", "AVANCE")
    if program_col is None or indicator_col is None:
        parsed.add_error(
            "La hoja 'Consolidado' no tiene PROGRAMA y TIPO INDICADOR", sheet="Consolidado"
        )
        return

    eps_columns: dict[Any, str] = {}
    for column in columns:
        key = normalize_header(column).replace("_", " ")
        eps_name = CONSOLIDADO_EPS_COLUMNS.get(key)
        if eps_name:
            eps_columns[column] = eps_name

    if not eps_columns:
        parsed.add_error(
            "La hoja 'Consolidado' no tiene columnas de EPS reconocidas", sheet="Consolidado"
        )
        return

    for row_number, (_, row) in enumerate(frame.iterrows(), start=2):
        raw_program = _first_value(row, program_col)
        raw_indicator = _first_value(row, indicator_col)
        if not clean_text(raw_program) or not clean_text(raw_indicator):
            continue
        program = normalize_program(raw_program)
        if program not in KNOWN_PROGRAMS:
            continue
        indicator = normalize_indicator(raw_indicator)
        indicator_name = clean_text(_first_value(row, name_col)) or None
        advance = clean_number(_first_value(row, advance_col))
        for column, eps in eps_columns.items():
            execution = clean_number(row[column])
            parsed.consolidado_rows.append(
                {
                    "program": program,
                    "indicator": indicator,
                    "indicator_name": indicator_name,
                    "eps": eps,
                    "execution": execution,
                    "compliance_advance": advance,
                    "source_sheet": "Consolidado",
                    "source_row": row_number,
                }
            )


def parse_consolidado(path: Path, default_year: int = 2026) -> ParsedDataset:
    parsed = ParsedDataset(dataset_type="consolidado")
    workbook = pd.ExcelFile(path)
    sheets = {normalize_header(sheet): sheet for sheet in workbook.sheet_names}
    found_sheets: list[str] = []

    for key, eps in EPS_SHEETS.items():
        sheet = sheets.get(key)
        if sheet is None:
            continue
        found_sheets.append(sheet)
        _parse_eps_sheet(path, sheet, eps, parsed, default_year)

    if not found_sheets:
        parsed.add_error(
            "No se encontraron hojas de EPS. Hojas disponibles: "
            + ", ".join(workbook.sheet_names)
        )

    _parse_consolidado_sheet(path, parsed)

    parsed.summary = {
        "monthly_rows": len(parsed.rows),
        "consolidado_rows": len(parsed.consolidado_rows),
        "sheets": found_sheets,
        "programs": sorted({row["program"] for row in parsed.rows}),
        "eps": sorted({row["eps"] for row in parsed.rows}),
        "year": default_year,
    }
    return parsed
