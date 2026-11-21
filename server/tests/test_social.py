"""Invite codes, friends, a reminder sent to a friend, the buddy and the buddy ping."""

import unittest
from datetime import timedelta

from bson import ObjectId

from app.core.errors import BadRequest, NotFound
from app.services.social import SocialService
from tests.fake_db import FakeDb
from tests.helpers import T0, new_world


async def make_user(db, name):
    uid = ObjectId()
    await db["users"].insert_one({"_id": uid, "username": name, "email": f"{name}@example.com"})
    return uid


class FakeNotifier:
    def __init__(self):
        self.sent = []

    async def send_push(self, user, title, body):
        self.sent.append((user["_id"], title))

    async def send_telegram(self, user, title, body):
        return None


class SocialTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db, self.clock, self.tasks = new_world()
        self.social = SocialService(self.db, self.tasks, clock=self.clock)
        self.ann = await make_user(self.db, "ann")
        self.raj = await make_user(self.db, "raj")

    async def join(self):
        code = (await self.social.summary(self.ann))["invite_code"]
        return await self.social.join(self.raj, code)

    async def test_code_is_stable_and_joining_makes_friends_once(self):
        first = (await self.social.summary(self.ann))["invite_code"]
        self.assertEqual(first, (await self.social.summary(self.ann))["invite_code"])
        await self.join()
        again = await self.join()
        self.assertEqual(again["message"], "You are already friends.")
        summary = await self.social.summary(self.ann)
        self.assertEqual(summary["invited_count"], 1)
        self.assertEqual([f["username"] for f in summary["friends"]], ["raj"])
        self.assertEqual([f["username"] for f in (await self.social.summary(self.raj))["friends"]], ["ann"])

    async def test_own_and_unknown_codes_are_refused(self):
        code = (await self.social.summary(self.ann))["invite_code"]
        with self.assertRaises(BadRequest):
            await self.social.join(self.ann, code)
        with self.assertRaises(NotFound):
            await self.social.join(self.raj, "ZZZZZZZZ")

    async def test_reminder_only_to_friends(self):
        due = T0 + timedelta(days=1)
        with self.assertRaises(NotFound):
            await self.social.send_reminder(self.ann, str(self.raj), title="Call mom", due_date=due, note=None, sender_name="ann")
        await self.join()
        await self.social.send_reminder(self.raj, str(self.ann), title="Bring notes", due_date=due, note="library", sender_name="raj")
        listed = await self.tasks.list_all(self.ann)
        self.assertEqual([t["title"] for t in listed], ["Bring notes"])
        self.assertEqual(listed[0]["description"], "From raj: library")

    async def test_buddy_needs_a_friendship_and_ends_with_it(self):
        with self.assertRaises(NotFound):
            await self.social.set_buddy(self.ann, str(self.raj))
        await self.join()
        await self.social.set_buddy(self.raj, str(self.ann))
        self.assertEqual((await self.social.summary(self.raj))["buddy_id"], str(self.ann))
        await self.social.unfriend(self.ann, str(self.raj))
        self.assertIsNone((await self.social.summary(self.raj))["buddy_id"])

    async def test_buddy_is_pinged_once_a_day(self):
        await self.join()
        await self.social.set_buddy(self.raj, str(self.ann))
        notifier = FakeNotifier()
        await self.social.completions.add(self.ann, "2026-10-20")  # 15:30 IST on the test clock's day
        await self.social.ping_buddies(notifier, self.ann, "ann")
        await self.social.completions.add(self.ann, "2026-10-20")
        await self.social.ping_buddies(notifier, self.ann, "ann")
        self.assertEqual(len(notifier.sent), 1)
        self.assertEqual(notifier.sent[0][0], self.raj)


if __name__ == "__main__":
    unittest.main()
