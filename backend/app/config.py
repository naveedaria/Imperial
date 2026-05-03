"""Centralised application configuration loaded from environment variables.

Kept intentionally small: a take-home doesn't need pydantic-settings, but having
one Settings object makes it easy to swap to it later and gives tests a single
hook for overrides.
"""

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    log_level: str
    database_url: str
    frontend_origin: str


def load_settings() -> Settings:
    return Settings(
        log_level=os.getenv("LOG_LEVEL", "INFO").upper(),
        database_url=os.getenv(
            "DATABASE_URL",
            "postgresql+asyncpg://imperial:imperial@db:5432/imperial",
        ),
        frontend_origin=os.getenv("FRONTEND_ORIGIN", "http://localhost:5173"),
    )


settings = load_settings()
