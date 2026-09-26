# The Account API. Built by Railway (server/railway.json) and by `docker compose up api`.
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.12.3 /uv /bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PYTHONUNBUFFERED=1

WORKDIR /srv

# Dependencies first, so a code change does not reinstall them.
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev

COPY app ./app

ENV PATH="/srv/.venv/bin:$PATH"
RUN useradd --system --no-create-home api
USER api

EXPOSE 8000
# Shell form so $PORT (set by Railway) is expanded; exec so uvicorn gets the stop signal.
CMD exec uvicorn app.main:create_app --factory --host 0.0.0.0 --port ${PORT:-8000}
