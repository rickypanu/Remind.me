"""
Recurring schedule maths.

A reminder has a schedule_type:

  "once"    a specific date and time (the original behaviour)
  "daily"   every day at time_of_day
  "weekly"  on the chosen weekdays at time_of_day (0 = Monday ... 6 = Sunday)

All wall-clock times are IST (the app's timezone). Everything stored in MongoDB is UTC.

For recurring reminders `due_date` always holds the NEXT occurrence (UTC). That keeps every
existing query (dashboard buckets, "due in 1h / 10m / 1m" windows, today / tomorrow digests)
working unchanged: when an occurrence is completed or missed, `due_date` moves forward to the
next one and the per-occurrence "already notified" flags are cleared.
"""
from datetime import date, datetime, time, timedelta
from typing import Iterable, List, Optional

from .timezone import IST, UTC, as_utc

SCHEDULE_TYPES = ("once", "daily", "weekly")
RECURRING_TYPES = ("daily", "weekly")
WEEKDAY_NAMES = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")

# Flags written by the notification schedulers for ONE occurrence. They are cleared whenever
# a recurring reminder rolls over to its next occurrence so the next one is announced again.
NOTIFICATION_FLAGS = (
    "notified_due_soon",
    "notified_due_soon_web",
    "notified_tomorrow_digest",
    "last_notified_at",
    "notified_tele_60m", "notified_tele_10m", "notified_tele_1m",
    "notified_web_60m", "notified_web_10m", "notified_web_1m",
)

# How long after an occurrence's time we wait for the user to complete it before rolling the
# reminder over to the next occurrence (keeps "overdue" visible for a while).
MISSED_GRACE = timedelta(hours=3)


def parse_time_of_day(value: str) -> time:
    """'HH:MM' (24h) -> time. Raises ValueError on bad input."""
    try:
        hh, mm = value.strip().split(":")
        h, m = int(hh), int(mm)
        if not (0 <= h <= 23 and 0 <= m <= 59):
            raise ValueError
        return time(h, m)
    except Exception:
        raise ValueError("time_of_day must look like HH:MM (24-hour), e.g. 18:30")


def parse_end_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except Exception:
        raise ValueError("ends_on must look like YYYY-MM-DD")


def normalize_weekdays(days: Optional[Iterable[int]]) -> List[int]:
    out = sorted({int(d) for d in (days or [])})
    if any(d < 0 or d > 6 for d in out):
        raise ValueError("weekdays must be numbers from 0 (Monday) to 6 (Sunday)")
    return out


def next_occurrence(
    schedule_type: str,
    time_of_day: str,
    weekdays: Optional[Iterable[int]],
    after: datetime,
    ends_on: Optional[str] = None,
) -> Optional[datetime]:
    """First occurrence strictly later than `after`, as a UTC datetime. None if the series has ended."""
    if schedule_type not in RECURRING_TYPES:
        return None
    t = parse_time_of_day(time_of_day)
    allowed = set(normalize_weekdays(weekdays)) if schedule_type == "weekly" else set(range(7))
    if not allowed:
        return None
    end = parse_end_date(ends_on)
    after_utc = as_utc(after)
    start_day = after_utc.astimezone(IST).date()

    for offset in range(0, 9):  # 8 days always contains every weekday at least once
        day = start_day + timedelta(days=offset)
        if day.weekday() not in allowed:
            continue
        if end and day > end:
            return None
        candidate = datetime.combine(day, t, tzinfo=IST).astimezone(UTC)
        if candidate > after_utc:
            return candidate
    return None


def describe_schedule(schedule_type: str, time_of_day: Optional[str], weekdays: Optional[Iterable[int]] = None) -> str:
    """Human readable summary, e.g. 'Every day at 9:00 AM' or 'Every Mon, Wed at 6:30 PM'."""
    if schedule_type not in RECURRING_TYPES or not time_of_day:
        return "One time"
    t = parse_time_of_day(time_of_day)
    hour12 = t.hour % 12 or 12
    stamp = f"{hour12}:{t.minute:02d} {'AM' if t.hour < 12 else 'PM'}"
    if schedule_type == "daily":
        return f"Every day at {stamp}"
    days = normalize_weekdays(weekdays)
    if len(days) == 7:
        return f"Every day at {stamp}"
    return f"Every {', '.join(WEEKDAY_NAMES[d] for d in days)} at {stamp}"


def occurs_on_ist_day(task: dict, day_start_utc: datetime) -> bool:
    """Does this recurring reminder have an occurrence on the IST calendar day starting at day_start_utc?"""
    stype = task.get("schedule_type", "once")
    if stype not in RECURRING_TYPES:
        return False
    day = as_utc(day_start_utc).astimezone(IST).date()
    end = parse_end_date(task.get("ends_on"))
    if end and day > end:
        return False
    if stype == "daily":
        return True
    return day.weekday() in set(normalize_weekdays(task.get("weekdays")))


def advance_after_completion(task: dict, now: datetime) -> dict:
    """Mongo update (set / unset / inc) to apply when the user completes the current occurrence.

    The next occurrence is searched after the LATER of 'now' and the current due time, so ticking
    today's 9 AM item off at 8 AM schedules tomorrow's, not today's again.
    """
    due = as_utc(task["due_date"]) if task.get("due_date") else now
    nxt = next_occurrence(
        task.get("schedule_type", "once"), task.get("time_of_day", "00:00"),
        task.get("weekdays"), max(as_utc(now), due), task.get("ends_on"),
    )
    unset = {f: "" for f in NOTIFICATION_FLAGS}
    if nxt is None:  # series is over (ends_on passed)
        return {"set": {"status": "completed", "last_completed_at": now}, "unset": {}, "inc": {"completed_count": 1}, "next_due": None}
    return {
        "set": {"due_date": nxt, "status": "pending", "last_completed_at": now},
        "unset": unset,
        "inc": {"completed_count": 1},
        "next_due": nxt,
    }


def advance_after_miss(task: dict, now: datetime) -> Optional[dict]:
    """Mongo update for an occurrence nobody completed (nothing is marked done)."""
    nxt = next_occurrence(
        task.get("schedule_type", "once"), task.get("time_of_day", "00:00"),
        task.get("weekdays"), as_utc(now), task.get("ends_on"),
    )
    if nxt is None:
        return {"set": {"status": "completed"}, "unset": {}, "inc": {"missed_count": 1}, "next_due": None}
    return {"set": {"due_date": nxt, "status": "pending"}, "unset": {f: "" for f in NOTIFICATION_FLAGS}, "inc": {"missed_count": 1}, "next_due": nxt}
