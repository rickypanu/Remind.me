"""Rate limiting with slowapi (finding S5).

One shared ``Limiter``. Storage is Redis when REDIS_URL is set, so limits are shared between workers and survive
restarts; otherwise memory (development, or a single production instance with ALLOW_IN_MEMORY_RATE_LIMIT).

Keys
    * Requests that carry a valid access token are counted per USER, so a whole campus behind one NAT address is
      not throttled as a single client.
    * Everything else (login, sign-up, forgot-password, ...) is counted per client IP.

Client IP
    ``request.client.host`` is the proxy's address when the app runs behind Vercel / Render / nginx. With
    TRUSTED_PROXY_HOPS=N the address N entries from the right of X-Forwarded-For is used (the entry the outermost
    trusted proxy appended). With 0 (default) the header is ignored completely, so a client cannot spoof it.
"""

import ipaddress
import logging

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded

from app.core.config import get_settings
from utils.security import decode_access_token

log = logging.getLogger("rate_limit")
settings = get_settings()


def client_ip(request: Request) -> str:
    hops = settings.trusted_proxy_hops
    fallback = request.client.host if request.client else "unknown"
    if hops <= 0:
        return fallback
    forwarded = request.headers.get("x-forwarded-for", "")
    parts = [part.strip() for part in forwarded.split(",") if part.strip()]
    if len(parts) < hops:
        return fallback
    candidate = parts[-hops]
    try:
        return str(ipaddress.ip_address(candidate))
    except ValueError:
        return fallback


def rate_limit_key(request: Request) -> str:
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() == "bearer" and token:
        payload = decode_access_token(token.strip())  # signature-checked, so the key cannot be forged
        if payload is not None:
            return f"user:{payload['sub']}"
    return f"ip:{client_ip(request)}"


def ip_key(request: Request) -> str:
    """For endpoints that run before login: always the IP, whatever headers the caller sends."""
    return f"ip:{client_ip(request)}"


limiter = Limiter(
    key_func=rate_limit_key,
    storage_uri=settings.rate_limit_storage_uri,
    default_limits=[settings.rate_limit_default],
    enabled=settings.rate_limit_enabled,
    headers_enabled=False,  # slowapi's header injection needs a Response argument on every route; skip it
    strategy="fixed-window",
)


class Limits:
    """The limit strings, read once from Settings (so routes never hard-code them)."""

    login = settings.rate_limit_login
    signup = settings.rate_limit_signup
    forgot_password = settings.rate_limit_forgot_password
    reset_password = settings.rate_limit_reset_password
    refresh = settings.rate_limit_refresh
    magic_add = settings.rate_limit_magic_add
    avatar = settings.rate_limit_avatar
    telegram_link = settings.rate_limit_telegram_link
    admin = settings.rate_limit_admin


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    log.warning("Rate limit hit: %s %s (%s)", request.method, request.url.path, exc.detail)
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please wait a moment and try again."},
        headers={"Retry-After": "60"},
    )
