"""Database reads shared by the delivery jobs.

Reminder text is stored encrypted. These helpers decrypt it in memory, right before a notification is composed for
the OWNER, and never write plaintext back to the database. Reminder text is never sent to any AI service from here;
notification wording is generic or built locally.
"""

from datetime import datetime
from typing import Any

from app.repositories import TaskRepository
from utils.recurrence import occurs_on_ist_day


async def find_tasks(db: Any, query: dict, length: int | None = None) -> list[dict]:
    """``db.tasks.find(query)`` with title / description / category decrypted. ``_id`` is kept."""
    return await TaskRepository(db).find_many(query, length=length)


async def find_recurring_projected_to_day(db: Any, day_start_utc: datetime, extra: dict | None = None) -> list[dict]:
    """Daily / weekly reminders that HAVE an occurrence on the given IST day but whose ``due_date``
    (the next occurrence) is still earlier - e.g. today's occurrence is pending, so tomorrow's
    isn't in the database yet. Used for the 'tomorrow' digest."""
    query = {
        "schedule_type": {"$in": ["daily", "weekly"]},
        "status": {"$ne": "completed"},
        "due_date": {"$lt": day_start_utc},
    }
    query.update(extra or {})
    tasks = await find_tasks(db, query)
    return [t for t in tasks if occurs_on_ist_day(t, day_start_utc)]
