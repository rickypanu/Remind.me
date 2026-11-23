"""One shared outbound HTTP client (finding P5).

Every Telegram call, Brevo e-mail and webhook registration used to open its own ``httpx.AsyncClient``, which
means a new TCP + TLS handshake per message. The lifespan creates ONE client (connection pool with keep-alive),
everything borrows it through :func:`get_http_client`, and the lifespan closes it on shutdown.
"""

import logging

import httpx

from app.core.config import Settings, get_settings

log = logging.getLogger("http")

_client: httpx.AsyncClient | None = None


def build_http_client(settings: Settings) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=httpx.Timeout(settings.http_timeout_seconds, connect=5.0),
        limits=httpx.Limits(
            max_connections=settings.http_max_connections,
            max_keepalive_connections=max(5, settings.http_max_connections // 2),
            keepalive_expiry=30.0,
        ),
        follow_redirects=False,  # an API answer that redirects is never legitimate here
        headers={"User-Agent": "RemindMe/1.0"},
    )


def set_http_client(client: httpx.AsyncClient | None) -> None:
    global _client
    _client = client


def get_http_client() -> httpx.AsyncClient:
    """The shared client. Created lazily when nothing has set one (scripts, tests); the lifespan sets it explicitly."""
    global _client
    if _client is None:
        log.debug("Creating the shared HTTP client lazily")
        _client = build_http_client(get_settings())
    return _client


async def close_http_client() -> None:
    global _client
    client, _client = _client, None
    if client is not None:
        await client.aclose()
