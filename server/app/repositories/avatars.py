"""Uploaded avatar images (collection ``avatars``, keyed by the user id as text)."""

from datetime import datetime
from typing import Any

from bson import Binary


class AvatarRepository:
    def __init__(self, db: Any) -> None:
        self._c = db["avatars"]

    async def save(self, user_id: str, data: bytes, content_type: str, now: datetime) -> None:
        await self._c.update_one(
            {"_id": user_id},
            {"$set": {"data": Binary(data), "content_type": content_type, "updated_at": now}},
            upsert=True,
        )

    async def get(self, user_id: str) -> dict | None:
        return await self._c.find_one({"_id": user_id})

    async def delete(self, user_id: str) -> None:
        await self._c.delete_one({"_id": user_id})
