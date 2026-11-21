"""/v1/social: invite code, friends, a reminder sent to a friend, the accountability buddy."""

from fastapi import APIRouter, Request, status

from app.api.deps import CurrentUser, SocialSvc, UserId
from app.core.rate_limit import Limits, limiter
from schemas.auth import MessageResponse
from schemas.social import BuddyRequest, JoinRequest, JoinResponse, SendReminderRequest, SocialSummary

router = APIRouter(tags=["Social"])


@router.get("", response_model=SocialSummary)
async def summary(user_id: UserId, social: SocialSvc) -> dict:
    """Your invite code, how many friends joined with it, your friends (with their streaks) and your buddy."""
    return await social.summary(user_id)


@router.post("/join", response_model=JoinResponse)
@limiter.limit(Limits.telegram_link)  # a code can be guessed, so tries are limited per user
async def join(request: Request, payload: JoinRequest, user_id: UserId, social: SocialSvc) -> dict:
    return await social.join(user_id, payload.code)


@router.delete("/friends/{friend_id}", response_model=MessageResponse)
async def unfriend(friend_id: str, user_id: UserId, social: SocialSvc) -> MessageResponse:
    await social.unfriend(user_id, friend_id)
    return MessageResponse(message="Friend removed.")


@router.post("/friends/{friend_id}/remind", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(Limits.magic_add)
async def remind_friend(
    request: Request, friend_id: str, payload: SendReminderRequest, user: CurrentUser, user_id: UserId, social: SocialSvc
) -> MessageResponse:
    await social.send_reminder(
        user_id, friend_id, title=payload.title, due_date=payload.due_date, note=payload.note,
        sender_name=user.get("username", "A friend"),
    )
    return MessageResponse(message="Reminder sent.")


@router.put("/buddy", response_model=MessageResponse)
async def set_buddy(payload: BuddyRequest, user_id: UserId, social: SocialSvc) -> MessageResponse:
    await social.set_buddy(user_id, payload.friend_id)
    return MessageResponse(message="Buddy updated." if payload.friend_id else "Buddy removed.")
