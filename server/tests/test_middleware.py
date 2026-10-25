"""Security-header and body-size middlewares (S13, S10), driven through raw ASGI."""

import json
import unittest

from tests import auth_stubs  # noqa: F401  (must stay first: it prepares the test environment)

# isort: split

from app.core.body_limit import BodySizeLimitMiddleware  # noqa: E402
from app.core.security_headers import API_CSP, SecurityHeadersMiddleware  # noqa: E402


async def call(app, path="/", method="GET", headers=None, body_chunks=(b"",)):
    scope = {
        "type": "http", "method": method, "path": path, "headers": [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()],
    }
    chunks = list(body_chunks)

    async def receive():
        if chunks:
            data = chunks.pop(0)
            return {"type": "http.request", "body": data, "more_body": bool(chunks)}
        return {"type": "http.disconnect"}

    sent = []

    async def send(message):
        sent.append(message)

    await app(scope, receive, send)
    start = next(m for m in sent if m["type"] == "http.response.start")
    body = b"".join(m.get("body", b"") for m in sent if m["type"] == "http.response.body")
    return start["status"], {k.decode().lower(): v.decode() for k, v in start["headers"]}, body


def make_app(extra_headers=None, status=200):
    async def app(scope, receive, send):
        headers = [(b"content-type", b"application/json"), (b"server", b"uvicorn")]
        headers += [(k.lower().encode(), v.encode()) for k, v in (extra_headers or {}).items()]  # ASGI: names are lowercase
        await send({"type": "http.response.start", "status": status, "headers": headers})
        await send({"type": "http.response.body", "body": b"{}"})

    return app


class SecurityHeadersTests(unittest.IsolatedAsyncioTestCase):
    async def test_all_headers_present(self):
        _, h, _ = await call(SecurityHeadersMiddleware(make_app()))
        self.assertEqual(h["x-content-type-options"], "nosniff")
        self.assertEqual(h["x-frame-options"], "DENY")
        self.assertEqual(h["referrer-policy"], "no-referrer")
        self.assertEqual(h["cross-origin-opener-policy"], "same-origin")
        self.assertEqual(h["cross-origin-resource-policy"], "same-origin")
        self.assertEqual(h["content-security-policy"], API_CSP)
        self.assertEqual(h["cache-control"], "no-store")
        self.assertIn("camera=()", h["permissions-policy"])
        self.assertNotIn("strict-transport-security", h)
        self.assertNotIn("server", h)

    async def test_hsts_only_when_enabled(self):
        _, h, _ = await call(SecurityHeadersMiddleware(make_app(), hsts=True))
        self.assertIn("max-age=63072000", h["strict-transport-security"])

    async def test_a_routes_own_headers_win(self):
        own = {"Cache-Control": "public, max-age=86400", "Cross-Origin-Resource-Policy": "cross-origin", "Content-Security-Policy": "default-src 'none'; sandbox"}
        _, h, _ = await call(SecurityHeadersMiddleware(make_app(own)))
        self.assertEqual(h["cache-control"], "public, max-age=86400")
        self.assertEqual(h["cross-origin-resource-policy"], "cross-origin")
        self.assertEqual(h["content-security-policy"], "default-src 'none'; sandbox")

    async def test_error_responses_get_headers_too(self):
        status, h, _ = await call(SecurityHeadersMiddleware(make_app(status=500)))
        self.assertEqual(status, 500)
        self.assertEqual(h["x-content-type-options"], "nosniff")

    async def test_docs_pages_skip_the_csp_but_keep_the_rest(self):
        _, h, _ = await call(SecurityHeadersMiddleware(make_app()), path="/docs")
        self.assertNotIn("content-security-policy", h)
        self.assertEqual(h["x-frame-options"], "DENY")

    async def test_non_http_scopes_pass_through(self):
        seen = []

        async def app(scope, receive, send):
            seen.append(scope["type"])

        await SecurityHeadersMiddleware(app)({"type": "lifespan"}, None, None)
        self.assertEqual(seen, ["lifespan"])


class BodyLimitTests(unittest.IsolatedAsyncioTestCase):
    @staticmethod
    def reading_app():
        async def app(scope, receive, send):
            total = 0
            while True:
                message = await receive()
                if message["type"] != "http.request":
                    break
                total += len(message["body"])
                if not message.get("more_body"):
                    break
            await send({"type": "http.response.start", "status": 200, "headers": [(b"content-type", b"text/plain")]})
            await send({"type": "http.response.body", "body": str(total).encode()})

        return app

    def middleware(self):
        return BodySizeLimitMiddleware(self.reading_app(), default_limit=100, path_limits={"/big": 1000})

    async def test_small_body_passes(self):
        status, _, body = await call(self.middleware(), method="POST", headers={"content-length": "50"}, body_chunks=(b"x" * 50,))
        self.assertEqual((status, body), (200, b"50"))

    async def test_declared_length_over_limit_is_rejected_without_reading(self):
        status, h, body = await call(self.middleware(), method="POST", headers={"content-length": "101"}, body_chunks=(b"x" * 101,))
        self.assertEqual(status, 413)
        self.assertEqual(json.loads(body)["detail"], "Request body is too large.")

    async def test_streamed_body_over_limit_is_cut_off(self):
        # no content-length header (chunked upload) or a lying one
        for headers in ({}, {"content-length": "10"}):
            with self.subTest(headers=headers):
                status, _, _ = await call(self.middleware(), method="POST", headers=headers, body_chunks=(b"x" * 60, b"x" * 60))
                self.assertEqual(status, 413)

    async def test_per_path_limit(self):
        status, _, _ = await call(self.middleware(), path="/big", method="POST", headers={"content-length": "900"}, body_chunks=(b"x" * 900,))
        self.assertEqual(status, 200)
        status, _, _ = await call(self.middleware(), path="/big", method="POST", headers={"content-length": "1001"}, body_chunks=(b"x" * 1001,))
        self.assertEqual(status, 413)

    async def test_get_requests_are_not_inspected(self):
        status, _, _ = await call(self.middleware(), method="GET", headers={"content-length": "5000"})
        self.assertEqual(status, 200)

    async def test_garbage_content_length_falls_back_to_counting(self):
        status, _, _ = await call(self.middleware(), method="POST", headers={"content-length": "abc"}, body_chunks=(b"x" * 200,))
        self.assertEqual(status, 413)


if __name__ == "__main__":
    unittest.main()
