"""The server's rule parser must read sentences exactly like the app/website parser (fixture generated from the JS)."""

import datetime
import json
from pathlib import Path

from utils.quick_parse import parse_quick

FIXTURE = Path(__file__).parent / "fixtures" / "quick_parse_js_parity.json"


def _iso_to_ms(value: str) -> int:
    return int(datetime.datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp() * 1000)


def test_matches_javascript_parser():
    rows = json.loads(FIXTURE.read_text(encoding="utf8"))
    assert len(rows) > 100
    for row in rows:
        got = parse_quick(row["text"], row["now"])
        js = row["r"]
        if js is None:
            assert got is None
            continue
        expected = dict(js["payload"])
        if "due_date" in expected:
            expected["due_date"] = _iso_to_ms(expected["due_date"])
        assert got is not None, row["text"]
        assert got["payload"] == expected, row["text"]
        assert got["confidence"] == js["confidence"], row["text"]
        assert got["found"] == js["found"], row["text"]
        assert got["assumedTime"] == js["assumedTime"], row["text"]


def test_empty_sentence_is_none():
    assert parse_quick("   ", 0) is None
