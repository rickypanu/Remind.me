"""Admin announcements shown on the Updates page (collection ``updates``)."""

from typing import Any


class AnnouncementRepository:
    def __init__(self, db: Any) -> None:
        self._c = db["updates"]

    async def insert(self, doc: dict) -> None:
        await self._c.insert_one(dict(doc))

    async def latest(self, limit: int = 100) -> list[dict]:
        return await self._c.find({}).sort("created_at", -1).to_list(length=limit)

    async def delete(self, announcement_id: str) -> bool:
        result = await self._c.delete_one({"id": announcement_id})
        return result.deleted_count == 1
