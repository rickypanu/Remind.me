"""Quick Add: what happens when the message leaves out the day and/or the time. Everything is IST (UTC+05:30)."""

import unittest
from datetime import datetime, timedelta

from tests import auth_stubs  # noqa: F401  (must stay first: it prepares the test environment)

# isort: split

from app.services.quick_add import _to_task_create  # noqa: E402
from utils.quick_defaults import parse_date, parse_time, resolve_due_ist  # noqa: E402
from utils.timezone import IST, UTC, to_utc  # noqa: E402


def at(hour, minute=0, second=0, day=24):
    return datetime(2026, 10, day, hour, minute, second, 123456, tzinfo=IST)


def due(date_text, time_text, now):
    return resolve_due_ist(date_text, time_text, now)


class NoDateNoTimeTests(unittest.TestCase):
    def test_two_hours_from_now(self):
        self.assertEqual(due(None, None, at(10, 15)), at(12, 15).replace(microsecond=0))

    def test_seconds_are_dropped_before_adding(self):
        self.assertEqual(due(None, None, at(21, 14, 37)), at(23, 14).replace(microsecond=0))

    def test_exactly_at_the_midnight_boundary_counts_as_next_day(self):
        # 22:00 + 2 h = 00:00 tomorrow -> ten minutes instead
        self.assertEqual(due(None, None, at(22, 0)), at(22, 10).replace(microsecond=0))

    def test_late_night_adds_ten_minutes(self):
        self.assertEqual(due(None, None, at(23, 0)), at(23, 10).replace(microsecond=0))

    def test_just_before_the_cutoff_still_adds_two_hours(self):
        self.assertEqual(due(None, None, at(21, 59)), at(23, 59).replace(microsecond=0))

    def test_ten_minutes_may_itself_cross_midnight(self):
        # the rule is literally "+10 minutes", even at 23:55
        self.assertEqual(due(None, None, at(23, 55)), at(0, 5, day=25).replace(microsecond=0))

    def test_result_is_ist_aware(self):
        self.assertEqual(due(None, None, at(10, 0)).utcoffset(), timedelta(hours=5, minutes=30))

    def test_a_utc_now_is_converted_to_ist_first(self):
        # 17:30 UTC is 23:00 IST -> late-night rule, not "19:30 + 2h"
        now_utc = datetime(2026, 10, 24, 17, 30, tzinfo=UTC)
        self.assertEqual(due(None, None, now_utc), at(23, 10).replace(microsecond=0))


class PartialInputTests(unittest.TestCase):
    def test_time_only_later_today(self):
        self.assertEqual(due(None, "18:30", at(10, 0)), at(18, 30).replace(microsecond=0))

    def test_time_only_already_passed_means_tomorrow(self):
        self.assertEqual(due(None, "08:00", at(10, 0)), at(8, 0, day=25).replace(microsecond=0))

    def test_time_equal_to_now_means_tomorrow(self):
        self.assertEqual(due(None, "10:00", at(10, 0)), at(10, 0, day=25).replace(microsecond=0))

    def test_date_only_in_the_future_uses_nine_am(self):
        self.assertEqual(due("2026-10-27", None, at(10, 0)), datetime(2026, 10, 27, 9, 0, tzinfo=IST))

    def test_date_only_today_follows_the_two_hour_rule(self):
        self.assertEqual(due("2026-10-24", None, at(10, 0)), at(12, 0).replace(microsecond=0))

    def test_date_only_today_late_night_follows_the_ten_minute_rule(self):
        self.assertEqual(due("2026-10-24", None, at(23, 20)), at(23, 30).replace(microsecond=0))

    def test_date_and_time_are_used_as_given(self):
        self.assertEqual(due("2026-11-02", "17:00", at(10, 0)), datetime(2026, 11, 2, 17, 0, tzinfo=IST))

    def test_garbage_counts_as_missing(self):
        self.assertEqual(due("tomorrow", "5pm", at(10, 0)), at(12, 0).replace(microsecond=0))
        self.assertIsNone(parse_date("2026-13-40"))
        self.assertIsNone(parse_time("25:99"))
        self.assertIsNone(parse_time("noon"))
        self.assertEqual(parse_time(" 07:05 ").minute, 5)


class ConversionTests(unittest.TestCase):
    def reply(self, **over):
        base = {"title": "Buy milk", "description": None, "category": "Personal", "schedule_type": "once",
                "date": None, "time": None, "due_date": None, "time_of_day": None, "weekdays": []}
        base.update(over)
        return base

    def test_defaults_are_applied_and_stored_as_the_same_instant_in_utc(self):
        task = _to_task_create(self.reply(), now=at(10, 15))
        self.assertEqual(task.due_date, at(12, 15).replace(microsecond=0))
        self.assertEqual(to_utc(task.due_date), datetime(2026, 10, 24, 6, 45, tzinfo=UTC))

    def test_legacy_complete_deadline_is_still_accepted(self):
        task = _to_task_create(self.reply(due_date="2026-10-30T17:00:00+05:30"), now=at(10, 0))
        self.assertEqual(task.due_date, datetime(2026, 10, 30, 17, 0, tzinfo=IST))

    def test_recurring_reminders_ignore_the_one_time_defaults(self):
        task = _to_task_create(self.reply(schedule_type="daily", time_of_day="07:30"), now=at(10, 0))
        self.assertIsNone(task.due_date)
        self.assertEqual(task.time_of_day, "07:30")

    def test_unknown_schedule_type_falls_back_to_once(self):
        self.assertEqual(_to_task_create(self.reply(schedule_type="hourly"), now=at(10, 0)).schedule_type, "once")


if __name__ == "__main__":
    unittest.main()
