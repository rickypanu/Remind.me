"""/v1/admin: broadcast to every linked Telegram chat (finding S14), protected by the X-Admin-Key header."""

import hmac
import logging
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Header, Request

from app.api.deps import get_notifier
from app.core.config import get_settings
from app.core.errors import Forbidden
from app.core.rate_limit import Limits, ip_key, limiter
from app.notifications.dispatch import Notifier
from app.services.broadcast import broadcast_to_all
from schemas.notification import StatusResponse
from schemas.telegram import BroadcastIn

log = logging.getLogger("admin_broadcast")

router = APIRouter(tags=["Admin"])


def admin_key_matches(supplied: str | None) -> bool:
    """Constant-time check of the X-Admin-Key header against ADMIN_SECRET. False if no secret is configured."""
    secret = get_settings().admin_secret
    if secret is None or not supplied:
        return False
    return hmac.compare_digest(supplied.encode("utf-8"), secret.get_secret_value().encode("utf-8"))


@router.post("/broadcast", response_model=StatusResponse)
@limiter.limit(Limits.admin, key_func=ip_key)
async def broadcast(
    request: Request,
    data: BroadcastIn,
    bg: BackgroundTasks,
    notifier: Annotated[Notifier, Depends(get_notifier)],
    x_admin_key: Annotated[str | None, Header()] = None,
) -> StatusResponse:
    if not admin_key_matches(x_admin_key):
        log.warning("Rejected an admin broadcast request")
        raise Forbidden("Forbidden")
    # title/body are plain text; send_plain escapes them (no HTML or links can be injected)
    bg.add_task(broadcast_to_all, notifier, data.title, data.body)
    return StatusResponse(status="broadcast started")
