"""The three tables of the Account backend, in portable SQLAlchemy Core.

Postgres in production; the tests also run on SQLite, so nothing here is Postgres-only. Every time
is a BIGINT of ms since the epoch, the unit the browser records progress in.
"""

from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    Engine,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
    create_engine,
    event,
)

metadata = MetaData()

#: One row per Learner with an Account, keyed by the Firebase uid.
accounts = Table(
    "accounts",
    metadata,
    Column("uid", String(128), primary_key=True),
    Column("email", String(320)),
    Column("created_at", BigInteger, nullable=False),
)

#: One row per Concept per Account - the fields of the web app's ConceptProgress.
progress = Table(
    "progress",
    metadata,
    Column("account_uid", String(128), ForeignKey("accounts.uid", ondelete="CASCADE"), primary_key=True),
    Column("slug", String(100), primary_key=True),
    Column("done", Boolean, nullable=False),
    Column("done_at", BigInteger, nullable=False),
    Column("changed_at", BigInteger, nullable=False),
    Column("visited_at", BigInteger),
    Column("quiz_correct", Integer),
    Column("quiz_total", Integer),
    Column("quiz_at", BigInteger),
    Column("cleared_at", BigInteger),
    # A quiz result is all three fields or none.
    CheckConstraint(
        "(quiz_correct IS NULL AND quiz_total IS NULL AND quiz_at IS NULL)"
        " OR (quiz_correct IS NOT NULL AND quiz_total > 0 AND quiz_at IS NOT NULL)",
        name="progress_quiz_complete",
    ),
)

#: A tombstone per deleted Account, so a token issued before the delete gets 410 instead of
#: silently creating a new Account. Only a hash of the uid is kept, not the uid or the email.
deleted_accounts = Table(
    "deleted_accounts",
    metadata,
    Column("uid_sha256", String(64), primary_key=True),
    Column("deleted_at", BigInteger, nullable=False),
)


def make_engine(url: str) -> Engine:
    """An engine for `url`. SQLite (tests only) needs foreign keys switched on per connection."""
    if url.startswith("sqlite"):
        engine = create_engine(url)

        @event.listens_for(engine, "connect")
        def _foreign_keys(connection: Any, _record: Any) -> None:
            connection.execute("PRAGMA foreign_keys = ON")

        return engine
    # pre_ping: Railway may drop idle connections, and a dead one would fail the next request.
    return create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=5)


def create_tables(engine: Engine) -> None:
    """Creates the tables that are missing and leaves the others alone, so it runs at every start.

    There are no migrations yet: a later change to an existing table needs one (Alembic).
    """
    metadata.create_all(engine, checkfirst=True)
