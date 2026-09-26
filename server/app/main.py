"""The API app. Run it with `uvicorn app.main:create_app --factory` (see server/README.md).

The web app never waits for this server: it is a backup and a bridge between devices, never a
gate (docs/adr/0001-backend-with-rented-auth.md). So errors are short JSON the web app can act on
quietly - 401 sign in again, 410 become a Guest - and /health touches nothing.
"""

import time
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Request, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import Engine

from app.auth import GooglePublicKeys, Identity, InvalidToken, KeySource, KeysUnavailable, verify_token
from app.db import create_tables, make_engine
from app.limits import BodySizeLimit
from app.schemas import ProgressIn, to_json
from app.settings import Settings
from app.store import AccountDeleted, Store

#: A save of 1000 Concepts with long slugs is about 300 KB; anything much larger is not the web app.
MAX_BODY_BYTES = 1024 * 1024


def _now_ms() -> int:
    return int(time.time() * 1000)


def create_app(
    settings: Settings | None = None,
    *,
    keys: KeySource | None = None,
    engine: Engine | None = None,
    clock: Callable[[], int] = _now_ms,
) -> FastAPI:
    """The app, with its parts injectable: tests pass their own signing keys, database and clock."""
    settings = settings or Settings.from_env()
    keys = keys or GooglePublicKeys()
    engine = engine or make_engine(settings.database_url)
    store = Store(engine, clock)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        await run_in_threadpool(create_tables, engine)
        yield
        engine.dispose()

    app = FastAPI(title="System Design Interactive API", lifespan=lifespan, docs_url=None, redoc_url=None)
    app.add_middleware(BodySizeLimit, max_bytes=MAX_BODY_BYTES)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_origins),
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
        allow_credentials=False,  # the token travels in a header, never in a cookie
        max_age=600,
    )

    @app.exception_handler(InvalidToken)
    async def _invalid_token(_: Request, error: InvalidToken) -> JSONResponse:
        return JSONResponse({"detail": str(error)}, status_code=401, headers={"WWW-Authenticate": "Bearer"})

    @app.exception_handler(KeysUnavailable)
    async def _keys_unavailable(_: Request, error: KeysUnavailable) -> JSONResponse:
        return JSONResponse({"detail": str(error)}, status_code=503)

    @app.exception_handler(AccountDeleted)
    async def _account_deleted(_: Request, __: AccountDeleted) -> JSONResponse:
        return JSONResponse({"detail": "account_deleted"}, status_code=410)

    def identity(request: Request) -> Identity:
        scheme, _, token = request.headers.get("authorization", "").partition(" ")
        if scheme.lower() != "bearer" or not token.strip():
            raise InvalidToken("Missing bearer token")
        return verify_token(token.strip(), settings.firebase_project_id, keys)

    Who = Annotated[Identity, Depends(identity)]

    # Plain `def` endpoints: the database and the key fetch block, so FastAPI runs them in its thread pool.

    @app.get("/health")
    def health() -> dict[str, bool]:
        return {"ok": True}

    @app.get("/me")
    def me(who: Who) -> dict[str, str | None]:
        return {"email": store.email(who)}

    @app.get("/progress")
    def get_progress(who: Who) -> dict[str, Any]:
        return {"concepts": {slug: to_json(record) for slug, record in store.progress(who).items()}}

    @app.post("/progress")
    def post_progress(who: Who, body: ProgressIn) -> dict[str, Any]:
        changes = {slug: record.to_domain() for slug, record in body.concepts.items()}
        return {
            "concepts": {slug: to_json(record) for slug, record in sorted(store.save(who, changes).items())}
        }

    @app.delete("/me", status_code=204)
    def delete_me(who: Who) -> Response:
        store.delete(who)
        return Response(status_code=204)

    return app
