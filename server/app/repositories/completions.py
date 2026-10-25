"""Completions per IST day (collection ``completions``): the data behind the streak on the dashboard.

One document per (user, IST day): ``{user_id, day: "YYYY-MM-DD", count}``. ``day`` is the IST calendar day, written
as text, so it means the same thing wherever the server runs and needs no timezone arithmetic when read back.
"""

from datetime import date
from typing import Any

from bson import ObjectId

# 400 days is enough to show any streak the UI cares about while keeping the read to one small indexed query.
HISTORY_DAYS = 400


class CompletionRepository:
    def __init__(self, db: Any) -> None:
        self._c = db["completions"]

    async def add(self, user_id: ObjectId, day: str) -> None:
        await self._c.update_one({"user_id": user_id, "day": day}, {"$inc": {"count": 1}}, upsert=True)

    async def remove(self, user_id: ObjectId, day: str) -> None:
        """Undo one completion (a reminder re-opened). Never goes below zero."""
        await self._c.update_one({"user_id": user_id, "day": day, "count": {"$gt": 0}}, {"$inc": {"count": -1}})

    async def recent(self, user_id: ObjectId, limit: int = HISTORY_DAYS) -> dict[date, int]:
        rows = await (
            self._c.find({"user_id": user_id, "count": {"$gt": 0}}, {"day": 1, "count": 1})
            .sort("day", -1)
            .limit(limit)
            .to_list(length=limit)
        )
        out: dict[date, int] = {}
        for row in rows:
            try:
                out[date.fromisoformat(row["day"])] = int(row["count"])
            except (KeyError, ValueError, TypeError):
                continue  # a malformed row must never break the dashboard
        return out

    async def delete_all_for_user(self, user_id: ObjectId) -> int:
        result = await self._c.delete_many({"user_id": user_id})
        return result.deleted_count
