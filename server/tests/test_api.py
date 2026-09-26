"""The HTTP API of the contract, end to end through FastAPI with a real database."""

import hashlib
import time
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select

from app.db import accounts, deleted_accounts, progress
from tests.conftest import ORIGIN, FixedClock
from tests.tokens import make_token


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def rows(engine: Engine, table: Any, uid: str) -> int:
    column = table.c.uid if table is accounts else table.c.account_uid
    with engine.connect() as conn:
        return int(conn.execute(select(func.count()).select_from(table).where(column == uid)).scalar_one())


def done(at: int, **extra: Any) -> dict[str, Any]:
    return {"done": True, "doneAt": at, "changedAt": at, **extra}


# Health and auth.


def test_health_needs_no_token(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True}


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Authorization": "Bearer"},
        {"Authorization": "Basic abc"},
        {"Authorization": "Bearer not-a-token"},
        {"Authorization": f"Bearer {make_token(expires=time.time() - 3600, issued=time.time() - 7200)}"},
        {"Authorization": f"Bearer {make_token(project='another-project')}"},
        {"Authorization": f"Bearer {make_token(wrong_key=True)}"},
    ],
)
@pytest.mark.parametrize(("method", "path"), [("GET", "/me"), ("GET", "/progress"), ("DELETE", "/me")])
def test_every_endpoint_but_health_needs_a_valid_token(
    client: TestClient, headers: dict[str, str], method: str, path: str
) -> None:
    response = client.request(method, path, headers=headers)
    assert response.status_code == 401
    assert "detail" in response.json()


def test_the_token_is_checked_before_the_body(client: TestClient) -> None:
    assert client.post("/progress", json={"concepts": "nonsense"}).status_code == 401


def test_a_rejected_token_creates_no_account(client: TestClient, engine: Engine) -> None:
    client.get("/me", headers=auth(make_token("uid-x", project="another-project")))
    assert rows(engine, accounts, "uid-x") == 0


# GET /me


def test_the_first_call_creates_one_account_and_later_calls_reuse_it(
    client: TestClient, engine: Engine
) -> None:
    token = make_token("uid-1", "one@example.com")
    for _ in range(3):
        response = client.get("/me", headers=auth(token))
        assert response.status_code == 200
        assert response.json() == {"email": "one@example.com"}
    assert rows(engine, accounts, "uid-1") == 1


def test_an_account_without_email_answers_null(client: TestClient) -> None:
    assert client.get("/me", headers=auth(make_token("uid-2", email=None))).json() == {"email": None}


def test_a_changed_email_is_kept(client: TestClient) -> None:
    client.get("/me", headers=auth(make_token("uid-1", "old@example.com")))
    assert client.get("/me", headers=auth(make_token("uid-1", "new@example.com"))).json() == {
        "email": "new@example.com"
    }


# Progress.


def test_a_new_account_has_no_progress(client: TestClient) -> None:
    response = client.get("/progress", headers=auth(make_token()))
    assert response.status_code == 200
    assert response.json() == {"concepts": {}}


def test_post_before_me_creates_the_account(client: TestClient, engine: Engine) -> None:
    response = client.post(
        "/progress", headers=auth(make_token("uid-9")), json={"concepts": {"caching": done(5)}}
    )
    assert response.status_code == 200
    assert rows(engine, accounts, "uid-9") == 1


def test_post_merges_and_answers_all_the_progress_of_the_account(client: TestClient) -> None:
    token = auth(make_token())
    client.post("/progress", headers=token, json={"concepts": {"caching": done(100, visitedAt=50)}})
    response = client.post(
        "/progress",
        headers=token,
        json={
            "concepts": {
                "sharding": {"done": False, "doneAt": 0, "changedAt": 70, "visitedAt": 70},
                "caching": {"done": False, "doneAt": 200, "changedAt": 200, "visitedAt": 90},
            }
        },
    )
    assert response.status_code == 200
    assert response.json() == {
        "concepts": {
            "caching": {"done": False, "doneAt": 200, "changedAt": 200, "visitedAt": 50},
            "sharding": {"done": False, "doneAt": 0, "changedAt": 70, "visitedAt": 70},
        }
    }
    assert client.get("/progress", headers=token).json() == response.json()


def test_every_optional_field_round_trips_and_absent_ones_are_omitted(client: TestClient) -> None:
    full = {
        "done": True,
        "doneAt": 1_727_000_000_000,
        "changedAt": 1_727_000_000_500,
        "visitedAt": 1_726_000_000_000,
        "quiz": {"correct": 8, "total": 10, "at": 1_727_000_000_000},
        "clearedAt": 1_725_000_000_000,
    }
    token = auth(make_token())
    client.post("/progress", headers=token, json={"concepts": {"load-balancing": full, "cdn": done(1)}})
    concepts = client.get("/progress", headers=token).json()["concepts"]
    assert concepts["load-balancing"] == full
    assert concepts["cdn"] == {"done": True, "doneAt": 1, "changedAt": 1}


def test_a_lower_quiz_score_never_replaces_a_higher_one(client: TestClient) -> None:
    token = auth(make_token())
    high = {"done": True, "doneAt": 10, "changedAt": 10, "quiz": {"correct": 9, "total": 10, "at": 10}}
    low = {"done": False, "doneAt": 0, "changedAt": 20, "quiz": {"correct": 3, "total": 10, "at": 20}}
    client.post("/progress", headers=token, json={"concepts": {"cdn": high}})
    after = client.post("/progress", headers=token, json={"concepts": {"cdn": low}}).json()
    assert after["concepts"]["cdn"]["quiz"] == {"correct": 9, "total": 10, "at": 10}


def test_a_reset_clears_the_account_and_later_progress_is_kept(client: TestClient) -> None:
    token = auth(make_token())
    old = done(100, visitedAt=50, quiz={"correct": 10, "total": 10, "at": 100})
    client.post("/progress", headers=token, json={"concepts": {"cdn": old}})
    reset = {"done": False, "doneAt": 500, "changedAt": 500, "clearedAt": 500}
    client.post("/progress", headers=token, json={"concepts": {"cdn": reset}})
    # A device that was offline during the Reset brings the old record back: it must not win.
    stale = client.post("/progress", headers=token, json={"concepts": {"cdn": old}}).json()
    assert stale["concepts"]["cdn"] == reset
    after = done(800, visitedAt=700, clearedAt=500)
    assert (
        client.post("/progress", headers=token, json={"concepts": {"cdn": after}}).json()["concepts"]["cdn"]
        == after
    )


def test_ten_in_the_account_and_five_on_a_guest_device_give_fifteen_done(client: TestClient) -> None:
    token = auth(make_token())
    laptop = {f"concept-{n}": done(1000 + n) for n in range(10)}
    phone = {f"other-{n}": done(2000 + n) for n in range(5)}
    client.post("/progress", headers=token, json={"concepts": laptop})
    merged = client.post("/progress", headers=token, json={"concepts": phone}).json()["concepts"]
    assert sum(1 for record in merged.values() if record["done"]) == 15


def test_two_posts_with_different_concepts_both_end_saved(client: TestClient) -> None:
    token = auth(make_token())
    client.post("/progress", headers=token, json={"concepts": {"caching": done(1)}})
    client.post("/progress", headers=token, json={"concepts": {"sharding": done(2)}})
    assert set(client.get("/progress", headers=token).json()["concepts"]) == {"caching", "sharding"}


def test_an_account_reads_and_writes_only_its_own_progress(client: TestClient, engine: Engine) -> None:
    alice, bob = auth(make_token("alice", "a@example.com")), auth(make_token("bob", "b@example.com"))
    client.post("/progress", headers=alice, json={"concepts": {"caching": done(1)}})
    bob_answer = client.post("/progress", headers=bob, json={"concepts": {"sharding": done(2)}}).json()
    assert set(bob_answer["concepts"]) == {"sharding"}
    assert set(client.get("/progress", headers=alice).json()["concepts"]) == {"caching"}
    assert rows(engine, progress, "alice") == 1
    assert rows(engine, progress, "bob") == 1


# Validation.


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"concepts": []},
        {"concepts": {"Caching": done(1)}},
        {"concepts": {"-caching": done(1)}},
        {"concepts": {"a" * 101: done(1)}},
        {"concepts": {"cach ing": done(1)}},
        {"concepts": {"caching": {"done": True, "doneAt": 1}}},
        {"concepts": {"caching": {"done": "yes", "doneAt": 1, "changedAt": 1}}},
        {"concepts": {"caching": done(1, quiz={"correct": 1, "total": 0, "at": 1})}},
        {"concepts": {"caching": done(1, quiz={"correct": 1, "total": 2})}},
        {"concepts": {"caching": done(1, visitedAt="soon")}},
        {"concepts": {"caching": done(-1)}},
        {"concepts": {"caching": done(2**63)}},
    ],
)
def test_a_body_that_does_not_validate_is_422(client: TestClient, body: dict[str, Any]) -> None:
    assert client.post("/progress", headers=auth(make_token()), json=body).status_code == 422


def test_at_most_1000_concepts_per_post(client: TestClient) -> None:
    token = auth(make_token())
    many = {f"c-{n}": done(n) for n in range(1001)}
    assert client.post("/progress", headers=token, json={"concepts": many}).status_code == 422
    many.pop("c-0")
    assert client.post("/progress", headers=token, json={"concepts": many}).status_code == 200


def test_null_optional_fields_count_as_absent(client: TestClient) -> None:
    body = {"concepts": {"cdn": done(1, visitedAt=None, quiz=None, clearedAt=None)}}
    answer = client.post("/progress", headers=auth(make_token()), json=body).json()
    assert answer["concepts"]["cdn"] == done(1)


def test_a_huge_body_is_refused_before_it_is_read(client: TestClient) -> None:
    response = client.post(
        "/progress",
        headers={**auth(make_token()), "Content-Type": "application/json"},
        content=b'{"concepts": {"x": "' + b"a" * 2_000_000 + b'"}}',
    )
    assert response.status_code == 413


# DELETE /me


def test_delete_removes_every_row_of_the_account_and_only_that_account(
    client: TestClient, engine: Engine
) -> None:
    gone, kept = auth(make_token("gone")), auth(make_token("kept"))
    for token in (gone, kept):
        client.post("/progress", headers=token, json={"concepts": {"caching": done(1), "cdn": done(2)}})
    response = client.delete("/me", headers=gone)
    assert response.status_code == 204
    assert rows(engine, accounts, "gone") == 0
    assert rows(engine, progress, "gone") == 0
    assert rows(engine, accounts, "kept") == 1
    assert rows(engine, progress, "kept") == 2


def test_the_tombstone_holds_a_hash_of_the_uid_not_the_uid(
    client: TestClient, engine: Engine, clock: FixedClock
) -> None:
    client.delete("/me", headers=auth(make_token("gone")))
    with engine.connect() as conn:
        tombstones = conn.execute(select(deleted_accounts)).all()
    assert [(row.uid_sha256, row.deleted_at) for row in tombstones] == [
        (hashlib.sha256(b"gone").hexdigest(), clock.now)
    ]


def test_an_old_token_after_the_delete_gets_410_and_recreates_nothing(
    client: TestClient, engine: Engine, clock: FixedClock
) -> None:
    now = time.time()
    clock.now = int((now - 30) * 1000)  # the delete happens 30 s ago
    old = auth(make_token("gone", auth_time=now - 600))
    client.post("/progress", headers=old, json={"concepts": {"caching": done(1)}})
    assert client.delete("/me", headers=old).status_code == 204
    for method, path in [("GET", "/me"), ("GET", "/progress"), ("POST", "/progress"), ("DELETE", "/me")]:
        response = client.request(method, path, headers=old, json={"concepts": {"cdn": done(3)}})
        assert response.status_code == 410, (method, path)
        assert response.json() == {"detail": "account_deleted"}
    assert rows(engine, accounts, "gone") == 0
    assert rows(engine, progress, "gone") == 0


def test_a_new_sign_in_after_the_delete_gets_a_fresh_empty_account(
    client: TestClient, engine: Engine, clock: FixedClock
) -> None:
    now = time.time()
    clock.now = int((now - 30) * 1000)
    old = auth(make_token("gone", auth_time=now - 600))
    client.post("/progress", headers=old, json={"concepts": {"caching": done(1)}})
    client.delete("/me", headers=old)
    fresh = auth(make_token("gone", auth_time=now - 5))
    assert client.get("/me", headers=fresh).status_code == 200
    assert client.get("/progress", headers=fresh).json() == {"concepts": {}}
    assert rows(engine, accounts, "gone") == 1


def test_a_sign_in_in_the_same_millisecond_as_the_delete_is_refused(
    client: TestClient, clock: FixedClock
) -> None:
    signed_in = int(time.time()) - 60
    clock.now = signed_in * 1000
    token = auth(make_token("gone", auth_time=signed_in))
    client.delete("/me", headers=token)
    assert client.get("/me", headers=token).status_code == 410


# CORS


def test_cors_allows_the_web_app_origin(client: TestClient) -> None:
    response = client.options(
        "/progress",
        headers={
            "Origin": ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization, content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ORIGIN
    assert "access-control-allow-credentials" not in response.headers


def test_cors_refuses_any_other_origin(client: TestClient) -> None:
    preflight = client.options(
        "/progress", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"}
    )
    assert "access-control-allow-origin" not in preflight.headers
    simple = client.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in simple.headers
