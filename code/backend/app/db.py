"""Database connection. SQLite file by default; tests use an in-memory copy."""
from __future__ import annotations

from pathlib import Path

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "campusswap.db"


def make_engine(url: str | None = None) -> Engine:
    url = url or f"sqlite:///{DEFAULT_DB_PATH}"
    options: dict = {"connect_args": {"check_same_thread": False}}
    if url == "sqlite://":  # in-memory: one shared connection for the whole test
        options["poolclass"] = StaticPool
    engine = create_engine(url, **options)

    @event.listens_for(engine, "connect")
    def _enforce_foreign_keys(dbapi_connection, _record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


def make_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, expire_on_commit=False)
