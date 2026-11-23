"""Refresh-token sessions (finding S9).

Model
    * Logging in creates a *family* (``family_id``) with one refresh token.
    * Every refresh marks the presented token as used and issues a new one in the same family (rotation).
    * Only the SHA-256 of a token is stored, so a database leak does not leak working sessions.
    * Presenting a token that was already used means it was stolen or replayed: the whole family is deleted and
      both the attacker and the victim must log in again. A 10-second grace window absorbs the benign race of two
      browser tabs refreshing at the same moment; inside the window the second caller just gets a 401 and the
      family survives.
    * ``tv`` (token version) is copied from the user at issue time. If the user's ``token_version`` has moved on
      (password reset, "log out everywhere") the refresh is refused and the family is deleted.
    * Access tokens carry ``sid`` = ``family_id`` and are rejected once the family is gone, so logout is immediate
      instead of "within 15 minutes".

Documents in ``sessions``:
    {token_hash, family_id, user_id, tv, created_at, expires_at, used_at, user_agent}
TTL index on ``expires_at`` removes dead sessions; ``token_hash`` is unique.
"""

import hashlib
import logging
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from app.core.config import get_settings
from app.db.ids import to_object_id
from app.repositories import SessionRepository, UserRepository

log = logging.getLogger("sessions")

REUSE_GRACE_SECONDS = 10
MAX_USER_AGENT_CHARS = 200


@dataclass(frozen=True)
class IssuedSession:
    refresh_token: str
    family_id: str
    user: dict[str, Any]  # the user document (``_id`` as returned by the database)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def new_refresh_token() -> str:
    return secrets.token_urlsafe(48)  # 64 URL-safe characters, 384 bits


def _aware(value: datetime | None) -> datetime | None:
    """MongoDB hands back naive UTC datetimes unless the client is tz-aware; normalise both."""
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def _clip_user_agent(user_agent: str | None) -> str | None:
    if not user_agent:
        return None
    cleaned = "".join(ch for ch in user_agent if ch.isprintable())
    return cleaned[:MAX_USER_AGENT_CHARS] or None


async def _insert_token(
    db: Any, *, user_id: str, family_id: str, token_version: int, user_agent: str | None, now: datetime
) -> str:
    settings = get_settings()
    token = new_refresh_token()
    await SessionRepository(db).insert(
        {
            "token_hash": hash_token(token),
            "family_id": family_id,
            "user_id": user_id,
            "tv": int(token_version),
            "created_at": now,
            "expires_at": now + timedelta(days=settings.refresh_token_expire_days),
            "used_at": None,
            "user_agent": _clip_user_agent(user_agent),
        }
    )
    return token


async def start_session(db: Any, user: dict[str, Any], user_agent: str | None = None) -> IssuedSession:
    """New family for a successful login. ``user["_id"]`` may be an ObjectId or a string."""
    now = datetime.now(UTC)
    user_id = str(user["_id"])
    family_id = secrets.token_urlsafe(16)
    token = await _insert_token(
        db,
        user_id=user_id,
        family_id=family_id,
        token_version=int(user.get("token_version", 0)),
        user_agent=user_agent,
        now=now,
    )
    return IssuedSession(refresh_token=token, family_id=family_id, user=user)


async def rotate_session(db: Any, refresh_token: str, user_agent: str | None = None) -> IssuedSession | None:
    """Exchange a refresh token for a new one. ``None`` means "log in again"."""
    now = datetime.now(UTC)
    token_hash = hash_token(refresh_token)
    sessions = SessionRepository(db)

    # Atomic claim: only one caller can flip used_at from None, so a token can be spent exactly once.
    claimed = await sessions.claim_unused(token_hash, now)
    if claimed is None:
        previous = await sessions.find_by_hash(token_hash)
        used_at = _aware(previous.get("used_at")) if previous else None
        if previous is not None and used_at is not None:
            if (now - used_at).total_seconds() > REUSE_GRACE_SECONDS:
                await sessions.delete_family(previous["family_id"])
                log.warning("Refresh token reuse detected; session family revoked (user %s)", previous.get("user_id"))
        return None

    owner = to_object_id(claimed["user_id"])
    user = await UserRepository(db).get(owner) if owner is not None else None
    if user is None or int(user.get("token_version", 0)) != int(claimed.get("tv", 0)):
        await sessions.delete_family(claimed["family_id"])
        return None

    token = await _insert_token(
        db,
        user_id=claimed["user_id"],
        family_id=claimed["family_id"],
        token_version=int(user.get("token_version", 0)),
        user_agent=user_agent,
        now=now,
    )
    return IssuedSession(refresh_token=token, family_id=claimed["family_id"], user=user)


async def end_session(db: Any, refresh_token: str) -> bool:
    """Log out the session this refresh token belongs to (used or not). True if one existed."""
    sessions = SessionRepository(db)
    doc = await sessions.find_by_hash(hash_token(refresh_token))
    if doc is None:
        return False
    await sessions.delete_family(doc["family_id"])
    return True


async def end_all_sessions(db: Any, user_id: str) -> None:
    """Invalidate every session and every access token of a user (``token_version`` is bumped by the caller)."""
    await SessionRepository(db).delete_for_user(str(user_id))
