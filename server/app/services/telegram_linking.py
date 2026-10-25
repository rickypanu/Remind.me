"""Linking a Telegram chat to a RemindMe account (finding S1).

Before: ``/telegram/get-link`` took ANY user id from the request body and built ``t.me/bot?start=<userId>``; the
webhook then trusted that id, so anyone who knew (or guessed) a user id could attach their own chat to that account
and read its reminders, or hijack the account's notifications. ``/telegram/status`` and ``/telegram/disconnect`` also
worked without a login.

Now
    * Only a signed-in user can ask for a link, and only for THEIR OWN account (the id comes from the access token).
    * The ``start`` parameter is a random 256-bit token, not an id. Only its SHA-256 is stored, so a database leak
      does not leak usable links.
    * A token is single-use (claimed with an atomic ``find_one_and_delete``) and expires after
      ``TELEGRAM_LINK_TTL_MINUTES`` (default 10). One live token per user: asking again replaces the previous one.
    * A chat belongs to at most ONE account: linking it elsewhere unlinks it from the previous account, so a
      notification can never reach a chat that moved to someone else.
"""

import logging
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from bson import ObjectId

from app.core.config import get_settings
from app.repositories import LinkTokenRepository, UserRepository
from app.services.sessions import hash_token

log = logging.getLogger("telegram_linking")

TOKEN_PATTERN = r"^[A-Za-z0-9_-]{16,64}$"  # what Telegram allows in ``start`` (A-Z a-z 0-9 _ -, max 64)


def mask_phone(phone: str | None) -> str | None:
    """``+91 98765 43210`` -> ``+91••••••3210``: enough to recognise, not enough to copy."""
    if not phone:
        return None
    digits = [c for c in phone if c.isdigit()]
    if len(digits) <= 4:
        return "••••"
    prefix = "+" if phone.strip().startswith("+") else ""
    return f"{prefix}{'•' * (len(digits) - 4)}{''.join(digits[-4:])}"


def build_deep_link(bot_username: str, token: str) -> str:
    return f"https://t.me/{bot_username}?start={token}"


async def create_link_token(db: Any, user_id: ObjectId) -> tuple[str, datetime]:
    """Make a fresh single-use token for ``user_id``. Returns ``(token, expires_at)``; only the hash is stored."""
    settings = get_settings()
    now = datetime.now(UTC)
    expires = now + timedelta(minutes=settings.telegram_link_ttl_minutes)
    token = secrets.token_urlsafe(32)  # 43 characters
    await LinkTokenRepository(db).replace_for_user(user_id, hash_token(token), now, expires)
    return token, expires


async def consume_link_token(db: Any, token: str) -> ObjectId | None:
    """The account a token belongs to, or ``None``. A token works exactly once and never after it expired.

    The repository's ``consume`` is atomic: of two simultaneous attempts only one gets the document. The expiry is
    compared here as well, because the TTL monitor in MongoDB only runs about once a minute.
    """
    doc = await LinkTokenRepository(db).consume(hash_token(token))
    if doc is None:
        return None
    expires = doc.get("expires")
    if expires is None:
        return None
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    if expires <= datetime.now(UTC):
        return None
    return doc.get("user_id")


async def link_chat(db: Any, user_id: ObjectId, chat_id: str) -> bool:
    """Attach ``chat_id`` to the account. Returns False if the account no longer exists."""
    return await UserRepository(db).link_telegram(user_id, chat_id)


async def unlink(db: Any, user_id: ObjectId) -> bool:
    changed = await UserRepository(db).unlink_telegram(user_id)
    await LinkTokenRepository(db).delete_for_user(user_id)
    return changed


async def save_phone(db: Any, chat_id: str, phone: str) -> bool:
    return await UserRepository(db).set_phone_for_chat(chat_id, phone)


async def status(db: Any, user_id: ObjectId) -> dict:
    user = await UserRepository(db).telegram_fields(user_id)
    if not user:
        return {"connected": False, "phone_number": None}
    return {"connected": bool(user.get("telegram_chat_id")), "phone_number": mask_phone(user.get("phone_number"))}
