"""Single-use Telegram link tokens (collection ``telegram_link_tokens``); only the SHA-256 of a token is stored."""

from datetime import datetime
from typing import Any

from bson import ObjectId


class LinkTokenRepository:
    def __init__(self, db: Any) -> None:
        self._c = db["telegram_link_tokens"]

    async def replace_for_user(self, user_id: ObjectId, token_hash: str, created: datetime, expires: datetime) -> None:
        await self._c.delete_many({"user_id": user_id})  # one live token per user
        await self._c.insert_one({"_id": token_hash, "user_id": user_id, "created_at": created, "expires": expires})

    async def consume(self, token_hash: str) -> dict | None:
        """Atomic: of two simultaneous attempts only one gets the document."""
        return await self._c.find_one_and_delete({"_id": token_hash})

    async def delete_for_user(self, user_id: ObjectId) -> None:
        await self._c.delete_many({"user_id": user_id})
