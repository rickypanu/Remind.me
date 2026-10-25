"""Token revocation across every way a session can end (T2.3), and the rate-limit building blocks (finding S5).

The real 429 behaviour (slowapi counting requests) is exercised over HTTP in tests/api/test_rate_limiting.py, which
needs FastAPI + slowapi installed. Here: what decides WHO is counted, and that the limits are sane and configured.
"""

import re
import unittest
from datetime import UTC, datetime, timedelta

from tests import auth_stubs  # noqa: F401  (must stay first: it prepares the test environment)

# isort: split

from bson import ObjectId  # noqa: E402
from starlette.requests import Request  # noqa: E402

from app.api import deps  # noqa: E402
from app.core import rate_limit  # noqa: E402
from app.core.errors import Unauthorized  # noqa: E402
from app.core.rate_limit import Limits, ip_key, rate_limit_exceeded_handler, rate_limit_key  # noqa: E402
from app.services.auth import AuthService  # noqa: E402
from app.services.users import UserService  # noqa: E402
from tests.fake_db import FakeDb  # noqa: E402
from utils import security  # noqa: E402

PASSWORD = "Tr0ub4dor&Horse"


def request_with(headers=None, host="203.0.113.9") -> Request:
    raw = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
    return Request({"type": "http", "method": "POST", "path": "/", "headers": raw, "client": (host, 1234), "query_string": b""})


class RevocationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = FakeDb()
        self.auth = AuthService(self.db)
        await self.auth.signup(username="ricky", email="ricky@example.com", password=PASSWORD)
        self.user = self.db["users"].docs[0]

    async def login(self, agent="phone"):
        return await self.auth.login("ricky@example.com", PASSWORD, agent)

    async def alive(self, result) -> bool:
        try:
            await deps.get_current_user(token=result["access_token"], db=self.db)
            return True
        except Unauthorized:
            return False

    async def test_a_fresh_login_works(self):
        self.assertTrue(await self.alive(await self.login()))

    async def test_logout_revokes_only_that_device_immediately(self):
        phone, laptop = await self.login("phone"), await self.login("laptop")
        await self.auth.logout(phone["refresh_token"])
        self.assertFalse(await self.alive(phone))
        self.assertTrue(await self.alive(laptop))
        with self.assertRaises(Unauthorized):
            await self.auth.refresh(phone["refresh_token"], None)

    async def test_logout_all_revokes_every_access_and_refresh_token(self):
        devices = [await self.login(name) for name in ("a", "b", "c")]
        await self.auth.logout_all(self.user["_id"])
        for device in devices:
            self.assertFalse(await self.alive(device))
            with self.assertRaises(Unauthorized):
                await self.auth.refresh(device["refresh_token"], None)
        self.assertEqual(self.db["sessions"].docs, [])
        self.assertEqual((await self.db["users"].find_one({"_id": self.user["_id"]}))["token_version"], 1)
        self.assertTrue(await self.alive(await self.login()))  # a NEW login after "log out everywhere" works

    async def test_replaying_a_spent_refresh_token_kills_the_whole_family_and_its_access_token(self):
        first = await self.login()
        second = await self.auth.refresh(first["refresh_token"], None)
        self.assertTrue(await self.alive(second))
        for doc in self.db["sessions"].docs:  # past the 10-second benign-race window
            if doc["used_at"]:
                doc["used_at"] -= timedelta(minutes=5)
        with self.assertRaises(Unauthorized) as caught:
            await self.auth.refresh(first["refresh_token"], None)  # the thief replays the stolen, already-used token
        self.assertEqual(caught.exception.headers, {"WWW-Authenticate": "Bearer"})
        self.assertFalse(await self.alive(second))  # the victim's current access token dies with the family
        with self.assertRaises(Unauthorized):
            await self.auth.refresh(second["refresh_token"], None)

    async def test_a_password_change_revokes_tokens_issued_before_it(self):
        old = await self.login()
        await deps.UserRepository(self.db).set_password(self.user["_id"], security.get_password_hash("N3w!Passw0rd"), revoke_tokens=True)
        self.assertFalse(await self.alive(old))
        with self.assertRaises(Unauthorized):
            await self.auth.refresh(old["refresh_token"], None)

    async def test_deleting_the_account_revokes_everything(self):
        token = await self.login()
        await UserService(self.db).delete_account(self.user["_id"])
        self.assertFalse(await self.alive(token))
        with self.assertRaises(Unauthorized):
            await self.auth.refresh(token["refresh_token"], None)
        self.assertEqual((self.db["sessions"].docs, self.db["users"].docs), ([], []))

    async def test_an_access_token_is_not_accepted_as_a_refresh_token_or_the_other_way_round(self):
        token = await self.login()
        with self.assertRaises(Unauthorized):
            await self.auth.refresh(token["access_token"], None)
        with self.assertRaises(Unauthorized):
            await deps.get_current_user(token=token["refresh_token"], db=self.db)

    async def test_refresh_keeps_the_session_id_so_one_logout_covers_every_rotation(self):
        first = await self.login()
        second = await self.auth.refresh(first["refresh_token"], None)
        self.assertEqual(security.decode_access_token(first["access_token"])["sid"], security.decode_access_token(second["access_token"])["sid"])
        await self.auth.logout(second["refresh_token"])
        self.assertFalse(await self.alive(first))  # even the OLD access token of that session is dead

    async def test_a_token_whose_user_id_is_a_foreign_account_never_authenticates_as_it(self):
        other = await self.auth.signup(username="other", email="other@example.com", password=PASSWORD)
        self.assertIsNone(other)
        mine = await self.login()
        claims = security.decode_access_token(mine["access_token"])
        forged = security.create_access_token(user_id=str(self.db["users"].docs[1]["_id"]), token_version=0, session_id=claims["sid"])
        with self.assertRaises(Unauthorized):  # my session id does not belong to the other account
            await deps.get_current_user(token=forged, db=self.db)

    async def test_expired_access_token_is_rejected(self):
        import jwt

        from app.core.config import get_settings

        now = datetime.now(UTC)
        claims = security.decode_access_token((await self.login())["access_token"])
        expired = jwt.encode(
            {**claims, "iat": now - timedelta(hours=2), "exp": now - timedelta(hours=1)},
            get_settings().secret_key.get_secret_value(),
            algorithm="HS256",
        )
        with self.assertRaises(Unauthorized):
            await deps.get_current_user(token=expired, db=self.db)


class RateLimitKeyTests(unittest.TestCase):
    def token(self, user_id):
        return security.create_access_token(user_id=str(user_id), token_version=0, session_id="sid")

    def test_login_style_routes_are_always_counted_per_ip_whatever_the_headers_say(self):
        victim = ObjectId()
        for headers in ({}, {"authorization": f"Bearer {self.token(victim)}"}, {"authorization": "Bearer junk"}, {"x-forwarded-for": "1.2.3.4"}):
            with self.subTest(headers=list(headers)):
                self.assertEqual(ip_key(request_with(headers)), "ip:203.0.113.9")

    def test_an_attacker_cannot_dodge_the_limit_by_rotating_bogus_tokens(self):
        keys = {rate_limit_key(request_with({"authorization": f"Bearer junk-{n}"})) for n in range(50)}
        self.assertEqual(keys, {"ip:203.0.113.9"})

    def test_signed_in_users_behind_one_address_are_counted_separately(self):
        a, b = ObjectId(), ObjectId()
        key_a = rate_limit_key(request_with({"authorization": f"Bearer {self.token(a)}"}))
        key_b = rate_limit_key(request_with({"authorization": f"Bearer {self.token(b)}"}))
        self.assertNotEqual(key_a, key_b)
        self.assertEqual(key_a, f"user:{a}")

    def test_the_same_user_on_two_networks_shares_one_budget(self):
        a = ObjectId()
        headers = {"authorization": f"Bearer {self.token(a)}"}
        self.assertEqual(rate_limit_key(request_with(headers, host="198.51.100.1")), rate_limit_key(request_with(headers, host="192.0.2.77")))

    def test_a_forged_token_is_counted_as_an_ip_not_as_the_victim(self):
        forged = self.token(ObjectId())[:-3] + "AAA"
        self.assertTrue(rate_limit_key(request_with({"authorization": f"Bearer {forged}"})).startswith("ip:"))

    def test_every_limit_string_is_well_formed_and_login_is_stricter_than_the_default(self):
        pattern = re.compile(r"^(\d+)/(second|minute|hour|day)$")
        per_minute = {"second": 60, "minute": 1, "hour": 1 / 60, "day": 1 / 1440}
        rates = {}
        for name in ("login", "signup", "forgot_password", "reset_password", "refresh", "magic_add", "avatar", "telegram_link", "admin"):
            match = pattern.match(getattr(Limits, name))
            self.assertIsNotNone(match, name)
            rates[name] = int(match.group(1)) * per_minute[match.group(2)]
        default = pattern.match(rate_limit.settings.rate_limit_default)
        self.assertIsNotNone(default)
        self.assertLess(rates["login"], int(default.group(1)) * per_minute[default.group(2)])
        self.assertLess(rates["forgot_password"], rates["login"])  # sending e-mail is the most expensive thing to repeat

    def test_the_429_answer_is_json_with_retry_after(self):
        import asyncio

        class Exceeded(Exception):
            detail = "5 per 1 minute"

        response = asyncio.run(rate_limit_exceeded_handler(request_with(), Exceeded()))
        self.assertEqual(response.status_code, 429)
        self.assertEqual({k.lower(): v for k, v in dict(response.headers).items()}["retry-after"], "60")


if __name__ == "__main__":
    unittest.main()
