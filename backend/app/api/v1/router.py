from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import audit, auth, catalogs, dashboard, imports, records, users

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(catalogs.router)
api_router.include_router(records.router)
api_router.include_router(imports.router)
api_router.include_router(dashboard.router)
api_router.include_router(audit.router)
