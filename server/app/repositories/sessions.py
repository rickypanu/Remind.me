"""Refresh-token sessions (collection ``sessions``). See app/services/sessions.py for the model."""

from datetime import datetime
from typing import Any


class SessionRepository:
    def __init__(self, db: Any) -> None:
        self._c = db["sessions"]

    async def insert(self, doc: dict) -> None:
        await self._c.insert_one(dict(doc))

    async def claim_unused(self, token_hash: str, now: datetime) -> dict | None:
        """Atomically mark a live, unused token as used. Exactly one caller can win for a given token."""
        return await self._c.find_one_and_update(
            {"token_hash": token_hash, "used_at": None, "expires_at": {"$gt": now}},
            {"$set": {"used_at": now}},
        )

    async def find_by_hash(self, token_hash: str) -> dict | None:
        return await self._c.find_one({"token_hash": token_hash})

    async def family_is_alive(self, family_id: str, user_id: str, now: datetime) -> bool:
        found = await self._c.find_one(
            {"family_id": family_id, "user_id": user_id, "expires_at": {"$gt": now}}, {"_id": 1}
        )
        return found is not None

    async def delete_family(self, family_id: str) -> None:
        await self._c.delete_many({"family_id": family_id})

    async def delete_for_user(self, user_id: str) -> None:
        await self._c.delete_many({"user_id": str(user_id)})
