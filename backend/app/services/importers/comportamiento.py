from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pandas as pd

from app.services.importers.base import ParsedDataset
from app.services.importers.normalization import (
    MORTALITY_ALIASES,
    MORTALITY_CODES,
    clean_int,
    clean_text,
    fold,
    parse_year,
)

SHEET_NAME = "CAUSAS MORTALIDAD DETALLE"


def _find_header_row(frame: pd.DataFrame) -> int:
    for index in range(min(len(frame), 20)):
        years = [parse_year(value) for value in frame.iloc[index].tolist()]
        if sum(year is not None for year in years) >= 5:
            return index
    for index in range(min(len(frame), 20)):
        values = [fold(value) for value in frame.iloc[index].tolist()]
        joined = " | ".join(values)
        if "SUBGRUPO DE CAUSAS" in joined and "SEXO" in joined and "EDAD" in joined:
            return index
    return 1


def _find_header_index(header: pd.Series, needle: str) -> int | None:
    wanted = fold(needle)
    for index, value in enumerate(header.tolist()):
        if wanted in fold(value):
            return index
    return None


def _match_cause(value: Any) -> str | None:
    key = fold(clean_text(value))
    match = re.match(r"^0?(\d{3})\b", key)
    if match and match.group(1) in MORTALITY_CODES:
        return MORTALITY_CODES[match.group(1)]
    for alias, indicator in MORTALITY_ALIASES.items():
        if alias in key:
            return indicator
    return None


def parse_comportamiento(path: Path) -> ParsedDataset:
    parsed = ParsedDataset(dataset_type="comportamiento")
    workbook = pd.ExcelFile(path)
    sheet = SHEET_NAME if SHEET_NAME in workbook.sheet_names else None
    if sheet is None:
        sheet = next(
            (name for name in workbook.sheet_names if "MORTALIDAD" in fold(name)),
            workbook.sheet_names[0],
        )
    frame = pd.read_excel(path, sheet_name=sheet, header=None, dtype=object)
    if frame.empty:
        parsed.add_error("La hoja de mortalidad está vacía")
        return parsed

    header_index = _find_header_row(frame)
    header = frame.iloc[header_index]
    meta_header = frame.iloc[header_index - 1] if header_index > 0 else header
    cause_header = _find_header_index(meta_header, "SUBGRUPO DE CAUSAS")
    if cause_header is None:
        cause_header = _find_header_index(header, "SUBGRUPO DE CAUSAS")
    sex_header = _find_header_index(meta_header, "SEXO")
    if sex_header is None:
        sex_header = _find_header_index(header, "SEXO")
    age_header = _find_header_index(meta_header, "EDAD")
    if age_header is None:
        age_header = _find_header_index(header, "EDAD")

    offset = 0
    if cause_header is not None and header_index > 0 and cause_header > 0:
        previous_header = fold(clean_text(meta_header.iloc[cause_header - 1]))
        if "CAPITULO" in previous_header:
            offset = 1

    cause_col = (cause_header + offset) if cause_header is not None else 2 + offset
    sex_col = (sex_header + offset) if sex_header is not None else 3 + offset

    year_columns: list[tuple[int, int]] = []
    for index, value in enumerate(header.tolist()):
        year = parse_year(value)
        if year is not None and 2000 <= year <= 2100:
            year_columns.append((year, index + offset))
    year_columns.sort()

    if not year_columns:
        parsed.add_error("No se encontraron columnas de años en la hoja de mortalidad")
        return parsed

    totals: dict[tuple[str, int], int] = {}
    by_sex: dict[tuple[str, int], int] = {}
    current_indicator: str | None = None
    for _row_number, (_, row) in enumerate(
        frame.iloc[header_index + 1 :].iterrows(), start=header_index + 2
    ):
        raw_cause = row.iloc[cause_col] if cause_col < len(row) else None
        matched = _match_cause(raw_cause)
        if clean_text(raw_cause):
            current_indicator = matched
        indicator = current_indicator
        if indicator is None:
            continue
        sex = fold(clean_text(row.iloc[sex_col] if sex_col < len(row) else ""))
        is_total = sex == "TOTAL"
        for year, column in year_columns:
            if column >= len(row):
                continue
            cases = clean_int(row.iloc[column])
            key = (indicator, year)
            if is_total:
                totals[key] = (
                    totals.get(key, 0) + cases
                    if cases is not None
                    else totals.get(key, 0)
                )
            elif cases is not None:
                by_sex[key] = by_sex.get(key, 0) + cases

    keys = sorted(set(totals) | set(by_sex))
    for indicator, year in keys:
        cases = totals.get((indicator, year), by_sex.get((indicator, year), 0))
        parsed.rows.append(
            {
                "indicator": indicator,
                "year": year,
                "cases": cases,
                "source_sheet": sheet,
            }
        )

    if not parsed.rows:
        parsed.add_warning(
            "No se encontraron causas de cáncer reconocidas en la hoja de mortalidad"
        )

    parsed.summary = {
        "rows": len(parsed.rows),
        "sheet": sheet,
        "years": [year for year, _ in year_columns],
        "indicators": sorted({row["indicator"] for row in parsed.rows}),
    }
    return parsed
