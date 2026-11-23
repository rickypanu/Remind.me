"""Friends, invite codes and the accountability buddy.

``friendships`` holds one document per direction: ``{user_id, friend_id, created_at}``. The pair is stored twice so
"my friends" is one indexed read and removing a friend never has to guess which side wrote it.
The invite code, the buddy and the invite count live on the ``users`` document.
"""

import secrets
from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

# No 0/O/1/I: the code is read aloud and typed by hand.
_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
CODE_LENGTH = 8


def new_code() -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(CODE_LENGTH))


class SocialRepository:
    def __init__(self, db: Any) -> None:
        self._users = db["users"]
        self._links = db["friendships"]

    # ---- invite code -----------------------------------------------------------------------------
    async def ensure_code(self, user_id: ObjectId) -> str:
        """The user's invite code, made on first use. Two users can never share one (unique sparse index)."""
        user = await self._users.find_one({"_id": user_id}, {"invite_code": 1})
        if user and user.get("invite_code"):
            return user["invite_code"]
        for _ in range(5):
            code = new_code()
            try:
                result = await self._users.update_one(
                    {"_id": user_id, "invite_code": {"$exists": False}}, {"$set": {"invite_code": code}}
                )
            except DuplicateKeyError:
                continue
            if result.matched_count == 1:
                return code
            user = await self._users.find_one({"_id": user_id}, {"invite_code": 1})  # a parallel call won
            if user and user.get("invite_code"):
                return user["invite_code"]
        raise RuntimeError("Could not allocate an invite code.")

    async def user_by_code(self, code: str) -> dict | None:
        return await self._users.find_one({"invite_code": code}, {"username": 1, "avatar_url": 1})

    async def get_user(self, user_id: ObjectId, projection: dict | None = None) -> dict | None:
        return await self._users.find_one({"_id": user_id}, projection)

    # ---- friendships --------------------------------------------------------------------------------
    async def are_friends(self, user_id: ObjectId, friend_id: ObjectId) -> bool:
        return await self._links.find_one({"user_id": user_id, "friend_id": friend_id}, {"_id": 1}) is not None

    async def add_friendship(self, user_id: ObjectId, friend_id: ObjectId) -> bool:
        """Link two users. False when they were already friends (nothing changes, nothing is counted)."""
        if await self.are_friends(user_id, friend_id):
            return False
        now = datetime.now(UTC)
        for a, b in ((user_id, friend_id), (friend_id, user_id)):
            # Upsert keyed by the pair: a parallel join cannot make a duplicate (unique index), only a no-op.
            await self._links.update_one({"user_id": a, "friend_id": b}, {"$setOnInsert": {"created_at": now}}, upsert=True)
        return True

    async def remove_friendship(self, user_id: ObjectId, friend_id: ObjectId) -> None:
        await self._links.delete_many(
            {"$or": [{"user_id": user_id, "friend_id": friend_id}, {"user_id": friend_id, "friend_id": user_id}]}
        )
        # The buddy ends with the friendship, on both sides.
        await self._users.update_many(
            {"_id": {"$in": [user_id, friend_id]}, "buddy_id": {"$in": [user_id, friend_id]}},
            {"$unset": {"buddy_id": ""}},
        )

    async def friend_ids(self, user_id: ObjectId, limit: int = 200) -> list[ObjectId]:
        rows = await self._links.find({"user_id": user_id}, {"friend_id": 1}).limit(limit).to_list(length=limit)
        return [row["friend_id"] for row in rows]

    async def load_users(self, ids: list[ObjectId]) -> list[dict]:
        if not ids:
            return []
        return [u async for u in self._users.find({"_id": {"$in": ids}}, {"username": 1, "avatar_url": 1})]

    async def count_invited(self, user_id: ObjectId) -> int:
        user = await self._users.find_one({"_id": user_id}, {"invited_count": 1})
        return int((user or {}).get("invited_count", 0))

    async def bump_invited(self, user_id: ObjectId) -> None:
        await self._users.update_one({"_id": user_id}, {"$inc": {"invited_count": 1}})

    # ---- buddy ----------------------------------------------------------------------------------------
    async def set_buddy(self, user_id: ObjectId, buddy_id: ObjectId | None) -> None:
        update = {"$set": {"buddy_id": buddy_id}} if buddy_id else {"$unset": {"buddy_id": ""}}
        await self._users.update_one({"_id": user_id}, update)

    async def buddies_watching(self, user_id: ObjectId) -> list[dict]:
        """Everyone who picked ``user_id`` as their buddy: they get the pings."""
        return [
            u
            async for u in self._users.find(
                {"buddy_id": user_id}, {"username": 1, "telegram_chat_id": 1, "push_subscriptions": 1}
            )
        ]

    # ---- cleanup ----------------------------------------------------------------------------------------
    async def delete_all_for_user(self, user_id: ObjectId) -> None:
        await self._links.delete_many({"$or": [{"user_id": user_id}, {"friend_id": user_id}]})
        await self._users.update_many({"buddy_id": user_id}, {"$unset": {"buddy_id": ""}})
