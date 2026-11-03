from __future__ import annotations

from app.core.config import settings
from tests.conftest import DATA_DIR


def test_login_and_catalog_crud(client, admin_headers):
    response = client.post(
        f"{settings.api_v1_prefix}/auth/login-json",
        json={"email": settings.admin_email, "password": settings.admin_password},
    )
    assert response.status_code == 200
    assert response.json()["role"] == "admin"

    eps = client.post(
        f"{settings.api_v1_prefix}/catalogs/eps",
        json={"name": "EPS de prueba"},
        headers=admin_headers,
    )
    assert eps.status_code == 201

    program = client.post(
        f"{settings.api_v1_prefix}/catalogs/programs",
        json={"name": "Dt Prueba"},
        headers=admin_headers,
    )
    assert program.status_code == 201

    indicator = client.post(
        f"{settings.api_v1_prefix}/catalogs/indicators",
        json={
            "program_id": program.json()["id"],
            "name": "COBERTURA PRUEBA",
            "kind": "cobertura",
        },
        headers=admin_headers,
    )
    assert indicator.status_code == 201

    record = client.post(
        f"{settings.api_v1_prefix}/data/monthly",
        json={
            "program_id": program.json()["id"],
            "indicator_id": indicator.json()["id"],
            "eps_id": eps.json()["id"],
            "year": 2026,
            "month": 1,
            "value": 12,
            "target": 100,
            "population": 1000,
        },
        headers=admin_headers,
    )
    assert record.status_code == 201
    assert record.json()["program_name"] == "Dt Prueba"

    blocked = client.delete(
        f"{settings.api_v1_prefix}/catalogs/programs/{program.json()['id']}",
        headers=admin_headers,
    )
    assert blocked.status_code == 409

    other_program = client.post(
        f"{settings.api_v1_prefix}/catalogs/programs",
        json={"name": "Dt Otro"},
        headers=admin_headers,
    )
    other_indicator = client.post(
        f"{settings.api_v1_prefix}/catalogs/indicators",
        json={"program_id": other_program.json()["id"], "name": "OTRO INDICADOR"},
        headers=admin_headers,
    )
    mismatch = client.patch(
        f"{settings.api_v1_prefix}/data/monthly/{record.json()['id']}",
        json={"indicator_id": other_indicator.json()["id"]},
        headers=admin_headers,
    )
    assert mismatch.status_code == 422

    dashboard = client.get(f"{settings.api_v1_prefix}/dashboard")
    assert dashboard.status_code == 200
    data = dashboard.json()
    assert data["anio"] == 2026
    assert len(data["mensual"]) == 1
    assert data["mensual"][0]["VALOR_MES"] == 12


def test_import_historico_preview_and_commit(client, admin_headers):
    path = DATA_DIR / "3. Cumplimiento tamizacion 5 años.xlsx"
    with path.open("rb") as file:
        response = client.post(
            f"{settings.api_v1_prefix}/imports",
            data={"dataset_type": "auto", "commit": "false"},
            files={
                "file": (
                    path.name,
                    file,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
            headers=admin_headers,
        )
    assert response.status_code == 200, response.text
    batch = response.json()
    assert batch["status"] == "previewed"
    assert batch["dataset_type"] == "historico"
    assert batch["row_count"] == 280

    commit = client.post(
        f"{settings.api_v1_prefix}/imports/{batch['id']}/commit", headers=admin_headers
    )
    assert commit.status_code == 200, commit.text
    body = commit.json()
    assert body["inserted"] == 280
    assert body["batch"]["status"] == "committed"

    history = client.get(
        f"{settings.api_v1_prefix}/data/annual-history?page_size=500",
        headers=admin_headers,
    )
    assert history.status_code == 200
    assert history.json()["total"] == 280

    rollback = client.post(
        f"{settings.api_v1_prefix}/imports/{batch['id']}/rollback", headers=admin_headers
    )
    assert rollback.status_code == 200
    history = client.get(
        f"{settings.api_v1_prefix}/data/annual-history?page_size=500",
        headers=admin_headers,
    )
    assert history.json()["total"] == 0


def test_import_consolidado_updates_dashboard(client, admin_headers):
    path = DATA_DIR / "4. CONSOLIDADO_INDICADORES CANCER_SOGAMOSO.xlsx"
    with path.open("rb") as file:
        response = client.post(
            f"{settings.api_v1_prefix}/imports",
            data={"dataset_type": "auto", "commit": "true"},
            files={
                "file": (
                    path.name,
                    file,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
            headers=admin_headers,
        )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "committed"
    assert response.json()["row_count"] == 432

    dashboard = client.get(f"{settings.api_v1_prefix}/dashboard")
    assert dashboard.status_code == 200
    data = dashboard.json()
    assert len(data["kpis"]) == 7
    assert len(data["funnel"]) == 102
    assert len(data["alertas"]) == 18
    assert len(data["consolidado"]) == 102
    assert len(data["mensual"]) == 330


def test_reads_are_public_but_writes_require_token(client):
    assert client.get(f"{settings.api_v1_prefix}/dashboard").status_code == 200
    response = client.post(f"{settings.api_v1_prefix}/catalogs/eps", json={"name": "Sin token"})
    assert response.status_code == 401
