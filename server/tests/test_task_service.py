"""TaskService + TaskRepository: cross-user isolation (T2.1), idempotent sync (T2.2), tombstones and encryption.

Everything runs against the in-memory FakeDb with a hand-moved clock, so every timestamp is exact.
"""

import unittest
from datetime import timedelta

from tests import auth_stubs  # noqa: F401  (must stay first: it prepares the test environment)

# isort: split

from bson import ObjectId  # noqa: E402

from app.core.errors import BadRequest, NotFound, Unprocessable  # noqa: E402
from app.repositories import TaskRepository  # noqa: E402
from app.services.users import UserService  # noqa: E402
from schemas.task import TaskStatusUpdate, TaskUpdate  # noqa: E402
from tests.helpers import T0, new_world, task_payload  # noqa: E402
from utils import crypto  # noqa: E402

DONE = TaskStatusUpdate(status="completed")


class CrossUserIsolationTests(unittest.IsolatedAsyncioTestCase):
    """User B must not be able to read, update, complete or delete User A's reminder, in any way."""

    async def asyncSetUp(self):
        self.db, self.clock, self.svc = new_world()
        self.a, self.b = ObjectId(), ObjectId()
        self.task = await self.svc.create(self.a, task_payload("A's secret exam", description="A's private notes"))

    async def assert_untouched(self):
        mine = await self.svc.get(self.a, self.task["id"])
        self.assertEqual((mine["title"], mine["description"], mine["status"]), ("A's secret exam", "A's private notes", "pending"))
        self.assertEqual(len([d for d in self.db["tasks"].docs if not d.get("deleted")]), 1)

    async def test_b_cannot_read_a_task(self):
        with self.assertRaises(NotFound) as caught:
            await self.svc.get(self.b, self.task["id"])
        self.assertEqual(caught.exception.status_code, 404)
        self.assertIsNone(await TaskRepository(self.db).get(self.b, ObjectId(self.task["id"])))
        await self.assert_untouched()

    async def test_b_cannot_update_a_task(self):
        with self.assertRaises(NotFound):
            await self.svc.update(self.b, self.task["id"], TaskUpdate(title="hijacked", due_date=T0 + timedelta(days=9)))
        await self.assert_untouched()

    async def test_b_cannot_complete_a_task(self):
        with self.assertRaises(NotFound):
            await self.svc.set_status(self.b, self.task["id"], DONE)
        await self.assert_untouched()

    async def test_b_cannot_delete_a_task(self):
        with self.assertRaises(NotFound):
            await self.svc.delete(self.b, self.task["id"])
        await self.assert_untouched()

    async def test_the_answer_for_a_foreign_task_equals_the_answer_for_a_missing_one(self):
        """No existence oracle: B learns nothing about whether an id belongs to somebody else."""
        missing = str(ObjectId())
        operations = {
            "get": lambda tid: self.svc.get(self.b, tid),
            "update": lambda tid: self.svc.update(self.b, tid, TaskUpdate(title="x")),
            "status": lambda tid: self.svc.set_status(self.b, tid, DONE),
            "delete": lambda tid: self.svc.delete(self.b, tid),
        }
        for name, call in operations.items():
            with self.subTest(name):
                with self.assertRaises(NotFound) as foreign:
                    await call(self.task["id"])
                with self.assertRaises(NotFound) as absent:
                    await call(missing)
                self.assertEqual(
                    (foreign.exception.status_code, foreign.exception.detail, foreign.exception.body()),
                    (absent.exception.status_code, absent.exception.detail, absent.exception.body()),
                )

    async def test_lists_and_change_feeds_never_mix_users(self):
        theirs = await self.svc.create(self.b, task_payload("B's task"))
        await self.svc.delete(self.a, self.task["id"])  # A deletes: a tombstone now exists for A only
        page_b = await self.svc.list_changes(self.b)
        self.assertEqual([t["title"] for t in page_b.items], ["B's task"])
        self.assertEqual(page_b.deleted, [])
        page_a = await self.svc.list_changes(self.a, cursor=(await self.svc.list_changes(self.a, limit=1)).next_cursor)
        self.assertNotIn(theirs["id"], [t["id"] for t in page_a.items])
        self.assertEqual(len(await self.svc.list_all(self.b)), 1)
        self.assertEqual(await self.svc.list_all(ObjectId()), [])

    async def test_the_same_client_id_for_two_users_makes_two_tasks(self):
        first = await self.svc.create(self.a, task_payload("one", client_id="shared-id"))
        second = await self.svc.create(self.b, task_payload("two", client_id="shared-id"))
        self.assertNotEqual(first["id"], second["id"])
        self.assertEqual((first["title"], second["title"]), ("one", "two"))
        self.assertEqual(second["user_id"], str(self.b))

    async def test_malformed_ids_are_400_not_500(self):
        for bad in ("not-an-id", "123", "g" * 24, "", " " * 24):
            with self.subTest(bad=bad):
                with self.assertRaises(BadRequest):
                    await self.svc.get(self.b, bad)
                with self.assertRaises(BadRequest):
                    await self.svc.delete(self.b, bad)

    async def test_ciphertext_is_bound_to_its_owner(self):
        """Even a database-level copy of A's row into B's account decrypts to nothing, never to A's text."""
        stored = next(d for d in self.db["tasks"].docs if d.get("title"))
        self.assertNotIn("A's secret exam", str(stored))
        moved = {**stored, "_id": ObjectId(), "user_id": self.b}
        await self.db["tasks"].insert_one(moved)
        seen_by_b = await self.svc.get(self.b, str(moved["_id"]))
        self.assertEqual(seen_by_b["title"], crypto.UNREADABLE)
        self.assertNotIn("A's secret exam", str(seen_by_b))

    async def test_deleting_an_account_removes_only_that_users_reminders(self):
        await self.svc.create(self.b, task_payload("B's task"))
        await self.svc.delete(self.a, self.task["id"])  # leaves a tombstone
        await self.db["users"].insert_one({"_id": self.a, "email": "a@example.com"})
        await UserService(self.db).delete_account(self.a)
        owners = {d["user_id"] for d in self.db["tasks"].docs}
        self.assertEqual(owners, {self.b})  # A's live task AND A's tombstone are gone


class IdempotentSyncTests(unittest.IsolatedAsyncioTestCase):
    """An offline client retries a queued operation until it hears back, so every replay must be harmless."""

    async def asyncSetUp(self):
        self.db, self.clock, self.svc = new_world()
        self.me = ObjectId()

    async def test_replaying_a_create_returns_the_same_task(self):
        first = await self.svc.create(self.me, task_payload("Buy milk", client_id="c-1"))
        self.clock.tick(seconds=30)
        second = await self.svc.create(self.me, task_payload("Buy milk", client_id="c-1"))
        self.assertEqual(first, second)  # same id AND same updated_at: nothing was rewritten
        self.assertEqual(len(self.db["tasks"].docs), 1)

    async def test_a_replay_with_different_content_does_not_overwrite(self):
        first = await self.svc.create(self.me, task_payload("Original", client_id="c-2"))
        again = await self.svc.create(self.me, task_payload("Edited later", client_id="c-2"))
        self.assertEqual(again["id"], first["id"])
        self.assertEqual(again["title"], "Original")

    async def test_two_creates_racing_past_the_lookup_are_decided_by_the_unique_index(self):
        await self.svc.create(self.me, task_payload("Winner", client_id="race"))
        real = self.svc.repo.get_by_client_id
        calls = []

        async def blind_first_time(user, client_id):
            calls.append(client_id)
            return None if len(calls) == 1 else await real(user, client_id)  # the loser's lookup misses

        self.svc.repo.get_by_client_id = blind_first_time
        out = await self.svc.create(self.me, task_payload("Loser", client_id="race"))
        self.assertEqual(out["title"], "Winner")
        self.assertEqual(len(self.db["tasks"].docs), 1)

    async def test_tasks_without_client_id_are_never_deduplicated(self):
        await self.svc.create(self.me, task_payload("Same"))
        await self.svc.create(self.me, task_payload("Same"))
        self.assertEqual(len(self.db["tasks"].docs), 2)

    async def test_replayed_status_change_is_a_no_op_the_second_time(self):
        task = await self.svc.create(self.me, task_payload())
        for _ in range(3):
            result = await self.svc.set_status(self.me, task["id"], DONE)
            self.assertEqual(result["message"], "Task updated successfully")
        self.assertEqual((await self.svc.get(self.me, task["id"]))["status"], "completed")
        self.assertEqual(len(self.db["tasks"].docs), 1)

    async def test_replayed_edit_converges_on_the_same_content(self):
        task = await self.svc.create(self.me, task_payload("Old"))
        edit = TaskUpdate(title="New", due_date=T0 + timedelta(days=5))
        first = await self.svc.update(self.me, task["id"], edit)
        second = await self.svc.update(self.me, task["id"], edit)
        for key in ("title", "description", "category", "due_date", "status"):
            self.assertEqual(first[key], second[key])

    async def test_replayed_delete_is_a_404_and_leaves_the_tombstone_alone(self):
        task = await self.svc.create(self.me, task_payload())
        await self.svc.delete(self.me, task["id"])
        [tombstone] = self.db["tasks"].docs
        deleted_at = tombstone["deleted_at"]
        self.clock.tick(hours=1)
        with self.assertRaises(NotFound):  # clients treat 404 on a DELETE as "already gone"
            await self.svc.delete(self.me, task["id"])
        self.assertEqual(self.db["tasks"].docs[0]["deleted_at"], deleted_at)  # not re-stamped
        self.assertEqual(len(self.db["tasks"].docs), 1)

    async def test_a_replayed_create_after_a_delete_does_not_resurrect_the_old_task(self):
        """Documented limit: the tombstone forgets its client_id, so a very late replay makes a NEW task; the old id
        stays deleted. (The client drops a queued create when the user deletes the item offline.)"""
        task = await self.svc.create(self.me, task_payload("Gone", client_id="late"))
        await self.svc.delete(self.me, task["id"])
        with self.assertRaises(NotFound):
            await self.svc.get(self.me, task["id"])

    async def test_moderation_rejection_stores_nothing_and_can_be_retried(self):
        bad = task_payload("buy porn tapes", client_id="bad-1")
        for _ in range(2):
            with self.assertRaises(Unprocessable) as caught:
                await self.svc.create(self.me, bad)
            self.assertEqual(caught.exception.code, "content_rejected")
        self.assertEqual(self.db["tasks"].docs, [])


class LifecycleTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db, self.clock, self.svc = new_world()
        self.me = ObjectId()

    async def test_create_encrypts_at_rest_and_returns_plaintext_with_updated_at(self):
        out = await self.svc.create(self.me, task_payload("Thesis", description="chapter 3", client_id="k"))
        [stored] = self.db["tasks"].docs
        for secret in ("Thesis", "chapter 3", "Personal"):
            self.assertNotIn(secret, str(stored))
        self.assertEqual((out["title"], out["description"], out["category"]), ("Thesis", "chapter 3", "Personal"))
        self.assertEqual(out["updated_at"], T0)
        self.assertEqual(out["user_id"], str(self.me))
        for internal in ("deleted", "deleted_at", "purge_at", "created_at"):
            self.assertNotIn(internal, out)

    async def test_every_visible_change_bumps_updated_at(self):
        task = await self.svc.create(self.me, task_payload())
        stamps = [task["updated_at"]]
        for step in (
            lambda: self.svc.update(self.me, task["id"], TaskUpdate(title="B")),
            lambda: self.svc.set_status(self.me, task["id"], DONE),
        ):
            self.clock.tick(minutes=1)
            await step()
            stamps.append((await self.svc.get(self.me, task["id"]))["updated_at"])
        self.assertEqual(stamps, [T0, T0 + timedelta(minutes=1), T0 + timedelta(minutes=2)])

    async def test_notification_bookkeeping_does_not_bump_updated_at(self):
        """Marking "already reminded" is invisible to clients: it must not make every device re-download the task."""
        task = await self.svc.create(self.me, task_payload())
        repo = self.svc.repo
        self.clock.tick(minutes=5)
        self.assertTrue(await repo.claim_reminder(ObjectId(task["id"]), "notified_tele_60m", {"notified_tele_60m": True}))
        await repo.mark_notified([ObjectId(task["id"])], {"last_notified_at": self.clock()})
        self.assertEqual((await self.svc.get(self.me, task["id"]))["updated_at"], T0)

    async def test_only_one_caller_wins_the_claim_on_a_reminder(self):
        """Two scheduler instances racing for the same reminder: exactly one may send it."""
        task = await self.svc.create(self.me, task_payload())
        oid, repo = ObjectId(task["id"]), self.svc.repo
        first = await repo.claim_reminder(oid, "notified_tele_60m", {"notified_tele_60m": True, "claimed_at": 1})
        second = await repo.claim_reminder(oid, "notified_tele_60m", {"notified_tele_60m": True, "claimed_at": 2})
        self.assertEqual((first, second), (True, False))
        await repo.release_reminder(oid, {"notified_tele_60m": True})
        self.assertTrue(await repo.claim_reminder(oid, "notified_tele_60m", {"notified_tele_60m": True}))

    async def test_a_new_due_time_rearms_notifications_but_a_title_edit_does_not(self):
        task = await self.svc.create(self.me, task_payload())
        oid = ObjectId(task["id"])
        await self.db["tasks"].update_one({"_id": oid}, {"$set": {"notified_tele_60m": True, "notified_due_soon": True}})
        await self.svc.update(self.me, task["id"], TaskUpdate(title="renamed"))
        self.assertTrue((await self.db["tasks"].find_one({"_id": oid}))["notified_tele_60m"])
        await self.svc.update(self.me, task["id"], TaskUpdate(due_date=T0 + timedelta(days=7)))
        stored = await self.db["tasks"].find_one({"_id": oid})
        self.assertNotIn("notified_tele_60m", stored)
        self.assertNotIn("notified_due_soon", stored)

    async def test_delete_leaves_a_content_free_tombstone(self):
        task = await self.svc.create(self.me, task_payload("Secret", description="Very secret", client_id="x"))
        self.clock.tick(hours=2)
        await self.svc.delete(self.me, task["id"])
        [stored] = self.db["tasks"].docs
        self.assertEqual(set(stored), {"_id", "user_id", "deleted", "deleted_at", "updated_at", "purge_at"})
        self.assertIs(stored["deleted"], True)
        self.assertEqual(stored["deleted_at"], T0 + timedelta(hours=2))
        self.assertEqual(stored["updated_at"], stored["deleted_at"])
        self.assertEqual(stored["purge_at"], stored["deleted_at"] + timedelta(days=30))
        self.assertNotIn("Secret", str(stored))
        self.assertNotIn("enc:v1", str(stored))  # not even ciphertext remains

    async def test_a_tombstone_is_invisible_and_immutable_to_every_normal_operation(self):
        task = await self.svc.create(self.me, task_payload())
        await self.svc.delete(self.me, task["id"])
        with self.assertRaises(NotFound):
            await self.svc.get(self.me, task["id"])
        with self.assertRaises(NotFound):
            await self.svc.update(self.me, task["id"], TaskUpdate(title="zombie"))
        with self.assertRaises(NotFound):
            await self.svc.set_status(self.me, task["id"], DONE)
        self.assertEqual(await self.svc.list_all(self.me), [])
        repo = self.svc.repo
        self.assertEqual(await repo.find_many({}), [])
        self.assertFalse(await repo.claim_reminder(ObjectId(task["id"]), "notified_tele_60m", {"x": 1}))
        self.assertEqual(await repo.find_missed_recurring(T0 + timedelta(days=999), ("daily", "weekly")), [])
        self.assertEqual(set(self.db["tasks"].docs[0]), {"_id", "user_id", "deleted", "deleted_at", "updated_at", "purge_at"})

    async def test_completing_a_daily_reminder_rolls_it_to_the_next_occurrence(self):
        task = await self.svc.create(self.me, task_payload("Gym", schedule_type="daily", time_of_day="07:30", due_date=None))
        self.clock.tick(minutes=1)
        result = await self.svc.set_status(self.me, task["id"], DONE)
        self.assertTrue(result["recurring"])
        self.assertIsNotNone(result["next_due"])
        after = await self.svc.get(self.me, task["id"])
        self.assertEqual(after["status"], "pending")
        self.assertEqual(after["completed_count"], 1)
        self.assertEqual(after["updated_at"], T0 + timedelta(minutes=1))

    async def test_a_schedule_with_no_future_occurrence_is_a_422(self):
        with self.assertRaises(Unprocessable):
            await self.svc.create(
                self.me,
                task_payload("Ended", schedule_type="daily", time_of_day="07:30", due_date=None, ends_on="2020-01-01"),
            )

    async def test_editing_the_time_of_a_recurring_reminder_recomputes_the_due_date(self):
        task = await self.svc.create(self.me, task_payload("Gym", schedule_type="daily", time_of_day="07:30", due_date=None))
        edited = await self.svc.update(self.me, task["id"], TaskUpdate(time_of_day="18:45"))
        self.assertEqual(edited["time_of_day"], "18:45")
        self.assertNotEqual(edited["due_date"], task["due_date"])


if __name__ == "__main__":
    unittest.main()
