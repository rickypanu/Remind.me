"""/v1/user: profile, avatar, account deletion."""

from typing import Annotated

from fastapi import APIRouter, File, Request, UploadFile

from app.api.deps import CurrentUser, UserId, UserSvc
from app.core.errors import AppError
from app.core.rate_limit import Limits, limiter
from app.services.avatars import AvatarError, read_limited
from app.services.users import profile_of
from schemas.auth import MessageResponse
from schemas.user import AvatarResponse, ProfileUpdateResponse, UserResponse, UserUpdate

router = APIRouter(tags=["User"])


@router.get("/me", response_model=UserResponse)
async def get_profile(current_user: CurrentUser) -> dict:
    return profile_of(current_user)


@router.patch("/me", response_model=ProfileUpdateResponse)
async def update_profile(update: UserUpdate, user_id: UserId, users: UserSvc) -> ProfileUpdateResponse:
    # Only fields that were actually provided; UserUpdate forbids everything except username and avatar_url.
    changed = await users.update_profile(user_id, update.model_dump(exclude_unset=True))
    return ProfileUpdateResponse(message="Profile updated successfully", updated_fields=changed)


@router.post("/avatar", response_model=AvatarResponse)
@limiter.limit(Limits.avatar)
async def upload_avatar(
    request: Request, avatar: Annotated[UploadFile, File()], user_id: UserId, users: UserSvc
) -> AvatarResponse:
    # The Content-Type header and file name are ignored on purpose: the bytes are inspected and re-encoded.
    try:
        data = await read_limited(avatar)
    except AvatarError as exc:
        error = AppError(exc.message)
        error.status_code = exc.status_code
        raise error from None
    url = await users.upload_avatar(user_id, data)
    return AvatarResponse(avatar_url=url, message="Avatar uploaded successfully.")


@router.delete("/me", response_model=MessageResponse)
async def delete_account(user_id: UserId, users: UserSvc) -> MessageResponse:
    """Permanently delete the user and everything stored for them (reminders, avatar, sessions, tokens)."""
    await users.delete_account(user_id)
    return MessageResponse(message="Account and all associated data permanently deleted.")
