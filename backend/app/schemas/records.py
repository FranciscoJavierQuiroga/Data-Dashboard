from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MonthlyRecordBase(BaseModel):
    program_id: int
    indicator_id: int
    eps_id: int
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)
    value: float = 0.0
    source_accumulated: float | None = None
    source_pct_execution: float | None = None
    target: float | None = None
    population: int | None = Field(default=None, ge=0)
    numerator: float | None = None
    denominator: float | None = None
    estimation: float | None = None
    line_base: float | None = None


class MonthlyRecordCreate(MonthlyRecordBase):
    pass


class MonthlyRecordUpdate(BaseModel):
    program_id: int | None = None
    indicator_id: int | None = None
    eps_id: int | None = None
    year: int | None = Field(default=None, ge=2000, le=2100)
    month: int | None = Field(default=None, ge=1, le=12)
    value: float | None = None
    source_accumulated: float | None = None
    source_pct_execution: float | None = None
    target: float | None = None
    population: int | None = Field(default=None, ge=0)
    numerator: float | None = None
    denominator: float | None = None
    estimation: float | None = None
    line_base: float | None = None


class MonthlyRecordRead(MonthlyRecordBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    program_name: str | None = None
    indicator_name: str | None = None
    eps_name: str | None = None
    created_at: datetime
    updated_at: datetime


class AnnualHistoryBase(BaseModel):
    indicator_name: str = Field(min_length=1, max_length=180)
    eps_name: str = Field(min_length=1, max_length=120)
    year: int = Field(ge=2000, le=2100)
    value: float


class AnnualHistoryCreate(AnnualHistoryBase):
    pass


class AnnualHistoryUpdate(BaseModel):
    indicator_name: str | None = Field(default=None, min_length=1, max_length=180)
    eps_name: str | None = Field(default=None, min_length=1, max_length=120)
    year: int | None = Field(default=None, ge=2000, le=2100)
    value: float | None = None


class AnnualHistoryRead(AnnualHistoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    updated_at: datetime


class CancerMortalityBase(BaseModel):
    indicator: str = Field(min_length=1, max_length=120)
    year: int = Field(ge=2000, le=2100)
    cases: int = Field(ge=0)


class CancerMortalityCreate(CancerMortalityBase):
    pass


class CancerMortalityUpdate(BaseModel):
    indicator: str | None = Field(default=None, min_length=1, max_length=120)
    year: int | None = Field(default=None, ge=2000, le=2100)
    cases: int | None = Field(default=None, ge=0)


class CancerMortalityRead(CancerMortalityBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    updated_at: datetime


class PopulationBase(BaseModel):
    year: int = Field(ge=1900, le=2200)
    population: int = Field(ge=0)


class PopulationCreate(PopulationBase):
    pass


class PopulationUpdate(BaseModel):
    year: int | None = Field(default=None, ge=1900, le=2200)
    population: int | None = Field(default=None, ge=0)


class PopulationRead(PopulationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    updated_at: datetime


class RiskFactorBase(BaseModel):
    age_group: str = Field(min_length=1, max_length=120)
    indicator_name: str = Field(min_length=1, max_length=180)
    value_pct: float | None = None
    numerator: float | None = None
    denominator: float | None = None


class RiskFactorCreate(RiskFactorBase):
    pass


class RiskFactorUpdate(BaseModel):
    age_group: str | None = Field(default=None, min_length=1, max_length=120)
    indicator_name: str | None = Field(default=None, min_length=1, max_length=180)
    value_pct: float | None = None
    numerator: float | None = None
    denominator: float | None = None


class RiskFactorRead(RiskFactorBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    updated_at: datetime


class ConsolidadoBase(BaseModel):
    program: str = Field(min_length=1, max_length=120)
    indicator: str = Field(min_length=1, max_length=180)
    indicator_name: str | None = None
    eps: str = Field(min_length=1, max_length=120)
    execution: float | None = None
    compliance_advance: float | None = None


class ConsolidadoCreate(ConsolidadoBase):
    pass


class ConsolidadoUpdate(BaseModel):
    program: str | None = Field(default=None, min_length=1, max_length=120)
    indicator: str | None = Field(default=None, min_length=1, max_length=180)
    indicator_name: str | None = None
    eps: str | None = Field(default=None, min_length=1, max_length=120)
    execution: float | None = None
    compliance_advance: float | None = None


class ConsolidadoRead(ConsolidadoBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
