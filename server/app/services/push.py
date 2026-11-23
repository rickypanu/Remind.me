"""Web Push device registration (finding S4): the cap is enforced INSIDE the MongoDB update, so parallel
requests cannot slip past it. See ``app/integrations/webpush.py`` for the endpoint allow-list (SSRF guard)."""

from typing import Any

from bson import ObjectId

from app.core.errors import Conflict, NotFound, Unprocessable
from app.repositories import UserRepository


class PushService:
    def __init__(self, db: Any, *, cap: int) -> None:
        self.users = UserRepository(db)
        self.cap = cap

    async def subscribe(self, user_id: ObjectId, stored: dict) -> dict[str, str]:
        # 1. Same device again (keys may have rotated): update it in place.
        if await self.users.update_push_subscription(user_id, stored):
            return {"status": "success", "message": "Subscription updated."}
        # 2. New device, only while fewer than `cap` are registered.
        if await self.users.append_push_subscription(user_id, stored, self.cap):
            return {"status": "success", "message": "Subscription registered."}
        # Nothing matched: a parallel request just added this endpoint, or the cap is reached.
        if await self.users.has_push_endpoint(user_id, stored["endpoint"]):
            return {"status": "info", "message": "Subscription already exists."}
        raise Conflict(f"You can register at most {self.cap} devices. Remove one in Settings and try again.")

    async def unsubscribe(self, user_id: ObjectId, endpoint: Any) -> dict[str, str]:
        """One device when ``endpoint`` is given, every device otherwise (the old behaviour)."""
        if endpoint is not None and not isinstance(endpoint, str):
            raise Unprocessable("Invalid endpoint")
        if endpoint:
            changed = await self.users.remove_push_endpoint(user_id, endpoint)
        else:
            changed = await self.users.clear_push_subscriptions(user_id)
        if not changed:
            raise NotFound("User or subscription not found.")
        return {"status": "success", "message": "Subscription removed successfully."}
