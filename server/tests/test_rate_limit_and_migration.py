"""Client-IP / rate-limit key logic (S5) and the e-mail normalisation migration."""

import io  # noqa: E402
import unittest
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import patch

from tests import auth_stubs  # noqa: F401  (must stay first: it prepares the test environment)

# isort: split

from bson import ObjectId  # noqa: E402
from PIL import Image  # noqa: E402
from starlette.requests import Request  # noqa: E402

from app.core import rate_limit  # noqa: E402
from scripts import normalize_emails, reencode_avatars  # noqa: E402
from tests.fake_db import FakeDb  # noqa: E402
from utils import security  # noqa: E402


def request(headers=None, host="198.51.100.7"):
    raw = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
    return Request({"type": "http", "method": "GET", "path": "/", "headers": raw, "client": (host, 1), "query_string": b""})


class ClientIpTests(unittest.TestCase):
    def with_hops(self, hops):
        return patch.object(rate_limit, "settings", SimpleNamespace(trusted_proxy_hops=hops))

    def test_forwarded_header_is_ignored_by_default(self):
        with self.with_hops(0):
            self.assertEqual(rate_limit.client_ip(request({"x-forwarded-for": "1.2.3.4"})), "198.51.100.7")

    def test_with_one_trusted_proxy_the_rightmost_entry_is_the_client(self):
        with self.with_hops(1):
            # a caller can prepend anything, but the proxy appends the real address last
            self.assertEqual(rate_limit.client_ip(request({"x-forwarded-for": "6.6.6.6, 1.2.3.4"})), "1.2.3.4")

    def test_two_hops(self):
        with self.with_hops(2):
            self.assertEqual(rate_limit.client_ip(request({"x-forwarded-for": "9.9.9.9, 1.2.3.4, 10.0.0.1"})), "1.2.3.4")

    def test_missing_short_or_invalid_headers_fall_back_to_the_socket_address(self):
        with self.with_hops(2):
            for header in (None, "1.2.3.4", "not-an-ip, also-bad"):
                headers = {"x-forwarded-for": header} if header else {}
                self.assertEqual(rate_limit.client_ip(request(headers)), "198.51.100.7", header)

    def test_ipv6_is_normalised(self):
        with self.with_hops(1):
            self.assertEqual(rate_limit.client_ip(request({"x-forwarded-for": "2001:DB8:0:0:0:0:0:1"})), "2001:db8::1")


class KeyTests(unittest.TestCase):
    def test_valid_bearer_token_is_counted_per_user_everything_else_per_ip(self):
        token = security.create_access_token(user_id="a" * 24, token_version=0, session_id="sid")
        self.assertEqual(rate_limit.rate_limit_key(request({"authorization": f"Bearer {token}"})), "user:" + "a" * 24)
        self.assertEqual(rate_limit.rate_limit_key(request({"authorization": "Bearer forged.token.here"})), "ip:198.51.100.7")
        self.assertEqual(rate_limit.rate_limit_key(request()), "ip:198.51.100.7")

    def test_ip_key_ignores_authorization_entirely(self):
        token = security.create_access_token(user_id="a" * 24, token_version=0, session_id="sid")
        self.assertEqual(rate_limit.ip_key(request({"authorization": f"Bearer {token}"})), "ip:198.51.100.7")

    def test_limits_come_from_settings(self):
        self.assertEqual(rate_limit.Limits.login, "5/minute")
        self.assertEqual(rate_limit.Limits.signup, "5/hour")
        self.assertEqual(rate_limit.Limits.forgot_password, "3/hour")
        self.assertEqual(rate_limit.Limits.magic_add, "10/hour")


class NormalizeEmailsTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = FakeDb()
        self.ids = {}
        for name, email, extra in (
            ("mixed", "Ricky@Gmail.com", {"reset_token": "old", "reset_token_expires": datetime.now(UTC)}),
            ("spaces", "  Spaced@Example.com ", {}),
            ("fine", "fine@example.com", {}),
            ("dup1", "Twin@example.com", {}),
            ("dup2", "twin@Example.com", {}),
        ):
            doc = {"_id": ObjectId(), "email": email, **extra}
            self.ids[name] = doc["_id"]
            await self.db["users"].insert_one(doc)

    async def test_plan_finds_renames_collisions_and_legacy_fields(self):
        renames, collisions, legacy = await normalize_emails.plan(self.db)
        self.assertEqual({new for _, _, new in renames}, {"ricky@gmail.com", "spaced@example.com"})
        self.assertEqual(set(collisions), {"twin@example.com"})
        self.assertEqual(len(collisions["twin@example.com"]), 2)
        self.assertEqual(legacy, 1)

    async def test_apply_changes_only_what_is_safe(self):
        renames, _, _ = await normalize_emails.plan(self.db)
        await normalize_emails.apply(self.db, renames)
        emails = {d["email"] for d in self.db["users"].docs}
        self.assertEqual(emails, {"ricky@gmail.com", "spaced@example.com", "fine@example.com", "Twin@example.com", "twin@Example.com"})
        self.assertTrue(all("reset_token" not in d for d in self.db["users"].docs))
        self.assertEqual(len(self.db["users"].docs), 5)  # nothing is ever deleted
        renames_again, _, legacy = await normalize_emails.plan(self.db)
        self.assertEqual((renames_again, legacy), ([], 0))  # idempotent


class ReencodeAvatarsTests(unittest.IsolatedAsyncioTestCase):
    @staticmethod
    def png():
        buffer = io.BytesIO()
        Image.new("RGB", (500, 300), (5, 90, 200)).save(buffer, format="PNG")
        return buffer.getvalue()

    async def asyncSetUp(self):
        self.db = FakeDb()
        self.good, self.bad = str(ObjectId()), str(ObjectId())
        await self.db["avatars"].insert_one({"_id": self.good, "data": self.png(), "content_type": "image/png"})
        await self.db["avatars"].insert_one({"_id": self.bad, "data": b"<svg onload=alert(1)>", "content_type": "image/svg+xml"})
        await self.db["users"].insert_one({"_id": ObjectId(self.bad), "avatar_url": f"/uploads/avatars/{self.bad}?v=1"})

    async def test_dry_run_changes_nothing(self):
        counts = await reencode_avatars.run(self.db, apply=False, delete_invalid=True)
        self.assertEqual((counts["reencoded"], counts["invalid"], counts["deleted"]), (1, 1, 0))
        self.assertEqual((await self.db["avatars"].find_one({"_id": self.good}))["content_type"], "image/png")
        self.assertIsNotNone(await self.db["avatars"].find_one({"_id": self.bad}))

    async def test_apply_reencodes_and_is_idempotent(self):
        await reencode_avatars.run(self.db, apply=True, delete_invalid=False)
        doc = await self.db["avatars"].find_one({"_id": self.good})
        self.assertEqual(doc["content_type"], "image/webp")
        self.assertEqual(bytes(doc["data"])[8:12], b"WEBP")
        self.assertIsNotNone(await self.db["avatars"].find_one({"_id": self.bad}))  # invalid ones stay unless asked
        again = await reencode_avatars.run(self.db, apply=True, delete_invalid=False)
        self.assertEqual(again["already_clean"], 1)

    async def test_delete_invalid_removes_the_row_and_the_users_avatar_url(self):
        counts = await reencode_avatars.run(self.db, apply=True, delete_invalid=True)
        self.assertEqual(counts["deleted"], 1)
        self.assertIsNone(await self.db["avatars"].find_one({"_id": self.bad}))
        self.assertIsNone((await self.db["users"].find_one({"_id": ObjectId(self.bad)}))["avatar_url"])


if __name__ == "__main__":
    unittest.main()
