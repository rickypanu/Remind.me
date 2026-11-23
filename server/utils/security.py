"""Password hashing and access tokens (findings S3, S7, S9, P4). The current-user dependency lives in app/api/deps.py.

Access tokens
    * HS256 JWT signed with the validated SECRET_KEY (no fallback value exists any more).
    * Short-lived (ACCESS_TOKEN_EXPIRE_MINUTES, default 15). The client renews them with a refresh token.
    * ``sub`` is the user's ID (never the e-mail address, which can change and is personal data).
    * ``tv`` is the user's ``token_version``. Changing a password or "log out everywhere" bumps it, which kills
      every access token issued earlier, immediately.
    * ``sid`` is the session (refresh-token family). Logging out deletes the family, which kills the access
      tokens of that session immediately.
    * ``typ`` = "access" so a token minted for another purpose can never be replayed here.

Passwords
    argon2id for new hashes; hashes made by the old passlib/bcrypt setup still verify and are upgraded on login.
    argon2 is CPU-heavy (and uses ~64 MB of memory per hash), so the async wrappers run it in the thread pool with
    ``run_in_threadpool`` instead of blocking the event loop, and at most PASSWORD_HASH_CONCURRENCY hashes run at
    once, so a burst of logins cannot exhaust the server's memory.
    ``verify_password_or_dummy`` always does one full hash verification, found user or not, so response time
    does not reveal whether an e-mail address is registered.
"""

import asyncio
import secrets
import weakref
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import Any, TypeVar

import bcrypt
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from jwt import InvalidTokenError
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings

T = TypeVar("T")

ACCESS_TOKEN_TYPE = "access"


@lru_cache(maxsize=1)
def _get_hasher() -> PasswordHasher:
    """argon2id. Library defaults unless ARGON2_* are set (see Settings); built lazily so importing never needs config."""
    s = get_settings()
    overrides: dict[str, int] = {}
    if s.argon2_time_cost is not None:
        overrides["time_cost"] = s.argon2_time_cost
    if s.argon2_memory_kib is not None:
        overrides["memory_cost"] = s.argon2_memory_kib
    if s.argon2_parallelism is not None:
        overrides["parallelism"] = s.argon2_parallelism
    return PasswordHasher(**overrides)


_BCRYPT_PREFIXES = ("$2a$", "$2b$", "$2y$")
_BCRYPT_MAX_BYTES = 72  # bcrypt ignores everything after 72 bytes; passlib truncated silently, bcrypt>=5 raises


# --------------------------------------------------------------------------------------------------
# Passwords
# --------------------------------------------------------------------------------------------------
def verify_password(plain_password: str, hashed_password: str | None) -> bool:
    if not hashed_password:
        return False
    if hashed_password.startswith("$argon2"):
        try:
            return _get_hasher().verify(hashed_password, plain_password)
        except (VerificationError, InvalidHashError):
            return False
    if hashed_password.startswith(_BCRYPT_PREFIXES):
        try:
            return bcrypt.checkpw(plain_password.encode("utf-8")[:_BCRYPT_MAX_BYTES], hashed_password.encode("utf-8"))
        except ValueError:
            return False
    return False


def get_password_hash(password: str) -> str:
    return _get_hasher().hash(password)


def password_needs_rehash(hashed_password: str) -> bool:
    """True for legacy bcrypt hashes and for argon2 hashes made with outdated parameters."""
    if not hashed_password.startswith("$argon2"):
        return True
    return _get_hasher().check_needs_rehash(hashed_password)


@lru_cache(maxsize=1)
def _dummy_hash() -> str:
    """A real argon2id hash of a random value, created once per process and used when no user matched."""
    return _get_hasher().hash(secrets.token_urlsafe(32))


def verify_password_or_dummy(plain_password: str, hashed_password: str | None) -> bool:
    """Same cost whether or not the account exists (finding S7).

    With no stored hash the password is checked against a throw-away argon2 hash and the result is discarded.
    Residual difference: an account that still has a legacy bcrypt hash verifies with bcrypt, which takes a
    different amount of time than argon2. That gap disappears as those users log in (their hash is upgraded).
    """
    if hashed_password:
        return verify_password(plain_password, hashed_password)
    verify_password(plain_password, _dummy_hash())
    return False


_hash_slots: "weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, asyncio.Semaphore]" = weakref.WeakKeyDictionary()


def _hash_semaphore() -> asyncio.Semaphore:
    """One semaphore per event loop (a semaphore is bound to the loop that first waits on it)."""
    loop = asyncio.get_running_loop()
    semaphore = _hash_slots.get(loop)
    if semaphore is None:
        semaphore = asyncio.Semaphore(get_settings().password_hash_concurrency)
        _hash_slots[loop] = semaphore
    return semaphore


async def _offload(function: Callable[..., T], *args: Any) -> T:
    """Run CPU-bound work in the thread pool, a few at a time, without blocking the event loop (finding P4)."""
    async with _hash_semaphore():
        return await run_in_threadpool(function, *args)


async def averify_password(plain_password: str, hashed_password: str | None) -> bool:
    return await _offload(verify_password_or_dummy, plain_password, hashed_password)


async def ahash_password(password: str) -> str:
    return await _offload(get_password_hash, password)


def warm_up_password_hasher() -> None:
    """Build the dummy hash at start-up so the first failed login is not slower than later ones."""
    _dummy_hash()


# --------------------------------------------------------------------------------------------------
# Access tokens
# --------------------------------------------------------------------------------------------------
def create_access_token(*, user_id: str, token_version: int, session_id: str) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "tv": int(token_version),
        "sid": session_id,
        "typ": ACCESS_TOKEN_TYPE,
        "jti": secrets.token_urlsafe(12),
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key.get_secret_value(), algorithm=settings.algorithm)


def decode_access_token(token: str) -> dict[str, Any] | None:
    """The verified claims, or ``None`` for anything that is not a valid, unexpired access token of the new format."""
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.secret_key.get_secret_value(),
            algorithms=[settings.algorithm],
            options={"require": ["exp", "sub", "tv", "sid", "typ"]},
        )
    except InvalidTokenError:
        return None
    if payload.get("typ") != ACCESS_TOKEN_TYPE:
        return None
    if not isinstance(payload.get("sub"), str) or not isinstance(payload.get("sid"), str):
        return None
    if not isinstance(payload.get("tv"), int) or isinstance(payload.get("tv"), bool):
        return None
    return payload
