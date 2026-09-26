"""Server settings, from environment variables (Railway variables, or the root .env locally)."""

import os
from collections.abc import Mapping
from dataclasses import dataclass


class SettingsError(Exception):
    """A required variable is missing: the server refuses to start rather than fail per request."""


def sqlalchemy_url(url: str) -> str:
    """Railway and most hosts hand out `postgres://` or `postgresql://`; SQLAlchemy needs the driver named."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url.removeprefix(prefix)
    return url


@dataclass(frozen=True, slots=True)
class Settings:
    database_url: str
    #: The Firebase project whose ID tokens are accepted - a token of any other project is a 401.
    firebase_project_id: str
    #: The web app origins allowed by CORS; empty allows no cross-origin caller.
    allowed_origins: tuple[str, ...] = ()

    @classmethod
    def from_env(cls, env: Mapping[str, str] = os.environ) -> "Settings":
        def required(name: str) -> str:
            value = env.get(name, "").strip()
            if not value:
                raise SettingsError(f"{name} is not set")
            return value

        origins = tuple(
            origin.strip() for origin in env.get("ALLOWED_ORIGIN", "").split(",") if origin.strip()
        )
        return cls(
            database_url=sqlalchemy_url(required("DATABASE_URL")),
            firebase_project_id=required("FIREBASE_PROJECT_ID"),
            allowed_origins=origins,
        )
