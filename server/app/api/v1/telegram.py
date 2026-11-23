"""/v1/integrations/telegram: account linking and the webhook (findings S1, S2).

Signed-in endpoints (the user is ALWAYS the one in the access token; no user id is accepted from the client):
    GET  /status      is a chat linked? (phone number masked)
    POST /get-link    mint a single-use, expiring link: https://t.me/<bot>?start=<token>
    POST /disconnect  unlink
Telegram endpoint:
    POST /webhook     only accepted with the secret Telegram echoes in X-Telegram-Bot-Api-Secret-Token
"""

import hmac
import logging
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Header, Request
from pydantic import ValidationError

from app.api.deps import CurrentUser, Db, UserId, get_notifier
from app.core.config import get_settings
from app.core.errors import BadRequest, Forbidden, ServiceUnavailable
from app.core.rate_limit import Limits, limiter
from app.notifications.dispatch import Notifier
from app.services import telegram_linking as linking
from app.services.broadcast import broadcast_to_all
from app.services.telegram_bot import handle_update
from schemas.auth import MessageResponse
from schemas.notification import StatusResponse
from schemas.telegram import TelegramLinkOut, TelegramStatusOut, TgUpdate

log = logging.getLogger("telegram_routes")

router = APIRouter(tags=["Telegram"])


@router.get("/status", response_model=TelegramStatusOut)
async def telegram_status(_user: CurrentUser, user_id: UserId, db: Db) -> dict:
    return await linking.status(db, user_id)


@router.post("/get-link", response_model=TelegramLinkOut)
@limiter.limit(Limits.telegram_link)
async def get_telegram_link(request: Request, _user: CurrentUser, user_id: UserId, db: Db) -> dict:
    """A fresh link, valid for TELEGRAM_LINK_TTL_MINUTES and usable once."""
    settings = get_settings()
    if not settings.telegram_enabled or not settings.telegram_bot_username:
        raise ServiceUnavailable("Telegram notifications are not configured.")
    token, _expires = await linking.create_link_token(db, user_id)
    return {
        "telegram_url": linking.build_deep_link(settings.telegram_bot_username, token),
        "expires_in": settings.telegram_link_ttl_minutes * 60,
    }


@router.post("/disconnect", response_model=MessageResponse)
async def disconnect_telegram(_user: CurrentUser, user_id: UserId, db: Db) -> MessageResponse:
    await linking.unlink(db, user_id)
    return MessageResponse(message="Telegram account disconnected successfully.")


@limiter.exempt  # Telegram's servers share a few IPs; the secret header is the access control here
@router.post("/webhook", response_model=StatusResponse)
async def telegram_webhook(
    request: Request,
    bg: BackgroundTasks,
    db: Db,
    notifier: Annotated[Notifier, Depends(get_notifier)],
    x_telegram_bot_api_secret_token: Annotated[str | None, Header()] = None,
) -> StatusResponse:
    secret = get_settings().telegram_webhook_secret
    if secret is None:
        raise ServiceUnavailable("Telegram is not configured.")
    # Constant-time comparison (S2): the time taken must not reveal how many leading characters matched.
    supplied = (x_telegram_bot_api_secret_token or "").encode("utf-8")
    if not hmac.compare_digest(supplied, secret.get_secret_value().encode("utf-8")):
        raise Forbidden("Forbidden")

    try:
        update = TgUpdate.model_validate_json(await request.body())
    except ValidationError:
        raise BadRequest("Malformed update") from None

    def start_broadcast(title: str, body: str, report_chat_id: str) -> None:
        bg.add_task(broadcast_to_all, notifier, title, body, report_chat_id)

    try:
        await handle_update(db, notifier, update, start_broadcast=start_broadcast)
    except Exception:  # noqa: BLE001 - answer 200 so Telegram does not redeliver the same update in a loop
        log.exception("Telegram update %s could not be processed", update.update_id)
    return StatusResponse(status="ok")
