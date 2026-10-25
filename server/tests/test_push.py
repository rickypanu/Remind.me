"""Web Push: SSRF allow-list, subscription cap and routes, sending (finding S4)."""

import unittest
from unittest.mock import patch

from tests import auth_stubs  # noqa: F401  (must stay first: it prepares the test environment)

# isort: split

from bson import ObjectId  # noqa: E402
from pydantic import ValidationError  # noqa: E402

from app.api import legacy  # noqa: E402
from app.api.v1 import webpush as routes  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.core.errors import AppError  # noqa: E402
from app.integrations.webpush import (  # noqa: E402
    PushEndpointError,
    PushOutcome,
    PushSubscription,
    WebPushSender,
    validate_push_endpoint,
)
from app.services.push import PushService  # noqa: E402
from schemas.notification import SubscriptionPayload, UnsubscribePayload  # noqa: E402
from tests.fake_db import FakeDb  # noqa: E402

KEYS = {"p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", "auth": "tBHItJI5svbpez7KI4CCXg"}
GOOD = [
    "https://fcm.googleapis.com/fcm/send/abc:APA91b",
    "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
    "https://web.push.apple.com/QGxyz",
    "https://fcm.googleapis.com:443/fcm/send/abc",
    "https://FCM.GoogleAPIs.com/fcm/send/abc",
    "https://db5p.notify.windows.com/?token=abc",
]
BAD = [
    "http://fcm.googleapis.com/fcm/send/abc",  # not https
    "https://169.254.169.254/latest/meta-data",
    "https://127.0.0.1/",
    "https://localhost/",
    "https://[::1]/",
    "https://10.0.0.5:443/",
    "https://fcm.googleapis.com.evil.com/x",  # suffix trick
    "https://evilfcm.googleapis.com/x",
    "https://evil.com/fcm.googleapis.com",
    "https://evil.com/?u=https://fcm.googleapis.com/",
    "https://fcm.googleapis.com@evil.com/x",  # userinfo trick
    "https://fcm.googleapis.com:443@evil.com/x",
    "https://evil.com#@fcm.googleapis.com/",
    "https://evil.com\\@fcm.googleapis.com/",
    "https://fcm.googleapis.com:8443/x",  # port
    "https://fcm.googleapis.com./x",  # trailing dot
    "https://fcm.googleapis.com /x",  # space
    "https://fcm.googleapis.com\n.evil.com/",
    "https://fcm.googleapis.com\t@evil.com/",
    "https://fcm.googleаpis.com/x",  # Cyrillic a
    "https://notify.windows.com/",  # bare suffix without a subdomain
    "https://evilnotify.windows.com/",
    "https://x.notify.windows.com.evil.com/",
    "ftp://fcm.googleapis.com/x",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "//fcm.googleapis.com/x",
    "",
    "https://" + "a" * 3000 + ".com/",
]


class ValidatorTests(unittest.TestCase):
    def test_real_push_services_pass(self):
        for url in GOOD:
            with self.subTest(url=url):
                self.assertEqual(validate_push_endpoint(url, allow_windows=True), url)

    def test_everything_else_fails(self):
        for url in BAD:
            with self.subTest(url=url):
                with self.assertRaises(PushEndpointError):
                    validate_push_endpoint(url, allow_windows=True)

    def test_windows_can_be_switched_off(self):
        with self.assertRaises(PushEndpointError):
            validate_push_endpoint("https://db5p.notify.windows.com/?token=abc", allow_windows=False)
        validate_push_endpoint("https://fcm.googleapis.com/x", allow_windows=False)

    def test_non_strings_fail(self):
        for value in (None, 5, b"https://fcm.googleapis.com/x", ["https://fcm.googleapis.com/x"]):
            with self.assertRaises(PushEndpointError):
                validate_push_endpoint(value, allow_windows=True)  # type: ignore[arg-type]

    def test_model_rejects_bad_endpoint_keys_and_extra_fields(self):
        PushSubscription(endpoint=GOOD[0], keys=KEYS)
        with self.assertRaises(ValidationError):
            PushSubscription(endpoint="https://169.254.169.254/", keys=KEYS)
        with self.assertRaises(ValidationError):
            PushSubscription(endpoint=GOOD[0], keys={"p256dh": "short", "auth": "x"})
        with self.assertRaises(ValidationError):
            PushSubscription(endpoint=GOOD[0], keys=KEYS, evil="x")

    def test_storage_keeps_only_endpoint_and_keys(self):
        sub = PushSubscription(endpoint=GOOD[0], keys=KEYS, expirationTime=123.0)
        self.assertEqual(sub.to_storage(), {"endpoint": GOOD[0], "keys": KEYS})


def ep(n: int) -> str:
    return f"https://fcm.googleapis.com/fcm/send/device-{n}"


def payload(n: int, keys=None):
    return SubscriptionPayload(subscription=PushSubscription(endpoint=ep(n), keys=keys or KEYS))


class SubscribeTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = FakeDb()
        self.uid = ObjectId()
        await self.db["users"].insert_one({"_id": self.uid})
        self.me = self.uid
        self.cap = get_settings().max_push_subscriptions
        self.push = PushService(self.db, cap=self.cap)

    async def subs(self):
        return (await self.db["users"].find_one({"_id": self.uid})).get("push_subscriptions", [])

    async def test_register_and_idempotent(self):
        out = await routes.subscribe(payload(1), self.me, self.push)
        self.assertEqual(out["status"], "success")
        await routes.subscribe(payload(1), self.me, self.push)
        self.assertEqual(len(await self.subs()), 1)

    async def test_same_device_with_new_keys_updates_in_place(self):
        await routes.subscribe(payload(1), self.me, self.push)
        new_keys = {"p256dh": "B" + "x" * 40, "auth": "newauthvalue1234"}
        out = await routes.subscribe(payload(1, new_keys), self.me, self.push)
        subs = await self.subs()
        self.assertEqual(len(subs), 1)
        self.assertEqual(subs[0]["keys"], new_keys)
        self.assertEqual(out["message"], "Subscription updated.")

    async def test_cap_is_enforced(self):
        for n in range(self.cap):
            await routes.subscribe(payload(n), self.me, self.push)
        with self.assertRaises(AppError) as caught:
            await routes.subscribe(payload(999), self.me, self.push)
        self.assertEqual(caught.exception.status_code, 409)
        self.assertEqual(len(await self.subs()), self.cap)
        # an existing device can still refresh its keys at the cap
        await routes.subscribe(payload(0), self.me, self.push)
        self.assertEqual(len(await self.subs()), self.cap)

    async def test_never_touches_another_user(self):
        other = ObjectId()
        await self.db["users"].insert_one({"_id": other})
        await routes.subscribe(payload(1), self.me, self.push)
        self.assertNotIn("push_subscriptions", await self.db["users"].find_one({"_id": other}))

    async def test_unknown_user_is_not_created(self):
        with self.assertRaises(AppError):
            await routes.subscribe(payload(1), ObjectId(), self.push)
        self.assertEqual(len(self.db["users"].docs), 1)  # no upsert, no shadow user

    async def test_unsubscribe_one_device_and_all(self):
        for n in range(3):
            await routes.subscribe(payload(n), self.me, self.push)
        await routes.unsubscribe(self.me, self.push, UnsubscribePayload(endpoint=ep(1)))
        self.assertEqual([s["endpoint"] for s in await self.subs()], [ep(0), ep(2)])
        await legacy.unsubscribe_legacy("whatever", self.me, self.push, UnsubscribePayload(subscription={"endpoint": ep(0)}))
        self.assertEqual([s["endpoint"] for s in await self.subs()], [ep(2)])
        await routes.unsubscribe(self.me, self.push, None)
        self.assertNotIn("push_subscriptions", await self.db["users"].find_one({"_id": self.uid}))
        with self.assertRaises(AppError) as caught:
            await routes.unsubscribe(self.me, self.push, None)
        self.assertEqual(caught.exception.status_code, 404)

    async def test_legacy_unsubscribe_ignores_the_user_id_in_the_path(self):
        other = ObjectId()
        await self.db["users"].insert_one({"_id": other, "push_subscriptions": [{"endpoint": ep(5)}]})
        await routes.subscribe(payload(1), self.me, self.push)
        await legacy.unsubscribe_legacy(str(other), self.me, self.push, None)
        self.assertEqual(len((await self.db["users"].find_one({"_id": other}))["push_subscriptions"]), 1)


class SenderTests(unittest.IsolatedAsyncioTestCase):
    def sender(self):
        sender = WebPushSender()
        sender.enabled, sender._private_key, sender._claims = True, "k", {"sub": "mailto:a@b.c"}
        return sender

    async def test_legacy_ssrf_endpoint_is_never_called(self):
        sender = self.sender()
        with patch.object(WebPushSender, "_send_blocking", side_effect=AssertionError("must not be called")):
            out = await sender.send({"endpoint": "https://169.254.169.254/latest", "keys": KEYS}, "t", "b")
        self.assertIs(out, PushOutcome.INVALID)

    async def test_good_subscription_is_sent(self):
        sender = self.sender()
        with patch.object(WebPushSender, "_send_blocking", return_value=201) as blocking:
            out = await sender.send({"endpoint": GOOD[0], "keys": KEYS}, "t", "b")
        self.assertIs(out, PushOutcome.SENT)
        self.assertEqual(blocking.call_args[0][0]["endpoint"], GOOD[0])

    async def test_gone_and_failed_are_told_apart(self):
        sender = self.sender()

        class Boom(Exception):
            def __init__(self, code):
                self.response = type("R", (), {"status_code": code})()

        for code, expected in ((410, PushOutcome.GONE), (404, PushOutcome.GONE), (500, PushOutcome.FAILED)):
            with patch.object(WebPushSender, "_send_blocking", side_effect=Boom(code)):
                out = await sender.send({"endpoint": GOOD[0], "keys": KEYS}, "t", "b")
            self.assertIs(out, expected)

    async def test_disabled(self):
        sender = WebPushSender()
        sender.enabled = False
        self.assertIs(await sender.send({"endpoint": GOOD[0], "keys": KEYS}, "t", "b"), PushOutcome.DISABLED)


if __name__ == "__main__":
    unittest.main()
