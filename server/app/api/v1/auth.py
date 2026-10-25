"""/v1/auth: sign-up, login, refresh, logout, password reset. Thin: parse, rate-limit, call the service."""

import logging
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import AuthSvc, CurrentUser, Db, UserId
from app.core.rate_limit import Limits, ip_key, limiter
from app.services.email import send_success_email
from app.services.password_reset import request_reset
from schemas.auth import (
    ForgotPasswordRequest,
    LogoutRequest,
    MessageResponse,
    RefreshRequest,
    ResetPasswordRequest,
    Token,
    UserCreate,
)

log = logging.getLogger("auth.routes")
router = APIRouter(tags=["Auth"])

_GENERIC = "If an account with that email exists, a reset link has been sent."


async def _notify_password_changed(email: str) -> None:
    try:
        await send_success_email(email)
    except Exception:  # noqa: BLE001 - a failed confirmation e-mail must not undo a successful reset
        log.exception("Failed to send the password-changed confirmation e-mail")


@router.post("/signup", status_code=status.HTTP_201_CREATED, response_model=MessageResponse)
@limiter.limit(Limits.signup, key_func=ip_key)
async def signup(request: Request, user: UserCreate, auth: AuthSvc) -> MessageResponse:
    await auth.signup(username=user.username, email=user.email, password=user.password)
    return MessageResponse(message="User created successfully")


@router.post("/login", response_model=Token)
@limiter.limit(Limits.login, key_func=ip_key)
async def login(request: Request, form: Annotated[OAuth2PasswordRequestForm, Depends()], auth: AuthSvc) -> dict:
    return await auth.login(form.username, form.password, request.headers.get("user-agent"))


@router.post("/refresh", response_model=Token)
@limiter.limit(Limits.refresh, key_func=ip_key)
async def refresh(request: Request, body: RefreshRequest, auth: AuthSvc) -> dict:
    """Trade a refresh token for a new access token AND a new refresh token (the old one is now dead)."""
    return await auth.refresh(body.refresh_token, request.headers.get("user-agent"))


@router.post("/logout", response_model=MessageResponse)
@limiter.limit(Limits.refresh, key_func=ip_key)
async def logout(request: Request, body: LogoutRequest, auth: AuthSvc) -> MessageResponse:
    """End this device's session. Always succeeds, so a client can call it without caring about the state."""
    await auth.logout(body.refresh_token)
    return MessageResponse(message="Logged out.")


@router.post("/logout-all", response_model=MessageResponse)
async def logout_all(_user: CurrentUser, user_id: UserId, auth: AuthSvc) -> MessageResponse:
    """End every session on every device: bumps token_version (kills all access tokens) and deletes all sessions."""
    await auth.logout_all(user_id)
    return MessageResponse(message="Logged out of all devices.")


@router.post("/forgot-password", response_model=MessageResponse)
@limiter.limit(Limits.forgot_password, key_func=ip_key)
async def forgot_password(
    request: Request, body: ForgotPasswordRequest, background_tasks: BackgroundTasks, db: Db
) -> MessageResponse:
    # Lookup, token creation and e-mail all run after the response is sent: the caller sees the same body and the
    # same timing whether or not the address is registered (no account enumeration).
    background_tasks.add_task(request_reset, db, body.email)
    return MessageResponse(message=_GENERIC)


@router.post("/reset-password", response_model=MessageResponse)
@limiter.limit(Limits.reset_password, key_func=ip_key)
async def reset_password(
    request: Request, body: ResetPasswordRequest, background_tasks: BackgroundTasks, auth: AuthSvc
) -> MessageResponse:
    email = await auth.reset_password(body.token, body.new_password)
    background_tasks.add_task(_notify_password_changed, email)
    return MessageResponse(message="Password successfully reset.")
