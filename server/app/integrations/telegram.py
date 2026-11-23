"""The ONE Telegram client (finding A2).

``send_telegram`` used to exist three times (scheduler, broadcast, setup). Everything now goes through
:class:`TelegramClient`, which

  * borrows the shared ``httpx.AsyncClient`` (no new TLS handshake per message, finding P5),
  * paces itself below Telegram's ~30 messages/second limit and honours ``retry_after`` on HTTP 429,
  * reports a precise outcome so callers can tell "retry later" from "this chat can never receive messages",
  * never logs the bot token (it is part of the request URL) or the message text.

Message text is Telegram *HTML*. ``send`` expects text that is already escaped/formatted by the caller;
``send_plain`` escapes for you and trims to Telegram's 4096-character limit.
"""

import asyncio
import html
import logging
import time
from collections.abc import Callable
from enum import Enum
from functools import lru_cache
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.http import get_http_client

log = logging.getLogger("telegram")

API_ROOT = "https://api.telegram.org"
MAX_MESSAGE_CHARS = 4096
MAX_RETRY_AFTER_SECONDS = 30
MESSAGES_PER_SECOND = 25  # Telegram allows ~30/s across chats; stay under it


class Outcome(str, Enum):
    SENT = "sent"
    TRANSIENT = "transient"  # network error, 429 that did not clear, 5xx: worth retrying
    PERMANENT = "permanent"  # bot blocked, chat not found, bad request: retrying cannot help
    DISABLED = "disabled"  # no bot token configured, or no chat id


def escape(text: str) -> str:
    """Escape for Telegram's HTML parse mode (only & < > are special in text)."""
    return html.escape(text or "", quote=False)


def fit_message(title: str, body: str) -> str:
    """``<b>title</b>\\nbody`` from PLAIN text, escaped, and never longer than Telegram's limit."""
    safe_title = escape(title.strip())
    wrapper = f"<b>{safe_title}</b>\n"
    budget = MAX_MESSAGE_CHARS - len(wrapper)
    safe_body = escape(body.strip())
    if len(safe_body) <= budget:
        return wrapper + safe_body
    # Trim the raw text (not the escaped text, which could cut an entity like &amp; in half) until it fits.
    raw = body.strip()
    while raw and len(escape(raw)) + 1 > budget:
        raw = raw[: max(0, int(len(raw) * 0.9) - 1)]
    return wrapper + escape(raw) + "…"


class TelegramClient:
    def __init__(
        self,
        token: str | None,
        http_getter: Callable[[], httpx.AsyncClient] = get_http_client,
        *,
        messages_per_second: float = MESSAGES_PER_SECOND,
    ) -> None:
        self._token = token
        self._http_getter = http_getter
        self._interval = 1.0 / messages_per_second
        self._next_slot = 0.0
        self._pace_lock = asyncio.Lock()

    @property
    def enabled(self) -> bool:
        return bool(self._token)

    async def _pace(self) -> None:
        async with self._pace_lock:
            now = time.monotonic()
            wait = self._next_slot - now
            self._next_slot = max(now, self._next_slot) + self._interval
        if wait > 0:
            await asyncio.sleep(wait)

    async def _call(self, method: str, payload: dict[str, Any]) -> tuple[Outcome, dict[str, Any]]:
        if not self._token:
            return Outcome.DISABLED, {}
        url = f"{API_ROOT}/bot{self._token}/{method}"
        for attempt in (1, 2):
            await self._pace()
            try:
                response = await self._http_getter().post(url, json=payload)
            except httpx.HTTPError as exc:
                # str(exc) can contain the URL (and so the token); log only the exception type.
                log.warning("Telegram %s failed: %s", method, type(exc).__name__)
                return Outcome.TRANSIENT, {}
            try:
                data = response.json()
            except ValueError:
                data = {}
            if response.status_code == 200 and data.get("ok", True):
                return Outcome.SENT, data
            if response.status_code == 429 and attempt == 1:
                retry_after = min(int((data.get("parameters") or {}).get("retry_after", 1)), MAX_RETRY_AFTER_SECONDS)
                await asyncio.sleep(max(1, retry_after))
                continue
            description = str(data.get("description", ""))[:200]
            log.warning("Telegram %s -> HTTP %s %s", method, response.status_code, description)
            if response.status_code in (400, 401, 403, 404):
                return Outcome.PERMANENT, data
            return Outcome.TRANSIENT, data
        return Outcome.TRANSIENT, {}

    async def send(
        self, chat_id: str | int, title_html: str, body_html: str = "", *, reply_markup: dict | None = None
    ) -> Outcome:
        """Send ``<b>title</b>\\nbody``. Both arguments are Telegram-HTML the caller has already escaped."""
        if not chat_id:
            return Outcome.DISABLED
        text = f"<b>{title_html}</b>\n{body_html}" if body_html else f"<b>{title_html}</b>"
        return await self.send_raw(chat_id, text[:MAX_MESSAGE_CHARS], reply_markup=reply_markup)

    async def send_plain(self, chat_id: str | int, title: str, body: str = "") -> Outcome:
        """Escape plain text and send it."""
        if not chat_id:
            return Outcome.DISABLED
        return await self.send_raw(chat_id, fit_message(title, body))

    async def send_raw(self, chat_id: str | int, text_html: str, *, reply_markup: dict | None = None) -> Outcome:
        payload: dict[str, Any] = {
            "chat_id": chat_id,
            "text": text_html,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }
        if reply_markup is not None:
            payload["reply_markup"] = reply_markup
        outcome, _ = await self._call("sendMessage", payload)
        return outcome

    async def set_webhook(self, url: str, secret_token: str, *, drop_pending_updates: bool = False) -> bool:
        """Register the webhook WITH a secret, so Telegram sends it back in X-Telegram-Bot-Api-Secret-Token."""
        outcome, _ = await self._call(
            "setWebhook",
            {
                "url": url,
                "secret_token": secret_token,
                "allowed_updates": ["message"],
                "drop_pending_updates": drop_pending_updates,
                "max_connections": 20,
            },
        )
        return outcome is Outcome.SENT


@lru_cache
def get_telegram() -> TelegramClient:
    token = get_settings().telegram_bot_token
    return TelegramClient(token.get_secret_value() if token is not None else None)
