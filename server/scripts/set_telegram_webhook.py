"""Register (or re-register) the Telegram webhook WITH the secret token (finding S2).

Telegram only sends the ``X-Telegram-Bot-Api-Secret-Token`` header if the webhook was registered with
``secret_token``. Run this once after deploying (and whenever TELEGRAM_WEBHOOK_SECRET changes):

    python -m scripts.set_telegram_webhook https://your-api.example.com/v1/integrations/telegram/webhook
    python -m scripts.set_telegram_webhook https://your-api.example.com/v1/integrations/telegram/webhook --drop-pending

Until it has run, the new webhook answers 403 to every update.
"""

import argparse
import asyncio
import sys
from urllib.parse import urlparse

from app.core.config import get_settings
from app.core.http import build_http_client, close_http_client, set_http_client
from app.integrations.telegram import get_telegram

WEBHOOK_PATHS = ("/v1/integrations/telegram/webhook", "/telegram/webhook")  # the second is the legacy URL


async def main(url: str, drop_pending: bool) -> int:
    settings = get_settings()
    secret = settings.telegram_webhook_secret
    if not settings.telegram_enabled or secret is None:
        print("TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET must be set in server/.env", file=sys.stderr)
        return 2
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.path.rstrip("/") not in WEBHOOK_PATHS:
        print("The URL must be https://<your-api-host>/v1/integrations/telegram/webhook", file=sys.stderr)
        return 2

    set_http_client(build_http_client(settings))
    try:
        ok = await get_telegram().set_webhook(url, secret.get_secret_value(), drop_pending_updates=drop_pending)
    finally:
        await close_http_client()
    print("Webhook registered with a secret token." if ok else "Telegram refused the request (see the log above).")
    return 0 if ok else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("url", help="public https URL of POST /v1/integrations/telegram/webhook")
    parser.add_argument("--drop-pending", action="store_true", help="discard updates queued while the webhook was down")
    args = parser.parse_args()
    sys.exit(asyncio.run(main(args.url, args.drop_pending)))
