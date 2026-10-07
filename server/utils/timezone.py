"""
Single source of truth for time handling.

Rules used across the whole backend:
  1. MongoDB always stores UTC (tz-aware datetimes). Never store IST.
  2. A datetime that arrives WITHOUT a timezone is assumed to be IST.
  3. "Today" / "tomorrow" are IST calendar days, converted to UTC for queries.

IST has no daylight saving, so a fixed +05:30 offset is exact.
"""
from datetime import datetime, timedelta, timezone, time

UTC = timezone.utc
IST = timezone(timedelta(hours=5, minutes=30), name="IST")


def now_utc() -> datetime:
    return datetime.now(UTC)


def now_ist() -> datetime:
    return datetime.now(IST)


def to_utc(dt: datetime) -> datetime:
    """Naive -> assumed IST. Aware -> converted. Always returns UTC."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=IST)
    return dt.astimezone(UTC)


def as_utc(dt: datetime) -> datetime:
    """For values read back from Mongo: naive -> assumed UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def ist_day_bounds_utc(day_offset: int = 0):
    """[start, end) of an IST calendar day, expressed in UTC.
    day_offset=0 -> today, 1 -> tomorrow."""
    day = now_ist().date() + timedelta(days=day_offset)
    start = datetime.combine(day, time.min, tzinfo=IST)
    end = start + timedelta(days=1)
    return start.astimezone(UTC), end.astimezone(UTC)
