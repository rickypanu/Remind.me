"""'Every N days' reminders: daily reminders with interval_days > 1."""

import unittest
from datetime import UTC, datetime

from utils.recurrence import advance_after_completion, describe_schedule, next_occurrence, occurs_on_ist_day

DUE = datetime(2026, 11, 21, 3, 30, tzinfo=UTC)  # 9:00 IST


class IntervalTests(unittest.TestCase):
    def test_steps_from_the_occurrence_just_handled(self):
        nxt = next_occurrence("daily", "09:00", [], datetime(2026, 11, 21, 4, 0, tzinfo=UTC), None, 3, DUE)
        self.assertEqual(nxt, datetime(2026, 11, 24, 3, 30, tzinfo=UTC))

    def test_a_late_completion_lands_on_the_next_step_not_in_the_past(self):
        nxt = next_occurrence("daily", "09:00", [], datetime(2026, 11, 30, 4, 0, tzinfo=UTC), None, 3, DUE)
        self.assertEqual(nxt, datetime(2026, 12, 3, 3, 30, tzinfo=UTC))

    def test_new_series_starts_at_the_next_daily_slot(self):
        nxt = next_occurrence("daily", "09:00", [], datetime(2026, 11, 21, 2, 0, tzinfo=UTC), None, 3)
        self.assertEqual(nxt, DUE)

    def test_end_date_stops_the_series(self):
        self.assertIsNone(next_occurrence("daily", "09:00", [], DUE, "2026-11-23", 3, DUE))

    def test_default_interval_is_plain_daily(self):
        nxt = next_occurrence("daily", "09:00", [], DUE)
        self.assertEqual(nxt, datetime(2026, 11, 22, 3, 30, tzinfo=UTC))

    def test_completion_advances_by_the_interval(self):
        task = {"schedule_type": "daily", "time_of_day": "09:00", "interval_days": 2, "due_date": DUE}
        change = advance_after_completion(task, datetime(2026, 11, 21, 3, 0, tzinfo=UTC))
        self.assertEqual(change["next_due"], datetime(2026, 11, 23, 3, 30, tzinfo=UTC))

    def test_digest_only_lists_the_reminder_on_its_days(self):
        task = {"schedule_type": "daily", "interval_days": 3, "due_date": DUE}
        day = lambda d: datetime(2026, 11, d, 0, 0, tzinfo=UTC)  # noqa: E731
        self.assertTrue(occurs_on_ist_day(task, day(21)))
        self.assertFalse(occurs_on_ist_day(task, day(22)))
        self.assertTrue(occurs_on_ist_day(task, day(24)))

    def test_label(self):
        self.assertEqual(describe_schedule("daily", "09:00", [], 3), "Every 3 days at 9:00 AM")
        self.assertEqual(describe_schedule("daily", "09:00", [], 1), "Every day at 9:00 AM")


if __name__ == "__main__":
    unittest.main()
