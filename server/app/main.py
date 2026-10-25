"""Application factory (findings A6, A9).

``create_app()`` builds a fresh FastAPI instance, so tests can make one per test with their own settings and
database. ``app`` (module level) is the instance uvicorn serves: ``uvicorn app.main:app`` (the old ``main:app`` still
works through the shim in ``server/main.py``).
"""

from pathlib import Path

from dotenv import load_dotenv

# Legacy modules that have not moved to Settings yet (utils/crypto.py, the notification schedulers) still read
# os.environ, so populate it from server/.env before they are imported.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI, Request  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.middleware.gzip import GZipMiddleware  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402
from slowapi.errors import RateLimitExceeded  # noqa: E402
from slowapi.middleware import SlowAPIMiddleware  # noqa: E402

from app.api.legacy import legacy_router  # noqa: E402
from app.api.uploads import router as uploads_router  # noqa: E402
from app.api.v1 import api_router  # noqa: E402
from app.core.body_limit import BodySizeLimitMiddleware  # noqa: E402
from app.core.config import Settings, get_settings  # noqa: E402
from app.core.errors import AppError  # noqa: E402
from app.core.lifespan import lifespan  # noqa: E402
from app.core.rate_limit import limiter, rate_limit_exceeded_handler  # noqa: E402
from app.core.security_headers import SecurityHeadersMiddleware  # noqa: E402
from app.core.timing import TimingMiddleware  # noqa: E402
from app.services.avatars import MAX_AVATAR_BYTES  # noqa: E402
from schemas.notification import HealthResponse, WelcomeResponse  # noqa: E402

_WEBHOOK_BODY_LIMIT = 64 * 1024  # a real Telegram update is a few KB (S2)


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """The ONE place a domain error becomes an HTTP response: ``{"detail": ..., "code": ...}``."""
    return JSONResponse(status_code=exc.status_code, content=exc.body(), headers=exc.headers)


def create_app(settings: Settings | None = None, *, use_lifespan: bool = True) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(
        title="RemindMe API",
        version="1.0.0",
        lifespan=lifespan if use_lifespan else None,
        redirect_slashes=False,  # a 307 on POST is a round trip (and a CORS pre-flight failure) for nothing
        # API docs are only served outside production.
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url="/redoc" if settings.docs_enabled else None,
        openapi_url="/openapi.json" if settings.docs_enabled else None,
    )

    # --- errors and rate limiting (S5) ----------------------------------------------------------------
    app.state.limiter = limiter
    app.add_exception_handler(AppError, app_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)  # type: ignore[arg-type]

    # --- middleware -----------------------------------------------------------------------------------
    # Starlette runs the LAST one added first. Request path: security headers -> CORS -> body limit -> rate limit
    # -> app. Security headers sit outermost so they also decorate CORS pre-flights and every 4xx/5xx; CORS sits
    # outside the limiters so a 413 or 429 still carries CORS headers and the browser can read the message.
    # Innermost: compress large JSON (the reminder list is repetitive text and shrinks about 5-10x, which is most of
    # the download time on a phone connection). Small responses are left alone.
    app.add_middleware(GZipMiddleware, minimum_size=settings.gzip_min_bytes)
    app.add_middleware(SlowAPIMiddleware)
    app.add_middleware(
        BodySizeLimitMiddleware,
        default_limit=settings.max_request_body_bytes,
        # 2 MB image + multipart framing; the image itself is checked again, byte by byte, while it is read.
        path_limits={
            "/v1/user/avatar": MAX_AVATAR_BYTES + 64 * 1024,
            "/user/avatar": MAX_AVATAR_BYTES + 64 * 1024,
            "/v1/integrations/telegram/webhook": _WEBHOOK_BODY_LIMIT,
            "/telegram/webhook": _WEBHOOK_BODY_LIMIT,
        },
    )
    # Explicit origins only (CORS_ORIGINS). Any localhost port is added in development/test only.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.cors_origin_regex,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
        allow_headers=["Authorization", "Content-Type", "Accept"],
        max_age=600,
    )
    app.add_middleware(SecurityHeadersMiddleware, hsts=settings.is_production)
    # Outermost: times the whole request, including every middleware above, and logs the slow ones.
    app.add_middleware(TimingMiddleware, slow_ms=settings.slow_request_ms)

    # --- routes ---------------------------------------------------------------------------------------
    app.include_router(api_router)
    app.include_router(uploads_router)
    if settings.legacy_api_enabled:
        app.include_router(legacy_router)

    @app.get("/", response_model=WelcomeResponse, tags=["Health"])
    async def root() -> WelcomeResponse:
        return WelcomeResponse(message="Welcome to the RemindMe API")

    @app.api_route("/health", methods=["GET", "HEAD"], response_model=HealthResponse, tags=["Health"])
    def health_check() -> HealthResponse:
        """Endpoint for UptimeRobot to ping and keep the server awake."""
        return HealthResponse(status="ok", message="Remind me backend is active and awake")

    return app


app = create_app()
