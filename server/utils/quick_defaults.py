"""Defaults for a Quick Add reminder that leaves out the day and/or the time. Everything is IST (UTC+05:30).

The language model only reports what the user actually SAID (``date``, ``time``, both optional). The gaps are
filled here, by plain code, so the rule is deterministic and unit-tested instead of depending on a prompt:

    no date, no time    today, 2 hours from now
                        BUT if that lands on the next day (late at night), 10 minutes from now instead
    no date, a time     today if that time is still ahead, otherwise tomorrow
    a date, no time     that date at 09:00. When the date is TODAY the "2 hours from now" rule above applies
    a date and a time   exactly that

"Now" is measured to the minute (seconds are dropped), so 21:14:37 + 2 h is 23:14, not 23:14:37.
"""

from datetime import date, datetime, time, timedelta

from utils.timezone import IST

DEFAULT_LEAD = timedelta(hours=2)
LATE_NIGHT_LEAD = timedelta(minutes=10)
DEFAULT_TIME_ON_FUTURE_DAY = time(9, 0)


def _default_for_today(now: datetime) -> datetime:
    candidate = now + DEFAULT_LEAD
    if candidate.date() != now.date():  # crossed midnight: it would no longer be a reminder for today
        return now + LATE_NIGHT_LEAD
    return candidate


def parse_date(value: str | None) -> date | None:
    """"YYYY-MM-DD" -> date. Anything else (None, empty, malformed) -> None, i.e. "the user gave no date"."""
    if not value:
        return None
    try:
        return date.fromisoformat(value.strip())
    except ValueError:
        return None


def parse_time(value: str | None) -> time | None:
    """"HH:MM" (24 h) -> time. Anything else -> None, i.e. "the user gave no time"."""
    if not value:
        return None
    try:
        parts = value.strip().split(":")
        hour, minute = int(parts[0]), int(parts[1])
        return time(hour, minute)
    except (ValueError, IndexError):
        return None


def resolve_due_ist(date_text: str | None, time_text: str | None, now: datetime) -> datetime:
    """The deadline of a one-time reminder, as an aware IST datetime. ``now`` must be IST-aware."""
    now = now.astimezone(IST).replace(second=0, microsecond=0)
    day = parse_date(date_text)
    clock = parse_time(time_text)

    if day is None and clock is None:
        return _default_for_today(now)

    if day is None:
        due = datetime.combine(now.date(), clock, tzinfo=IST)
        return due if due > now else due + timedelta(days=1)

    if clock is None:
        if day == now.date():
            return _default_for_today(now)
        return datetime.combine(day, DEFAULT_TIME_ON_FUTURE_DAY, tzinfo=IST)

    return datetime.combine(day, clock, tzinfo=IST)
