"""Everything stored on ``users`` documents: account, Telegram link, web-push devices."""

from collections.abc import AsyncIterator, Iterable
from typing import Any

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from app.core.errors import Conflict


class UserRepository:
    def __init__(self, db: Any) -> None:
        self._c = db["users"]

    # ---- account ---------------------------------------------------------------------------------
    async def get(self, user_id: ObjectId, projection: dict | None = None) -> dict | None:
        return await self._c.find_one({"_id": user_id}, projection)

    async def get_by_email(self, email: str) -> dict | None:
        return await self._c.find_one({"email": email})

    async def email_exists(self, email: str) -> bool:
        return await self._c.find_one({"email": email}, {"_id": 1}) is not None

    async def create(self, doc: dict) -> ObjectId:
        """Insert a new account. The unique e-mail index decides races: the loser gets a 409."""
        try:
            result = await self._c.insert_one(dict(doc))
        except DuplicateKeyError:
            raise Conflict("Email already registered") from None
        return result.inserted_id

    async def set_fields(self, user_id: ObjectId, fields: dict[str, Any]) -> bool:
        result = await self._c.update_one({"_id": user_id}, {"$set": fields})
        return result.matched_count == 1

    async def set_password(self, user_id: ObjectId, password_hash: str, *, revoke_tokens: bool = False) -> bool:
        """New hash. With ``revoke_tokens`` the token version is bumped too, which kills every access token issued
        before now, and legacy reset fields left on the document by the old code are removed."""
        update: dict[str, Any] = {"$set": {"password_hash": password_hash}}
        if revoke_tokens:
            update["$inc"] = {"token_version": 1}
            update["$unset"] = {"reset_token": "", "reset_token_expires": ""}
        result = await self._c.update_one({"_id": user_id}, update)
        return result.matched_count == 1

    async def bump_token_version(self, user_id: ObjectId) -> bool:
        result = await self._c.update_one({"_id": user_id}, {"$inc": {"token_version": 1}})
        return result.matched_count == 1

    async def delete(self, user_id: ObjectId) -> bool:
        result = await self._c.delete_one({"_id": user_id})
        return result.deleted_count == 1

    async def load_many(self, user_ids: Iterable[ObjectId], projection: dict | None = None) -> list[dict]:
        """One ``$in`` query for a batch of users (finding P5)."""
        ids = list(user_ids)
        if not ids:
            return []
        return [user async for user in self._c.find({"_id": {"$in": ids}}, projection)]

    # ---- Telegram ----------------------------------------------------------------------------------
    async def link_telegram(self, user_id: ObjectId, chat_id: str) -> bool:
        """Attach a chat to an account. A chat belongs to ONE account, so it is taken from any other first."""
        await self._c.update_many(
            {"telegram_chat_id": chat_id, "_id": {"$ne": user_id}},
            {"$unset": {"telegram_chat_id": "", "phone_number": ""}},
        )
        result = await self._c.update_one({"_id": user_id}, {"$set": {"telegram_chat_id": chat_id}})
        return result.matched_count == 1

    async def unlink_telegram(self, user_id: ObjectId) -> bool:
        result = await self._c.update_one({"_id": user_id}, {"$unset": {"telegram_chat_id": "", "phone_number": ""}})
        return result.modified_count == 1

    async def set_phone_for_chat(self, chat_id: str, phone: str) -> bool:
        result = await self._c.update_one({"telegram_chat_id": chat_id}, {"$set": {"phone_number": phone}})
        return result.matched_count == 1

    async def telegram_fields(self, user_id: ObjectId) -> dict | None:
        return await self._c.find_one({"_id": user_id}, {"telegram_chat_id": 1, "phone_number": 1})

    async def telegram_chat_ids(self) -> AsyncIterator[Any]:
        query = {"telegram_chat_id": {"$exists": True, "$nin": [None, ""]}}
        async for user in self._c.find(query, {"telegram_chat_id": 1}):
            yield user["telegram_chat_id"]

    # ---- Web Push devices ----------------------------------------------------------------------------
    async def update_push_subscription(self, user_id: ObjectId, stored: dict) -> bool:
        """Same device registering again (keys may have rotated): update it in place."""
        result = await self._c.update_one(
            {"_id": user_id, "push_subscriptions.endpoint": stored["endpoint"]},
            {"$set": {"push_subscriptions.$": stored}},
        )
        return result.matched_count == 1

    async def append_push_subscription(self, user_id: ObjectId, stored: dict, cap: int) -> bool:
        """Add a device only while the list has fewer than ``cap`` entries; checked inside the one atomic update."""
        result = await self._c.update_one(
            {
                "_id": user_id,
                f"push_subscriptions.{cap - 1}": {"$exists": False},
                "push_subscriptions.endpoint": {"$ne": stored["endpoint"]},
            },
            {"$push": {"push_subscriptions": stored}},
        )
        return result.matched_count == 1

    async def has_push_endpoint(self, user_id: ObjectId, endpoint: str) -> bool:
        found = await self._c.find_one({"_id": user_id, "push_subscriptions.endpoint": endpoint}, {"_id": 1})
        return found is not None

    async def remove_push_endpoint(self, user_id: ObjectId, endpoint: str) -> bool:
        result = await self._c.update_one({"_id": user_id}, {"$pull": {"push_subscriptions": {"endpoint": endpoint}}})
        return result.modified_count == 1

    async def clear_push_subscriptions(self, user_id: ObjectId) -> bool:
        result = await self._c.update_one({"_id": user_id}, {"$unset": {"push_subscriptions": ""}})
        return result.modified_count == 1

    async def pull_push_subscription(self, user_id: ObjectId, condition: Any) -> None:
        await self._c.update_one({"_id": user_id}, {"$pull": {"push_subscriptions": condition}})

    # ---- diagnostics ------------------------------------------------------------------------------------
    async def count_string_ids(self) -> int:
        return await self._c.count_documents({"_id": {"$type": "string"}})
