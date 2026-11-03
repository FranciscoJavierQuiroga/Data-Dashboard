# API Dashboard Sogamoso

Backend FastAPI para cargar los Excel originales del dashboard, validar los datos,
mantener un CRUD de los registros base y recalcular la analítica (KPIs, funnel,
alertas, burn-up y proyección Poisson).

## Requisitos

- Python 3.11+
- PostgreSQL (recomendado) o SQLite para desarrollo local

## Arranque local

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

La documentación OpenAPI queda en `http://localhost:8000/docs`.

Por defecto se crea un usuario administrador con los valores de `.env`
(`ADMIN_EMAIL` / `ADMIN_PASSWORD`) y se cargan los JSON actuales de
`../app/public/data` como datos semilla si la base está vacía.

## Docker Compose

```bash
docker compose up --build
```

- Frontend: `http://localhost:3000`
- API: `http://localhost:8000`
- PostgreSQL: `localhost:5432`

## Importación de Excel

`POST /api/v1/imports` acepta `multipart/form-data`:

- `file`: archivo `.xlsx`
- `dataset_type`: `auto` | `consolidado` | `historico` | `comportamiento` | `poblacion` | `factores`
- `commit`: `true` para confirmar la importación; `false` para solo previsualizar

El backend detecta el tipo de libro por sus hojas y nombre. La previsualización
devuelve filas normalizadas, errores y advertencias. Al confirmar se aplica un
upsert transaccional por clave natural y se registra la importación.

## Roles

- `admin`: usuarios, catálogos, importaciones y CRUD.
- `editor`: importaciones y CRUD de datos.
- `viewer`: solo lectura.

Con `ALLOW_PUBLIC_READS=true` los endpoints de consulta del dashboard quedan
abiertos; las escrituras siempre requieren token.
