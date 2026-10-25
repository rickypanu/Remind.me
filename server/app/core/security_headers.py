"""HTTP security headers for every API response (finding S13).

A pure ASGI middleware (not BaseHTTPMiddleware), so it adds no per-request task overhead, never buffers
streaming bodies and also decorates error responses produced by other middleware.

Headers set on every response (a route's own value is kept when it sets one, e.g. the avatar endpoint):

  X-Content-Type-Options: nosniff                 browsers must trust Content-Type, never guess
  X-Frame-Options: DENY                           the API is never framed
  Referrer-Policy: no-referrer
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin       avatars override this with cross-origin (the SPA shows them)
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'
  Cache-Control: no-store                         for API responses that do not set their own caching
  Strict-Transport-Security                       production only (it is meaningless over plain http)

Swagger UI / ReDoc (development only) need scripts and styles, so ``/docs``, ``/redoc`` skip the CSP.
"""

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
HSTS = "max-age=63072000; includeSubDomains"
DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")

STATIC_HEADERS: tuple[tuple[str, str], ...] = (
    ("X-Content-Type-Options", "nosniff"),
    ("X-Frame-Options", "DENY"),
    ("Referrer-Policy", "no-referrer"),
    ("Cross-Origin-Opener-Policy", "same-origin"),
    ("Cross-Origin-Resource-Policy", "same-origin"),
    ("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()"),
    ("X-Permitted-Cross-Domain-Policies", "none"),
)


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp, *, hsts: bool = False) -> None:
        self.app = app
        self.hsts = hsts

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        is_docs = path.startswith(DOCS_PATHS)

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                for name, value in STATIC_HEADERS:
                    if name not in headers:
                        headers[name] = value
                if not is_docs and "Content-Security-Policy" not in headers:
                    headers["Content-Security-Policy"] = API_CSP
                if "Cache-Control" not in headers:
                    headers["Cache-Control"] = "no-store"
                if self.hsts and "Strict-Transport-Security" not in headers:
                    headers["Strict-Transport-Security"] = HSTS
                if "server" in headers:
                    del headers["server"]  # uvicorn adds its own; run it with --no-server-header as well
            await send(message)

        await self.app(scope, receive, send_with_headers)
