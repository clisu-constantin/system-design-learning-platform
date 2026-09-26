"""Settings come from the environment Railway and the root .env provide."""

import pytest

from app.settings import Settings, SettingsError, sqlalchemy_url


def test_settings_are_read_from_the_environment() -> None:
    settings = Settings.from_env(
        {
            "DATABASE_URL": "postgresql://u:p@db:5432/sdi",
            "FIREBASE_PROJECT_ID": "proj",
            "ALLOWED_ORIGIN": "https://app.example, http://localhost:5173 ,",
        }
    )
    assert settings.database_url == "postgresql+psycopg://u:p@db:5432/sdi"
    assert settings.firebase_project_id == "proj"
    assert settings.allowed_origins == ("https://app.example", "http://localhost:5173")


@pytest.mark.parametrize("missing", ["DATABASE_URL", "FIREBASE_PROJECT_ID"])
def test_a_missing_required_variable_stops_the_start(missing: str) -> None:
    env = {"DATABASE_URL": "postgresql://u:p@db/sdi", "FIREBASE_PROJECT_ID": "proj"}
    env[missing] = " "
    with pytest.raises(SettingsError, match=missing):
        Settings.from_env(env)


def test_no_allowed_origin_means_no_cross_origin_caller() -> None:
    settings = Settings.from_env({"DATABASE_URL": "sqlite://", "FIREBASE_PROJECT_ID": "p"})
    assert settings.allowed_origins == ()


@pytest.mark.parametrize(
    ("given", "used"),
    [
        ("postgres://u:p@h:5432/d", "postgresql+psycopg://u:p@h:5432/d"),
        ("postgresql://u:p@h/d", "postgresql+psycopg://u:p@h/d"),
        ("postgresql+psycopg://u:p@h/d", "postgresql+psycopg://u:p@h/d"),
        ("sqlite:///x.db", "sqlite:///x.db"),
    ],
)
def test_railway_style_database_urls_use_psycopg_3(given: str, used: str) -> None:
    assert sqlalchemy_url(given) == used
