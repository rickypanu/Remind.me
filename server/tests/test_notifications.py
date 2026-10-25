"""Reminder delivery: ONE implementation for both channels, batching, bounded concurrency, claims (A2, A3, A4, P5)."""

import asyncio
import unittest
from datetime import timedelta
from unittest.mock import patch

from tests import auth_stubs  # noqa: F401  (must stay first: it prepares the test environment)

# isort: split

from bson import ObjectId  # noqa: E402

from app.integrations.telegram import Outcome  # noqa: E402
from app.integrations.webpush import PushOutcome  # noqa: E402
from app.notifications import jobs, rules  # noqa: E402
from app.notifications.dispatch import Delivery, Notifier  # noqa: E402
from app.notifications.scheduler import DIGEST_HOURS, start_scheduler  # noqa: E402
from tests.fake_db import FakeCollection, FakeDb  # noqa: E402
from utils.recurrence import NOTIFICATION_FLAGS  # noqa: E402
from utils.task_store import to_storage  # noqa: E402
from utils.timezone import ist_day_bounds_utc, now_utc  # noqa: E402


class FakeTelegram:
    def __init__(self, enabled=True, outcome=Outcome.SENT):
        self.enabled, self.outcome, self.sent = enabled, outcome, []

    async def send(self, chat_id, title, body="", *, reply_markup=None):
        self.sent.append((str(chat_id), title, body))
        return self.outcome


class FakePush:
    def __init__(self, enabled=True):
        self.enabled, self.outcomes, self.sent = enabled, {}, []

    async def send(self, subscription, title, body):
        endpoint = subscription.get("endpoint")
        self.sent.append((endpoint, title, body))
        return self.outcomes.get(endpoint, PushOutcome.SENT)


def task_doc(user_id, due, title="Submit report", **extra):
    doc = {"_id": ObjectId(), "user_id": user_id, "status": "pending", "due_date": due, "schedule_type": "once", **extra}
    doc.update(to_storage(user_id, {"title": title, "description": None, "category": "Assignment"}))
    return doc


class Base(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = FakeDb()
        self.tg, self.push = FakeTelegram(), FakePush()
        self.n = Notifier(self.db, self.tg, self.push, concurrency=4)
        self.uid = ObjectId()
        await self.db["users"].insert_one(
            {"_id": self.uid, "telegram_chat_id": "42", "push_subscriptions": [{"endpoint": "https://fcm.googleapis.com/a", "keys": {}}]}
        )
        # the AI is never needed: force the template wording
        p = patch("app.notifications.messages._ai_copy", side_effect=RuntimeError("no ai in tests"))
        p.start()
        self.addCleanup(p.stop)

    async def add_task(self, minutes=9, **extra):
        doc = task_doc(extra.pop("user_id", self.uid), now_utc() + timedelta(minutes=minutes), **extra)
        await self.db["tasks"].insert_one(doc)
        return doc["_id"]

    async def task(self, task_id):
        return await self.db["tasks"].find_one({"_id": task_id})


class DueSoonTests(Base):
    async def test_each_channel_sends_once(self):
        task_id = await self.add_task(9)
        await jobs.remind_upcoming_tasks(self.n)
        await jobs.remind_upcoming_tasks(self.n)  # the next minute: nothing new
        self.assertEqual(len(self.tg.sent), 1)
        self.assertEqual(len(self.push.sent), 1)
        task = await self.task(task_id)
        self.assertTrue(task["notified_tele_10m"] and task["notified_web_10m"])

    async def test_title_is_encrypted_at_rest_and_readable_in_the_message(self):
        task_id = await self.add_task(9)
        self.assertNotEqual((await self.task(task_id))["title"], "Submit report")
        await jobs.remind_upcoming_tasks(self.n)
        self.assertIn("Submit report", self.tg.sent[0][2])

    async def test_only_tasks_inside_a_window_are_reminded(self):
        await self.add_task(30)
        await self.add_task(120)
        await jobs.remind_upcoming_tasks(self.n)
        self.assertEqual((self.tg.sent, self.push.sent), ([], []))

    async def test_completed_tasks_are_skipped(self):
        await self.add_task(9, status="completed")
        await jobs.remind_upcoming_tasks(self.n)
        self.assertEqual(self.tg.sent, [])

    async def test_one_hour_reminder_sets_the_digest_cooldown_marks(self):
        task_id = await self.add_task(58)
        await jobs.remind_upcoming_tasks(self.n)
        task = await self.task(task_id)
        self.assertTrue(task["notified_tele_60m"] and task["notified_due_soon"])
        self.assertIn("last_notified_at", task)

    async def test_ten_minute_reminder_does_not_touch_the_cooldown(self):
        task_id = await self.add_task(9)
        await jobs.remind_upcoming_tasks(self.n)
        self.assertNotIn("last_notified_at", await self.task(task_id))

    async def test_legacy_flag_blocks_the_one_hour_reminder(self):
        await self.add_task(58, notified_due_soon=True, notified_due_soon_web=True)
        await jobs.remind_upcoming_tasks(self.n)
        self.assertEqual((self.tg.sent, self.push.sent), ([], []))

    async def test_channels_are_independent(self):
        await self.add_task(9, notified_web_10m=True)
        await jobs.remind_upcoming_tasks(self.n)
        self.assertEqual((len(self.tg.sent), len(self.push.sent)), (1, 0))

    async def test_unconfigured_channel_is_not_used_or_claimed(self):
        self.push.enabled = False
        task_id = await self.add_task(9)
        await jobs.remind_upcoming_tasks(self.n)
        self.assertEqual(len(self.tg.sent), 1)
        self.assertNotIn("notified_web_10m", await self.task(task_id))  # still available once push is configured

    async def test_two_workers_running_together_send_one_message(self):
        await self.add_task(9)
        await asyncio.gather(jobs.remind_upcoming_tasks(self.n), jobs.remind_upcoming_tasks(self.n), jobs.remind_upcoming_tasks(self.n))
        self.assertEqual((len(self.tg.sent), len(self.push.sent)), (1, 1))

    async def test_a_temporary_failure_gives_the_claim_back(self):
        task_id = await self.add_task(9)
        self.tg.outcome = Outcome.TRANSIENT
        await jobs.remind_upcoming_tasks(self.n)
        self.assertNotIn("notified_tele_10m", await self.task(task_id))
        self.assertIn("notified_web_10m", await self.task(task_id))  # the channel that worked keeps its mark
        self.tg.outcome = Outcome.SENT
        await jobs.remind_upcoming_tasks(self.n)
        self.assertEqual(len(self.tg.sent), 2)  # one failed attempt + the retry
        self.assertTrue((await self.task(task_id))["notified_tele_10m"])

    async def test_a_permanent_failure_is_not_retried(self):
        self.tg.outcome = Outcome.PERMANENT
        task_id = await self.add_task(9)
        await jobs.remind_upcoming_tasks(self.n)
        await jobs.remind_upcoming_tasks(self.n)
        self.assertEqual(len(self.tg.sent), 1)
        self.assertTrue((await self.task(task_id))["notified_tele_10m"])

    async def test_a_user_without_telegram_is_skipped_quietly(self):
        other = ObjectId()
        await self.db["users"].insert_one({"_id": other})
        await self.add_task(9, user_id=other)
        await jobs.remind_upcoming_tasks(self.n)
        self.assertEqual((self.tg.sent, self.push.sent), ([], []))

    async def test_a_task_with_a_not_yet_migrated_string_user_id_is_still_delivered(self):
        await self.add_task(9, user_id=str(self.uid))
        await jobs.remind_upcoming_tasks(self.n)
        self.assertEqual(len(self.tg.sent), 1)

    async def test_a_task_whose_user_id_is_garbage_does_not_crash_the_run(self):
        await self.add_task(9, user_id="not-an-id")
        good = await self.add_task(9)
        with self.assertLogs("notifier", "WARNING"):
            await jobs.remind_upcoming_tasks(self.n)
        self.assertEqual(len(self.tg.sent), 1)  # the good task was still delivered
        self.assertTrue((await self.task(good))["notified_tele_10m"])

    async def test_one_exploding_delivery_does_not_stop_the_others(self):
        await self.add_task(9)
        await self.add_task(9)
        calls = {"n": 0}
        original = self.tg.send

        async def flaky(*a, **k):
            calls["n"] += 1
            if calls["n"] == 1:
                raise RuntimeError("boom")
            return await original(*a, **k)

        self.tg.send = flaky
        with self.assertLogs("notifier", "ERROR"):
            await jobs.remind_upcoming_tasks(self.n)
        self.assertEqual(len(self.tg.sent), 1)


class BatchingTests(Base):
    async def test_users_are_loaded_with_one_query_not_one_per_task(self):
        users = []
        for _ in range(10):
            uid = ObjectId()
            users.append(uid)
            await self.db["users"].insert_one({"_id": uid, "telegram_chat_id": str(uid)[:6]})
        for uid in users:
            for _ in range(3):
                await self.add_task(9, user_id=uid)
        finds = []
        original = FakeCollection.find

        def counting(coll, flt=None, projection=None):
            if flt and "_id" in flt and "$in" in flt["_id"] and coll is self.db["users"]:
                finds.append(len(flt["_id"]["$in"]))
            return original(coll, flt, projection)

        with patch.object(FakeCollection, "find", counting):
            await jobs.remind_upcoming_tasks(self.n)
        self.assertEqual(finds, [10])
        self.assertEqual(len(self.tg.sent), 30)

    async def test_large_batches_are_split_into_chunks(self):
        ids = [ObjectId() for _ in range(1200)]
        self.db["users"].docs.extend({"_id": i, "telegram_chat_id": "1"} for i in ids)
        chunks = []
        original = FakeCollection.find

        def counting(coll, flt=None, projection=None):
            if flt and "_id" in flt and "$in" in flt["_id"]:
                chunks.append(len(flt["_id"]["$in"]))
            return original(coll, flt, projection)

        with patch.object(FakeCollection, "find", counting):
            loaded = await self.n.load_users(ids + ids[:50])  # duplicates collapse
        self.assertEqual(len(loaded), 1200)
        self.assertEqual(chunks, [500, 500, 200])

    async def test_invalid_ids_are_dropped_with_a_warning(self):
        with self.assertLogs("notifier", "WARNING"):
            loaded = await self.n.load_users([self.uid, "abc", None, 5, str(self.uid)])
        self.assertEqual(list(loaded), [self.uid])
        self.assertEqual(await self.n.load_users([]), {})


class ConcurrencyTests(Base):
    async def test_never_more_than_the_limit_in_flight(self):
        active = {"now": 0, "max": 0}

        async def work():
            active["now"] += 1
            active["max"] = max(active["max"], active["now"])
            await asyncio.sleep(0.005)
            active["now"] -= 1
            return 1

        results = await self.n.run_bounded((work() for _ in range(40)), "test")
        self.assertEqual(sum(results), 40)
        self.assertEqual(active["max"], 4)

    async def test_exceptions_are_logged_and_do_not_cancel_the_rest(self):
        async def ok():
            return "ok"

        async def bad():
            raise ValueError("nope")

        with self.assertLogs("notifier", "ERROR") as logs:
            results = await self.n.run_bounded([ok(), bad(), ok()], "unit")
        self.assertEqual(results[0], "ok")
        self.assertIsInstance(results[1], ValueError)
        self.assertEqual(results[2], "ok")
        self.assertIn("unit", logs.output[0])

    async def test_slot_lock_has_one_winner(self):
        results = await asyncio.gather(*(self.n.claim_slot("digest", "2026-10-21-08") for _ in range(6)))
        self.assertEqual(results.count(True), 1)
        self.assertTrue(await self.n.claim_slot("digest", "2026-10-21-09"))
        self.assertTrue(await self.n.claim_slot("other", "2026-10-21-08"))
        self.assertIn("expires_at", self.db["scheduler_locks"].docs[0])  # so the TTL index can clean it up


class PushDeliveryTests(Base):
    async def test_dead_and_invalid_subscriptions_are_removed_failed_ones_kept(self):
        subs = [{"endpoint": f"https://fcm.googleapis.com/{name}", "keys": {}} for name in ("ok", "gone", "bad", "flaky")]
        await self.db["users"].update_one({"_id": self.uid}, {"$set": {"push_subscriptions": subs}})
        self.push.outcomes = {
            subs[1]["endpoint"]: PushOutcome.GONE, subs[2]["endpoint"]: PushOutcome.INVALID, subs[3]["endpoint"]: PushOutcome.FAILED,
        }
        user = await self.db["users"].find_one({"_id": self.uid})
        self.assertIs(await self.n.send_push(user, "t", "b"), Delivery.SENT)
        kept = [s["endpoint"] for s in (await self.db["users"].find_one({"_id": self.uid}))["push_subscriptions"]]
        self.assertEqual(kept, [subs[0]["endpoint"], subs[3]["endpoint"]])

    async def test_all_failed_is_a_failure_and_nothing_is_a_skip(self):
        user = await self.db["users"].find_one({"_id": self.uid})
        self.push.outcomes = {user["push_subscriptions"][0]["endpoint"]: PushOutcome.FAILED}
        self.assertIs(await self.n.send_push(user, "t", "b"), Delivery.FAILED)
        self.assertIs(await self.n.send_push({"_id": self.uid}, "t", "b"), Delivery.SKIPPED)

    async def test_endpoint_is_not_logged_when_removed(self):
        user = await self.db["users"].find_one({"_id": self.uid})
        endpoint = user["push_subscriptions"][0]["endpoint"]
        self.push.outcomes = {endpoint: PushOutcome.GONE}
        with self.assertLogs("notifier", "INFO") as logs:
            await self.n.send_push(user, "t", "b")
        self.assertNotIn(endpoint, "\n".join(logs.output))


class DigestTests(Base):
    def tomorrow(self, hours=12):
        start, _ = ist_day_bounds_utc(1)
        return start + timedelta(hours=hours)

    def today(self, hours=12):
        start, _ = ist_day_bounds_utc(0)
        return start + timedelta(hours=hours)

    async def test_today_digest_once_per_hour_slot_even_with_two_workers(self):
        await self.db["tasks"].insert_one(task_doc(self.uid, self.today()))
        await asyncio.gather(jobs.digest_today(self.n, "tele"), jobs.digest_today(self.n, "tele"))
        self.assertEqual(len(self.tg.sent), 1)
        await jobs.digest_today(self.n, "web")
        self.assertEqual(len(self.push.sent), 1)

    async def test_today_digest_skips_tasks_that_just_had_an_urgent_warning(self):
        await self.db["tasks"].insert_one(task_doc(self.uid, self.today(), last_notified_at=now_utc() - timedelta(minutes=10)))
        await jobs.digest_today(self.n, "tele")
        self.assertEqual(self.tg.sent, [])

    async def test_tomorrow_digest_marks_tasks_and_does_not_repeat(self):
        task = task_doc(self.uid, self.tomorrow())
        await self.db["tasks"].insert_one(task)
        await jobs.digest_tomorrow(self.n, "tele")
        self.assertEqual(len(self.tg.sent), 1)
        self.assertTrue((await self.task(task["_id"]))["notified_tomorrow_digest"])
        self.db["scheduler_locks"].docs.clear()  # a later slot
        await jobs.digest_tomorrow(self.n, "tele")
        self.assertEqual(len(self.tg.sent), 1)

    async def test_web_tomorrow_digest_does_not_use_the_telegram_flag(self):
        await self.db["tasks"].insert_one(task_doc(self.uid, self.tomorrow(), notified_tomorrow_digest=True))
        await jobs.digest_tomorrow(self.n, "web")
        self.assertEqual(len(self.push.sent), 1)

    async def test_digest_groups_all_of_a_users_tasks_into_one_message(self):
        for hour in (10, 12, 14):
            await self.db["tasks"].insert_one(task_doc(self.uid, self.tomorrow(hour), title=f"Task {hour}"))
        await jobs.digest_tomorrow(self.n, "tele")
        self.assertEqual(len(self.tg.sent), 1)
        self.assertEqual(self.tg.sent[0][2].count("•"), 3)

    async def test_unconfigured_channel_does_nothing(self):
        self.push.enabled = False
        await self.db["tasks"].insert_one(task_doc(self.uid, self.tomorrow()))
        await jobs.digest_tomorrow(self.n, "web")
        self.assertEqual(self.db["scheduler_locks"].docs, [])


class RollMissedTests(Base):
    async def test_missed_recurring_task_rolls_forward_and_flags_are_cleared(self):
        due = now_utc() - timedelta(hours=5)
        doc = task_doc(self.uid, due, schedule_type="daily", time_of_day="09:00", notified_tele_10m=True, notified_web_10m=True)
        await self.db["tasks"].insert_one(doc)
        self.assertEqual(await jobs.roll_missed_recurring_tasks(self.n), 1)
        task = await self.task(doc["_id"])
        self.assertGreater(task["due_date"], now_utc())
        self.assertNotIn("notified_tele_10m", task)
        self.assertEqual(task["missed_count"], 1)

    async def test_recent_and_one_off_tasks_are_left_alone(self):
        await self.db["tasks"].insert_one(task_doc(self.uid, now_utc() - timedelta(hours=1), schedule_type="daily", time_of_day="09:00"))
        await self.db["tasks"].insert_one(task_doc(self.uid, now_utc() - timedelta(hours=9)))
        self.assertEqual(await jobs.roll_missed_recurring_tasks(self.n), 0)


class RulesAndSchedulerTests(Base):
    def test_derived_flags_cover_everything_the_old_tuple_did(self):
        old = {
            "notified_due_soon", "notified_due_soon_web", "notified_tomorrow_digest", "last_notified_at",
            "notified_tele_60m", "notified_tele_10m", "notified_tele_1m",
            "notified_web_60m", "notified_web_10m", "notified_web_1m",
        }
        self.assertEqual(set(NOTIFICATION_FLAGS), old)
        self.assertEqual(len(NOTIFICATION_FLAGS), len(old))
        self.assertEqual(set(rules.NOTIFICATION_FLAGS), old)

    def test_scheduler_registers_jobs_for_configured_channels_only(self):
        scheduler = start_scheduler(self.n)
        ids = sorted(j["id"] for j in scheduler.jobs)
        self.assertEqual(ids, ["due_soon", "roll_missed", "today_tele", "today_web", "tomorrow_tele", "tomorrow_web"])
        self.assertTrue(scheduler.started)
        for job in scheduler.jobs:
            self.assertEqual((job["max_instances"], job["coalesce"]), (1, True))
        self.push.enabled = False
        ids = sorted(j["id"] for j in start_scheduler(self.n).jobs)
        self.assertEqual(ids, ["due_soon", "roll_missed", "today_tele", "tomorrow_tele"])
        self.assertEqual(DIGEST_HOURS["tele"]["today"], "8,17,21,23")

    async def test_a_failing_job_is_logged_not_raised(self):
        from app.notifications.scheduler import _safe

        async def explode(*_):
            raise RuntimeError("db down")

        with self.assertLogs("scheduler", "ERROR"):
            await _safe("x", explode, 1)()


if __name__ == "__main__":
    unittest.main()
