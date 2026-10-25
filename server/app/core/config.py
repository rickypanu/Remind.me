"""Typed, fail-fast application settings.

Implements audit findings A5 (one typed settings object), S3 (no fallback JWT
secret, minimum length enforced), S5 (rate-limit configuration) and S16 (strict
CORS). Every environment variable the server reads is declared here, validated
once at boot, and exposed as a typed attribute.

    from app.core.config import get_settings

    settings = get_settings()                       # raises ValidationError if invalid
    settings.secret_key.get_secret_value()          # secrets are SecretStr, never logged

Design rules
------------
* Secrets have NO defaults. A missing or weak secret stops the server before it
  serves a single request.
* All problems are reported together, so one boot attempt shows everything to fix.
* ``ENVIRONMENT=production`` switches on the strict checks (https, no localhost,
  Redis for rate limiting, email configured).
* Variable names match the ones the legacy code already reads with ``os.getenv``,
  so migrating modules one by one is safe.
"""

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any, Literal
from urllib.parse import urlsplit

from pydantic import EmailStr, Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

SERVER_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = SERVER_DIR / ".env"

Environment = Literal["development", "test", "staging", "production"]
LogLevel = Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
JwtAlgorithm = Literal["HS256", "HS384", "HS512"]

MIN_SECRET_LENGTH = 32
MIN_DISTINCT_CHARS = 12

# Substrings that prove a value was copied from documentation instead of generated.
_PLACEHOLDER_MARKERS = (
    "your_secret",
    "your-secret",
    "changeme",
    "change-me",
    "change_me",
    "replace",
    "placeholder",
    "example",
    "generate",
    "xxxxxxxx",
)

_LOCAL_HOSTS = frozenset({"localhost", "127.0.0.1", "::1", "0.0.0.0"})  # noqa: S104 - a deny-list, not a bind address
_MONGO_LOCAL_HOST_RE = re.compile(
    r"(?:^|[/@,])(?:localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(?::\d+)?(?=[,/?]|$)", re.IGNORECASE
)
_LOCALHOST_ORIGIN_REGEX = r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$"

_ORIGIN_RE = re.compile(
    r"^https?://"
    r"(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*|\[::1\])"
    r"(?::\d{1,5})?$"
)
_RATE_LIMIT_RE = re.compile(r"^[1-9]\d{0,5}/(?:second|minute|hour|day)$")
_TELEGRAM_SECRET_RE = re.compile(r"^[A-Za-z0-9_-]{32,256}$")
_BOT_USERNAME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_]{4,31}$")
_DATABASE_NAME_RE = re.compile(r"^[A-Za-z0-9_-]{1,63}$")
_TELEGRAM_ID_RE = re.compile(r"^-?\d{1,20}$")

_RATE_LIMIT_FIELDS = (
    "rate_limit_default",
    "rate_limit_login",
    "rate_limit_signup",
    "rate_limit_forgot_password",
    "rate_limit_magic_add",
    "rate_limit_avatar",
    "rate_limit_reset_password",
    "rate_limit_refresh",
    "rate_limit_telegram_link",
    "rate_limit_admin",
)


def _strip_quotes(value: Any) -> Any:
    """Trim whitespace and one pair of matching quotes (``KEY="value"`` in a .env file)."""
    if isinstance(value, str):
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
            value = value[1:-1].strip()
    return value


def _split_csv(value: Any) -> Any:
    """``"a, b"`` -> ``["a", "b"]``. JSON arrays and real lists pass through untouched."""
    if isinstance(value, str):
        text = _strip_quotes(value)
        if text.startswith("["):
            return json.loads(text)
        parts = (_strip_quotes(part) for part in text.split(","))
        return [part for part in parts if part]
    return value


def _secret_problems(label: str, value: str, min_length: int = MIN_SECRET_LENGTH) -> list[str]:
    """Reasons why ``value`` is not an acceptable secret (empty list = fine)."""
    problems: list[str] = []
    if len(value) < min_length:
        problems.append(f"{label} must be at least {min_length} characters (got {len(value)})")
    lowered = value.lower()
    if any(marker in lowered for marker in _PLACEHOLDER_MARKERS):
        problems.append(f"{label} looks like a placeholder; generate a random value instead")
    if len(set(value)) < MIN_DISTINCT_CHARS:
        problems.append(f"{label} has too little variety; generate a random value instead")
    return problems


def _is_local_url(url: str) -> bool:
    """True for http(s) URLs that point at this machine."""
    return (urlsplit(url).hostname or "") in _LOCAL_HOSTS


def _mongodb_url_is_local(url: str) -> bool:
    """True when any host in a mongodb:// connection string is this machine (credentials and host lists handled)."""
    return bool(_MONGO_LOCAL_HOST_RE.search(url))


class Settings(BaseSettings):
    """All server configuration. Field name == environment variable (case-insensitive)."""

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        env_ignore_empty=True,  # `KEY=` in .env means "not set"
        frozen=True,
    )

    # ---- runtime -------------------------------------------------------------------------
    environment: Environment = "development"
    log_level: LogLevel = "INFO"
    slow_request_ms: int = Field(default=1500, ge=100, le=60000)  # requests slower than this are logged as WARNING
    gzip_min_bytes: int = Field(default=1024, ge=200, le=100000)  # compress JSON responses larger than this

    # ---- database ------------------------------------------------------------------------
    mongodb_url: SecretStr = SecretStr("mongodb://localhost:27017")
    database_name: str = "remindme"
    mongodb_server_selection_timeout_ms: int = Field(default=5000, ge=1000, le=60000)
    # Connection pool. Keeping a few connections open avoids a new TCP + TLS handshake to the database on the first
    # request after a quiet moment (hundreds of ms against a remote cluster); recycling idle ones before a proxy or
    # the database drops them avoids a failed first query on a dead socket.
    mongodb_max_pool_size: int = Field(default=30, ge=5, le=200)
    mongodb_min_pool_size: int = Field(default=2, ge=0, le=50)
    mongodb_max_idle_ms: int = Field(default=45000, ge=5000, le=600000)
    mongodb_compression: bool = True  # zlib on the wire: smaller payloads between the API and a remote cluster

    # ---- authentication ------------------------------------------------------------------
    secret_key: SecretStr
    algorithm: JwtAlgorithm = "HS256"
    access_token_expire_minutes: int = Field(default=15, ge=5, le=60)  # short-lived (S9); refreshed silently
    refresh_token_expire_days: int = Field(default=30, ge=1, le=90)
    password_reset_expire_minutes: int = Field(default=60, ge=5, le=180)

    # ---- reminder encryption -------------------------------------------------------------
    reminder_encryption_key: SecretStr
    reminder_encryption_key_previous: Annotated[list[SecretStr], NoDecode] = Field(default_factory=list)

    # ---- web -----------------------------------------------------------------------------
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"]
    )
    frontend_url: str = "http://localhost:5173"

    # ---- rate limiting -------------------------------------------------------------------
    redis_url: SecretStr | None = None
    allow_in_memory_rate_limit: bool = False
    rate_limit_enabled: bool = True
    rate_limit_default: str = "120/minute"
    rate_limit_login: str = "5/minute"
    rate_limit_signup: str = "5/hour"
    rate_limit_forgot_password: str = "3/hour"
    rate_limit_magic_add: str = "10/hour"
    rate_limit_avatar: str = "10/hour"
    rate_limit_reset_password: str = "10/hour"
    rate_limit_refresh: str = "60/minute"
    rate_limit_telegram_link: str = "10/hour"
    rate_limit_admin: str = "5/minute"
    # How many reverse proxies sit in front of the API and append to X-Forwarded-For (0 = none, trust nothing).
    # Vercel/Render/Fly/Heroku-style hosts: 1. Wrong values let clients spoof their IP and dodge rate limits.
    trusted_proxy_hops: int = Field(default=0, ge=0, le=5)

    # ---- request size limits -------------------------------------------------------------
    max_request_body_bytes: int = Field(default=2 * 1024 * 1024, ge=16 * 1024, le=20 * 1024 * 1024)

    # ---- outbound HTTP (one shared client, created at start-up) ------------------------------
    http_timeout_seconds: float = Field(default=10.0, ge=1, le=60)
    http_max_connections: int = Field(default=50, ge=5, le=500)

    # ---- reminder delivery ---------------------------------------------------------------
    scheduler_enabled: bool = True  # false: this process serves the API only (run the scheduler elsewhere)
    scheduler_concurrency: int = Field(default=10, ge=1, le=50)  # simultaneous Telegram / push sends
    telegram_link_ttl_minutes: int = Field(default=10, ge=2, le=60)
    max_push_subscriptions: int = Field(default=10, ge=1, le=50)  # devices per user
    push_allow_windows: bool = True  # also accept *.notify.windows.com (Microsoft Edge); Google/Mozilla/Apple always

    # ---- API surface and sync --------------------------------------------------------------
    # also serve the un-versioned routes (/auth, /tasks, ...) for already-installed clients
    legacy_api_enabled: bool = True
    tombstone_retention_days: int = Field(default=30, ge=1, le=365)  # how long a deleted task is remembered for sync
    sync_default_page_size: int = Field(default=200, ge=10, le=500)
    sync_max_page_size: int = Field(default=500, ge=10, le=1000)
    sync_safety_window_seconds: int = Field(default=5, ge=0, le=60)  # delta cursors lag "now" by this much (clock skew)
    password_hash_concurrency: int = Field(default=4, ge=1, le=16)  # argon2 uses ~64 MB each: bound parallel hashes
    # argon2id cost. Unset = the library's recommended defaults (strongest). On a tiny free instance (0.1 CPU, 512 MB)
    # set 2 / 19456 / 1 (the OWASP minimum profile) so a login does not take seconds. Old hashes keep verifying and
    # are re-hashed with the new cost on the user's next login.
    argon2_time_cost: int | None = Field(default=None, ge=1, le=10)
    argon2_memory_kib: int | None = Field(default=None, ge=8192, le=262144)
    argon2_parallelism: int | None = Field(default=None, ge=1, le=8)
    # Free hosting without a verified e-mail sender: lets production start without Brevo. Password reset e-mails
    # then cannot be sent (users can still sign in; reminders via push / Telegram are unaffected).
    allow_production_without_email: bool = False

    # ---- telegram ------------------------------------------------------------------------
    telegram_bot_token: SecretStr | None = None
    telegram_bot_username: str | None = None
    telegram_webhook_secret: SecretStr | None = None
    admin_telegram_id: str | None = None
    admin_secret: SecretStr | None = None

    # ---- email (Brevo) -------------------------------------------------------------------
    brevo_api_key: SecretStr | None = None
    email_sender_address: EmailStr | None = None
    email_sender_name: str = "RemindMe"

    # ---- web push (VAPID) ----------------------------------------------------------------
    vapid_private_key: SecretStr | None = None
    vapid_public_key: str | None = None
    vapid_email: str | None = None

    # ---- gemini --------------------------------------------------------------------------
    gemini_api_keys: Annotated[list[SecretStr], NoDecode] = Field(default_factory=list)
    gemini_api_key: SecretStr | None = None
    gemini_models: Annotated[list[str], NoDecode] = Field(default_factory=list)
    gemini_timeout_seconds: float = Field(default=20.0, ge=1, le=120)

    # =======================================================================================
    # Field-level parsing and validation
    # =======================================================================================
    @field_validator("*", mode="before")
    @classmethod
    def _clean_strings(cls, value: Any) -> Any:
        return _strip_quotes(value)

    @field_validator("environment", mode="before")
    @classmethod
    def _lower_environment(cls, value: Any) -> Any:
        return value.lower() if isinstance(value, str) else value

    @field_validator("log_level", "algorithm", mode="before")
    @classmethod
    def _upper_enum(cls, value: Any) -> Any:
        return value.upper() if isinstance(value, str) else value

    @field_validator(
        "cors_origins",
        "gemini_models",
        "gemini_api_keys",
        "reminder_encryption_key_previous",
        mode="before",
    )
    @classmethod
    def _parse_lists(cls, value: Any) -> Any:
        return _split_csv(value)

    @field_validator("mongodb_url")
    @classmethod
    def _check_mongodb_url(cls, value: SecretStr) -> SecretStr:
        if not value.get_secret_value().lower().startswith(("mongodb://", "mongodb+srv://")):
            raise ValueError("must start with mongodb:// or mongodb+srv://")
        return value

    @field_validator("database_name")
    @classmethod
    def _check_database_name(cls, value: str) -> str:
        if not _DATABASE_NAME_RE.match(value):
            raise ValueError("use 1-63 letters, digits, '_' or '-'")
        return value

    @field_validator("cors_origins")
    @classmethod
    def _check_cors_origins(cls, origins: list[str]) -> list[str]:
        cleaned: list[str] = []
        for raw in origins:
            origin = raw.strip().rstrip("/")
            if origin == "*":
                raise ValueError('wildcard "*" is not allowed; list the exact origins')
            if not _ORIGIN_RE.match(origin):
                raise ValueError(f"invalid origin {raw!r}: use scheme://host[:port] with no path")
            origin = origin.lower()
            if origin not in cleaned:
                cleaned.append(origin)
        if not cleaned:
            raise ValueError("at least one origin is required")
        return cleaned

    @field_validator("frontend_url")
    @classmethod
    def _check_frontend_url(cls, value: str) -> str:
        url = value.rstrip("/")
        if not _ORIGIN_RE.match(url):
            raise ValueError("use scheme://host[:port] with no path")
        return url

    @field_validator("redis_url")
    @classmethod
    def _check_redis_url(cls, value: SecretStr | None) -> SecretStr | None:
        if value is not None and not value.get_secret_value().lower().startswith(("redis://", "rediss://", "unix://")):
            raise ValueError("must start with redis://, rediss:// or unix://")
        return value

    @field_validator(*_RATE_LIMIT_FIELDS)
    @classmethod
    def _check_rate_limit(cls, value: str) -> str:
        value = value.strip().lower()
        if not _RATE_LIMIT_RE.match(value):
            raise ValueError("use '<count>/<second|minute|hour|day>', e.g. 5/minute")
        return value

    @field_validator("telegram_bot_username")
    @classmethod
    def _check_bot_username(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.lstrip("@")
        if not _BOT_USERNAME_RE.match(value):
            raise ValueError("Telegram bot usernames are 5-32 letters, digits or '_' and start with a letter")
        return value

    @field_validator("telegram_webhook_secret")
    @classmethod
    def _check_webhook_secret(cls, value: SecretStr | None) -> SecretStr | None:
        if value is not None and not _TELEGRAM_SECRET_RE.match(value.get_secret_value()):
            raise ValueError("must be 32-256 characters from A-Z a-z 0-9 _ - (Telegram's secret_token rules)")
        return value

    @field_validator("admin_telegram_id")
    @classmethod
    def _check_admin_telegram_id(cls, value: str | None) -> str | None:
        if value is not None and not _TELEGRAM_ID_RE.match(value):
            raise ValueError("must be a numeric Telegram chat id")
        return value

    @field_validator("vapid_email")
    @classmethod
    def _check_vapid_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        address = re.sub(r"^mailto:", "", value, flags=re.IGNORECASE).strip()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", address):
            raise ValueError("must be an email address, optionally prefixed with mailto:")
        return address

    # =======================================================================================
    # Cross-field and environment-dependent checks (all problems reported at once)
    # =======================================================================================
    @model_validator(mode="after")
    def _cross_validate(self) -> "Settings":
        problems: list[str] = []
        prod = self.environment == "production"

        # -- secrets -------------------------------------------------------------------------
        jwt_secret = self.secret_key.get_secret_value()
        enc_secret = self.reminder_encryption_key.get_secret_value()
        problems += _secret_problems("SECRET_KEY", jwt_secret)
        problems += _secret_problems("REMINDER_ENCRYPTION_KEY", enc_secret)
        if jwt_secret == enc_secret:
            problems.append("SECRET_KEY and REMINDER_ENCRYPTION_KEY must be different values")

        for index, previous in enumerate(self.reminder_encryption_key_previous, start=1):
            old = previous.get_secret_value()
            problems += _secret_problems(f"REMINDER_ENCRYPTION_KEY_PREVIOUS[{index}]", old, MIN_SECRET_LENGTH)[:1]
            if old == enc_secret:
                problems.append(f"REMINDER_ENCRYPTION_KEY_PREVIOUS[{index}] equals the current key; remove it")

        if self.admin_secret is not None:
            problems += _secret_problems("ADMIN_SECRET", self.admin_secret.get_secret_value())

        # -- telegram: all-or-none -----------------------------------------------------------
        if self.telegram_bot_token is not None:
            if not self.telegram_bot_username:
                problems.append("TELEGRAM_BOT_USERNAME is required when TELEGRAM_BOT_TOKEN is set")
            if self.telegram_webhook_secret is None:
                problems.append("TELEGRAM_WEBHOOK_SECRET is required when TELEGRAM_BOT_TOKEN is set")
        elif self.telegram_webhook_secret is not None or self.admin_telegram_id:
            problems.append("TELEGRAM_WEBHOOK_SECRET / ADMIN_TELEGRAM_ID are set but TELEGRAM_BOT_TOKEN is missing")

        # -- email ---------------------------------------------------------------------------
        if self.brevo_api_key is not None and self.email_sender_address is None:
            problems.append("EMAIL_SENDER_ADDRESS is required when BREVO_API_KEY is set")
        if prod and self.brevo_api_key is None and not self.allow_production_without_email:
            problems.append("BREVO_API_KEY is required in production (password reset cannot work without it; or set ALLOW_PRODUCTION_WITHOUT_EMAIL=true)")

        # -- web push: all-or-none -----------------------------------------------------------
        vapid_values = (self.vapid_private_key, self.vapid_public_key, self.vapid_email)
        if any(vapid_values) and not all(vapid_values):
            problems.append("VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY and VAPID_EMAIL must be set together")

        # -- production-only hardening -------------------------------------------------------
        if prod:
            if not self.frontend_url.lower().startswith("https://") or _is_local_url(self.frontend_url):
                problems.append("FRONTEND_URL must be a public https URL in production")
            for origin in self.cors_origins:
                if not origin.startswith("https://") or _is_local_url(origin):
                    problems.append(f"CORS_ORIGINS entry {origin!r} must be a public https origin in production")
            if _mongodb_url_is_local(self.mongodb_url.get_secret_value()):
                problems.append("MONGODB_URL points at localhost in production")
            if self.rate_limit_enabled and self.redis_url is None and not self.allow_in_memory_rate_limit:
                problems.append(
                    "REDIS_URL is required in production so rate limits are shared between workers "
                    "(or set ALLOW_IN_MEMORY_RATE_LIMIT=true for a single instance)"
                )

        if problems:
            raise ValueError("Invalid configuration:\n" + "\n".join(f"  - {problem}" for problem in problems))
        return self

    # =======================================================================================
    # Derived values
    # =======================================================================================
    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def is_local(self) -> bool:
        return self.environment in ("development", "test")

    @property
    def docs_enabled(self) -> bool:
        """Swagger / ReDoc / openapi.json are only served outside production."""
        return not self.is_production

    @property
    def cors_origin_regex(self) -> str | None:
        """Any localhost port is allowed in development/test only (finding S16)."""
        return _LOCALHOST_ORIGIN_REGEX if self.is_local else None

    @property
    def rate_limit_storage_uri(self) -> str:
        return self.redis_url.get_secret_value() if self.redis_url is not None else "memory://"

    @property
    def gemini_keys(self) -> list[str]:
        """GEMINI_API_KEYS and GEMINI_API_KEY merged, de-duplicated, order preserved."""
        keys = [key.get_secret_value() for key in self.gemini_api_keys]
        if self.gemini_api_key is not None:
            keys.append(self.gemini_api_key.get_secret_value())
        return list(dict.fromkeys(key for key in keys if key))

    @property
    def vapid_claims(self) -> dict[str, str] | None:
        return {"sub": f"mailto:{self.vapid_email}"} if self.push_enabled and self.vapid_email else None

    @property
    def push_enabled(self) -> bool:
        return bool(self.vapid_private_key and self.vapid_public_key and self.vapid_email)

    @property
    def telegram_enabled(self) -> bool:
        return self.telegram_bot_token is not None

    @property
    def email_enabled(self) -> bool:
        return self.brevo_api_key is not None and self.email_sender_address is not None

    @property
    def ai_enabled(self) -> bool:
        return bool(self.gemini_keys)

    def safe_summary(self) -> dict[str, Any]:
        """Non-secret snapshot for the startup log."""
        return {
            "environment": self.environment,
            "database": self.database_name,
            "cors_origins": self.cors_origins,
            "rate_limiting": (
                ("redis" if self.redis_url is not None else "in-memory") if self.rate_limit_enabled else "off"
            ),
            "telegram": self.telegram_enabled,
            "web_push": self.push_enabled,
            "email": self.email_enabled,
            "ai_magic_add": self.ai_enabled,
        }


@lru_cache
def get_settings() -> Settings:
    """Process-wide settings. Raises ``pydantic.ValidationError`` listing every problem."""
    return Settings()  # type: ignore[call-arg]  # required fields are filled from the environment
