from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="viewer")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Eps(TimestampMixin, Base):
    __tablename__ = "eps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    monthly_records: Mapped[list[MonthlyRecord]] = relationship(back_populates="eps")


class Program(TimestampMixin, Base):
    __tablename__ = "programs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    indicators: Mapped[list[Indicator]] = relationship(back_populates="program")
    monthly_records: Mapped[list[MonthlyRecord]] = relationship(back_populates="program")


class Indicator(TimestampMixin, Base):
    __tablename__ = "indicators"
    __table_args__ = (UniqueConstraint("program_id", "name", name="uq_indicator_program_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    program_id: Mapped[int] = mapped_column(
        ForeignKey("programs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(30), nullable=False, default="otro")
    unit: Mapped[str] = mapped_column(String(30), nullable=False, default="conteo")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    program: Mapped[Program] = relationship(back_populates="indicators")
    monthly_records: Mapped[list[MonthlyRecord]] = relationship(back_populates="indicator")


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    dataset_type: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="uploaded")
    row_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    warning_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    summary: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    errors: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    warnings: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    preview: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    rollback_payload: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    uploaded_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    committed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class MonthlyRecord(TimestampMixin, Base):
    __tablename__ = "monthly_records"
    __table_args__ = (
        UniqueConstraint(
            "program_id", "indicator_id", "eps_id", "year", "month",
            name="uq_monthly_record_natural_key",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("programs.id"), nullable=False, index=True)
    indicator_id: Mapped[int] = mapped_column(
        ForeignKey("indicators.id"), nullable=False, index=True
    )
    eps_id: Mapped[int] = mapped_column(ForeignKey("eps.id"), nullable=False, index=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    month: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    value: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    source_accumulated: Mapped[float | None] = mapped_column(Float, nullable=True)
    source_pct_execution: Mapped[float | None] = mapped_column(Float, nullable=True)
    target: Mapped[float | None] = mapped_column(Float, nullable=True)
    population: Mapped[int | None] = mapped_column(Integer, nullable=True)
    numerator: Mapped[float | None] = mapped_column(Float, nullable=True)
    denominator: Mapped[float | None] = mapped_column(Float, nullable=True)
    estimation: Mapped[float | None] = mapped_column(Float, nullable=True)
    line_base: Mapped[float | None] = mapped_column(Float, nullable=True)
    source_import_id: Mapped[int | None] = mapped_column(
        ForeignKey("import_batches.id", ondelete="SET NULL"), nullable=True
    )

    program: Mapped[Program] = relationship(back_populates="monthly_records")
    indicator: Mapped[Indicator] = relationship(back_populates="monthly_records")
    eps: Mapped[Eps] = relationship(back_populates="monthly_records")


class AnnualHistory(Base):
    __tablename__ = "annual_history"
    __table_args__ = (
        UniqueConstraint("indicator_name", "eps_name", "year", name="uq_annual_history_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    indicator_name: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    eps_name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    source_import_id: Mapped[int | None] = mapped_column(
        ForeignKey("import_batches.id", ondelete="SET NULL"), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class CancerMortality(Base):
    __tablename__ = "cancer_mortality"
    __table_args__ = (UniqueConstraint("indicator", "year", name="uq_cancer_mortality_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    indicator: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    cases: Mapped[int] = mapped_column(Integer, nullable=False)
    source_import_id: Mapped[int | None] = mapped_column(
        ForeignKey("import_batches.id", ondelete="SET NULL"), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class Population(Base):
    __tablename__ = "population"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    year: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    population: Mapped[int] = mapped_column(Integer, nullable=False)
    source_import_id: Mapped[int | None] = mapped_column(
        ForeignKey("import_batches.id", ondelete="SET NULL"), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class RiskFactor(Base):
    __tablename__ = "risk_factors"
    __table_args__ = (
        UniqueConstraint("age_group", "indicator_name", name="uq_risk_factor_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    age_group: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    indicator_name: Mapped[str] = mapped_column(String(180), nullable=False)
    value_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    numerator: Mapped[float | None] = mapped_column(Float, nullable=True)
    denominator: Mapped[float | None] = mapped_column(Float, nullable=True)
    source_import_id: Mapped[int | None] = mapped_column(
        ForeignKey("import_batches.id", ondelete="SET NULL"), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class ConsolidadoRecord(Base):
    __tablename__ = "consolidado_records"
    __table_args__ = (
        UniqueConstraint("program", "indicator", "eps", name="uq_consolidado_record_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    program: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    indicator: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    indicator_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    eps: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    execution: Mapped[float | None] = mapped_column(Float, nullable=True)
    compliance_advance: Mapped[float | None] = mapped_column(Float, nullable=True)
    source_import_id: Mapped[int | None] = mapped_column(
        ForeignKey("import_batches.id", ondelete="SET NULL"), nullable=True
    )


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    level: Mapped[str] = mapped_column(String(20), nullable=False)
    program: Mapped[str] = mapped_column(String(120), nullable=False)
    eps: Mapped[str] = mapped_column(String(120), nullable=False)
    type: Mapped[str] = mapped_column(String(120), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    rule_code: Mapped[str] = mapped_column(String(50), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(40), nullable=False)
    entity: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    entity_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    before: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    after: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
