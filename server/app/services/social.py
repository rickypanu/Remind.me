"""Social rules: join with an invite code, friend list, a reminder sent to a friend, the accountability buddy."""

import logging
from datetime import UTC, datetime
from typing import Any

from bson import ObjectId

from app.core.clock import now_ms
from app.core.errors import BadRequest, Conflict, NotFound
from app.db.ids import to_object_id
from app.repositories import CompletionRepository, SocialRepository
from app.services.tasks import TaskService
from schemas.social import REWARD_INVITES
from schemas.task import TaskCreate
from utils.streak import current_streak
from utils.timezone import as_ist

log = logging.getLogger("social")

SHARED_CATEGORY = "Shared"
MAX_FRIENDS = 200


def _friend_out(user: dict, streak: int, buddy_id: ObjectId | None) -> dict:
    return {
        "id": str(user["_id"]),
        "username": user.get("username", "Friend"),
        "avatar_url": user.get("avatar_url"),
        "streak": streak,
        "is_buddy": buddy_id is not None and user["_id"] == buddy_id,
    }


class SocialService:
    def __init__(self, db: Any, tasks: TaskService, *, clock=now_ms) -> None:
        self.repo = SocialRepository(db)
        self.completions = CompletionRepository(db)
        self.tasks = tasks
        self._clock = clock

    async def _streak(self, user_id: ObjectId) -> int:
        history = await self.completions.recent(user_id)
        return current_streak(set(history), as_ist(self._clock()).date())

    async def _friend_rows(self, user_id: ObjectId, buddy_id: ObjectId | None) -> list[dict]:
        ids = await self.repo.friend_ids(user_id, MAX_FRIENDS)
        rows = []
        for friend in await self.repo.load_users(ids):
            rows.append(_friend_out(friend, await self._streak(friend["_id"]), buddy_id))
        rows.sort(key=lambda r: (not r["is_buddy"], -r["streak"], r["username"].lower()))
        return rows

    async def summary(self, user_id: ObjectId) -> dict:
        code = await self.repo.ensure_code(user_id)
        me = await self.repo.get_user(user_id, {"buddy_id": 1, "invited_count": 1}) or {}
        buddy_id = me.get("buddy_id")
        invited = int(me.get("invited_count", 0))
        return {
            "invite_code": code,
            "invited_count": invited,
            "reward_target": REWARD_INVITES,
            "reward_unlocked": invited >= REWARD_INVITES,
            "friends": await self._friend_rows(user_id, buddy_id),
            "buddy_id": str(buddy_id) if buddy_id else None,
        }

    async def join(self, user_id: ObjectId, code: str) -> dict:
        inviter = await self.repo.user_by_code(code)
        if inviter is None:
            raise NotFound("That invite code does not exist. Check it and try again.")
        if inviter["_id"] == user_id:
            raise BadRequest("That is your own invite code. Send it to a friend instead.")
        if len(await self.repo.friend_ids(user_id, MAX_FRIENDS)) >= MAX_FRIENDS:
            raise Conflict("Your friend list is full.")
        created = await self.repo.add_friendship(user_id, inviter["_id"])
        if created:
            await self.repo.bump_invited(inviter["_id"])  # counted once per pair, so re-entering a code adds nothing
        friend = _friend_out(inviter, await self._streak(inviter["_id"]), None)
        return {"message": "You are now friends." if created else "You are already friends.", "friend": friend}

    async def unfriend(self, user_id: ObjectId, friend_id: str) -> None:
        fid = to_object_id(friend_id)
        if fid is None or not await self.repo.are_friends(user_id, fid):
            raise NotFound("Friend not found.")
        await self.repo.remove_friendship(user_id, fid)

    async def send_reminder(self, user_id: ObjectId, friend_id: str, *, title: str, due_date: datetime, note: str | None, sender_name: str) -> None:
        fid = to_object_id(friend_id)
        if fid is None or not await self.repo.are_friends(user_id, fid):
            raise NotFound("You can only send reminders to your friends.")
        if due_date.tzinfo is None:
            due_date = due_date.replace(tzinfo=UTC)
        description = f"From {sender_name}" + (f": {note.strip()}" if note and note.strip() else "")
        # The normal create path applies content moderation, validation and encryption, exactly as for the friend's own reminders.
        await self.tasks.create(
            fid,
            TaskCreate(title=title, description=description[:1000], category=SHARED_CATEGORY, due_date=due_date, schedule_type="once"),
        )

    async def set_buddy(self, user_id: ObjectId, friend_id: str | None) -> None:
        if friend_id is None:
            await self.repo.set_buddy(user_id, None)
            return
        fid = to_object_id(friend_id)
        if fid is None or not await self.repo.are_friends(user_id, fid):
            raise NotFound("Pick one of your friends as a buddy.")
        await self.repo.set_buddy(user_id, fid)

    async def ping_buddies(self, notifier: Any, user_id: ObjectId, name: str) -> None:
        """Tell the people who chose this user as their buddy that a reminder was just completed.

        At most once per day (the first completion), so a busy day never turns into a stream of notifications.
        Best effort: failures are logged and never reach the person who completed the reminder.
        """
        try:
            history = await self.completions.recent(user_id, 1)
            today = as_ist(self._clock()).date()
            if history.get(today, 0) != 1:
                return
            for watcher in await self.repo.buddies_watching(user_id):
                title = f"{name} is on it"
                body = f"{name} just finished a reminder today. Your turn?"
                await notifier.send_push(watcher, title, body)
                await notifier.send_telegram(watcher, f"<b>{title}</b>", body)
        except Exception:  # noqa: BLE001
            log.warning("Buddy ping failed", exc_info=True)
