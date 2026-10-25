"""What the bot does with an incoming Telegram update (findings S1, S2, S14).

The route (``app/api/v1/telegram.py``) has already proven that the request really came from Telegram
(secret header) and that the body is a well-formed update. This module decides what to do with it:

    /start <token>   link this chat to the account that created <token> (single use, expires, see telegram_linking)
    shared contact   store the phone number, but only if the contact is the sender's OWN number
    /broadcast ...   admin only: the admin must be a private chat whose id equals ADMIN_TELEGRAM_ID

Everything else is ignored silently. Groups and channels are ignored completely: a reminder bot talks to one person.
"""

import hmac
import logging
import re
from typing import Any

from app.core.config import get_settings
from app.integrations.telegram import TelegramClient, escape
from app.notifications.dispatch import Notifier
from app.services import telegram_linking as linking
from schemas.telegram import TgMessage, TgUpdate

log = logging.getLogger("telegram_bot")

_TOKEN_RE = re.compile(linking.TOKEN_PATTERN)
_PHONE_RE = re.compile(r"^\+?[0-9]{6,20}$")

CONTACT_KEYBOARD = {
    "keyboard": [[{"text": "📱 Share Phone Number (Recommended)", "request_contact": True}]],
    "resize_keyboard": True,
    "one_time_keyboard": True,
}
REMOVE_KEYBOARD = {"remove_keyboard": True}


def is_admin_chat(chat_id: int, admin_telegram_id: str | None) -> bool:
    """Constant-time comparison of the chat id with ADMIN_TELEGRAM_ID."""
    if not admin_telegram_id:
        return False
    return hmac.compare_digest(str(chat_id).encode(), admin_telegram_id.encode())


def normalise_phone(raw: str) -> str | None:
    cleaned = re.sub(r"[\s\-().]", "", raw)
    return cleaned if _PHONE_RE.match(cleaned) else None


async def handle_update(db: Any, notifier: Notifier, update: TgUpdate, *, start_broadcast) -> None:
    """``start_broadcast(title, body, report_chat_id)`` schedules the broadcast (a FastAPI background task)."""
    message = update.message
    if message is None:
        return
    # Private chats only, and the sender must be the chat itself (rules out groups, channels, forwarded oddities)
    if message.chat.type != "private" or message.from_user is None or message.from_user.id != message.chat.id:
        return
    if message.from_user.is_bot:
        return

    telegram = notifier.telegram
    chat_id = str(message.chat.id)
    text = (message.text or "").strip()

    if message.contact is not None:
        await _handle_contact(db, telegram, message, chat_id)
        return
    if text.startswith("/broadcast"):
        await _handle_broadcast(telegram, message, text, start_broadcast)
        return
    if text == "/start" or text.startswith("/start "):
        await _handle_start(db, telegram, chat_id, text)


async def _handle_start(db: Any, telegram: TelegramClient, chat_id: str, text: str) -> None:
    token = text[len("/start") :].strip()
    if not token:
        await telegram.send(
            chat_id,
            "Welcome to RemindMe",
            "To connect this chat, open <b>Settings → Telegram</b> in the RemindMe app and tap <b>Connect</b>.",
        )
        return
    if not _TOKEN_RE.match(token):
        await telegram.send(chat_id, "Link not valid", "Please create a new link in the RemindMe app.")
        return

    user_id = await linking.consume_link_token(db, token)
    if user_id is None or not await linking.link_chat(db, user_id, chat_id):
        log.info("Rejected a Telegram link attempt (unknown, used or expired token)")
        await telegram.send(
            chat_id,
            "Link expired",
            "This link was already used or has expired. Please create a new one in the RemindMe app.",
        )
        return

    await telegram.send(
        chat_id,
        "Account Linked Successfully!",
        "To ensure you receive notifications, <b>sharing your phone number is strongly recommended</b>.\n\n"
        "Please tap the button below to complete your profile verification.",
        reply_markup=CONTACT_KEYBOARD,
    )


async def _handle_contact(db: Any, telegram: TelegramClient, message: TgMessage, chat_id: str) -> None:
    contact = message.contact
    if contact is None or message.from_user is None:
        return
    # The contact must be the sender's own: otherwise anyone could attach somebody else's number to their account.
    phone = normalise_phone(contact.phone_number)
    if contact.user_id != message.from_user.id or phone is None:
        await telegram.send(
            chat_id, "Not your number", "Please share <b>your own</b> phone number with the button.",
            reply_markup=CONTACT_KEYBOARD,
        )
        return
    if not await linking.save_phone(db, chat_id, phone):
        await telegram.send(chat_id, "Not linked yet", "Connect this chat from the RemindMe app first.")
        return
    masked = escape(linking.mask_phone(phone) or "")
    await telegram.send(
        chat_id,
        "Verification Complete!",
        f"Your phone number (<code>{masked}</code>) has been verified and saved.\n"
        "You will now receive notifications directly.",
        reply_markup=REMOVE_KEYBOARD,
    )


async def _handle_broadcast(telegram: TelegramClient, message: TgMessage, text: str, start_broadcast) -> None:
    settings = get_settings()
    chat_id = str(message.chat.id)
    if not is_admin_chat(message.chat.id, settings.admin_telegram_id):
        return  # silent: do not even reveal that the command exists
    content = text[len("/broadcast") :].strip()
    title, sep, body = content.partition("|")
    title, body = title.strip(), body.strip()
    if not (sep and title and body) or len(title) > 200 or len(body) > 3000:
        await telegram.send(chat_id, "Error", "Format: /broadcast Title | Message (title ≤ 200, message ≤ 3000 chars)")
        return
    start_broadcast(title, body, chat_id)
    await telegram.send(chat_id, "OK", "Broadcast started…")
