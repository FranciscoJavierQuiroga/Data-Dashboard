from __future__ import annotations

import hashlib
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import select

from app.api.deps import DbSession, EditorUser, ReadUser
from app.core.config import settings
from app.db.models import ImportBatch
from app.schemas.common import Page
from app.schemas.imports import ImportCommitResult, ImportRead
from app.services.common import commit, get_or_404, log_audit, paginate
from app.services.import_service import apply_dataset, rollback_import
from app.services.importers.pipeline import DATASET_TYPES, detect_dataset_type, parse_dataset

router = APIRouter(prefix="/imports", tags=["imports"])


def _safe_name(filename: str) -> str:
    base = Path(filename).name
    return re.sub(r"[^A-Za-z0-9._-]+", "_", base) or "archivo.xlsx"


def _prepare_batch(
    db: DbSession, path: Path, original_name: str, dataset_type: str, user_id: int
) -> ImportBatch:
    content = path.read_bytes()
    batch = ImportBatch(
        filename=str(path),
        original_name=original_name,
        sha256=hashlib.sha256(content).hexdigest(),
        dataset_type=dataset_type,
        status="uploaded",
        uploaded_by_id=user_id,
    )
    db.add(batch)
    db.flush()
    return batch


@router.get("", response_model=Page[ImportRead])
def list_imports(
    db: DbSession,
    _: ReadUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    dataset_type: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
) -> Page[ImportRead]:
    stmt = select(ImportBatch).order_by(ImportBatch.created_at.desc())
    if dataset_type:
        stmt = stmt.where(ImportBatch.dataset_type == dataset_type)
    if status_filter:
        stmt = stmt.where(ImportBatch.status == status_filter)
    rows, total = paginate(db, stmt, page, page_size)
    return Page(
        items=[ImportRead.model_validate(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=ImportRead)
async def upload_import(
    db: DbSession,
    actor: EditorUser,
    file: UploadFile = File(...),
    dataset_type: str = Form("auto"),
    commit_import: bool = Form(False, alias="commit"),
) -> ImportBatch:
    if dataset_type != "auto" and dataset_type not in DATASET_TYPES:
        raise HTTPException(status_code=422, detail=f"dataset_type inválido: {dataset_type}")
    original_name = file.filename or "archivo.xlsx"
    if not original_name.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=422, detail="Solo se aceptan archivos .xlsx o .xlsm")

    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                "El archivo supera el máximo de "
                f"{settings.max_upload_bytes // (1024 * 1024)} MB"
            ),
        )

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    stored = upload_dir / f"{uuid.uuid4().hex}_{_safe_name(original_name)}"
    stored.write_bytes(content)

    resolved_type = dataset_type
    if resolved_type == "auto":
        try:
            resolved_type = detect_dataset_type(stored, original_name)
        except Exception as exc:  # noqa: BLE001
            stored.unlink(missing_ok=True)
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    batch = _prepare_batch(db, stored, original_name, resolved_type, actor.id)
    try:
        parsed = parse_dataset(stored, resolved_type, original_name)
    except Exception as exc:  # noqa: BLE001
        batch.status = "failed"
        batch.errors = [{"message": str(exc)}]
        batch.error_count = 1
        commit(db)
        raise HTTPException(
            status_code=422, detail=f"No fue posible leer el archivo: {exc}"
        ) from exc

    batch.row_count = len(parsed.rows) + len(parsed.consolidado_rows)
    batch.error_count = len(parsed.errors)
    batch.warning_count = len(parsed.warnings)
    batch.summary = parsed.summary
    batch.errors = parsed.errors
    batch.warnings = parsed.warnings
    batch.preview = parsed.preview

    if not commit_import:
        batch.status = "previewed"
        commit(db)
        db.refresh(batch)
        return batch

    if parsed.errors:
        batch.status = "failed"
        commit(db)
        db.refresh(batch)
        raise HTTPException(
            status_code=422,
            detail={
                "message": "El archivo tiene errores de validación y no se importó",
                "batch_id": batch.id,
                "errors": parsed.errors,
            },
        )

    result = apply_dataset(db, parsed, batch)
    log_audit(
        db,
        actor,
        "import",
        "import_batch",
        batch.id,
        after={"inserted": result.inserted, "updated": result.updated},
    )
    commit(db)
    db.refresh(batch)
    return batch


@router.get("/{batch_id}", response_model=ImportRead)
def get_import(db: DbSession, batch_id: int, _: ReadUser) -> ImportBatch:
    return get_or_404(db, ImportBatch, batch_id, "Importación")


@router.post("/{batch_id}/commit", response_model=ImportCommitResult)
def commit_import(db: DbSession, batch_id: int, actor: EditorUser) -> ImportCommitResult:
    batch = get_or_404(db, ImportBatch, batch_id, "Importación")
    if batch.status == "committed":
        raise HTTPException(status_code=409, detail="La importación ya fue confirmada")
    path = Path(batch.filename)
    if not path.exists():
        raise HTTPException(status_code=410, detail="El archivo original ya no está disponible")
    parsed = parse_dataset(path, batch.dataset_type, batch.original_name)
    if parsed.errors:
        batch.status = "failed"
        batch.errors = parsed.errors
        batch.error_count = len(parsed.errors)
        batch.warnings = parsed.warnings
        batch.warning_count = len(parsed.warnings)
        batch.summary = parsed.summary
        commit(db)
        raise HTTPException(
            status_code=422,
            detail={
                "message": "El archivo tiene errores de validación y no se importó",
                "batch_id": batch.id,
                "errors": parsed.errors,
            },
        )
    result = apply_dataset(db, parsed, batch)
    log_audit(
        db,
        actor,
        "import_commit",
        "import_batch",
        batch.id,
        after={"inserted": result.inserted, "updated": result.updated},
    )
    commit(db)
    db.refresh(batch)
    return ImportCommitResult(batch=ImportRead.model_validate(batch), **result.__dict__)


@router.post("/{batch_id}/rollback", response_model=ImportRead)
def rollback(db: DbSession, batch_id: int, actor: EditorUser) -> ImportBatch:
    batch = get_or_404(db, ImportBatch, batch_id, "Importación")
    try:
        reverted = rollback_import(db, batch)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    log_audit(
        db,
        actor,
        "rollback",
        "import_batch",
        batch.id,
        before={"status": "committed"},
        after={"status": "rolled_back", "reverted": reverted},
    )
    commit(db)
    db.refresh(batch)
    return batch
