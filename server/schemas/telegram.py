"""Pydantic models for Telegram webhook updates (finding S2) and the broadcast API (finding S14).

Telegram's real updates carry dozens of fields we never use, so these models IGNORE unknown fields (``extra="ignore"``);
what matters is that every field we DO read has a strict type and length, so a forged or malformed body is rejected
with a 4xx before any code touches it.
"""

from pydantic import BaseModel, ConfigDict, Field


class _Loose(BaseModel):
    model_config = ConfigDict(extra="ignore")


class TgUser(_Loose):
    id: int
    is_bot: bool = False


class TgChat(_Loose):
    id: int
    type: str = Field(max_length=20)


class TgContact(_Loose):
    phone_number: str = Field(min_length=5, max_length=32)
    user_id: int | None = None  # absent when the contact is not a Telegram user


class TgMessage(_Loose):
    message_id: int | None = None
    chat: TgChat
    from_user: TgUser | None = Field(default=None, alias="from")
    text: str | None = Field(default=None, max_length=4096)
    contact: TgContact | None = None


class TgUpdate(_Loose):
    update_id: int
    message: TgMessage | None = None


class BroadcastIn(BaseModel):
    """Body of ``POST /admin/broadcast``. Plain text only: it is HTML-escaped before it is sent."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=3000)


class TelegramLinkOut(BaseModel):
    telegram_url: str
    expires_in: int  # seconds


class TelegramStatusOut(BaseModel):
    connected: bool
    phone_number: str | None = None  # masked
