"""Process-wide logging setup. Replaces the ad-hoc ``print()`` calls (finding Q1)."""

import logging
import re
import sys
from datetime import datetime

from utils.timezone import IST

_FORMAT = "%(asctime)s %(levelname)-8s %(name)s: %(message)s"


class ISTFormatter(logging.Formatter):
    """Log timestamps in Indian Standard Time, whatever timezone the server runs in: 2026-10-24T21:30:00.123+05:30."""

    def formatTime(self, record: logging.LogRecord, datefmt: str | None = None) -> str:
        moment = datetime.fromtimestamp(record.created, IST)
        return moment.strftime(datefmt) if datefmt else moment.isoformat(timespec="milliseconds")


# Telegram puts the bot token in the URL path (https://api.telegram.org/bot<token>/sendMessage). Any library that
# logs a URL would write the token to the logs, so every record is scrubbed before it is emitted.
_BOT_TOKEN_RE = re.compile(r"bot\d{5,}:[A-Za-z0-9_-]{20,}")


class RedactSecretsFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        if "bot" in message and _BOT_TOKEN_RE.search(message):
            record.msg = _BOT_TOKEN_RE.sub("bot<redacted>", message)
            record.args = ()
        return True


def configure_logging(level: str) -> None:
    """Send all application logs to stdout at ``level``. Safe to call more than once."""
    logging.basicConfig(level=level, format=_FORMAT, stream=sys.stdout, force=True)
    for handler in logging.getLogger().handlers:
        handler.addFilter(RedactSecretsFilter())
        handler.setFormatter(ISTFormatter(_FORMAT))
    # APScheduler and the HTTP client are chatty at INFO; keep them at WARNING unless debugging.
    noisy_level = logging.DEBUG if level == "DEBUG" else logging.WARNING
    for name in ("apscheduler", "httpx", "httpcore"):
        logging.getLogger(name).setLevel(noisy_level)
