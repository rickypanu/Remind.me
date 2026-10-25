"""Telegram: linking tokens (S1), webhook verification (S2), admin key and escaping (S14), client behaviour."""

import asyncio
import logging
import unittest
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch

from tests import auth_stubs  # noqa: F401  (must stay first: it prepares the test environment)

# isort: split

import httpx  # noqa: E402
from bson import ObjectId  # noqa: E402
from fastapi import BackgroundTasks  # noqa: E402
from pydantic import SecretStr, ValidationError  # noqa: E402

from app.api import deps  # noqa: E402
from app.api.v1 import admin as telegram_broadcast  # noqa: E402
from app.api.v1 import telegram as telegram_setup
from app.core.errors import AppError  # noqa: E402
from app.core.logging_config import RedactSecretsFilter  # noqa: E402
from app.integrations.telegram import Outcome, TelegramClient, escape, fit_message  # noqa: E402
from app.notifications.dispatch import Notifier  # noqa: E402
from app.services import telegram_bot  # noqa: E402
from app.services import telegram_linking as linking
from app.services.broadcast import broadcast_to_all  # noqa: E402
from app.services.sessions import hash_token  # noqa: E402
from schemas.telegram import BroadcastIn, TgUpdate  # noqa: E402
from tests.fake_db import FakeDb  # noqa: E402

BOT_TOKEN = "123456789:AAH-secretSECRETsecret_token0123456789"
WEBHOOK_SECRET = "Wh" + "k" * 40
ADMIN_CHAT = 555000111


def settings(**over):
    base = dict(
        telegram_enabled=True, telegram_bot_username="RemindMeBot", telegram_link_ttl_minutes=10,
        telegram_webhook_secret=SecretStr(WEBHOOK_SECRET), admin_telegram_id=str(ADMIN_CHAT),
        admin_secret=SecretStr("A" * 40),
    )
    base.update(over)
    return SimpleNamespace(**base)


class FakeTelegram:
    enabled = True

    def __init__(self, outcome=Outcome.SENT):
        self.sent, self.outcome = [], outcome

    async def send(self, chat_id, title, body="", *, reply_markup=None):
        self.sent.append({"chat": str(chat_id), "title": title, "body": body, "markup": reply_markup})
        return self.outcome

    async def send_plain(self, chat_id, title, body=""):
        self.sent.append({"chat": str(chat_id), "title": fit_message(title, body), "plain": True})
        return self.outcome


class FakePush:
    enabled = False


def make_notifier(db, telegram=None):
    return Notifier(db, telegram or FakeTelegram(), FakePush(), concurrency=5)


def update(text=None, *, chat_id=111, user_id=None, chat_type="private", contact=None, is_bot=False):
    message = {"message_id": 1, "chat": {"id": chat_id, "type": chat_type}, "from": {"id": chat_id if user_id is None else user_id, "is_bot": is_bot}}
    if text is not None:
        message["text"] = text
    if contact is not None:
        message["contact"] = contact
    return TgUpdate.model_validate({"update_id": 1, "message": message})


class LinkTokenTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = FakeDb()
        self.uid = ObjectId()
        await self.db["users"].insert_one({"_id": self.uid, "username": "u"})
        patcher = patch.object(linking, "get_settings", lambda: settings())
        patcher.start()
        self.addCleanup(patcher.stop)

    async def test_token_is_random_hashed_and_expiring(self):
        token, expires = await linking.create_link_token(self.db, self.uid)
        self.assertRegex(token, linking.TOKEN_PATTERN)
        doc = self.db["telegram_link_tokens"].docs[0]
        self.assertEqual(doc["_id"], hash_token(token))
        self.assertNotIn(token, str(doc))  # only the hash is stored
        self.assertEqual(doc["user_id"], self.uid)
        self.assertAlmostEqual((expires - datetime.now(UTC)).total_seconds(), 600, delta=5)
        other, _ = await linking.create_link_token(self.db, ObjectId())
        self.assertNotEqual(token, other)

    async def test_single_use(self):
        token, _ = await linking.create_link_token(self.db, self.uid)
        self.assertEqual(await linking.consume_link_token(self.db, token), self.uid)
        self.assertIsNone(await linking.consume_link_token(self.db, token))

    async def test_concurrent_attempts_only_one_wins(self):
        token, _ = await linking.create_link_token(self.db, self.uid)
        results = await asyncio.gather(*(linking.consume_link_token(self.db, token) for _ in range(5)))
        self.assertEqual(sum(r is not None for r in results), 1)

    async def test_expired_token_is_refused(self):
        token, _ = await linking.create_link_token(self.db, self.uid)
        self.db["telegram_link_tokens"].docs[0]["expires"] = datetime.now(UTC) - timedelta(seconds=1)
        self.assertIsNone(await linking.consume_link_token(self.db, token))
        self.assertEqual(self.db["telegram_link_tokens"].docs, [])  # and it is gone

    async def test_a_user_id_is_not_a_token(self):
        self.assertIsNone(await linking.consume_link_token(self.db, str(self.uid)))
        self.assertIsNone(await linking.consume_link_token(self.db, "x" * 43))

    async def test_new_token_replaces_the_old_one(self):
        first, _ = await linking.create_link_token(self.db, self.uid)
        second, _ = await linking.create_link_token(self.db, self.uid)
        self.assertIsNone(await linking.consume_link_token(self.db, first))
        self.assertEqual(await linking.consume_link_token(self.db, second), self.uid)

    async def test_chat_moves_between_accounts(self):
        other = ObjectId()
        await self.db["users"].insert_one({"_id": other, "telegram_chat_id": "42", "phone_number": "+911234567890"})
        self.assertTrue(await linking.link_chat(self.db, self.uid, "42"))
        mine = await self.db["users"].find_one({"_id": self.uid})
        theirs = await self.db["users"].find_one({"_id": other})
        self.assertEqual(mine["telegram_chat_id"], "42")
        self.assertNotIn("telegram_chat_id", theirs)
        self.assertNotIn("phone_number", theirs)

    async def test_link_chat_never_creates_a_user(self):
        self.assertFalse(await linking.link_chat(self.db, ObjectId(), "42"))
        self.assertEqual(len(self.db["users"].docs), 1)

    async def test_status_masks_phone_and_unlink(self):
        await linking.link_chat(self.db, self.uid, "42")
        await linking.save_phone(self.db, "42", "+919876543210")
        st = await linking.status(self.db, self.uid)
        self.assertTrue(st["connected"])
        self.assertNotIn("98765", st["phone_number"])
        self.assertTrue(st["phone_number"].endswith("3210"))
        await linking.unlink(self.db, self.uid)
        self.assertEqual(await linking.status(self.db, self.uid), {"connected": False, "phone_number": None})

    def test_mask_phone(self):
        self.assertIsNone(linking.mask_phone(None))
        self.assertEqual(linking.mask_phone("+919876543210"), "+" + "•" * 8 + "3210")
        self.assertEqual(linking.mask_phone("123"), "••••")


class LinkRouteTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = FakeDb()
        self.uid = ObjectId()
        await self.db["users"].insert_one({"_id": self.uid})
        for module in (telegram_setup, linking):
            p = patch.object(module, "get_settings", lambda: settings())
            p.start()
            self.addCleanup(p.stop)

    async def test_link_is_for_the_caller_only(self):
        out = await telegram_setup.get_telegram_link(None, {"_id": str(self.uid)}, self.uid, self.db)
        self.assertTrue(out["telegram_url"].startswith("https://t.me/RemindMeBot?start="))
        self.assertEqual(out["expires_in"], 600)
        token = out["telegram_url"].split("start=")[1]
        self.assertEqual(await linking.consume_link_token(self.db, token), self.uid)
        self.assertNotIn(str(self.uid), out["telegram_url"])

    async def test_not_configured(self):
        with patch.object(telegram_setup, "get_settings", lambda: settings(telegram_enabled=False)):
            with self.assertRaises(AppError) as caught:
                await telegram_setup.get_telegram_link(None, {"_id": str(self.uid)}, self.uid, self.db)
        self.assertEqual(caught.exception.status_code, 503)

    async def test_bad_identity_fails_closed(self):
        with self.assertRaises(AppError) as caught:
            deps.get_user_id({"_id": "not-an-id"})
        self.assertEqual(caught.exception.status_code, 401)

    async def test_the_old_idor_endpoints_are_gone(self):
        """The account always comes from the access token (the ``get_user_id`` dependency), never from a body or a path."""
        import inspect
        import typing

        for fn in (telegram_setup.telegram_status, telegram_setup.get_telegram_link, telegram_setup.disconnect_telegram):
            parameters = inspect.signature(fn).parameters
            self.assertNotIn("payload", parameters)
            self.assertNotIn("body", parameters)
            metadata = typing.get_type_hints(fn, include_extras=True)["user_id"].__metadata__
            self.assertTrue(any(getattr(m, "dependency", m) is deps.get_user_id for m in metadata), fn.__name__)


class FakeRequest:
    def __init__(self, body: bytes):
        self._body = body

    async def body(self):
        return self._body


GOOD_BODY = b'{"update_id": 1, "message": {"message_id": 1, "chat": {"id": 111, "type": "private"}, "from": {"id": 111, "is_bot": false}, "text": "hello"}}'


class WebhookTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = FakeDb()
        self.notifier = make_notifier(self.db)
        p = patch.object(telegram_setup, "get_settings", lambda: settings())
        p.start()
        self.addCleanup(p.stop)

    async def call(self, secret, body=GOOD_BODY):
        return await telegram_setup.telegram_webhook(FakeRequest(body), BackgroundTasks(), self.db, self.notifier, secret)

    async def test_missing_or_wrong_secret_is_403(self):
        for bad in (None, "", "wrong", WEBHOOK_SECRET[:-1], WEBHOOK_SECRET + "x", WEBHOOK_SECRET.lower() if WEBHOOK_SECRET.lower() != WEBHOOK_SECRET else "nope", "é" * 5):
            with self.subTest(secret=bad):
                with self.assertRaises(AppError) as caught:
                    await self.call(bad)
                self.assertEqual(caught.exception.status_code, 403)

    async def test_secret_is_compared_in_constant_time(self):
        with patch.object(telegram_setup.hmac, "compare_digest", wraps=telegram_setup.hmac.compare_digest) as spy:
            await self.call(WEBHOOK_SECRET)
        self.assertTrue(spy.called)

    async def test_correct_secret_is_accepted(self):
        self.assertEqual((await self.call(WEBHOOK_SECRET)).status, "ok")

    async def test_secret_is_checked_before_the_body_is_read(self):
        class Exploding(FakeRequest):
            async def body(self):
                raise AssertionError("body must not be read before authentication")

        with self.assertRaises(AppError):
            await telegram_setup.telegram_webhook(Exploding(b""), BackgroundTasks(), self.db, self.notifier, "bad")

    async def test_not_configured_is_503(self):
        with patch.object(telegram_setup, "get_settings", lambda: settings(telegram_webhook_secret=None)):
            with self.assertRaises(AppError) as caught:
                await self.call("anything")
        self.assertEqual(caught.exception.status_code, 503)

    async def test_malformed_bodies_are_400(self):
        for body in (b"", b"not json", b"[]", b"{}", b'{"update_id": "x"}', b'{"update_id": 1, "message": {"chat": {"id": "abc", "type": "private"}}}',
                     b'{"update_id": 1, "message": {"chat": {"id": 1, "type": "private"}, "text": "' + b"a" * 5000 + b'"}}'):
            with self.subTest(body=body[:40]):
                with self.assertRaises(AppError) as caught:
                    await self.call(WEBHOOK_SECRET, body)
                self.assertEqual(caught.exception.status_code, 400)

    async def test_a_crash_inside_the_handler_still_answers_200(self):
        with patch.object(telegram_setup, "handle_update", side_effect=RuntimeError("boom")):
            with self.assertLogs("telegram_routes", "ERROR"):
                self.assertEqual((await self.call(WEBHOOK_SECRET)).status, "ok")

    def test_pydantic_update_model(self):
        up = TgUpdate.model_validate_json(GOOD_BODY)
        self.assertEqual(up.message.from_user.id, 111)
        with self.assertRaises(ValidationError):
            TgUpdate.model_validate({"update_id": 1, "message": {"chat": {"id": 1}}})  # chat.type missing


class BotTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = FakeDb()
        self.tg = FakeTelegram()
        self.notifier = make_notifier(self.db, self.tg)
        self.uid = ObjectId()
        await self.db["users"].insert_one({"_id": self.uid})
        self.broadcasts = []
        for module in (linking, telegram_bot):
            p = patch.object(module, "get_settings", lambda: settings())
            p.start()
            self.addCleanup(p.stop)

    async def handle(self, up):
        await telegram_bot.handle_update(self.db, self.notifier, up, start_broadcast=lambda *a: self.broadcasts.append(a))

    async def user(self):
        return await self.db["users"].find_one({"_id": self.uid})

    async def test_start_with_valid_token_links_the_chat_once(self):
        token, _ = await linking.create_link_token(self.db, self.uid)
        await self.handle(update(f"/start {token}", chat_id=777))
        self.assertEqual((await self.user())["telegram_chat_id"], "777")
        self.assertIsNotNone(self.tg.sent[-1]["markup"])  # the share-phone keyboard is kept
        # replaying the same link from another chat does nothing
        await self.handle(update(f"/start {token}", chat_id=888))
        self.assertEqual((await self.user())["telegram_chat_id"], "777")
        self.assertIn("expired", self.tg.sent[-1]["title"].lower())

    async def test_start_with_a_user_id_is_rejected_and_creates_nothing(self):
        await self.handle(update(f"/start {self.uid}", chat_id=777))
        self.assertNotIn("telegram_chat_id", await self.user())
        self.assertEqual(len(self.db["users"].docs), 1)  # no shadow user

    async def test_start_with_garbage_token(self):
        for text in ("/start", "/start ", "/start a b", "/start <script>", "/start " + "a" * 200, "/start ../../x"):
            await self.handle(update(text, chat_id=777))
        self.assertNotIn("telegram_chat_id", await self.user())

    async def test_groups_channels_bots_and_impersonation_are_ignored(self):
        token, _ = await linking.create_link_token(self.db, self.uid)
        for up in (update(f"/start {token}", chat_type="group"), update(f"/start {token}", chat_type="supergroup"),
                   update(f"/start {token}", chat_id=-100123, chat_type="channel"),
                   update(f"/start {token}", chat_id=111, user_id=222), update(f"/start {token}", is_bot=True)):
            await self.handle(up)
        self.assertNotIn("telegram_chat_id", await self.user())
        self.assertEqual(self.tg.sent, [])

    async def test_contact_must_be_the_senders_own(self):
        await linking.link_chat(self.db, self.uid, "111")
        await self.handle(update(chat_id=111, contact={"phone_number": "+911112223334", "user_id": 999}))  # someone else's
        self.assertNotIn("phone_number", await self.user())
        await self.handle(update(chat_id=111, contact={"phone_number": "+911112223334"}))  # no user id
        self.assertNotIn("phone_number", await self.user())
        await self.handle(update(chat_id=111, contact={"phone_number": "<b>x</b>", "user_id": 111}))
        self.assertNotIn("phone_number", await self.user())
        await self.handle(update(chat_id=111, contact={"phone_number": "+91 11122-23334", "user_id": 111}))
        self.assertEqual((await self.user())["phone_number"], "+911112223334")
        self.assertNotIn("1112223", self.tg.sent[-1]["body"])  # only the masked number is echoed back

    async def test_contact_without_a_linked_account(self):
        await self.handle(update(chat_id=999, contact={"phone_number": "+911112223334", "user_id": 999}))
        self.assertIn("Not linked", self.tg.sent[-1]["title"])

    async def test_broadcast_command_is_admin_only(self):
        await self.handle(update("/broadcast Hi | there", chat_id=111))
        self.assertEqual((self.broadcasts, self.tg.sent), ([], []))  # silent for everybody else
        await self.handle(update("/broadcast Hi | there", chat_id=ADMIN_CHAT))
        self.assertEqual(self.broadcasts, [("Hi", "there", str(ADMIN_CHAT))])
        await self.handle(update("/broadcast no separator", chat_id=ADMIN_CHAT))
        self.assertEqual(len(self.broadcasts), 1)
        await self.handle(update("/broadcast " + "t" * 201 + " | b", chat_id=ADMIN_CHAT))
        self.assertEqual(len(self.broadcasts), 1)

    async def test_admin_from_a_group_is_refused(self):
        await self.handle(update("/broadcast Hi | there", chat_id=ADMIN_CHAT, chat_type="group"))
        self.assertEqual(self.broadcasts, [])

    def test_admin_chat_comparison(self):
        self.assertTrue(telegram_bot.is_admin_chat(ADMIN_CHAT, str(ADMIN_CHAT)))
        self.assertFalse(telegram_bot.is_admin_chat(ADMIN_CHAT + 1, str(ADMIN_CHAT)))
        self.assertFalse(telegram_bot.is_admin_chat(ADMIN_CHAT, None))
        with patch.object(telegram_bot.hmac, "compare_digest", wraps=telegram_bot.hmac.compare_digest) as spy:
            telegram_bot.is_admin_chat(1, "2")
        self.assertTrue(spy.called)


class AdminBroadcastTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        p = patch.object(telegram_broadcast, "get_settings", lambda: settings())
        p.start()
        self.addCleanup(p.stop)
        self.db = FakeDb()
        self.tg = FakeTelegram()
        self.notifier = make_notifier(self.db, self.tg)

    async def post(self, key, **over):
        data = BroadcastIn(title=over.get("title", "T"), body=over.get("body", "B"))
        bg = BackgroundTasks()
        out = await telegram_broadcast.broadcast(None, data, bg, self.notifier, key)
        return out, bg

    async def test_key_check(self):
        for bad in (None, "", "A" * 39, "A" * 41, "a" * 40):
            with self.subTest(key=bad):
                with self.assertRaises(AppError) as caught:
                    await self.post(bad)
                self.assertEqual(caught.exception.status_code, 403)
        out, bg = await self.post("A" * 40)
        self.assertEqual(out.status, "broadcast started")
        self.assertEqual(len(bg.tasks), 1)

    async def test_no_admin_secret_configured_means_nobody_gets_in(self):
        with patch.object(telegram_broadcast, "get_settings", lambda: settings(admin_secret=None)):
            self.assertFalse(telegram_broadcast.admin_key_matches("anything"))
            self.assertFalse(telegram_broadcast.admin_key_matches(""))

    async def test_constant_time_compare_is_used(self):
        with patch.object(telegram_broadcast.hmac, "compare_digest", wraps=telegram_broadcast.hmac.compare_digest) as spy:
            telegram_broadcast.admin_key_matches("A" * 40)
        self.assertTrue(spy.called)

    def test_schema_limits_and_unknown_fields(self):
        for kwargs in ({"title": "", "body": "x"}, {"title": "x", "body": ""}, {"title": "t" * 201, "body": "x"},
                       {"title": "x", "body": "b" * 3001}, {"title": "x", "body": "y", "extra": 1}):
            with self.assertRaises(ValidationError):
                BroadcastIn(**kwargs)

    async def test_html_is_escaped_before_sending(self):
        for n in range(3):
            await self.db["users"].insert_one({"_id": ObjectId(), "telegram_chat_id": str(100 + n)})
        await self.db["users"].insert_one({"_id": ObjectId()})  # not linked
        counts = await broadcast_to_all(self.notifier, '<a href="https://evil.test">click</a>', "5 < 6 & <b>bold</b>", "999")
        self.assertEqual(counts, {"sent": 3, "failed": 0})
        sent = [m for m in self.tg.sent if m["chat"] != "999"]
        self.assertEqual(len(sent), 3)
        for message in sent:
            self.assertNotIn("<a ", message["title"])
            self.assertNotIn("<b>bold", message["title"])
            self.assertIn("&lt;a href", message["title"])
        self.assertIn("Sent: 3", self.tg.sent[-1]["title"])

    async def test_counts_failures(self):
        self.tg.outcome = Outcome.PERMANENT
        await self.db["users"].insert_one({"_id": ObjectId(), "telegram_chat_id": "1"})
        self.assertEqual(await broadcast_to_all(self.notifier, "t", "b"), {"sent": 0, "failed": 1})


class FakeResponse:
    def __init__(self, status, data=None):
        self.status_code, self._data = status, data if data is not None else {}

    def json(self):
        return self._data


class FakeHttp:
    def __init__(self, *responses):
        self.responses, self.calls = list(responses), []

    async def post(self, url, json=None):
        self.calls.append((url, json))
        item = self.responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


class ClientTests(unittest.IsolatedAsyncioTestCase):
    def client(self, http, token=BOT_TOKEN):
        return TelegramClient(token, lambda: http, messages_per_second=10_000)

    async def test_outcomes(self):
        cases = [
            (FakeResponse(200, {"ok": True}), Outcome.SENT),
            (FakeResponse(403, {"description": "bot was blocked"}), Outcome.PERMANENT),
            (FakeResponse(400, {"description": "chat not found"}), Outcome.PERMANENT),
            (FakeResponse(500), Outcome.TRANSIENT),
            (httpx.HTTPError("network down"), Outcome.TRANSIENT),
        ]
        for response, expected in cases:
            with self.subTest(expected=expected):
                self.assertIs(await self.client(FakeHttp(response)).send("1", "t", "b"), expected)

    async def test_429_waits_and_retries_once(self):
        http = FakeHttp(FakeResponse(429, {"parameters": {"retry_after": 2}}), FakeResponse(200, {"ok": True}))
        with patch("app.integrations.telegram.asyncio.sleep") as sleep:
            sleep.return_value = None
            out = await self.client(http).send("1", "t", "b")
        self.assertIs(out, Outcome.SENT)
        self.assertEqual(len(http.calls), 2)
        self.assertIn(2, [c.args[0] for c in sleep.call_args_list])

    async def test_a_second_429_gives_up_as_transient(self):
        http = FakeHttp(FakeResponse(429, {"parameters": {"retry_after": 1}}), FakeResponse(429, {"parameters": {"retry_after": 1}}))
        with patch("app.integrations.telegram.asyncio.sleep") as sleep:
            sleep.return_value = None
            self.assertIs(await self.client(http).send("1", "t", "b"), Outcome.TRANSIENT)
        self.assertEqual(len(http.calls), 2)

    async def test_huge_retry_after_is_capped(self):
        http = FakeHttp(FakeResponse(429, {"parameters": {"retry_after": 9999}}), FakeResponse(200, {"ok": True}))
        with patch("app.integrations.telegram.asyncio.sleep") as sleep:
            sleep.return_value = None
            await self.client(http).send("1", "t", "b")
        self.assertLessEqual(max(c.args[0] for c in sleep.call_args_list), 30)

    async def test_disabled_without_token_or_chat(self):
        http = FakeHttp()
        self.assertIs(await self.client(http, token=None).send("1", "t"), Outcome.DISABLED)
        self.assertIs(await self.client(http).send("", "t"), Outcome.DISABLED)
        self.assertEqual(http.calls, [])

    async def test_token_never_reaches_the_log(self):
        leaky = httpx.HTTPError(f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage failed")
        with self.assertLogs("telegram", "WARNING") as logs:
            await self.client(FakeHttp(leaky)).send("1", "t", "b")
        self.assertNotIn(BOT_TOKEN, "\n".join(logs.output))
        self.assertNotIn("AAH-secret", "\n".join(logs.output))

    def test_log_filter_redacts_bot_tokens(self):
        record = logging.LogRecord("httpx", logging.INFO, "f", 1, 'HTTP Request: POST https://api.telegram.org/bot%s/sendMessage "200 OK"', (BOT_TOKEN,), None)
        self.assertTrue(RedactSecretsFilter().filter(record))
        self.assertNotIn(BOT_TOKEN, record.getMessage())
        self.assertIn("bot<redacted>", record.getMessage())

    async def test_the_payload_is_html_with_previews_off(self):
        http = FakeHttp(FakeResponse(200, {"ok": True}))
        await self.client(http).send("1", "Title", "body")
        url, payload = http.calls[0]
        self.assertEqual((payload["parse_mode"], payload["disable_web_page_preview"]), ("HTML", True))
        self.assertTrue(url.endswith("/sendMessage"))

    def test_escape_and_fit_message(self):
        self.assertEqual(escape("<b>&"), "&lt;b&gt;&amp;")
        text = fit_message("T", "x" * 10_000)
        self.assertLessEqual(len(text), 4096)
        tail = fit_message("T", "&" * 5000)
        self.assertLessEqual(len(tail), 4096)
        self.assertTrue(tail.endswith("&amp;…"))  # cut on a whole entity, never in the middle of one


if __name__ == "__main__":
    unittest.main()
