"""Slow-request logging and a ``Server-Timing`` header (performance finding: "10-20 s to load").

You cannot fix what you cannot see. Every response carries ``Server-Timing: app;dur=<ms>`` (visible in the browser's
Network tab, under Timing), and any request slower than ``SLOW_REQUEST_MS`` is logged as one WARNING line with its
method, path, status and duration, so a slow endpoint shows up in the logs the first time it happens.

Pure ASGI: no per-request task or buffering, unlike ``BaseHTTPMiddleware``.
"""

import logging
import time

from starlette.types import ASGIApp, Message, Receive, Scope, Send

log = logging.getLogger("timing")


class TimingMiddleware:
    def __init__(self, app: ASGIApp, *, slow_ms: int = 1500) -> None:
        self.app = app
        self.slow_ms = slow_ms

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        started = time.perf_counter()
        status = 0

        async def send_with_timing(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                elapsed = (time.perf_counter() - started) * 1000
                headers = list(message.get("headers", []))
                headers.append((b"server-timing", f"app;dur={elapsed:.0f}".encode("ascii")))
                message = {**message, "headers": headers}
            await send(message)

        try:
            await self.app(scope, receive, send_with_timing)
        finally:
            elapsed_ms = (time.perf_counter() - started) * 1000
            if elapsed_ms >= self.slow_ms:
                log.warning("Slow request: %s %s -> %s in %.0f ms", scope["method"], scope["path"], status, elapsed_ms)
