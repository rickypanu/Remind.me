"""
Background job that keeps daily / weekly reminders moving.

A recurring reminder stores its NEXT occurrence in `due_date`. When the user ticks an occurrence off,
the API rolls it forward immediately (routes/tasks/task.py). When nobody completes it, this job rolls it
forward once the occurrence is MISSED_GRACE (3 h) old, clears the "already notified" flags, and counts it
in `missed_count`, so tomorrow's reminders still fire on time.
"""
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from database import db
from utils.recurrence import MISSED_GRACE, RECURRING_TYPES, advance_after_miss
from utils.timezone import IST, now_utc

log = logging.getLogger("recurring_jobs")


async def roll_missed_recurring_tasks() -> int:
    now = now_utc()
    cutoff = now - MISSED_GRACE
    query = {
        "schedule_type": {"$in": list(RECURRING_TYPES)},
        "status": {"$ne": "completed"},
        "due_date": {"$lt": cutoff},
    }
    rolled = 0
    async for task in db["tasks"].find(query):
        change = advance_after_miss(task, now)
        update = {"$set": change["set"], "$inc": change["inc"]}
        if change["unset"]:
            update["$unset"] = change["unset"]
        # Guard on the old due_date so a concurrent completion is never overwritten
        res = await db["tasks"].update_one({"_id": task["_id"], "due_date": task["due_date"]}, update)
        rolled += res.modified_count
    if rolled:
        log.info("Rolled %d missed recurring reminder(s) to their next occurrence", rolled)
    return rolled


def start_scheduler_recurring():
    scheduler = AsyncIOScheduler(timezone=IST)
    scheduler.add_job(
        roll_missed_recurring_tasks,
        IntervalTrigger(minutes=5, timezone=IST),
        coalesce=True, max_instances=1, misfire_grace_time=120,
    )
    scheduler.start()
    print("--> [RECURRING] Recurring reminder roll-over scheduler active.")
    return scheduler
