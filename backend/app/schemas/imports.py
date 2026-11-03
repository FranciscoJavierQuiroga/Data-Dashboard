from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class ImportSummary(BaseModel):
    dataset_type: str
    row_count: int
    error_count: int
    warning_count: int
    summary: dict[str, Any] = {}
    errors: list[dict[str, Any]] = []
    warnings: list[str] = []
    preview: list[dict[str, Any]] = []


class ImportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    original_name: str
    sha256: str
    dataset_type: str
    status: str
    row_count: int
    error_count: int
    warning_count: int
    summary: dict[str, Any]
    errors: list[dict[str, Any]]
    warnings: list[str]
    preview: list[dict[str, Any]]
    uploaded_by_id: int | None
    created_at: datetime
    committed_at: datetime | None


class ImportCommitResult(BaseModel):
    batch: ImportRead
    inserted: int
    updated: int
    skipped: int
