from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

IndicatorKind = Literal["cobertura", "positividad", "otro"]


class EpsCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    code: str | None = Field(default=None, max_length=50)
    active: bool = True


class EpsUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    code: str | None = Field(default=None, max_length=50)
    active: bool | None = None


class EpsRead(EpsCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class ProgramCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    code: str | None = Field(default=None, max_length=50)
    active: bool = True


class ProgramUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    code: str | None = Field(default=None, max_length=50)
    active: bool | None = None


class ProgramRead(ProgramCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class IndicatorCreate(BaseModel):
    program_id: int
    name: str = Field(min_length=1, max_length=180)
    kind: IndicatorKind = "otro"
    unit: str = Field(default="conteo", max_length=30)
    active: bool = True


class IndicatorUpdate(BaseModel):
    program_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=180)
    kind: IndicatorKind | None = None
    unit: str | None = Field(default=None, max_length=30)
    active: bool | None = None


class IndicatorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    program_id: int
    name: str
    kind: str
    unit: str
    active: bool
    program_name: str | None = None
    created_at: datetime
    updated_at: datetime
