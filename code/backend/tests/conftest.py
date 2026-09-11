from datetime import datetime

import pytest

from app.db import make_engine, make_session_factory
from app.models import Base

NOW = datetime(2026, 9, 14, 10, 0, 0)  # fixed "current time" for tests


@pytest.fixture
def engine():
    engine = make_engine("sqlite://")
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def db(engine):
    with make_session_factory(engine)() as session:
        yield session


@pytest.fixture
def seeded(db):
    from seed import seed

    seed(db, now=NOW)
    return db
