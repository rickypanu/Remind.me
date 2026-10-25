"""Reject oversized request bodies before they are read into memory (findings S10, S13).

Pure ASGI. Two checks:
  * a declared ``Content-Length`` above the limit is answered with 413 immediately;
  * a body streamed without (or lying about) its length is counted as it arrives and cut off at the limit.

The limit is per path prefix, so the avatar upload gets room for a 2 MB image plus multipart overhead while every
other endpoint stays small.
"""

import json
from collections.abc import Mapping

from starlette.types import ASGIApp, Message, Receive, Scope, Send

_TOO_LARGE = json.dumps({"detail": "Request body is too large."}).encode()


class _BodyTooLarge(Exception):
    pass


class BodySizeLimitMiddleware:
    def __init__(self, app: ASGIApp, *, default_limit: int, path_limits: Mapping[str, int] | None = None) -> None:
        self.app = app
        self.default_limit = default_limit
        self.path_limits = dict(path_limits or {})

    def _limit_for(self, path: str) -> int:
        return self.path_limits.get(path, self.default_limit)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] in ("GET", "HEAD", "OPTIONS"):
            await self.app(scope, receive, send)
            return

        limit = self._limit_for(scope.get("path", ""))
        declared = None
        for name, value in scope["headers"]:
            if name == b"content-length":
                try:
                    declared = int(value)
                except ValueError:
                    declared = None
                break
        if declared is not None and declared > limit:
            await self._reject(send)
            return

        received = 0
        response_started = False

        async def counting_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    raise _BodyTooLarge
            return message

        async def tracking_send(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, counting_receive, tracking_send)
        except _BodyTooLarge:
            if not response_started:
                await self._reject(send)

    @staticmethod
    async def _reject(send: Send) -> None:
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(_TOO_LARGE)).encode()),
                    (b"connection", b"close"),
                ],
            }
        )
        await send({"type": "http.response.body", "body": _TOO_LARGE})
