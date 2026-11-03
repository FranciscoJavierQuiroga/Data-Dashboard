from __future__ import annotations

import math
import re
import unicodedata
from typing import Any

MONTHS = [
    "ENERO",
    "FEBRERO",
    "MARZO",
    "ABRIL",
    "MAYO",
    "JUNIO",
    "JULIO",
    "AGOSTO",
    "SEPTIEMBRE",
    "OCTUBRE",
    "NOVIEMBRE",
    "DICIEMBRE",
]

MONTH_NUMBER = {name: index + 1 for index, name in enumerate(MONTHS)}
MONTH_PREFIX = {name[:3]: index + 1 for index, name in enumerate(MONTHS)}

PROGRAM_ALIASES = {
    "DT CERVIX": "Dt Cervix",
    "DT MAMA": "Dt Mama",
    "DT PROSTATA": "Dt Prostata",
    "DT COLON Y RECTO": "Dt Colon Y Recto",
}

INDICATOR_ALIASES = {
    "COBERTURA CCU": "COBERTURA CCU",
    "POSITIVIDAD CCU": "POSITIVIDAD CCU",
    "COBERTURA ADN VPH": "COBERTURA ADN VPH",
    "POSITIVIDAD ADN VPH": "POSITIVIDAD ADN VPH",
    "COBERTURA COLPOSCOPIA Y BIOPSIA": "COBERTURA COLPOSCOPIA Y  BIOPSIA",
    "COBERTURA EXAMEN CLINICO DE LA MAMA": "COBERTURA EXAMEN CLINICO DE LA MAMA",
    "COBERTURA MAMOGRAFIA": "COBERTURA MAMOGRAFIA",
    "POSITIVIDAD MAMOGRAFIA": "POSITIVIDAD MAMOGRAFIA",
    "COBERTURA BIOPSIA DE MAMA": "COBERTURA BIOPSIA DE MAMA",
    "COBERTURA TACTO RECTAL": "COBERTURA TACTO RECTAL",
    "COBERTURA PSA": "COBERTURA PSA",
    "COBERTURA (PSA Y TACTO RECTAL)": "COBERTURA  (PSA   Y TACTO RECTAL)",
    "POSITIVIDAD CANCER DE PROSTATA": "POSITIVIDAD CANCER DE PROSTATA",
    "COBERTURA BIOPSIA DE PROSTATA": "COBERTURA BIOPSIA DE PROSTATA",
    "COBERTURA TAMIZACION SANGRE OCULTA EN HECES": "COBERTURA TAMIZACION SANGRE OCULTA EN HECES",
    "POSITIVIDAD SANGRE OCULTA EN HECES": "POSITIVIDAD SANGRE OCULTA EN HECES",
    "COBERTURA COLONOSCOPIA": "COBERTURA COLONOSCOPIA",
}

HISTORICAL_INDICATOR_ALIASES = {
    "TAMIZACION CANCER DE COLON Y RECTO": "Colon y Recto",
    "TAMIZAJE CANCER DE COLON Y RECTO": "Colon y Recto",
    "TAMIZAJE CANCER DE CUELLO UTERINO": "Cuello Uterino",
    "TAMIZAJE CANCER DE CUELLO UTERINO - CITOLOGIA": "Cuello Uterino - Citología",
    "TAMIZAJE CANCER DE CUELLO UTERINO - ADN VPH": "Cuello Uterino - ADN VPH",
    "TAMIZAJE CANCER DE MAMA": "Mama",
    "TAMIZAJE CANCER DE PROSTATA": "Próstata",
    "TAMIZAJE CANCER DE PROSTATA-PSA": "Próstata - PSA",
    "TAMIZAJE CANCER DE PROSTATA- TATO RECTAL": "Próstata - Tacto Rectal",
    "TAMIZAJE CANCER DE PROSTATA - TACTO RECTAL": "Próstata - Tacto Rectal",
}

MORTALITY_CODES = {
    "202": "Colon y Recto",
    "204": "Pulmón",
    "206": "Mama",
    "207": "Cuello Uterino",
    "210": "Próstata",
}

MORTALITY_ALIASES = {
    "CUELLO DEL UTERO": "Cuello Uterino",
    "TUMOR MALIGNO DE LA PROSTATA": "Próstata",
    "MAMA DE LA MUJER": "Mama",
    "TRAQUEA, LOS BRONQUIOS Y EL PULMON": "Pulmón",
}

NON_NUMERIC = {"", "N/A", "NA", "N.A.", "SD", "S/D", "#DIV/0!", "#VALUE!", "#REF!", "-", "--"}


def fold(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(char for char in text if not unicodedata.combining(char))
    return text.upper().strip()


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    text = str(value)
    if text.lower() in {"nan", "none", "nat"}:
        return ""
    return re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()


def normalize_program(value: Any) -> str:
    key = fold(clean_text(value))
    return PROGRAM_ALIASES.get(key, clean_text(value).title())


def normalize_eps(value: Any) -> str:
    text = clean_text(value).replace("_", " ")
    return text.title()


def normalize_indicator(value: Any) -> str:
    key = fold(clean_text(value))
    return INDICATOR_ALIASES.get(key, re.sub(r"\s+", " ", key))


def indicator_kind(value: Any) -> str:
    key = fold(clean_text(value))
    if key.startswith("COBERTURA"):
        return "cobertura"
    if key.startswith("POSITIVIDAD"):
        return "positividad"
    return "otro"


def normalize_history_indicator(value: Any) -> str:
    key = fold(clean_text(value))
    return HISTORICAL_INDICATOR_ALIASES.get(key, clean_text(value))


def normalize_history_eps(value: Any) -> str:
    return clean_text(value).title()


def normalize_header(value: Any) -> str:
    return fold(clean_text(value))


def clean_number(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        return None if math.isnan(value) or math.isinf(value) else float(value)

    text = clean_text(value).replace("%", "").replace("$", "").replace(" ", "")
    if fold(text) in {fold(item) for item in NON_NUMERIC}:
        return None
    if "," in text and "." in text:
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    elif "," in text:
        text = text.replace(",", ".") if text.count(",") == 1 else text.replace(",", "")
    try:
        parsed = float(text)
    except (TypeError, ValueError):
        return None
    if math.isnan(parsed) or math.isinf(parsed):
        return None
    return parsed


def clean_percentage(value: Any) -> float | None:
    number = clean_number(value)
    if number is None:
        return None
    return number / 100.0 if abs(number) > 1 else number


def clean_int(value: Any) -> int | None:
    number = clean_number(value)
    return int(round(number)) if number is not None else None


def parse_year(value: Any) -> int | None:
    number = clean_number(value)
    if number is None:
        return None
    year = int(number)
    return year if 1900 <= year <= 2200 else None


def month_number(value: Any) -> int | None:
    key = fold(clean_text(value))
    if key in MONTH_NUMBER:
        return MONTH_NUMBER[key]
    return MONTH_PREFIX.get(key[:3])


def find_column(columns: list[Any], *needles: str, exact: bool = False) -> Any | None:
    normalized = [(column, normalize_header(column)) for column in columns]
    wanted = [normalize_header(needle) for needle in needles]
    for column, header in normalized:
        if exact and header in wanted:
            return column
    for column, header in normalized:
        if any(needle and needle in header for needle in wanted):
            return column
    return None


def month_columns(columns: list[Any]) -> dict[int, Any]:
    result: dict[int, Any] = {}
    for column in columns:
        number = month_number(column)
        if number is not None:
            result[number] = column
    return result
