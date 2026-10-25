"""MongoDB index definitions and the startup routine (audit finding A7).

Uses an in-memory fake database, so no MongoDB is needed. Run from the server folder:
    pytest tests/test_indexes.py     (or python -m unittest tests.test_indexes)
"""

import os
import sys
import unittest
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pymongo.errors import OperationFailure  # noqa: E402

from app.db.indexes import INDEX_SPECS, IndexSetupError, ensure_indexes, report_duplicates  # noqa: E402


class FakeCursor:
    def __init__(self, rows: list[dict[str, Any]]):
        self._rows = rows

    async def to_list(self, length: int | None = None) -> list[dict[str, Any]]:
        return self._rows[:length]


class FakeCollection:
    def __init__(self, name: str):
        self.name = name
        self.created: list[tuple[list[tuple[str, int]], dict[str, Any]]] = []
        self.fail_with: OperationFailure | None = None
        self.duplicates: list[dict[str, Any]] = []
        self.pipelines: list[list[dict[str, Any]]] = []

    async def create_index(self, keys: list[tuple[str, int]], **options: Any) -> str:
        if self.fail_with is not None:
            raise self.fail_with
        self.created.append((keys, options))
        return str(options["name"])

    async def aggregate(self, pipeline: list[dict[str, Any]]) -> FakeCursor:
        self.pipelines.append(pipeline)
        return FakeCursor(self.duplicates)


class FakeDB:
    def __init__(self) -> None:
        self.collections: dict[str, FakeCollection] = {}

    def __getitem__(self, name: str) -> FakeCollection:
        return self.collections.setdefault(name, FakeCollection(name))


def only(db: FakeDB, collection: str, name: str) -> tuple[list[tuple[str, int]], dict[str, Any]]:
    matches = [c for c in db[collection].created if c[1]["name"] == name]
    assert len(matches) == 1, f"{collection}.{name} created {len(matches)} times"
    return matches[0]


class IndexSpecTests(unittest.TestCase):
    def test_names_are_unique_per_collection(self):
        pairs = [(s.collection, s.name) for s in INDEX_SPECS]
        self.assertEqual(len(pairs), len(set(pairs)))

    def test_ttl_is_never_placed_on_the_users_collection(self):
        # A TTL index deletes whole documents: on `users` it would delete accounts.
        for spec in INDEX_SPECS:
            if spec.collection == "users":
                self.assertNotIn("expireAfterSeconds", spec.options, spec.name)


class EnsureIndexesTests(unittest.IsolatedAsyncioTestCase):
    async def test_creates_every_required_index(self):
        db = FakeDB()
        ensured = await ensure_indexes(db)
        self.assertEqual(len(ensured), len(INDEX_SPECS))

        keys, opts = only(db, "users", "uq_users_email")
        self.assertEqual(keys, [("email", 1)])
        self.assertIs(opts["unique"], True)

        self.assertEqual(only(db, "tasks", "ix_tasks_user_due")[0], [("user_id", 1), ("due_date", 1)])
        self.assertEqual(only(db, "tasks", "ix_tasks_status_due")[0], [("status", 1), ("due_date", 1)])

        keys, opts = only(db, "tasks", "uq_tasks_user_client")
        self.assertEqual(keys, [("user_id", 1), ("client_id", 1)])
        self.assertIs(opts["unique"], True)
        self.assertEqual(opts["partialFilterExpression"], {"client_id": {"$type": "string"}})

        keys, opts = only(db, "password_resets", "uq_password_resets_token_hash")
        self.assertEqual(keys, [("reset_token_hash", 1)])
        self.assertIs(opts["sparse"], True)

        keys, opts = only(db, "sessions", "uq_sessions_token_hash")
        self.assertEqual(keys, [("token_hash", 1)])
        self.assertIs(opts["unique"], True)
        self.assertEqual(only(db, "sessions", "ix_sessions_user")[0], [("user_id", 1)])
        self.assertEqual(only(db, "sessions", "ix_sessions_family")[0], [("family_id", 1)])
        keys, opts = only(db, "sessions", "ttl_sessions_expires")
        self.assertEqual(keys, [("expires_at", 1)])
        self.assertEqual(opts["expireAfterSeconds"], 0)
        self.assertEqual(
            only(db, "password_resets", "ix_password_resets_user_created")[0], [("user_id", 1), ("created_at", -1)]
        )

        keys, opts = only(db, "password_resets", "ttl_password_resets_expires")
        self.assertEqual(keys, [("reset_token_expires", 1)])
        self.assertEqual(opts["expireAfterSeconds"], 0)

    async def test_no_index_creation_touches_a_ttl_on_users(self):
        db = FakeDB()
        await ensure_indexes(db)
        for _keys, opts in db["users"].created:
            self.assertNotIn("expireAfterSeconds", opts)

    async def test_running_twice_is_safe(self):
        db = FakeDB()
        await ensure_indexes(db)
        await ensure_indexes(db)  # the real server treats identical definitions as a no-op

    async def test_duplicate_data_gives_an_actionable_error(self):
        db = FakeDB()
        db["users"].fail_with = OperationFailure("E11000 duplicate key", code=11000)
        db["users"].duplicates = [{"_id": "ana@example.org", "count": 2}]
        with self.assertRaises(IndexSetupError) as ctx:
            await ensure_indexes(db)
        message = str(ctx.exception)
        self.assertIn("users.uq_users_email", message)
        self.assertIn("ana@example.org x2", message)

    async def test_conflicting_existing_index_gives_an_actionable_error(self):
        db = FakeDB()
        db["tasks"].fail_with = OperationFailure("Index already exists with different options", code=85)
        with self.assertRaises(IndexSetupError) as ctx:
            await ensure_indexes(db)
        self.assertIn("dropIndexes", str(ctx.exception))

    async def test_other_database_errors_are_wrapped_not_swallowed(self):
        db = FakeDB()
        db["users"].fail_with = OperationFailure("not authorized", code=13)
        with self.assertRaises(IndexSetupError) as ctx:
            await ensure_indexes(db)
        self.assertIn("not authorized", str(ctx.exception))

    async def test_report_duplicates_only_lists_unique_indexes_with_findings(self):
        db = FakeDB()
        db["tasks"].duplicates = [{"_id": {"user_id": "u1", "client_id": "c1"}, "count": 3}]
        report = await report_duplicates(db)
        self.assertEqual(set(report), {"tasks.uq_tasks_user_client"})
        pipeline = db["tasks"].pipelines[0]
        self.assertEqual(pipeline[0], {"$match": {"client_id": {"$type": "string"}}})


if __name__ == "__main__":
    unittest.main()
