"""/v1/integrations/webpush: device registration (finding S4). The service holds the rules."""

from typing import Annotated

from fastapi import APIRouter, Body

from app.api.deps import PushSvc, UserId
from schemas.notification import PushResult, SubscriptionPayload, UnsubscribePayload

router = APIRouter(tags=["WebPush"])


@router.post("/subscribe", response_model=PushResult)
async def subscribe(payload: SubscriptionPayload, user_id: UserId, push: PushSvc) -> dict:
    return await push.subscribe(user_id, payload.subscription.to_storage())


@router.post("/unsubscribe", response_model=PushResult)
async def unsubscribe(
    user_id: UserId, push: PushSvc, payload: Annotated[UnsubscribePayload | None, Body()] = None
) -> dict:
    endpoint = None
    if payload is not None:
        endpoint = payload.endpoint or (payload.subscription or {}).get("endpoint")
    return await push.unsubscribe(user_id, endpoint)
