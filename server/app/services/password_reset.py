"""Password-reset tokens (findings S6, S7).

* The emailed token is 256 bits of randomness; only its SHA-256 is stored, in ``password_resets`` (never on the
  ``users`` document, where a TTL index would delete accounts).
* One live token per user: asking again replaces the previous one. Asking more often than once a minute is ignored.
* The token is single-use: it is claimed with an atomic ``find_one_and_delete``.
* The link carries the token in the URL *fragment* (``/reset-password#token=...``). Fragments are never sent to a
  server, so the token does not end up in access logs, proxies or the Referer header.
"""

import logging
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from bson import ObjectId

from app.core.config import get_settings
from app.repositories import PasswordResetRepository, UserRepository
from app.services.email import send_reset_email
from app.services.sessions import hash_token

log = logging.getLogger("password_reset")

MIN_SECONDS_BETWEEN_EMAILS = 60


def build_reset_link(token: str) -> str:
    return f"{get_settings().frontend_url}/reset-password#token={token}"


async def request_reset(db: Any, email: str) -> None:
    """Create a token and e-mail it. Runs AFTER the HTTP response, so the response never depends on the outcome."""
    settings = get_settings()
    try:
        user = await UserRepository(db).get_by_email(email)
        if user is None:
            return
        user_id = str(user["_id"])
        now = datetime.now(UTC)
        resets = PasswordResetRepository(db)

        if await resets.recent_for_user(user_id, now - timedelta(seconds=MIN_SECONDS_BETWEEN_EMAILS)) is not None:
            return

        token = secrets.token_urlsafe(32)  # 43 characters
        await resets.replace_for_user(
            user_id,
            {
                "reset_token_hash": hash_token(token),
                "user_id": user_id,
                "created_at": now,
                "reset_token_expires": now + timedelta(minutes=settings.password_reset_expire_minutes),
            },
        )
        await send_reset_email(user["email"], build_reset_link(token), settings.password_reset_expire_minutes)
    except Exception:  # noqa: BLE001 - this runs in the background; it must never raise into the server
        log.exception("Could not process a password-reset request")


async def peek_reset(db: Any, token: str) -> dict[str, Any] | None:
    """Look at a token without spending it (to run checks that must not burn a valid token)."""
    return await PasswordResetRepository(db).peek(hash_token(token), datetime.now(UTC))


async def claim_reset(db: Any, token: str) -> dict[str, Any] | None:
    """Spend the token. Exactly one caller can ever get a document back for a given token."""
    return await PasswordResetRepository(db).claim(hash_token(token), datetime.now(UTC))


def user_object_id(reset_doc: dict[str, Any]) -> ObjectId:
    return ObjectId(reset_doc["user_id"])
