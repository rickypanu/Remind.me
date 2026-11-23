"""Small builders shared by the service, sync and route tests."""

from datetime import UTC, datetime, timedelta

from bson import ObjectId

from app.services.tasks import build_task_service
from schemas.task import TaskCreate
from tests.fake_db import FakeDb

T0 = datetime(2026, 10, 20, 10, 0, 0, tzinfo=UTC)


class Clock:
    """A clock the test moves by hand. Callable, so it plugs into ``build_task_service(db, clock=clock)``."""

    def __init__(self, start: datetime = T0) -> None:
        self.now = start

    def __call__(self) -> datetime:
        return self.now

    def tick(self, **delta) -> datetime:
        self.now += timedelta(**delta)
        return self.now


def new_world(start: datetime = T0):
    """``(db, clock, service)``: an empty in-memory database, a manual clock and a TaskService wired to both."""
    db, clock = FakeDb(), Clock(start)
    return db, clock, build_task_service(db, clock=clock)


def task_payload(title: str = "Pay rent", *, client_id: str | None = None, days: int = 2, **over) -> TaskCreate:
    args = {
        "title": title,
        "category": "Personal",
        "due_date": T0 + timedelta(days=days),
        "client_id": client_id,
    }
    args.update(over)
    return TaskCreate(**args)


def user_id() -> ObjectId:
    return ObjectId()
