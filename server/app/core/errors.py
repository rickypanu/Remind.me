"""Domain errors raised by services and repositories (finding A1).

The service layer must not know about HTTP or FastAPI. It raises these instead, and ONE handler registered in
``app/main.py`` turns them into JSON responses. That keeps route functions thin (no ``try/except`` ladders) and
keeps every status code and message in one place.
"""

from typing import Any


class AppError(Exception):
    """Base class. ``status_code`` and ``detail`` become the HTTP answer: ``{"detail": ..., "code": ...}``."""

    status_code = 400
    default_detail = "The request could not be completed."

    def __init__(
        self, detail: str | None = None, *, code: str | None = None, headers: dict[str, str] | None = None
    ) -> None:
        self.detail = detail or self.default_detail
        self.code = code
        self.headers = headers
        super().__init__(self.detail)

    def body(self) -> dict[str, Any]:
        out: dict[str, Any] = {"detail": self.detail}
        if self.code:
            out["code"] = self.code
        return out


class BadRequest(AppError):
    status_code = 400
    default_detail = "Bad request."


class Unauthorized(AppError):
    status_code = 401
    default_detail = "Could not validate credentials"

    def __init__(
        self, detail: str | None = None, *, code: str | None = None, headers: dict[str, str] | None = None
    ) -> None:
        super().__init__(detail, code=code, headers=headers or {"WWW-Authenticate": "Bearer"})


class Forbidden(AppError):
    status_code = 403
    default_detail = "Forbidden"


class NotFound(AppError):
    status_code = 404
    default_detail = "Not found."


class Conflict(AppError):
    status_code = 409
    default_detail = "That conflicts with existing data."


class Gone(AppError):
    status_code = 410
    default_detail = "That is no longer available."


class PayloadTooLarge(AppError):
    status_code = 413
    default_detail = "That is too large."


class UnsupportedMedia(AppError):
    status_code = 415
    default_detail = "Unsupported file type."


class Unprocessable(AppError):
    status_code = 422
    default_detail = "That could not be processed."


class ServiceUnavailable(AppError):
    status_code = 503
    default_detail = "This service is temporarily unavailable."


class InternalError(AppError):
    status_code = 500
    default_detail = "Something went wrong. Please try again."
