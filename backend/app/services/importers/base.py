from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ParsedDataset:
    dataset_type: str
    rows: list[dict[str, Any]] = field(default_factory=list)
    consolidado_rows: list[dict[str, Any]] = field(default_factory=list)
    errors: list[dict[str, Any]] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    summary: dict[str, Any] = field(default_factory=dict)

    def add_error(self, message: str, row: int | None = None, sheet: str | None = None) -> None:
        error: dict[str, Any] = {"message": message}
        if row is not None:
            error["row"] = row
        if sheet is not None:
            error["sheet"] = sheet
        self.errors.append(error)

    def add_warning(self, message: str) -> None:
        if message not in self.warnings:
            self.warnings.append(message)

    @property
    def preview(self) -> list[dict[str, Any]]:
        rows = self.rows if self.rows else self.consolidado_rows
        return rows[:50]
