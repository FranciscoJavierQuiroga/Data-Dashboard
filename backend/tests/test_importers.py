from __future__ import annotations

import json

from app.services.importers.pipeline import parse_dataset
from tests.conftest import DATA_DIR


def _load(name: str):
    with (DATA_DIR / name).open(encoding="utf-8-sig") as file:
        return json.load(file)


def test_comportamiento_parser_matches_legacy_json():
    parsed = parse_dataset(DATA_DIR / "1. COMPORTAMIENTO CANCER.xlsx")
    assert parsed.errors == []
    ours = {(row["indicator"], row["year"]): row["cases"] for row in parsed.rows}
    reference = {
        (row["indicador"], row["year"]): row["cases"]
        for row in _load("comportamiento_cancer.json")
    }
    assert ours == reference


def test_historico_parser_matches_legacy_json():
    parsed = parse_dataset(DATA_DIR / "3. Cumplimiento tamizacion 5 años.xlsx")
    assert parsed.errors == []
    ours = {
        (row["indicator_name"], row["eps_name"], row["year"]): round(row["value"], 6)
        for row in parsed.rows
    }
    reference = {
        (row["INDICADOR_CLEAN"], row["EPS_CLEAN"], row["AÑO"]): round(row["VALOR"], 6)
        for row in _load("historico.json")
    }
    assert ours == reference


def test_consolidado_parser_matches_legacy_json():
    parsed = parse_dataset(DATA_DIR / "4. CONSOLIDADO_INDICADORES CANCER_SOGAMOSO.xlsx")
    assert parsed.errors == []
    assert len(parsed.rows) == 330
    assert len(parsed.consolidado_rows) == 102

    ours = {
        (row["program"], row["indicator"].strip(), row["eps"], row["month"]): round(
            row["value"], 6
        )
        for row in parsed.rows
    }
    months = {
        "ENERO": 1,
        "FEBRERO": 2,
        "MARZO": 3,
        "ABRIL": 4,
        "MAYO": 5,
        "JUNIO": 6,
        "JULIO": 7,
        "AGOSTO": 8,
        "SEPTIEMBRE": 9,
        "OCTUBRE": 10,
        "NOVIEMBRE": 11,
        "DICIEMBRE": 12,
    }
    reference = {
        (row["PROGRAMA"], row["TIPO_INDICADOR"].strip(), row["EPS"], months[row["MES"]]): round(
            row["VALOR_MES"], 6
        )
        for row in _load("operativo_mensual.json")
    }
    assert ours == reference


def test_poblacion_parser_matches_source_years():
    parsed = parse_dataset(DATA_DIR / "PPED-AreaMun-2018-2042_VP.xlsx")
    assert parsed.errors == []
    assert parsed.rows[0]["year"] == 2018
    assert parsed.rows[-1]["year"] == 2042
    assert len(parsed.rows) == 25


def test_factores_parser_reads_risk_factors():
    parsed = parse_dataset(DATA_DIR / "2. FACTORES RIESGO Y PROTECTORES CA.xlsx")
    assert parsed.errors == []
    assert len(parsed.rows) == 42
    assert parsed.rows[0]["age_group"] == "JUVENTUD (18 a 28 años)"
