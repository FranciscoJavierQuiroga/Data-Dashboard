from __future__ import annotations

from pathlib import Path

import pandas as pd

from app.services.importers.base import ParsedDataset
from app.services.importers.normalization import (
    clean_int,
    clean_text,
    fold,
    parse_year,
)

SHEET_NAME = "PobMunicipalxÁrea"


def _find_header_row(frame: pd.DataFrame) -> int:
    for index in range(min(len(frame), 30)):
        values = [fold(value) for value in frame.iloc[index].tolist()]
        joined = " | ".join(values)
        if "DPNOM" in joined and "DPMP" in joined and "ANO" in joined and "TOTAL" in joined:
            return index
    return 7


def _column_index(header: pd.Series, name: str) -> int | None:
    wanted = fold(name)
    for index, value in enumerate(header.tolist()):
        if fold(value) == wanted:
            return index
    return None


def parse_poblacion(path: Path) -> ParsedDataset:
    parsed = ParsedDataset(dataset_type="poblacion")
    workbook = pd.ExcelFile(path)
    sheet = SHEET_NAME if SHEET_NAME in workbook.sheet_names else workbook.sheet_names[-1]
    frame = pd.read_excel(path, sheet_name=sheet, header=None, dtype=object)
    if frame.empty:
        parsed.add_error("La hoja de población está vacía")
        return parsed

    header_index = _find_header_row(frame)
    header = frame.iloc[header_index]
    municipality_col = _column_index(header, "DPMP")
    area_col = _column_index(header, "ÁREA GEOGRÁFICA")
    year_col = _column_index(header, "AÑO")
    total_col = _column_index(header, "TOTAL")
    if None in (municipality_col, area_col, year_col, total_col):
        parsed.add_error(
            "La hoja de población no tiene las columnas DPMP, "
            "ÁREA GEOGRÁFICA, AÑO y TOTAL"
        )
        return parsed

    by_year: dict[int, int] = {}
    for _row_number, (_, row) in enumerate(
        frame.iloc[header_index + 1 :].iterrows(), start=header_index + 2
    ):
        municipality = clean_text(row.iloc[municipality_col])
        area = clean_text(row.iloc[area_col])
        if fold(municipality) != "SOGAMOSO" or fold(area) != "TOTAL":
            continue
        year = parse_year(row.iloc[year_col])
        population = clean_int(row.iloc[total_col])
        if year is None or population is None:
            continue
        by_year[year] = population

    for year, population in sorted(by_year.items()):
        parsed.rows.append(
            {
                "year": year,
                "population": population,
                "source_sheet": sheet,
            }
        )

    if not parsed.rows:
        parsed.add_error("No se encontraron registros de Sogamoso con área Total")

    parsed.summary = {
        "rows": len(parsed.rows),
        "sheet": sheet,
        "first_year": min(by_year) if by_year else None,
        "last_year": max(by_year) if by_year else None,
    }
    return parsed
