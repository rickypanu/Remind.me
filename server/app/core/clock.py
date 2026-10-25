"""Time helpers shared by repositories and services.

MongoDB stores datetimes with MILLISECOND precision. A timestamp that keeps its microseconds would compare
differently before and after a round trip through the database, which breaks "everything after this cursor"
queries. ``now_ms`` therefore truncates to whole milliseconds, always in UTC.
"""

from datetime import UTC, datetime


def truncate_ms(value: datetime) -> datetime:
    return value.replace(microsecond=(value.microsecond // 1000) * 1000)


def now_ms() -> datetime:
    return truncate_ms(datetime.now(UTC))


def as_aware_utc(value: datetime) -> datetime:
    """A naive datetime (what MongoDB returns unless the client is tz-aware) is taken to be UTC."""
    return value if value.tzinfo else value.replace(tzinfo=UTC)
