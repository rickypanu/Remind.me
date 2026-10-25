"""Web Push: subscription validation and delivery (finding S4).

THE RISK. A push subscription contains an ``endpoint`` URL and the server POSTs to it every time a reminder
fires. If a user may store any URL, they can make the server call ``http://169.254.169.254/...`` (cloud metadata)
or any internal service (SSRF). Defences, all of them applied:

  1. Registration accepts only https endpoints on the push services' own hosts (Google FCM, Mozilla autopush,
     Apple Web Push, and Microsoft WNS for Edge): exact host match, no credentials in the URL, port 443 only,
     no IP literals, plain printable ASCII.
  2. The same check runs again immediately before every send, so subscriptions stored by the OLD code (which
     accepted anything) can never be called; they are reported as ``INVALID`` and removed.
  3. Redirects are never followed when the push request is made.
  4. A user can store at most ``MAX_PUSH_SUBSCRIPTIONS`` devices.
"""

import asyncio
import json
import logging
import re
from enum import Enum
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.config import get_settings

log = logging.getLogger("webpush")

ALLOWED_PUSH_HOSTS = frozenset(
    {
        "fcm.googleapis.com",  # Chrome, Edge-on-FCM, Android browsers
        "updates.push.services.mozilla.com",  # Firefox
        "web.push.apple.com",  # Safari / iOS home-screen apps
    }
)
WINDOWS_PUSH_SUFFIX = ".notify.windows.com"  # Microsoft Edge (WNS); switchable with PUSH_ALLOW_WINDOWS
MAX_ENDPOINT_CHARS = 2048
PUSH_TTL_SECONDS = 60 * 60  # a reminder that could not be delivered within an hour is stale
PUSH_TIMEOUT_SECONDS = 10

_PRINTABLE_ASCII_RE = re.compile(r"^[\x21-\x7e]+$")  # no spaces, controls or non-ASCII (also rules out IDN tricks)
_BASE64URL_RE = re.compile(r"^[A-Za-z0-9_-]+={0,2}$")
_IPV4_RE = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")


class PushEndpointError(ValueError):
    pass


def validate_push_endpoint(endpoint: str, *, allow_windows: bool | None = None) -> str:
    """Return ``endpoint`` unchanged when it points at a real push service, else raise :class:`PushEndpointError`."""
    if allow_windows is None:
        allow_windows = get_settings().push_allow_windows
    if not isinstance(endpoint, str) or not endpoint or len(endpoint) > MAX_ENDPOINT_CHARS:
        raise PushEndpointError("Unsupported push service.")
    if not _PRINTABLE_ASCII_RE.match(endpoint) or "\\" in endpoint:
        raise PushEndpointError("Unsupported push service.")
    try:
        parts = urlsplit(endpoint)
        host = (parts.hostname or "").lower()
        port = parts.port
    except ValueError:
        raise PushEndpointError("Unsupported push service.") from None

    if parts.scheme != "https" or not host or parts.username is not None or parts.password is not None:
        raise PushEndpointError("Unsupported push service.")
    if port not in (None, 443):
        raise PushEndpointError("Unsupported push service.")
    # urlsplit() and the HTTP client must agree on the host: the raw netloc may only be "host" or "host:443".
    if parts.netloc.lower() not in (host, f"{host}:443"):
        raise PushEndpointError("Unsupported push service.")
    if _IPV4_RE.match(host) or ":" in host or host.startswith("[") or host.endswith("."):
        raise PushEndpointError("Unsupported push service.")

    if host in ALLOWED_PUSH_HOSTS:
        return endpoint
    if allow_windows and host.endswith(WINDOWS_PUSH_SUFFIX) and len(host) > len(WINDOWS_PUSH_SUFFIX):
        return endpoint
    raise PushEndpointError("Unsupported push service.")


class PushKeys(BaseModel):
    model_config = ConfigDict(extra="forbid")

    p256dh: str = Field(min_length=20, max_length=200)
    auth: str = Field(min_length=8, max_length=100)

    @field_validator("p256dh", "auth")
    @classmethod
    def _base64url(cls, value: str) -> str:
        if not _BASE64URL_RE.match(value):
            raise ValueError("must be base64url text")
        return value


class PushSubscription(BaseModel):
    """What ``PushSubscription.toJSON()`` produces in the browser."""

    model_config = ConfigDict(extra="forbid")

    endpoint: str = Field(max_length=MAX_ENDPOINT_CHARS)
    keys: PushKeys
    expirationTime: float | None = None  # accepted (browsers send it), never stored

    @field_validator("endpoint")
    @classmethod
    def _endpoint_is_a_push_service(cls, value: str) -> str:
        try:
            return validate_push_endpoint(value)
        except PushEndpointError as exc:
            raise ValueError(str(exc)) from None

    def to_storage(self) -> dict:
        return {"endpoint": self.endpoint, "keys": {"p256dh": self.keys.p256dh, "auth": self.keys.auth}}


class PushOutcome(str, Enum):
    SENT = "sent"
    GONE = "gone"  # 404 / 410: the browser unsubscribed; delete it
    INVALID = "invalid"  # endpoint or keys are not acceptable (legacy / tampered data); delete it
    FAILED = "failed"  # push service error or timeout: keep the subscription, retry later
    DISABLED = "disabled"  # VAPID is not configured


class WebPushSender:
    """Sends one push message. pywebpush is synchronous, so each call runs in a worker thread."""

    def __init__(self) -> None:
        settings = get_settings()
        self.enabled = settings.push_enabled
        self._private_key = settings.vapid_private_key.get_secret_value() if settings.vapid_private_key else None
        self._claims = settings.vapid_claims

    async def send(self, subscription: dict, title: str, body: str) -> PushOutcome:
        if not self.enabled or not self._private_key or not self._claims:
            return PushOutcome.DISABLED
        try:
            endpoint = validate_push_endpoint(subscription.get("endpoint", ""))
            keys = subscription.get("keys") or {}
            checked = PushSubscription.model_validate({"endpoint": endpoint, "keys": keys})
        except (PushEndpointError, ValueError, AttributeError):
            return PushOutcome.INVALID

        payload = json.dumps({"title": title[:200], "body": body[:500]})
        try:
            status = await asyncio.to_thread(self._send_blocking, checked.to_storage(), payload)
        except Exception as exc:  # noqa: BLE001 - classify, never let one device break a delivery batch
            status = getattr(getattr(exc, "response", None), "status_code", None)
            if status in (404, 410):
                return PushOutcome.GONE
            log.warning("Web push failed (HTTP %s): %s", status, type(exc).__name__)
            return PushOutcome.FAILED
        if status in (404, 410):
            return PushOutcome.GONE
        return PushOutcome.SENT

    def _send_blocking(self, subscription: dict, payload: str) -> int | None:
        # Imported here so merely importing this module never needs the optional native dependencies.
        import requests
        from pywebpush import webpush

        class NoRedirectSession(requests.Session):
            def request(self, method, url, **kwargs):  # type: ignore[override]
                kwargs["allow_redirects"] = False
                return super().request(method, url, **kwargs)

        with NoRedirectSession() as session:
            response = webpush(
                subscription_info=subscription,
                data=payload,
                vapid_private_key=self._private_key,
                vapid_claims=dict(self._claims),  # pywebpush adds aud/exp to the dict it is given
                ttl=PUSH_TTL_SECONDS,
                timeout=PUSH_TIMEOUT_SECONDS,
                requests_session=session,
            )
        return getattr(response, "status_code", None)
