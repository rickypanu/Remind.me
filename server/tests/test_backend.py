"""
Run from the server folder:   python -m unittest discover -s tests -v
(or `pytest` if you have it installed). No database, network or API keys needed.
"""
import os
import sys
import unittest
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from tests import _stubs  # noqa: E402

_stubs.install()
os.environ.setdefault("REMINDER_ENCRYPTION_KEY", "unit-test-master-key-0123456789abcdef-xyz")

from utils import crypto, moderation, recurrence  # noqa: E402
from utils.timezone import IST, UTC  # noqa: E402


class CryptoTests(unittest.TestCase):
    def test_roundtrip_and_not_plaintext(self):
        ct = crypto.encrypt_text("user1", "title", "Submit thesis")
        self.assertTrue(ct.startswith("enc:v1:"))
        self.assertNotIn("thesis", ct)
        self.assertEqual(crypto.decrypt_text("user1", "title", ct), "Submit thesis")

    def test_unique_ciphertext_each_time(self):
        self.assertNotEqual(crypto.encrypt_text("u", "title", "x"), crypto.encrypt_text("u", "title", "x"))

    def test_other_user_cannot_decrypt(self):
        ct = crypto.encrypt_text("alice", "title", "secret")
        self.assertEqual(crypto.decrypt_text("bob", "title", ct), crypto.UNREADABLE)

    def test_cannot_move_between_fields(self):
        ct = crypto.encrypt_text("alice", "title", "secret")
        self.assertEqual(crypto.decrypt_text("alice", "description", ct), crypto.UNREADABLE)

    def test_tamper_detected(self):
        ct = crypto.encrypt_text("alice", "title", "secret")
        bad = ct[:-4] + ("AAAA" if not ct.endswith("AAAA") else "BBBB")
        self.assertEqual(crypto.decrypt_text("alice", "title", bad), crypto.UNREADABLE)

    def test_legacy_plaintext_and_none_pass_through(self):
        self.assertEqual(crypto.decrypt_text("u", "title", "old plain"), "old plain")
        self.assertIsNone(crypto.encrypt_text("u", "description", None))
        self.assertIsNone(crypto.decrypt_text("u", "description", None))

    def test_unicode(self):
        s = "कल माँ को फोन करना 📞"
        self.assertEqual(crypto.decrypt_text("u", "title", crypto.encrypt_text("u", "title", s)), s)

    def test_key_rotation(self):
        old = os.environ["REMINDER_ENCRYPTION_KEY"]
        ct = crypto.encrypt_text("u", "title", "keep me")
        try:
            os.environ["REMINDER_ENCRYPTION_KEY"] = "a-brand-new-master-key-0123456789abcdef"
            os.environ["REMINDER_ENCRYPTION_KEY_PREVIOUS"] = old
            self.assertEqual(crypto.decrypt_text("u", "title", ct), "keep me")
        finally:
            os.environ["REMINDER_ENCRYPTION_KEY"] = old
            os.environ.pop("REMINDER_ENCRYPTION_KEY_PREVIOUS", None)

    def test_missing_key_fails_loudly(self):
        old = os.environ.pop("REMINDER_ENCRYPTION_KEY")
        try:
            with self.assertRaises(crypto.EncryptionConfigError):
                crypto.assert_encryption_configured()
        finally:
            os.environ["REMINDER_ENCRYPTION_KEY"] = old

    def test_task_store_encrypts_private_fields_only(self):
        from utils.task_store import to_response, to_storage
        stored = to_storage("u1", {"title": "Pay rent", "description": "flat 4B", "category": "Personal", "user_id": "u1", "due_date": 1})
        self.assertTrue(all(stored[f].startswith("enc:v1:") for f in ("title", "description", "category")))
        self.assertEqual(stored["due_date"], 1)
        stored["_id"] = "abc"
        out = to_response(stored)
        self.assertEqual((out["title"], out["description"], out["category"], out["id"]), ("Pay rent", "flat 4B", "Personal", "abc"))


class ModerationTests(unittest.TestCase):
    def blocked(self, text):
        return not moderation.check_text(text).allowed

    def test_blocks_vulgar_sexual_hate_harm(self):
        for t in [
            "fuck this assignment", "f u c k", "f*ck", "fuuuuck", "5h1t", "a$$hole", "what a bitch",
            "watch porn tonight", "send nudes", "you are a slut", "madarchod", "bhenchod ka kaam",
            "kill him tomorrow", "make a bomb", "I want to kill myself", "buy cocaine at 5pm",
        ]:
            self.assertTrue(self.blocked(t), t)

    def test_allows_normal_student_reminders(self):
        for t in [
            "Submit physics assignment by Friday", "Class at 9am", "Pass the exam", "Buy a cocktail dress",
            "Scunthorpe trip", "Eat shiitake mushrooms", "Biology: sex-linked traits chapter", "sex education seminar",
            "Kill the stuck process on the server", "Assess the assassination chapter", "Call mom", "Dickens essay",
            "Analyse the Hancock paper", "Meet Cocker spaniel owner", "Massachusetts trip", "Gym every Monday at 7 AM",
            "Pay rent on 1st", "Therapist appointment", "मीटिंग कल सुबह 9 बजे",
        ]:
            self.assertFalse(self.blocked(t), t)

    def test_enforce_raises_with_message(self):
        with self.assertRaises(Exception) as cm:
            moderation.enforce("ok", None, "porn")
        self.assertEqual(cm.exception.status_code, 422)
        self.assertIn("sexual", cm.exception.detail.lower())

    def test_self_harm_message_is_supportive(self):
        r = moderation.check_text("I want to end my life")
        self.assertEqual(r.category, "self_harm")
        self.assertIn("14416", r.message)


class RecurrenceTests(unittest.TestCase):
    def ist(self, *a):
        return datetime(*a, tzinfo=IST)

    def test_daily_today_if_still_ahead(self):
        n = recurrence.next_occurrence("daily", "09:00", [], self.ist(2026, 10, 14, 8, 0))
        self.assertEqual(n.astimezone(IST), self.ist(2026, 10, 14, 9, 0))

    def test_daily_tomorrow_if_passed(self):
        n = recurrence.next_occurrence("daily", "09:00", [], self.ist(2026, 10, 14, 9, 0))
        self.assertEqual(n.astimezone(IST), self.ist(2026, 10, 15, 9, 0))

    def test_weekly_picks_next_allowed_weekday(self):
        # 2026-10-14 is a Wednesday. Mon=0, Fri=4
        n = recurrence.next_occurrence("weekly", "18:30", [0, 4], self.ist(2026, 10, 14, 12, 0))
        self.assertEqual(n.astimezone(IST), self.ist(2026, 10, 16, 18, 30))
        n = recurrence.next_occurrence("weekly", "18:30", [2], self.ist(2026, 10, 14, 19, 0))
        self.assertEqual(n.astimezone(IST), self.ist(2026, 10, 21, 18, 30))

    def test_utc_conversion(self):
        n = recurrence.next_occurrence("daily", "00:15", [], self.ist(2026, 10, 14, 0, 0))
        self.assertEqual(n.tzinfo, UTC)
        self.assertEqual((n.hour, n.minute), (18, 45))  # 00:15 IST == 18:45 UTC previous day

    def test_ends_on(self):
        self.assertIsNone(recurrence.next_occurrence("daily", "09:00", [], self.ist(2026, 10, 14, 10, 0), "2026-10-14"))
        self.assertIsNotNone(recurrence.next_occurrence("daily", "09:00", [], self.ist(2026, 10, 14, 10, 0), "2026-10-15"))

    def test_complete_early_skips_to_next_occurrence(self):
        due = self.ist(2026, 10, 14, 9, 0).astimezone(UTC)
        task = {"schedule_type": "daily", "time_of_day": "09:00", "weekdays": [], "due_date": due}
        change = recurrence.advance_after_completion(task, self.ist(2026, 10, 14, 8, 0).astimezone(UTC))
        self.assertEqual(change["next_due"].astimezone(IST), self.ist(2026, 10, 15, 9, 0))
        self.assertEqual(change["set"]["status"], "pending")
        self.assertIn("notified_tele_60m", change["unset"])

    def test_complete_last_occurrence_finishes_series(self):
        due = self.ist(2026, 10, 14, 9, 0).astimezone(UTC)
        task = {"schedule_type": "daily", "time_of_day": "09:00", "due_date": due, "ends_on": "2026-10-14"}
        change = recurrence.advance_after_completion(task, due)
        self.assertEqual(change["set"]["status"], "completed")

    def test_miss_rolls_forward(self):
        due = self.ist(2026, 10, 14, 9, 0).astimezone(UTC)
        task = {"schedule_type": "weekly", "time_of_day": "09:00", "weekdays": [2], "due_date": due}
        change = recurrence.advance_after_miss(task, self.ist(2026, 10, 14, 13, 0).astimezone(UTC))
        self.assertEqual(change["next_due"].astimezone(IST), self.ist(2026, 10, 21, 9, 0))
        self.assertEqual(change["inc"], {"missed_count": 1})

    def test_labels_and_projection(self):
        self.assertEqual(recurrence.describe_schedule("daily", "07:05"), "Every day at 7:05 AM")
        self.assertEqual(recurrence.describe_schedule("weekly", "18:30", [0, 2]), "Every Mon, Wed at 6:30 PM")
        self.assertEqual(recurrence.describe_schedule("once", None), "One time")
        tomorrow = self.ist(2026, 10, 15, 0, 0).astimezone(UTC)  # Thursday
        self.assertTrue(recurrence.occurs_on_ist_day({"schedule_type": "daily"}, tomorrow))
        self.assertTrue(recurrence.occurs_on_ist_day({"schedule_type": "weekly", "weekdays": [3]}, tomorrow))
        self.assertFalse(recurrence.occurs_on_ist_day({"schedule_type": "weekly", "weekdays": [0]}, tomorrow))
        self.assertFalse(recurrence.occurs_on_ist_day({"schedule_type": "once"}, tomorrow))

    def test_bad_input(self):
        for bad in ("25:00", "9", "ab:cd", "12:60"):
            with self.assertRaises(ValueError):
                recurrence.parse_time_of_day(bad)
        with self.assertRaises(ValueError):
            recurrence.normalize_weekdays([7])


class SchemaTests(unittest.TestCase):
    def test_task_create_rules(self):
        try:
            from schemas.task import TaskCreate
        except ImportError:
            self.skipTest("pydantic not installed")
        from pydantic import ValidationError
        t = TaskCreate(title=" Gym ", category="Personal", schedule_type="weekly", time_of_day="7:00", weekdays=[4, 0, 0])
        self.assertEqual((t.title, t.time_of_day, t.weekdays), ("Gym", "07:00", [0, 4]))
        for bad in (
            dict(title="x", category="c"),                                                    # once without due_date
            dict(title="x", category="c", schedule_type="daily"),                             # no time
            dict(title="x", category="c", schedule_type="weekly", time_of_day="09:00"),       # no weekdays
            dict(title="  ", category="c", due_date="2030-01-01T10:00:00+05:30"),             # blank title
        ):
            with self.assertRaises(ValidationError):
                TaskCreate(**bad)
        once = TaskCreate(title="x", category="c", due_date="2030-01-01T10:00:00+05:30", weekdays=[1], time_of_day="09:00")
        self.assertEqual((once.weekdays, once.time_of_day), ([], None))


RULES = "Test rules: answer briefly."  # GeminiPool.generate requires our instructions separately from the user text (S15)


class GeminiPoolTests(unittest.IsolatedAsyncioTestCase):
    def make_pool(self, behaviours, models=("m1", "m2")):
        """behaviours: {(key, model): exception | 'ok'} - missing means ok."""
        from utils import gemini_pool as gp

        calls = []

        class FakeModels:
            def __init__(self, key):
                self.key = key

            async def generate_content(self, model, contents, config):
                calls.append((self.key, model))
                b = behaviours.get((self.key, model), "ok")
                if isinstance(b, BaseException):
                    raise b
                return type("R", (), {"text": f"{self.key}:{model}"})()

        class FakeClient:
            def __init__(self, key):
                self.aio = type("A", (), {"models": FakeModels(key)})()

        pool = gp.GeminiPool(keys=["k1", "k2", "k3"], models=list(models), timeout=2)
        pool._client = lambda key: FakeClient(key)
        return gp, pool, calls

    def err(self, code, message="", status=""):
        from google.genai import errors
        return errors.APIError(code, message, status) if _stubs_used() else _real_err(code, message, status)

    async def test_falls_through_rate_limited_keys(self):
        rl = self.err(429, "quota exceeded", "RESOURCE_EXHAUSTED")
        gp, pool, calls = self.make_pool({("k1", "m1"): rl, ("k2", "m1"): rl})
        pool._rr = __import__("itertools").count(0)
        out = await pool.generate("hi", system_instruction=RULES)
        self.assertEqual(out, "k3:m1")           # third key rescued the request on the best model
        self.assertEqual(calls, [("k1", "m1"), ("k2", "m1"), ("k3", "m1")])

    async def test_rate_limited_key_is_skipped_next_time(self):
        rl = self.err(429, "quota exceeded", "RESOURCE_EXHAUSTED")
        gp, pool, calls = self.make_pool({("k1", "m1"): rl})
        pool._rr = __import__("itertools").count(0)
        await pool.generate("a", system_instruction=RULES)
        calls.clear()
        pool._rr = __import__("itertools").count(0)  # start at k1 again
        await pool.generate("b", system_instruction=RULES)
        self.assertNotIn(("k1", "m1"), calls)     # cooling down: not retried

    async def test_bad_key_benched_long(self):
        gp, pool, calls = self.make_pool({("k1", "m1"): self.err(400, "API key not valid. Please pass a valid API key.", "INVALID_ARGUMENT")})
        pool._rr = __import__("itertools").count(0)
        out = await pool.generate("x", system_instruction=RULES)
        self.assertEqual(out, "k2:m1")
        self.assertGreater(pool._key_blocked_until["k1"] - __import__("time").monotonic(), 3000)

    async def test_all_keys_limited_falls_to_next_model(self):
        rl = self.err(429, "quota", "RESOURCE_EXHAUSTED")
        gp, pool, calls = self.make_pool({("k1", "m1"): rl, ("k2", "m1"): rl, ("k3", "m1"): rl})
        out = await pool.generate("x", system_instruction=RULES)
        self.assertTrue(out.endswith(":m2"))

    async def test_everything_fails_raises_unavailable(self):
        gp, pool, calls = self.make_pool({(k, m): self.err(503, "overloaded", "UNAVAILABLE") for k in ("k1", "k2", "k3") for m in ("m1", "m2")})
        with self.assertRaises(gp.GeminiUnavailable):
            await pool.generate("x", system_instruction=RULES)
        self.assertEqual(len(calls), 6)           # every combination tried exactly once

    async def test_invalid_prompt_not_retried(self):
        gp, pool, calls = self.make_pool({("k1", "m1"): self.err(400, "Invalid JSON payload", "INVALID_ARGUMENT")})
        pool._rr = __import__("itertools").count(0)
        with self.assertRaises(Exception):
            await pool.generate("x", system_instruction=RULES)
        self.assertEqual(len(calls), 1)

    async def test_round_robin_spreads_load(self):
        gp, pool, calls = self.make_pool({})
        for _ in range(3):
            await pool.generate("x", system_instruction=RULES)
        self.assertEqual({c[0] for c in calls}, {"k1", "k2", "k3"})

    def test_key_loading(self):
        from utils.gemini_pool import load_api_keys, load_models
        env = {"GEMINI_API_KEYS": " 'aaa' , \"bbb\",aaa", "GEMINI_API_KEY": "ccc", "GEMINI_API_KEY_2": "eee", "GEMINI_API_KEY_1": "ddd"}
        self.assertEqual(load_api_keys(env), ["aaa", "bbb", "ccc", "ddd", "eee"])
        self.assertEqual(load_models({"GEMINI_MODELS": "x, y"}), ["x", "y"])
        self.assertTrue(load_models({}))


def _stubs_used():
    import google.genai
    return getattr(google.genai.Client, "__name__", "") == "<lambda>"


def _real_err(code, message, status):
    from google.genai import errors
    cls = errors.ClientError if code < 500 else errors.ServerError
    return cls(code, {"error": {"code": code, "message": message, "status": status}})


if __name__ == "__main__":
    unittest.main()
