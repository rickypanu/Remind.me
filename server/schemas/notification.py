"""Schemas for the notification endpoints (Web Push registration, broadcast). Telegram ones: schemas/telegram.py."""

from pydantic import BaseModel, ConfigDict, Field

from app.integrations.webpush import PushSubscription


class SubscriptionPayload(BaseModel):
    # Older clients also send "userId"; it is ignored (the account comes from the access token).
    model_config = ConfigDict(extra="ignore")

    subscription: PushSubscription


class UnsubscribePayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    endpoint: str | None = Field(default=None, max_length=2048)
    subscription: dict | None = None  # older clients send the whole subscription; only its endpoint is used


class PushResult(BaseModel):
    status: str
    message: str


class StatusResponse(BaseModel):
    status: str


class HealthResponse(BaseModel):
    status: str
    message: str


class WelcomeResponse(BaseModel):
    message: str
