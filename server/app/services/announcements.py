"""Admin announcements for the Updates page (finding A1)."""

import uuid
from datetime import UTC, datetime
from typing import Any

from app.core.errors import NotFound
from app.repositories import AnnouncementRepository


class AnnouncementService:
    def __init__(self, db: Any) -> None:
        self.repo = AnnouncementRepository(db)

    async def create(self, title: str, content: str) -> dict:
        doc = {
            "id": str(uuid.uuid4()),  # custom string id: the frontend maps on it
            "title": title,
            "content": content,
            "created_at": datetime.now(UTC).isoformat(),
        }
        await self.repo.insert(doc)
        return doc

    async def latest(self, limit: int = 100) -> list[dict]:
        return await self.repo.latest(limit)

    async def delete(self, announcement_id: str) -> None:
        if not await self.repo.delete(announcement_id):
            raise NotFound("Update not found")
