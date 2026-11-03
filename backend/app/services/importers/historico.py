from __future__ import annotations

from pathlib import Path

import pandas as pd

from app.services.importers.base import ParsedDataset
from app.services.importers.normalization import (
    clean_percentage,
    clean_text,
    find_column,
    normalize_header,
    normalize_history_eps,
    normalize_history_indicator,
    parse_year,
)


def parse_historico(path: Path) -> ParsedDataset:
    parsed = ParsedDataset(dataset_type="historico")
    workbook = pd.ExcelFile(path)
    sheet = next(
        (name for name in workbook.sheet_names if "cumplimiento" in normalize_header(name)),
        workbook.sheet_names[0],
    )
    frame = pd.read_excel(path, sheet_name=sheet, header=0, dtype=object)
    columns = list(frame.columns)
    indicator_col = find_column(columns, "INDICADOR")
    eps_col = find_column(columns, "EPS")
    if indicator_col is None or eps_col is None:
        parsed.add_error("El histórico no tiene las columnas INDICADOR y EPS")
        return parsed

    year_columns: dict[int, object] = {}
    for column in columns:
        year = parse_year(column)
        if year is not None and 2000 <= year <= 2100:
            year_columns[year] = column
    if not year_columns:
        for column in columns:
            text = clean_text(column)
            if text.isdigit():
                year_columns[int(text)] = column
    if not year_columns:
        parsed.add_error("El histórico no tiene columnas de años reconocidas")
        return parsed

    for row_number, (_, row) in enumerate(frame.iterrows(), start=2):
        raw_indicator = row[indicator_col]
        if not clean_text(raw_indicator):
            continue
        indicator = normalize_history_indicator(raw_indicator)
        eps = normalize_history_eps(row[eps_col])
        if not eps:
            parsed.add_warning(f"Fila {row_number} sin EPS; se omite")
            continue
        for year, column in sorted(year_columns.items()):
            value = clean_percentage(row[column])
            if value is None:
                continue
            parsed.rows.append(
                {
                    "indicator_name": indicator,
                    "eps_name": eps,
                    "year": year,
                    "value": value,
                    "source_sheet": sheet,
                    "source_row": row_number,
                }
            )

    parsed.summary = {
        "rows": len(parsed.rows),
        "sheet": sheet,
        "years": sorted(year_columns),
        "indicators": sorted({row["indicator_name"] for row in parsed.rows}),
        "eps": sorted({row["eps_name"] for row in parsed.rows}),
    }
    return parsed
