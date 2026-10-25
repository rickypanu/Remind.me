"""Completion streaks, the /v1/tasks/stats numbers, IST output, slow-request logging and IST log timestamps."""

import json
import logging
import unittest
from datetime import date, datetime, timedelta

from tests import auth_stubs  # noqa: F401  (must stay first: it prepares the test environment)

# isort: split

from bson import ObjectId  # noqa: E402

from app.core.logging_config import ISTFormatter  # noqa: E402
from app.core.timing import TimingMiddleware  # noqa: E402
from app.repositories import CompletionRepository  # noqa: E402
from app.services.users import UserService  # noqa: E402
from schemas.task import TaskResponse, TaskStatsResponse, TaskStatusUpdate, TaskSyncPage  # noqa: E402
from tests.helpers import T0, Clock, new_world, task_payload  # noqa: E402
from utils.streak import best_streak, current_streak  # noqa: E402
from utils.task_store import shape_response  # noqa: E402
from utils.timezone import IST, UTC  # noqa: E402

DONE = TaskStatusUpdate(status="completed")
OPEN = TaskStatusUpdate(status="pending")
D = lambda day: date(2026, 10, day)  # noqa: E731


class StreakMathTests(unittest.TestCase):
    def test_no_history(self):
        self.assertEqual((current_streak(set(), D(24)), best_streak(set())), (0, 0))

    def test_run_ending_today(self):
        self.assertEqual(current_streak({D(22), D(23), D(24)}, D(24)), 3)

    def test_run_ending_yesterday_is_still_alive(self):
        self.assertEqual(current_streak({D(21), D(22), D(23)}, D(24)), 3)

    def test_two_quiet_days_end_it(self):
        self.assertEqual(current_streak({D(21), D(22)}, D(24)), 0)

    def test_a_gap_stops_the_count(self):
        self.assertEqual(current_streak({D(20), D(22), D(23), D(24)}, D(24)), 3)

    def test_best_streak_is_the_longest_run(self):
        self.assertEqual(best_streak({D(1), D(2), D(3), D(10), D(11)}), 3)
        self.assertEqual(best_streak({D(5)}), 1)

    def test_month_boundary(self):
        self.assertEqual(current_streak({date(2026, 10, 31), date(2026, 11, 1)}, date(2026, 11, 1)), 2)


class StatsServiceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        # 2026-10-20 10:00 UTC = 15:30 IST
        self.db, self.clock, self.svc = new_world()
        self.me = ObjectId()

    async def complete_new(self, title):
        task = await self.svc.create(self.me, task_payload(title))
        await self.svc.set_status(self.me, task["id"], DONE)
        return task

    async def test_fresh_user_has_nothing(self):
        self.assertEqual(await self.svc.stats(self.me), {"streak": 0, "best_streak": 0, "completed_today": 0})

    async def test_completing_counts_today(self):
        await self.complete_new("a")
        await self.complete_new("b")
        self.assertEqual(await self.svc.stats(self.me), {"streak": 1, "best_streak": 1, "completed_today": 2})

    async def test_consecutive_days_build_a_streak(self):
        for _ in range(3):
            await self.complete_new("daily win")
            self.clock.tick(days=1)
        self.assertEqual((await self.svc.stats(self.me))["streak"], 3)  # tomorrow has no completion yet: still alive
        self.clock.tick(days=1)
        self.assertEqual((await self.svc.stats(self.me))["streak"], 0)  # a full day of silence

    async def test_days_are_ist_days_not_utc_days(self):
        # 18:29 UTC on the 20th is 23:59 IST on the 20th; 18:31 UTC is 00:01 IST on the 21st.
        self.clock.now = datetime(2026, 10, 20, 18, 29, tzinfo=UTC)
        await self.complete_new("late")
        self.clock.now = datetime(2026, 10, 20, 18, 31, tzinfo=UTC)
        await self.complete_new("just after midnight IST")
        self.assertEqual(await self.svc.stats(self.me), {"streak": 2, "best_streak": 2, "completed_today": 1})
        days = sorted(d["day"] for d in self.db["completions"].docs)
        self.assertEqual(days, ["2026-10-20", "2026-10-21"])

    async def test_reopening_takes_the_completion_back(self):
        task = await self.complete_new("oops")
        await self.svc.set_status(self.me, task["id"], OPEN)
        self.assertEqual(await self.svc.stats(self.me), {"streak": 0, "best_streak": 0, "completed_today": 0})

    async def test_completing_twice_counts_once(self):
        task = await self.complete_new("once")
        await self.svc.set_status(self.me, task["id"], DONE)
        self.assertEqual((await self.svc.stats(self.me))["completed_today"], 1)

    async def test_a_recurring_completion_counts(self):
        task = await self.svc.create(self.me, task_payload("Gym", schedule_type="daily", time_of_day="18:00", due_date=None))
        await self.svc.set_status(self.me, task["id"], DONE)
        self.assertEqual((await self.svc.stats(self.me))["completed_today"], 1)

    async def test_stats_are_private_to_each_user(self):
        await self.complete_new("mine")
        self.assertEqual((await self.svc.stats(ObjectId()))["completed_today"], 0)

    async def test_completed_at_is_stamped_and_cleared(self):
        task = await self.complete_new("stamp")
        stored = self.db["tasks"].docs[0]
        self.assertEqual(stored["completed_at"], T0)
        await self.svc.set_status(self.me, task["id"], OPEN)
        self.assertNotIn("completed_at", self.db["tasks"].docs[0])

    async def test_a_failure_to_record_never_fails_the_completion(self):
        async def boom(*_a, **_k):
            raise RuntimeError("completions collection down")

        self.svc.completions.add = boom
        task = await self.svc.create(self.me, task_payload("x"))
        result = await self.svc.set_status(self.me, task["id"], DONE)
        self.assertEqual(result["message"], "Task updated successfully")

    async def test_deleting_the_account_removes_the_history(self):
        await self.complete_new("bye")
        await self.db["users"].insert_one({"_id": self.me, "email": "a@b.co"})
        await UserService(self.db).delete_account(self.me)
        self.assertEqual(await CompletionRepository(self.db).recent(self.me), {})
        self.assertEqual(self.db["completions"].docs, [])

    async def test_response_model_accepts_the_stats_dict(self):
        await self.complete_new("x")
        TaskStatsResponse(**await self.svc.stats(self.me))


class IstOutputTests(unittest.IsolatedAsyncioTestCase):
    async def test_api_timestamps_are_written_in_ist(self):
        db, clock, svc = new_world()
        me = ObjectId()
        task = await svc.create(me, task_payload("x", due_date=datetime(2026, 10, 25, 12, 0, tzinfo=UTC)))
        body = json.loads(TaskResponse(**task).model_dump_json())
        self.assertEqual(body["due_date"], "2026-10-25T17:30:00+05:30")
        self.assertTrue(body["updated_at"].endswith("+05:30"))

        page = await svc.list_changes(me)
        out = json.loads(TaskSyncPage(**page.__dict__).model_dump_json())
        self.assertTrue(out["server_time"].endswith("+05:30"))
        self.assertTrue(all(i["due_date"].endswith("+05:30") for i in out["items"]))

    async def test_python_mode_dump_keeps_real_datetimes(self):
        db, clock, svc = new_world()
        task = await svc.create(ObjectId(), task_payload("x"))
        self.assertIsInstance(TaskResponse(**task).model_dump()["due_date"], datetime)

    async def test_naive_input_is_ist_and_is_stored_as_the_matching_utc_instant(self):
        db, clock, svc = new_world()
        task = await svc.create(ObjectId(), task_payload("x", due_date=datetime(2026, 10, 25, 9, 0)))
        stored = db["tasks"].docs[0]["due_date"]
        self.assertEqual(stored, datetime(2026, 10, 25, 3, 30, tzinfo=UTC))
        self.assertEqual(task["due_date"], stored)


class LoggingTests(unittest.TestCase):
    def test_log_lines_carry_ist_timestamps(self):
        record = logging.LogRecord("t", logging.INFO, __file__, 1, "hello", (), None)
        record.created = datetime(2026, 10, 24, 18, 30, tzinfo=UTC).timestamp()
        line = ISTFormatter("%(asctime)s %(message)s").format(record)
        self.assertEqual(line, "2026-10-25T00:00:00.000+05:30 hello")  # 18:30 UTC is midnight in IST


async def run_asgi(middleware, status=200):
    sent = []

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        sent.append(message)

    await middleware({"type": "http", "method": "GET", "path": "/v1/tasks", "headers": []}, receive, send)
    return sent


class TimingMiddlewareTests(unittest.IsolatedAsyncioTestCase):
    @staticmethod
    def app(status=200):
        async def inner(scope, receive, send):
            await send({"type": "http.response.start", "status": status, "headers": []})
            await send({"type": "http.response.body", "body": b"{}"})

        return inner

    async def test_adds_a_server_timing_header(self):
        sent = await run_asgi(TimingMiddleware(self.app(), slow_ms=10_000))
        headers = dict(sent[0]["headers"])
        self.assertRegex(headers[b"server-timing"].decode(), r"^app;dur=\d+$")

    async def test_logs_only_slow_requests(self):
        with self.assertLogs("timing", level="WARNING") as caught:
            await run_asgi(TimingMiddleware(self.app(), slow_ms=0))
        self.assertIn("Slow request: GET /v1/tasks -> 200", caught.output[0])
        with self.assertNoLogs("timing", level="WARNING"):
            await run_asgi(TimingMiddleware(self.app(), slow_ms=60_000))

    async def test_websocket_scopes_pass_through(self):
        calls = []

        async def inner(scope, receive, send):
            calls.append(scope["type"])

        await TimingMiddleware(inner)({"type": "lifespan"}, None, None)
        self.assertEqual(calls, ["lifespan"])


if __name__ == "__main__":
    unittest.main()
