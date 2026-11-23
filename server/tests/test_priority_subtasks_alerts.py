"""Priority, checklist (subtasks) and per-reminder alert times: validation and storage shape."""

import unittest

from app.notifications.rules import DEFAULT_OFFSETS, offsets_for
from schemas.task import TaskCreate, TaskUpdate
from utils.task_store import shape_response


def make(**extra):
    return TaskCreate(title="Report", category="Assignment", due_date="2026-11-20T10:00:00", **extra)


class SchemaTests(unittest.TestCase):
    def test_defaults_keep_old_clients_working(self):
        task = make()
        self.assertEqual((task.priority, task.subtasks, task.alert_offsets), ("normal", [], None))

    def test_subtasks_are_trimmed_and_limited(self):
        task = make(subtasks=[{"id": "a", "text": " draft ", "done": True}])
        self.assertEqual(task.subtasks[0].text, "draft")
        with self.assertRaises(ValueError):
            make(subtasks=[{"id": str(i), "text": "x"} for i in range(21)])
        with self.assertRaises(ValueError):
            make(subtasks=[{"id": "a", "text": "   "}])

    def test_alert_offsets_are_checked_sorted_and_deduplicated(self):
        self.assertEqual(make(alert_offsets=[10, 1440, 10]).alert_offsets, [1440, 10])
        self.assertEqual(make(alert_offsets=[]).alert_offsets, [])
        with self.assertRaises(ValueError):
            make(alert_offsets=[7])

    def test_update_can_reset_alerts_to_default(self):
        self.assertEqual(TaskUpdate(alert_offsets=None).model_dump(exclude_unset=True), {"alert_offsets": None})
        self.assertNotIn("alert_offsets", TaskUpdate(title="x").model_dump(exclude_unset=True))


class RuleTests(unittest.TestCase):
    def test_which_alerts_apply(self):
        self.assertEqual(offsets_for({}), DEFAULT_OFFSETS)
        self.assertEqual(offsets_for({"alert_offsets": None}), DEFAULT_OFFSETS)
        self.assertEqual(offsets_for({"alert_offsets": []}), ())
        self.assertEqual(offsets_for({"alert_offsets": [1440, 10]}), (1440, 10))


class ResponseShapeTests(unittest.TestCase):
    def test_old_documents_get_defaults(self):
        out = shape_response({"_id": "1", "user_id": "u", "title": "t", "category": "c"})
        self.assertEqual((out["priority"], out["subtasks"], out["alert_offsets"]), ("normal", [], None))

    def test_checklist_is_read_from_stored_json(self):
        out = shape_response({"_id": "1", "user_id": "u", "title": "t", "category": "c", "priority": "high",
                              "subtasks_json": '[{"id": "a", "text": "s", "done": true}]'})
        self.assertEqual(out["priority"], "high")
        self.assertEqual(out["subtasks"], [{"id": "a", "text": "s", "done": True}])
        self.assertNotIn("subtasks_json", out)


if __name__ == "__main__":
    unittest.main()
