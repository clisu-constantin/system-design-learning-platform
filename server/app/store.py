"""What the API does with the database: Accounts, their progress, and deleting them.

Every call opens the Account of the token in one transaction and holds a row lock on it, so two
saves of one Account (two tabs, two devices) run one after the other and neither loses the merge
of the other, and a delete cannot race a save into bringing the Account back.
"""

import hashlib
from collections.abc import Callable, Mapping
from typing import Any

from sqlalchemy import Connection, Engine, Row, delete, select, update
from sqlalchemy.dialects import postgresql, sqlite

from app.auth import Identity
from app.db import accounts, deleted_accounts, progress
from app.merge import ConceptProgress, QuizResult, merge_progress


class AccountDeleted(Exception):
    """The Account was deleted after this token's sign-in: 410, and the web app becomes a Guest."""


def _uid_hash(uid: str) -> str:
    return hashlib.sha256(uid.encode()).hexdigest()


class Store:
    def __init__(self, engine: Engine, clock: Callable[[], int]) -> None:
        """`clock` gives the server time in ms; it stamps new Accounts and deletes."""
        self._engine = engine
        self._clock = clock

    def email(self, who: Identity) -> str | None:
        """The email of the Account, which is created on first contact."""
        with self._engine.begin() as conn:
            return self._open(conn, who)

    def progress(self, who: Identity) -> dict[str, ConceptProgress]:
        with self._engine.begin() as conn:
            self._open(conn, who)
            return self._read(conn, who.uid)

    def save(self, who: Identity, changes: Mapping[str, ConceptProgress]) -> dict[str, ConceptProgress]:
        """Merges the changed Concepts into the stored ones and answers all the progress of the Account."""
        with self._engine.begin() as conn:
            self._open(conn, who)
            stored = self._read(conn, who.uid)
            merged = merge_progress(stored, changes)
            written = {slug: merged[slug] for slug in changes if merged[slug] != stored.get(slug)}
            if written:
                conn.execute(
                    delete(progress).where(progress.c.account_uid == who.uid, progress.c.slug.in_(written))
                )
                conn.execute(
                    progress.insert(), [_to_row(who.uid, slug, rec) for slug, rec in written.items()]
                )
            return merged

    def delete(self, who: Identity) -> None:
        """Removes the Account and all its progress, and leaves a tombstone with the delete time."""
        with self._engine.begin() as conn:
            self._open(conn, who)
            conn.execute(delete(progress).where(progress.c.account_uid == who.uid))
            conn.execute(delete(accounts).where(accounts.c.uid == who.uid))
            uid_hash = _uid_hash(who.uid)
            conn.execute(delete(deleted_accounts).where(deleted_accounts.c.uid_sha256 == uid_hash))
            conn.execute(deleted_accounts.insert().values(uid_sha256=uid_hash, deleted_at=self._clock()))

    def _open(self, conn: Connection, who: Identity) -> str | None:
        """Creates the Account if missing, locks its row, and refuses a token from before a delete.

        The tombstone is read after the lock, not before: a delete that commits while this call
        waits is then seen, and the Account row this call may have inserted is rolled back.
        """
        conn.execute(_insert_ignore(conn, accounts, uid=who.uid, email=who.email, created_at=self._clock()))
        account = conn.execute(
            select(accounts.c.email).where(accounts.c.uid == who.uid).with_for_update()
        ).first()
        deleted_at = conn.execute(
            select(deleted_accounts.c.deleted_at).where(deleted_accounts.c.uid_sha256 == _uid_hash(who.uid))
        ).scalar_one_or_none()
        if account is None or (deleted_at is not None and who.auth_time * 1000 <= deleted_at):
            raise AccountDeleted
        if account.email != who.email:
            conn.execute(update(accounts).where(accounts.c.uid == who.uid).values(email=who.email))
        return who.email

    def _read(self, conn: Connection, uid: str) -> dict[str, ConceptProgress]:
        result = conn.execute(select(progress).where(progress.c.account_uid == uid).order_by(progress.c.slug))
        return {row.slug: _from_row(row) for row in result}


def _insert_ignore(conn: Connection, table: Any, **values: Any) -> Any:
    """INSERT that does nothing when the key exists - both dialects spell it ON CONFLICT DO NOTHING."""
    dialect = postgresql if conn.dialect.name == "postgresql" else sqlite
    return dialect.insert(table).values(**values).on_conflict_do_nothing()


def _to_row(uid: str, slug: str, record: ConceptProgress) -> dict[str, Any]:
    quiz = record.quiz
    return {
        "account_uid": uid,
        "slug": slug,
        "done": record.done,
        "done_at": record.done_at,
        "changed_at": record.changed_at,
        "visited_at": record.visited_at,
        "quiz_correct": quiz.correct if quiz else None,
        "quiz_total": quiz.total if quiz else None,
        "quiz_at": quiz.at if quiz else None,
        "cleared_at": record.cleared_at,
    }


def _from_row(row: Row[Any]) -> ConceptProgress:
    quiz = (
        QuizResult(correct=row.quiz_correct, total=row.quiz_total, at=row.quiz_at)
        if row.quiz_total is not None
        else None
    )
    return ConceptProgress(
        done=row.done,
        done_at=row.done_at,
        changed_at=row.changed_at,
        visited_at=row.visited_at,
        quiz=quiz,
        cleared_at=row.cleared_at,
    )
