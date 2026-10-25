"""One-winner locks for scheduled jobs (collection ``scheduler_locks``, cleaned by a TTL index)."""

from datetime import datetime
from typing import Any

from pymongo.errors import DuplicateKeyError


class LockRepository:
    def __init__(self, db: Any) -> None:
        self._c = db["scheduler_locks"]

    async def acquire(self, key: str, expires_at: datetime) -> bool:
        """True for exactly ONE caller per key, however many workers try."""
        try:
            await self._c.insert_one({"_id": key, "expires_at": expires_at})
        except DuplicateKeyError:
            return False
        return True
