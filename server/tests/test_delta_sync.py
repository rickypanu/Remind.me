"""Delta sync (finding P2): GET /v1/tasks with ``cursor`` / ``since`` / ``limit``, tombstones, paging and convergence."""

import base64
import random
import unittest
from datetime import UTC, datetime, timedelta

from tests import auth_stubs  # noqa: F401  (must stay first: it prepares the test environment)

# isort: split

from bson import ObjectId  # noqa: E402

from app.core.clock import now_ms, truncate_ms  # noqa: E402
from app.core.errors import BadRequest, Gone, Unprocessable  # noqa: E402
from app.repositories import TaskRepository  # noqa: E402
from app.services.tasks import SyncPage, TaskService, decode_cursor, encode_cursor  # noqa: E402
from schemas.task import TaskSyncPage, TaskUpdate  # noqa: E402
from tests.fake_db import FakeDb  # noqa: E402
from tests.helpers import T0, Clock, new_world, task_payload  # noqa: E402

RETENTION = timedelta(days=30)
SAFETY = timedelta(seconds=5)


async def drain(svc: TaskService, user, *, cursor=None, since=None, limit=None, max_pages=100) -> list[SyncPage]:
    """Follow ``next_cursor`` while ``has_more``, like a client does within one sync run."""
    pages = []
    while True:
        page = await svc.list_changes(user, cursor=cursor, since=since, limit=limit)
        pages.append(page)
        cursor, since = page.next_cursor, None
        if not page.has_more:
            return pages
        assert len(pages) < max_pages, "paging did not terminate"


class CursorTests(unittest.TestCase):
    def test_round_trip(self):
        oid = ObjectId()
        for snapshot in (True, False):
            cursor = encode_cursor((T0 + timedelta(milliseconds=7), oid), snapshot=snapshot)
            (moment, decoded), flag = decode_cursor(cursor)
            self.assertEqual((moment, decoded, flag), (T0 + timedelta(milliseconds=7), oid, snapshot))

    def test_the_cursor_is_url_safe_and_unpadded(self):
        cursor = encode_cursor((T0, ObjectId()), snapshot=False)
        self.assertRegex(cursor, r"^[A-Za-z0-9_-]+$")
        self.assertLess(len(cursor), 100)

    def test_garbage_is_a_400_with_a_stable_code(self):
        def b64(text: str) -> str:
            return base64.urlsafe_b64encode(text.encode()).decode().rstrip("=")

        good_oid = str(ObjectId())
        bad = [
            "", "x", "not a cursor", "////", "a" * 101, b64("d.123"), b64(f"x.123.{good_oid}"), b64(f"d.abc.{good_oid}"),
            b64(f"d.-1.{good_oid}"), b64("d.123.nothex"), b64(f"d.99999999999999999.{good_oid}"), b64(f"d.1.2.{good_oid}"),
            "ééé", b64("d.123." + "f" * 25),
        ]
        for value in bad:
            with self.subTest(value=value[:30]), self.assertRaises(BadRequest) as caught:
                decode_cursor(value)
            self.assertEqual(caught.exception.code, "invalid_cursor")
            self.assertEqual(caught.exception.status_code, 400)

    def test_now_ms_has_millisecond_precision_and_is_utc(self):
        stamp = now_ms()
        self.assertEqual(stamp.microsecond % 1000, 0)
        self.assertEqual(stamp.utcoffset(), timedelta(0))
        self.assertEqual(truncate_ms(datetime(2026, 1, 1, 0, 0, 0, 123999, tzinfo=UTC)).microsecond, 123000)


class FeedBasicsTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db, self.clock, self.svc = new_world()
        self.me = ObjectId()

    async def make(self, count, *, gap_seconds=1):
        ids = []
        for n in range(count):
            ids.append((await self.svc.create(self.me, task_payload(f"task {n}")))["id"])
            self.clock.tick(seconds=gap_seconds)
        return ids

    async def test_first_call_is_a_snapshot_of_live_reminders(self):
        ids = await self.make(3)
        await self.svc.delete(self.me, ids[1])
        page = await self.svc.list_changes(self.me)
        self.assertTrue(page.snapshot)
        self.assertFalse(page.has_more)
        self.assertEqual([t["title"] for t in page.items], ["task 0", "task 2"])
        self.assertEqual(page.deleted, [])  # a snapshot has no tombstones: the client prunes what it did not see
        self.assertEqual(page.server_time, self.clock())

    async def test_snapshot_pages_cover_everything_once_in_order(self):
        ids = await self.make(5)
        pages = await drain(self.svc, self.me, limit=2)
        self.assertEqual([len(p.items) for p in pages], [2, 2, 1])
        self.assertEqual([p.has_more for p in pages], [True, True, False])
        self.assertTrue(all(p.snapshot for p in pages))
        self.assertEqual([t["id"] for p in pages for t in p.items], ids)

    async def test_the_final_cursor_is_a_delta_cursor_lagging_now_by_the_safety_window(self):
        await self.make(2)
        page = (await drain(self.svc, self.me))[-1]
        (moment, _), snapshot = decode_cursor(page.next_cursor)
        self.assertFalse(snapshot)
        self.assertEqual(moment, self.clock() - SAFETY)

    async def test_many_changes_in_the_same_millisecond_still_page_without_loss_or_repeats(self):
        ids = [(await self.svc.create(self.me, task_payload(f"t{n}")))["id"] for n in range(7)]  # clock never moves
        for limit in (1, 2, 3, 7, 8):
            with self.subTest(limit=limit):
                pages = await drain(self.svc, self.me, limit=limit)
                seen = [t["id"] for p in pages for t in p.items]
                self.assertEqual(sorted(seen), sorted(ids))
                self.assertEqual(len(seen), len(set(seen)))

    async def test_a_poll_with_nothing_new_is_empty_and_the_cursor_never_moves_backwards(self):
        await self.make(2)
        last = (await drain(self.svc, self.me))[-1]
        self.clock.tick(seconds=30)
        last = await self.svc.list_changes(self.me, cursor=last.next_cursor)  # may repeat the last few seconds
        previous = decode_cursor(last.next_cursor)[0][0]
        for _ in range(4):
            self.clock.tick(seconds=30)
            poll = await self.svc.list_changes(self.me, cursor=last.next_cursor)
            self.assertEqual((poll.items, poll.deleted, poll.has_more, poll.snapshot), ([], [], False, False))
            current = decode_cursor(poll.next_cursor)[0][0]
            self.assertGreaterEqual(current, previous)
            last, previous = poll, current

    async def test_a_cursor_ahead_of_the_server_clock_is_never_moved_backwards(self):
        """A device whose cursor is newer than "now - safety window" (clock jump, restored backup) must keep it."""
        await self.make(1)
        future = encode_cursor((self.clock() + timedelta(hours=1), ObjectId("0" * 24)), snapshot=False)
        poll = await self.svc.list_changes(self.me, cursor=future)
        self.assertGreaterEqual(decode_cursor(poll.next_cursor)[0][0], self.clock() + timedelta(hours=1))

    async def test_updates_and_deletes_arrive_as_items_and_tombstones(self):
        ids = await self.make(3)
        cursor = (await drain(self.svc, self.me))[-1].next_cursor
        self.clock.tick(minutes=1)
        await self.svc.update(self.me, ids[0], TaskUpdate(title="renamed"))
        await self.svc.set_status(self.me, ids[1], __import__("schemas.task", fromlist=["x"]).TaskStatusUpdate(status="completed"))
        await self.svc.delete(self.me, ids[2])
        self.clock.tick(minutes=1)
        page = await self.svc.list_changes(self.me, cursor=cursor)
        self.assertEqual({t["id"]: (t["title"], t["status"]) for t in page.items}, {ids[0]: ("renamed", "pending"), ids[1]: ("task 1", "completed")})
        self.assertEqual([d["id"] for d in page.deleted], [ids[2]])
        self.assertIsNotNone(page.deleted[0]["deleted_at"])
        self.assertNotIn("title", page.deleted[0])  # a tombstone carries no content
        self.assertFalse(page.snapshot)

    async def test_the_overlap_window_resends_very_recent_changes_once_and_that_is_harmless(self):
        await self.svc.create(self.me, task_payload("fresh"))
        first = await self.svc.list_changes(self.me)
        again = await self.svc.list_changes(self.me, cursor=first.next_cursor)
        self.assertEqual([t["title"] for t in again.items], ["fresh"])  # inside the 5 s window: sent again
        self.clock.tick(seconds=10)
        third = await self.svc.list_changes(self.me, cursor=again.next_cursor)
        self.assertEqual([t["title"] for t in third.items], ["fresh"])  # the cursor it holds still predates the change
        fourth = await self.svc.list_changes(self.me, cursor=third.next_cursor)
        self.assertEqual(fourth.items, [])  # now the cursor is past it: the overlap is over

    async def test_a_write_stamped_slightly_in_the_past_but_committed_after_the_poll_is_not_lost(self):
        """Another server with a slow clock, or a slow commit: the doc gets an older ``updated_at`` than a poll that
        already happened. The safety window keeps the cursor behind it."""
        first = await self.svc.list_changes(self.me)
        self.clock.tick(seconds=1)
        slow_clock = Clock(self.clock() - timedelta(seconds=3))
        await TaskRepository(self.db, clock=slow_clock).insert(self.me, {"title": "late", "category": "Other", "status": "pending", "due_date": T0, "schedule_type": "once"})
        page = await self.svc.list_changes(self.me, cursor=first.next_cursor)
        self.assertEqual([t["title"] for t in page.items], ["late"])

    async def test_since_is_inclusive_and_treats_naive_datetimes_as_utc(self):
        await self.make(4)  # updated_at = T0, T0+1s, T0+2s, T0+3s
        page = await self.svc.list_changes(self.me, since=T0 + timedelta(seconds=2))
        self.assertEqual([t["title"] for t in page.items], ["task 2", "task 3"])
        self.assertFalse(page.snapshot)
        naive = await self.svc.list_changes(self.me, since=(T0 + timedelta(seconds=2)).replace(tzinfo=None))
        self.assertEqual([t["title"] for t in naive.items], ["task 2", "task 3"])
        micro = await self.svc.list_changes(self.me, since=T0 + timedelta(seconds=2, microseconds=999))
        self.assertEqual([t["title"] for t in micro.items], ["task 2", "task 3"])  # truncated to the millisecond

    async def test_since_includes_tombstones(self):
        ids = await self.make(2)
        self.clock.tick(minutes=1)
        await self.svc.delete(self.me, ids[0])
        page = await self.svc.list_changes(self.me, since=T0 + timedelta(minutes=1))
        self.assertEqual([d["id"] for d in page.deleted], [ids[0]])

    async def test_since_and_cursor_together_are_a_422(self):
        with self.assertRaises(Unprocessable) as caught:
            await self.svc.list_changes(self.me, since=T0, cursor=encode_cursor((T0, ObjectId()), snapshot=False))
        self.assertEqual(caught.exception.code, "since_and_cursor")

    async def test_limit_is_clamped(self):
        await self.make(12)
        db, clock = FakeDb(), Clock()
        small = TaskService(TaskRepository(db, clock=clock), clock=clock, default_page_size=5, max_page_size=8)
        for n in range(12):
            await small.create(self.me, task_payload(f"s{n}"))
        self.assertEqual(len((await small.list_changes(self.me)).items), 5)  # default
        self.assertEqual(len((await small.list_changes(self.me, limit=1000)).items), 8)  # capped
        self.assertEqual(len((await small.list_changes(self.me, limit=-3)).items), 1)  # at least one
        self.assertEqual(len((await small.list_changes(self.me, limit=0)).items), 5)  # 0 means "default"

    async def test_the_page_matches_the_public_response_model(self):
        ids = await self.make(2)
        await self.svc.delete(self.me, ids[0])
        cursor = (await self.svc.list_changes(self.me, limit=1)).next_cursor
        page = await self.svc.list_changes(self.me, since=T0)
        model = TaskSyncPage(**page.__dict__)
        self.assertEqual(len(model.items), 1)
        self.assertEqual(model.deleted[0].id, ids[0])
        self.assertTrue(model.next_cursor and cursor)
        self.assertEqual(model.items[0].updated_at, T0 + timedelta(seconds=1))

    async def test_the_feed_is_scoped_to_one_user(self):
        await self.make(2)
        other = ObjectId()
        await self.svc.create(other, task_payload("not mine"))
        for page in await drain(self.svc, self.me, limit=1):
            self.assertNotIn("not mine", [t["title"] for t in page.items])
        self.assertEqual([t["title"] for t in (await self.svc.list_changes(other)).items], ["not mine"])


class RetentionTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db, self.clock, self.svc = new_world()
        self.me = ObjectId()

    async def test_a_cursor_older_than_the_retention_needs_a_full_resync(self):
        await self.svc.create(self.me, task_payload())
        cursor = (await self.svc.list_changes(self.me)).next_cursor
        self.clock.tick(days=30, seconds=10)
        with self.assertRaises(Gone) as caught:
            await self.svc.list_changes(self.me, cursor=cursor)
        self.assertEqual((caught.exception.status_code, caught.exception.code), (410, "full_resync_required"))

    async def test_exactly_at_the_retention_boundary_is_still_served(self):
        await self.svc.create(self.me, task_payload())
        cursor = (await self.svc.list_changes(self.me)).next_cursor
        moment = decode_cursor(cursor)[0][0]
        self.clock.now = moment + RETENTION
        page = await self.svc.list_changes(self.me, cursor=cursor)
        self.assertFalse(page.snapshot)

    async def test_an_old_since_needs_a_full_resync_too(self):
        self.clock.tick(days=45)
        with self.assertRaises(Gone):
            await self.svc.list_changes(self.me, since=T0)

    async def test_after_a_410_a_fresh_snapshot_works(self):
        await self.svc.create(self.me, task_payload("kept"))
        cursor = (await self.svc.list_changes(self.me)).next_cursor
        self.clock.tick(days=60)
        with self.assertRaises(Gone):
            await self.svc.list_changes(self.me, cursor=cursor)
        page = await self.svc.list_changes(self.me)
        self.assertEqual([t["title"] for t in page.items], ["kept"])
        self.assertTrue(page.snapshot)

    async def test_a_snapshot_in_progress_is_not_expired_by_the_retention_rule(self):
        for n in range(3):
            await self.svc.create(self.me, task_payload(f"t{n}"))
        first = await self.svc.list_changes(self.me, limit=1)
        self.clock.tick(days=40)  # a very slow download
        second = await self.svc.list_changes(self.me, cursor=first.next_cursor, limit=1)
        self.assertTrue(second.snapshot)
        self.assertEqual(len(second.items), 1)

    async def test_retention_is_longer_than_any_sync_interval_the_server_accepts(self):
        """The invariant that makes tombstones safe to purge: a delete is purged (``purge_at``) only AFTER the last
        moment a cursor that predates it would still be accepted."""
        ids = []
        for n in range(2):
            ids.append((await self.svc.create(self.me, task_payload(f"t{n}")))["id"])
        client_cursor = (await self.svc.list_changes(self.me)).next_cursor
        self.clock.tick(days=1)
        await self.svc.delete(self.me, ids[0])
        [tombstone] = [d for d in self.db["tasks"].docs if d.get("deleted")]
        last_accepted = decode_cursor(client_cursor)[0][0] + RETENTION
        self.assertGreaterEqual(tombstone["purge_at"], last_accepted)
        # The client shows up just before its cursor expires: it still receives the tombstone.
        self.clock.now = last_accepted
        page = await self.svc.list_changes(self.me, cursor=client_cursor)
        self.assertEqual([d["id"] for d in page.deleted], [ids[0]])
        # Once the TTL index has removed the tombstone, that same stale cursor is refused instead of silently wrong.
        self.clock.now = tombstone["purge_at"] + timedelta(seconds=1)
        self.db["tasks"].docs = [d for d in self.db["tasks"].docs if not (d.get("purge_at") and d["purge_at"] < self.clock())]
        with self.assertRaises(Gone):
            await self.svc.list_changes(self.me, cursor=client_cursor)


class FakeClient:
    """What the PWA's sync.js does with the feed. ``prune`` is the snapshot rule: forget what the snapshot lacked."""

    def __init__(self):
        self.tasks: dict[str, dict] = {}
        self.cursor: str | None = None
        self._seen_in_snapshot: set[str] = set()

    def apply(self, page: SyncPage) -> None:
        if page.snapshot:
            self._seen_in_snapshot.update(t["id"] for t in page.items)
        for item in page.items:
            self.tasks[item["id"]] = item
        for gone in page.deleted:
            self.tasks.pop(gone["id"], None)
        if page.snapshot and not page.has_more:
            for stale in set(self.tasks) - self._seen_in_snapshot:
                del self.tasks[stale]
            self._seen_in_snapshot = set()
        self.cursor = page.next_cursor

    async def sync(self, svc: TaskService, user, *, limit=None) -> None:
        while True:
            try:
                page = await svc.list_changes(user, cursor=self.cursor, limit=limit)
            except Gone:
                self.cursor = None  # full resync
                continue
            self.apply(page)
            if not page.has_more:
                return


def word(rng: random.Random) -> str:
    """A title made of letters only (digits would be read as leetspeak by the moderation filter)."""
    return "zq" + "".join(chr(97 + int(d)) for d in str(rng.randrange(10**6)))


class ConvergenceTests(unittest.IsolatedAsyncioTestCase):
    """Whatever happens on the server and however the client pages, after a final sync the client equals the server."""

    async def run_scenario(self, seed: int):
        rng = random.Random(seed)
        db, clock, svc = new_world()
        me = ObjectId()
        clients = [FakeClient(), FakeClient()]
        live: dict[str, str] = {}
        for _step in range(60):
            clock.tick(milliseconds=rng.choice([0, 0, 1, 700, 2000, 9000]))
            action = rng.choices(["create", "update", "complete", "delete", "sync"], [4, 3, 2, 2, 3])[0]
            if action == "create" or not live:
                task = await svc.create(me, task_payload(word(rng)))
                live[task["id"]] = task["title"]
            elif action == "update":
                tid = rng.choice(sorted(live))
                live[tid] = word(rng)
                await svc.update(me, tid, TaskUpdate(title=live[tid]))
            elif action == "complete":
                tid = rng.choice(sorted(live))
                await svc.set_status(me, tid, __import__("schemas.task", fromlist=["x"]).TaskStatusUpdate(status="completed"))
            elif action == "delete":
                tid = rng.choice(sorted(live))
                await svc.delete(me, tid)
                del live[tid]
            else:
                await rng.choice(clients).sync(svc, me, limit=rng.choice([1, 2, 3, 50]))
        clock.tick(seconds=30)
        for client in clients:
            await client.sync(svc, me, limit=rng.choice([1, 4, 200]))
            self.assertEqual({tid: t["title"] for tid, t in client.tasks.items()}, live, f"seed {seed}")

    async def test_many_random_histories_converge(self):
        for seed in range(40):
            with self.subTest(seed=seed):
                await self.run_scenario(seed)

    async def test_a_client_that_was_away_longer_than_the_retention_converges_after_a_full_resync(self):
        db, clock, svc = new_world()
        me = ObjectId()
        keep = await svc.create(me, task_payload("keep"))
        drop = await svc.create(me, task_payload("drop"))
        client = FakeClient()
        await client.sync(svc, me)
        self.assertEqual(set(client.tasks), {keep["id"], drop["id"]})
        clock.tick(days=1)
        await svc.delete(me, drop["id"])
        clock.tick(days=45)  # the tombstone is purged by MongoDB's TTL index in the meantime
        db["tasks"].docs = [d for d in db["tasks"].docs if not (d.get("purge_at") and d["purge_at"] < clock())]
        await client.sync(svc, me)  # 410 -> snapshot -> prune
        self.assertEqual(set(client.tasks), {keep["id"]})

    async def test_a_delete_that_happens_while_a_snapshot_is_downloading_is_not_resurrected(self):
        db, clock, svc = new_world()
        me = ObjectId()
        ids = [(await svc.create(me, task_payload(f"t{n}")))["id"] for n in range(4)]
        client = FakeClient()
        first = await svc.list_changes(me, limit=2)
        client.apply(first)
        clock.tick(seconds=10)
        await svc.delete(me, ids[3])  # not yet downloaded
        await svc.delete(me, ids[0])  # already downloaded
        await client.sync(svc, me, limit=2)
        await client.sync(svc, me, limit=2)
        self.assertEqual(set(client.tasks), {ids[1], ids[2]})


if __name__ == "__main__":
    unittest.main()
