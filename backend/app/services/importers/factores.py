from __future__ import annotations

from pathlib import Path

import pandas as pd

from app.services.importers.base import ParsedDataset
from app.services.importers.normalization import (
    clean_number,
    clean_text,
    find_column,
    fold,
)


def parse_factores(path: Path) -> ParsedDataset:
    parsed = ParsedDataset(dataset_type="factores_riesgo")
    workbook = pd.ExcelFile(path)
    sheet = next(
        (name for name in workbook.sheet_names if "FACTORES" in fold(name)),
        workbook.sheet_names[0],
    )
    frame = pd.read_excel(path, sheet_name=sheet, header=0, dtype=object)
    columns = list(frame.columns)
    age_col = find_column(columns, "GRUPO EDAD", "GRUPO", exact=True)
    name_col = find_column(columns, "NOMBRE DEL INDICADOR", "NOMBRE", exact=True)
    value_col = find_column(columns, "INDICADOR", "PORCENTAJE", exact=True)
    numerator_col = find_column(columns, "NUMERADOR")
    denominator_col = find_column(columns, "DENOMINADOR")
    if age_col is None or name_col is None or value_col is None:
        parsed.add_error(
            "La hoja de factores de riesgo no tiene GRUPO EDAD, "
            "NOMBRE DEL INDICADOR e Indicador"
        )
        return parsed

    for row_number, (_, row) in enumerate(frame.iterrows(), start=2):
        age_group = clean_text(row[age_col])
        indicator_name = clean_text(row[name_col])
        if not age_group or not indicator_name:
            continue
        parsed.rows.append(
            {
                "age_group": age_group,
                "indicator_name": indicator_name,
                "value_pct": clean_number(row[value_col]),
                "numerator": clean_number(row[numerator_col]) if numerator_col else None,
                "denominator": clean_number(row[denominator_col]) if denominator_col else None,
                "source_sheet": sheet,
                "source_row": row_number,
            }
        )

    parsed.summary = {
        "rows": len(parsed.rows),
        "sheet": sheet,
        "age_groups": sorted({row["age_group"] for row in parsed.rows}),
        "indicators": sorted({row["indicator_name"] for row in parsed.rows}),
    }
    return parsed
