from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Sogamoso Dashboard API"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"

    database_url: str = "sqlite:///./data/dashboard.db"
    secret_key: str = "change-me-in-production-use-at-least-32-chars"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://localhost"
    allow_public_reads: bool = True

    seed_on_startup: bool = True
    seed_data_dir: str = "../app/public/data"
    upload_dir: str = "./uploads"
    max_upload_bytes: int = 25 * 1024 * 1024

    admin_email: str = "admin@sogamoso.gov.co"
    admin_password: str = "ChangeMe123!"
    admin_name: str = "Administrador"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
