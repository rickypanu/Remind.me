"""Create server/.env for local development with freshly generated secrets.

    cd server
    python -m scripts.init_env                 # writes .env (refuses to overwrite an existing one)
    python -m scripts.init_env --force         # replace it (a NEW REMINDER_ENCRYPTION_KEY makes old reminders unreadable!)

It copies .env.example, fills SECRET_KEY and REMINDER_ENCRYPTION_KEY with random values and leaves everything else
at the safe local defaults (ENVIRONMENT=development, MongoDB on localhost, CORS for http://localhost:5173).
"""

import argparse
import re
import secrets
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parents[1]
EXAMPLE = SERVER_DIR / ".env.example"
TARGET = SERVER_DIR / ".env"


def _set(text: str, key: str, value: str) -> str:
    pattern = re.compile(rf"^{re.escape(key)}=.*$", re.MULTILINE)
    if not pattern.search(text):
        return text.rstrip("\n") + f"\n{key}={value}\n"
    return pattern.sub(lambda _m: f"{key}={value}", text, count=1)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--force", action="store_true", help="overwrite an existing .env")
    args = parser.parse_args()

    if TARGET.exists() and not args.force:
        print(f"{TARGET} already exists - nothing changed. Use --force to replace it.")  # noqa: T201
        return 0
    if not EXAMPLE.exists():
        print(f"Missing {EXAMPLE}", file=sys.stderr)  # noqa: T201
        return 1

    text = EXAMPLE.read_text(encoding="utf-8")
    text = _set(text, "SECRET_KEY", secrets.token_urlsafe(48))
    text = _set(text, "REMINDER_ENCRYPTION_KEY", secrets.token_urlsafe(48))
    TARGET.write_text(text, encoding="utf-8")
    print(f"Wrote {TARGET}")  # noqa: T201
    print("Back up REMINDER_ENCRYPTION_KEY: without it saved reminders cannot be read again.")  # noqa: T201
    print("Optional: add GEMINI_API_KEYS=... for Quick Add (AI).")  # noqa: T201
    return 0


if __name__ == "__main__":
    sys.exit(main())
