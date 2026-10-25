"""Password-reset tokens (collection ``password_resets``); only the SHA-256 of a token is ever stored."""

from datetime import datetime
from typing import Any


class PasswordResetRepository:
    def __init__(self, db: Any) -> None:
        self._c = db["password_resets"]

    async def recent_for_user(self, user_id: str, since: datetime) -> dict | None:
        return await self._c.find_one({"user_id": user_id, "created_at": {"$gt": since}})

    async def replace_for_user(self, user_id: str, doc: dict) -> None:
        """One live token per user: the new one replaces any older one."""
        await self._c.delete_many({"user_id": user_id})
        await self._c.insert_one(dict(doc))

    async def peek(self, token_hash: str, now: datetime) -> dict | None:
        """Look at a token without spending it."""
        return await self._c.find_one({"reset_token_hash": token_hash, "reset_token_expires": {"$gt": now}})

    async def claim(self, token_hash: str, now: datetime) -> dict | None:
        """Spend the token. Atomic: exactly one caller ever gets a document back."""
        return await self._c.find_one_and_delete({"reset_token_hash": token_hash, "reset_token_expires": {"$gt": now}})

    async def delete_for_user(self, user_id: str) -> None:
        await self._c.delete_many({"user_id": user_id})
