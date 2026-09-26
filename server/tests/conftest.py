"""Shared fixtures: a fresh database per test and an app wired to the test signing key.

Tests run on SQLite unless TEST_DATABASE_URL points at a Postgres (CI sets it), so the same tests
check both the portable SQL and the real database the API runs on.
"""

import os
import time
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.db import create_tables, make_engine, metadata
from app.main import create_app
from app.settings import Settings, sqlalchemy_url
from tests.tokens import PROJECT, signing_keys

ORIGIN = "http://localhost:5173"


class FixedClock:
    """Milliseconds since the epoch, set by the test - the server clock for delete times."""

    def __init__(self, now: int) -> None:
        self.now = now

    def __call__(self) -> int:
        return self.now


@pytest.fixture
def engine(tmp_path: Path) -> Iterator[Engine]:
    url = sqlalchemy_url(os.environ.get("TEST_DATABASE_URL") or f"sqlite:///{tmp_path / 'test.db'}")
    engine = make_engine(url)
    metadata.drop_all(engine)
    create_tables(engine)
    yield engine
    metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def clock() -> FixedClock:
    return FixedClock(int(time.time() * 1000))


@pytest.fixture
def client(engine: Engine, clock: FixedClock) -> Iterator[TestClient]:
    settings = Settings(
        database_url=engine.url.render_as_string(hide_password=False),
        firebase_project_id=PROJECT,
        allowed_origins=(ORIGIN,),
    )
    app = create_app(settings, keys=signing_keys(), engine=engine, clock=clock)
    with TestClient(app) as client:
        yield client
