"""Sign-up, login, token refresh, logout and password reset rules (findings A1, S3, S6, S7, S9, P4).

HTTP-free: routes pass plain values in and get plain dicts back; failures are domain errors. Password hashing goes
through ``utils.security.ahash_password`` / ``averify_password``, which run argon2 in the thread pool (P4).
"""

from datetime import UTC, datetime
from typing import Any

from bson import ObjectId

from app.core.config import get_settings
from app.core.errors import BadRequest, Conflict, Unauthorized, Unprocessable
from app.core.passwords import MAX_LENGTH, password_problems
from app.repositories import PasswordResetRepository, UserRepository
from app.services import password_reset, sessions
from schemas.auth import MAX_EMAIL_LENGTH
from utils import security

BAD_LOGIN = "Incorrect email or password"
SESSION_EXPIRED = "Your session has expired. Please log in again."
INVALID_RESET = "Invalid or expired reset token."


def _token_response(user: dict[str, Any], issued: sessions.IssuedSession) -> dict[str, Any]:
    access_token = security.create_access_token(
        user_id=str(user["_id"]),
        token_version=int(user.get("token_version", 0)),
        session_id=issued.family_id,
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "refresh_token": issued.refresh_token,
        "expires_in": get_settings().access_token_expire_minutes * 60,
    }


class AuthService:
    def __init__(self, db: Any) -> None:
        self.db = db
        self.users = UserRepository(db)

    async def signup(self, *, username: str, email: str, password: str) -> None:
        # email is already trimmed and lower-cased by the schema; the password already passed the policy.
        if await self.users.email_exists(email):
            raise Conflict("Email already registered")
        await self.users.create(
            {
                "username": username,
                "email": email,
                "password_hash": await security.ahash_password(password),
                "created_at": datetime.now(UTC),
                "token_version": 0,
            }
        )  # a race past the check above is decided by the unique index (-> Conflict)

    async def login(self, username: str, password: str, user_agent: str | None) -> dict[str, Any]:
        email = username.strip().lower()
        user = None
        if len(email) <= MAX_EMAIL_LENGTH and len(password) <= MAX_LENGTH * 4:
            user = await self.users.get_by_email(email)

        # One full verification runs whether or not the account exists (no e-mail enumeration by timing), and the
        # same message is returned for "no such user" and "wrong password".
        password_ok = await security.averify_password(password, user.get("password_hash") if user else None)
        if user is None or not password_ok:
            raise Unauthorized(BAD_LOGIN)

        # Upgrade legacy bcrypt hashes (and outdated argon2 parameters) now that we hold the plaintext.
        if security.password_needs_rehash(user["password_hash"]):
            await self.users.set_password(user["_id"], await security.ahash_password(password))

        issued = await sessions.start_session(self.db, user, user_agent)
        return _token_response(user, issued)

    async def refresh(self, refresh_token: str, user_agent: str | None) -> dict[str, Any]:
        """Trade a refresh token for a new access token AND a new refresh token (the old one is now dead)."""
        issued = await sessions.rotate_session(self.db, refresh_token, user_agent)
        if issued is None:
            raise Unauthorized(SESSION_EXPIRED)
        return _token_response(issued.user, issued)

    async def logout(self, refresh_token: str) -> None:
        """End this device's session. Always succeeds, so a client can call it without caring about the state."""
        await sessions.end_session(self.db, refresh_token)

    async def logout_all(self, user_id: ObjectId) -> None:
        """Bump token_version (kills every access token) and delete every session."""
        await self.users.bump_token_version(user_id)
        await sessions.end_all_sessions(self.db, str(user_id))

    async def reset_password(self, token: str, new_password: str) -> str:
        """Spend a reset token and set the new password. Returns the account's e-mail (to send a confirmation)."""
        # 1. Look at the token without spending it, so a rejected password does not burn a valid link.
        pending = await password_reset.peek_reset(self.db, token)
        if pending is None:
            raise BadRequest(INVALID_RESET)
        user = await self.users.get(password_reset.user_object_id(pending))
        if user is None:
            raise BadRequest(INVALID_RESET)

        # 2. Rules that depend on the account (the password must not contain the e-mail name or the username).
        problems = password_problems(new_password, email=user["email"], username=user.get("username"))
        if problems:
            raise Unprocessable(problems[0])

        new_hash = await security.ahash_password(new_password)

        # 3. Spend the token. Atomic: of two simultaneous requests with the same link only one succeeds.
        if await password_reset.claim_reset(self.db, token) is None:
            raise BadRequest(INVALID_RESET)

        # 4. New password + new token_version (every access token issued before now stops working) and every
        #    refresh-token session is deleted. Legacy reset fields on the user document are removed too.
        await self.users.set_password(user["_id"], new_hash, revoke_tokens=True)
        await sessions.end_all_sessions(self.db, str(user["_id"]))
        await PasswordResetRepository(self.db).delete_for_user(str(user["_id"]))
        return user["email"]
