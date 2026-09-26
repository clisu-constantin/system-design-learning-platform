# server/ - the Account API

The optional backend of System Design Interactive: a FastAPI service with its own Postgres that
saves the progress of a signed-in Learner, so it follows them to another device and survives a
cleared browser. Sign-in itself is Firebase Auth; this service only checks the Firebase ID token
(with the Google public keys - no service account key) and owns the progress data. The web app
never waits for it: a Guest never calls it, and a down server only delays a sync.
See `docs/adr/0001-backend-with-rented-auth.md` and `CONTEXT.md` (Learner, Account, Guest).

## Endpoints

Every endpoint but `/health` needs `Authorization: Bearer <Firebase ID token>`.

| Method and path  | Answer                                                                          |
| ---------------- | ------------------------------------------------------------------------------- |
| `GET /health`    | `{"ok": true}` - no auth, no database (Railway health check)                    |
| `GET /me`        | `{"email": ...}` - creates the Account on first contact                         |
| `GET /progress`  | `{"concepts": {slug: ConceptProgress}}` - all the progress of the Account       |
| `POST /progress` | merges the changed Concepts (at most 1000) and answers all the progress         |
| `DELETE /me`     | deletes the Account and every progress row, leaves a tombstone; 204             |

Errors: 401 bad or missing token, 410 `account_deleted` (a token from before a delete),
422 a body that does not validate, 413 a body over 1 MB, 503 the Google keys cannot be fetched.
`ConceptProgress` is the TypeScript type of `src/app/providers/progressState.ts`, and the merge in
`app/merge.py` is a port of its `mergeConcept` - change the two together.

## Layout

```
app/
  main.py      create_app(): routes, CORS, error answers - run with uvicorn --factory
  auth.py      Firebase ID token check, Google public keys cached by max-age
  store.py     Accounts, progress and deletes, one transaction and one row lock per call
  merge.py     the progress merge rules (pure, a port of mergeConcept)
  schemas.py   request validation and the camelCase JSON
  db.py        the three tables (accounts, progress, deleted_accounts), created at start
  settings.py  environment variables
  limits.py    request body size cap
tests/         pytest; SQLite by default, Postgres when TEST_DATABASE_URL is set
```

## Run it locally

Needs [uv](https://docs.astral.sh/uv/) and Docker.

```bash
cp .env.example .env               # at the repo root, once; fill in the Firebase values
docker compose up db               # Postgres 17 on localhost:5432 (data kept in a named volume)
cd server
uv sync                            # Python and dependencies, as locked in uv.lock
uv run --env-file ../.env uvicorn app.main:create_app --factory --reload --port 8000
```

Then `npm run dev` in another terminal, with `VITE_API_URL=http://localhost:8000` in `.env`.
`docker compose up` (no service name) runs the API in a container instead, on the same port.

The tables are created at start when missing. There are no migrations yet: changing an existing
table needs one (Alembic) before it ships.

### Environment variables

| Variable              | Meaning                                                                     |
| --------------------- | --------------------------------------------------------------------------- |
| `DATABASE_URL`        | Postgres URL; `postgres://` and `postgresql://` both work (psycopg 3 is used) |
| `FIREBASE_PROJECT_ID` | the Firebase project whose ID tokens are accepted                           |
| `ALLOWED_ORIGIN`      | web app origins allowed by CORS, comma-separated                            |
| `PORT`                | listen port; Railway sets it, the Docker image defaults to 8000             |

The server refuses to start without `DATABASE_URL` or `FIREBASE_PROJECT_ID`.

## Checks

```bash
uv run ruff check .          # lint
uv run ruff format --check . # formatting
uv run mypy                  # strict type check of app/ and tests/
uv run pytest -q             # tests, on SQLite
docker compose exec db createdb -U sdi sdi_test                                   # once
TEST_DATABASE_URL=postgresql://sdi:sdi@localhost:5432/sdi_test uv run pytest -q   # on Postgres
```

Tests sign their own tokens with a test RSA key and never call Google. The `server` job of
`.github/workflows/ci.yml` runs all four, with the tests on a Postgres 17 service container.
The tests drop and recreate the tables of the database they point at, so never point
`TEST_DATABASE_URL` at the development database or a real one.

## Deploy (Railway)

`server/railway.json` builds the `Dockerfile` here and starts uvicorn on `$PORT`, with `/health`
as the health check. The API services (`api` in staging, `prod-api` in production) use Root
Directory `server/`, and their config file path must be set to `/server/railway.json`: Railway
does not look for the config file inside the Root Directory, and the root `railway.json` builds
the web app instead.
