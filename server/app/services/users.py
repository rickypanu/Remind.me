"""Profile, avatar and account deletion rules (finding A1)."""

import logging
from datetime import UTC, datetime
from typing import Any

from bson import ObjectId

from app.core.errors import AppError, BadRequest, Forbidden, NotFound
from app.repositories import (
    AvatarRepository,
    CompletionRepository,
    LinkTokenRepository,
    PasswordResetRepository,
    SessionRepository,
    TaskRepository,
    UserRepository,
)
from app.services.avatars import AvatarError, process_avatar
from schemas.user import AVATAR_URL_RE

log = logging.getLogger("user_service")

AVATAR_URL_PREFIX = "/uploads/avatars/"


def profile_of(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(user["_id"]),
        "username": user.get("username", "Student"),
        "email": user.get("email"),
        "created_at": user.get("created_at"),
        "avatar_url": user.get("avatar_url"),
        "is_admin": bool(user.get("is_admin", False)),
    }


class UserService:
    def __init__(self, db: Any) -> None:
        self.db = db
        self.users = UserRepository(db)
        self.avatars = AvatarRepository(db)

    async def update_profile(self, user_id: ObjectId, changes: dict[str, Any]) -> dict[str, Any]:
        """``changes`` is ``UserUpdate.model_dump(exclude_unset=True)``: only username / avatar_url can be here."""
        fields = dict(changes)
        if fields.get("username") is None:
            fields.pop("username", None)  # an explicit null username is meaningless; keep the old one
        if not fields:
            raise BadRequest("No valid fields provided for update.")

        # An uploaded-avatar URL may only point at the caller's own picture.
        new_avatar = fields.get("avatar_url")
        match = AVATAR_URL_RE.match(new_avatar) if new_avatar else None
        if match and match.group("user_id") != str(user_id):
            raise Forbidden("You can only use your own uploaded avatar.")

        await self.users.set_fields(user_id, fields)
        if "avatar_url" in fields and match is None:
            # Switched to a built-in illustration (or removed the picture): the uploaded file is no longer used.
            await self.avatars.delete(str(user_id))
        return fields

    async def upload_avatar(self, user_id: ObjectId, data: bytes) -> str:
        """Re-encode the image (the client's bytes are never stored as they are) and point the profile at it."""
        try:
            processed = await process_avatar(data)
        except AvatarError as exc:
            error = AppError(exc.message)
            error.status_code = exc.status_code
            raise error from None

        now = datetime.now(UTC)
        await self.avatars.save(str(user_id), processed.data, processed.content_type, now)
        avatar_url = f"{AVATAR_URL_PREFIX}{user_id}?v={int(now.timestamp())}"  # ?v= busts the browser cache
        await self.users.set_fields(user_id, {"avatar_url": avatar_url})
        return avatar_url

    async def delete_account(self, user_id: ObjectId) -> None:
        """Permanently delete the user and everything stored for them.

        The user document goes LAST, so a failure part-way can simply be retried by the user.
        """
        await TaskRepository(self.db).delete_all_for_user(user_id)
        await CompletionRepository(self.db).delete_all_for_user(user_id)
        await self.avatars.delete(str(user_id))
        await SessionRepository(self.db).delete_for_user(str(user_id))
        await PasswordResetRepository(self.db).delete_for_user(str(user_id))
        await LinkTokenRepository(self.db).delete_for_user(user_id)
        if not await self.users.delete(user_id):
            raise NotFound("User account could not be found.")
