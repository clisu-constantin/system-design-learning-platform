"""The Store under concurrent saves, and the table setup that runs at every start."""

import time
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import Engine, inspect

from app.auth import Identity
from app.db import create_tables
from app.merge import ConceptProgress, QuizResult
from app.store import Store


def who(uid: str = "uid-1") -> Identity:
    return Identity(uid=uid, email=f"{uid}@example.com", auth_time=int(time.time()) - 60)


def test_creating_the_tables_twice_changes_nothing(engine: Engine) -> None:
    create_tables(engine)
    create_tables(engine)
    assert {"accounts", "progress", "deleted_accounts"} <= set(inspect(engine).get_table_names())


def test_concurrent_saves_of_one_concept_lose_no_merge(engine: Engine) -> None:
    """Each save carries one visit and one score; the stored record must hold the best of all."""
    store = Store(engine, lambda: int(time.time() * 1000))
    store.email(who())
    saves = [
        ConceptProgress(
            done=False,
            done_at=0,
            changed_at=100 + n,
            visited_at=1000 - n,
            quiz=QuizResult(correct=n, total=20, at=100 + n),
        )
        for n in range(20)
    ]
    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(lambda record: store.save(who(), {"caching": record}), saves))
    final = store.progress(who())["caching"]
    assert final.visited_at == 1000 - 19
    assert final.quiz == QuizResult(correct=19, total=20, at=119)
    assert final.changed_at == 119


def test_concurrent_saves_of_different_concepts_all_end_saved(engine: Engine) -> None:
    store = Store(engine, lambda: int(time.time() * 1000))
    records = {f"concept-{n}": ConceptProgress(done=True, done_at=n, changed_at=n) for n in range(20)}
    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(lambda item: store.save(who(), dict([item])), records.items()))
    assert store.progress(who()) == records
