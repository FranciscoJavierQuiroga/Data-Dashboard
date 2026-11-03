from __future__ import annotations

from pathlib import Path

import pandas as pd

from app.services.importers.base import ParsedDataset
from app.services.importers.comportamiento import parse_comportamiento
from app.services.importers.consolidado import parse_consolidado
from app.services.importers.factores import parse_factores
from app.services.importers.historico import parse_historico
from app.services.importers.normalization import fold, normalize_header
from app.services.importers.poblacion import parse_poblacion

DATASET_TYPES = {
    "consolidado",
    "historico",
    "comportamiento",
    "poblacion",
    "factores_riesgo",
}


def detect_dataset_type(path: Path, filename: str | None = None) -> str:
    name = fold(filename or path.name)
    if "CONSOLIDADO" in name:
        return "consolidado"
    if "CUMPLIMIENTO" in name or "TAMIZACION 5" in name:
        return "historico"
    if "COMPORTAMIENTO" in name:
        return "comportamiento"
    if "PPED" in name or "POBLACION" in name:
        return "poblacion"
    if "FACTORES" in name:
        return "factores_riesgo"

    workbook = pd.ExcelFile(path)
    sheets = {normalize_header(sheet) for sheet in workbook.sheet_names}
    if "CAUSAS MORTALIDAD DETALLE" in sheets:
        return "comportamiento"
    if any("CUMPLIMIENTO" in sheet for sheet in sheets):
        return "historico"
    if "POBMUNICIPALXAREA" in sheets:
        return "poblacion"
    if "CONSOLIDADO" in sheets and any("NUEVA EPS" in sheet for sheet in sheets):
        return "consolidado"
    if any("FACTORES" in sheet for sheet in sheets):
        return "factores_riesgo"
    raise ValueError(
        "No fue posible detectar el tipo de archivo. Use dataset_type explícitamente. "
        f"Hojas: {', '.join(workbook.sheet_names)}"
    )


def parse_dataset(
    path: Path, dataset_type: str = "auto", filename: str | None = None
) -> ParsedDataset:
    resolved = detect_dataset_type(path, filename) if dataset_type == "auto" else dataset_type
    if resolved not in DATASET_TYPES:
        raise ValueError(f"Tipo de dataset no soportado: {resolved}")
    if resolved == "consolidado":
        return parse_consolidado(path)
    if resolved == "historico":
        return parse_historico(path)
    if resolved == "comportamiento":
        return parse_comportamiento(path)
    if resolved == "poblacion":
        return parse_poblacion(path)
    if resolved == "factores_riesgo":
        return parse_factores(path)
    raise ValueError(f"Tipo de dataset no soportado: {resolved}")
