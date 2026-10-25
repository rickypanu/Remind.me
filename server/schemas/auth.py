"""Request / response schemas for the auth routes (finding S8).

Every model forbids unknown fields (no mass assignment), trims and normalises text, lower-cases e-mail
addresses (so ``Ricky@Mail.com`` and ``ricky@mail.com`` are the same account) and enforces the password
policy on the server.
"""

import re
import unicodedata
from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    model_validator,
)

from app.core.passwords import MAX_LENGTH, validate_password

MAX_EMAIL_LENGTH = 254  # RFC 5321
USERNAME_MIN = 3
USERNAME_MAX = 40
# Reset tokens are secrets.token_urlsafe(32): 43 URL-safe base64 characters.
RESET_TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{43}$")
REFRESH_TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{43,128}$")


def _strip(value: object) -> object:
    return value.strip() if isinstance(value, str) else value


def _normalise_email(value: str) -> str:
    return value.strip().lower()


def _normalise_username(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).strip()
    if any(unicodedata.category(ch).startswith("C") for ch in value):
        raise ValueError("Username must not contain control characters.")
    if re.search(r"\s", value):
        raise ValueError("Username must not contain spaces.")
    if re.search(r"[<>\"'`&]", value):
        raise ValueError("Username must not contain < > \" ' ` or &.")
    if not USERNAME_MIN <= len(value) <= USERNAME_MAX:
        raise ValueError(f"Username must be {USERNAME_MIN}-{USERNAME_MAX} characters long.")
    return value


NormalizedEmail = Annotated[
    EmailStr,
    BeforeValidator(_strip),
    StringConstraints(max_length=MAX_EMAIL_LENGTH),
    AfterValidator(_normalise_email),
]
Username = Annotated[str, BeforeValidator(_strip), AfterValidator(_normalise_username)]
# Length is capped *before* the policy runs so a 10 MB "password" never reaches the regexes or argon2.
Password = Annotated[str, Field(max_length=MAX_LENGTH * 4), AfterValidator(validate_password)]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)


class UserCreate(_Strict):
    username: Username
    email: NormalizedEmail
    password: Password

    @model_validator(mode="after")
    def _password_must_not_contain_identity(self) -> "UserCreate":
        validate_password(self.password, email=self.email, username=self.username)
        return self


class UserLogin(_Strict):
    email: NormalizedEmail
    password: Annotated[str, Field(min_length=1, max_length=MAX_LENGTH * 4)]


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    refresh_token: str
    expires_in: int = Field(description="Seconds until the access token expires")


class ForgotPasswordRequest(_Strict):
    email: NormalizedEmail


class ResetPasswordRequest(_Strict):
    token: Annotated[str, BeforeValidator(_strip)]
    new_password: Password

    @model_validator(mode="after")
    def _token_shape(self) -> "ResetPasswordRequest":
        # Malformed tokens are rejected before any database work; the message is the same one a wrong token gets.
        if not RESET_TOKEN_RE.match(self.token):
            raise ValueError("Invalid or expired reset token.")
        return self


class RefreshRequest(_Strict):
    refresh_token: Annotated[str, BeforeValidator(_strip)]

    @model_validator(mode="after")
    def _token_shape(self) -> "RefreshRequest":
        if not REFRESH_TOKEN_RE.match(self.refresh_token):
            raise ValueError("Invalid refresh token.")
        return self


class LogoutRequest(RefreshRequest):
    """Same body as refresh: the token identifies which session to end."""


class MessageResponse(BaseModel):
    message: str


class ErrorResponse(BaseModel):
    """Every error the API raises on purpose: ``{"detail": "...", "code": "..."}`` (``code`` is optional)."""

    detail: str
    code: str | None = None
