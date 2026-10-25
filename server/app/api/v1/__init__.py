"""The v1 API surface (finding A6): everything below ``/v1``, no trailing slashes, a response model on every route."""

from fastapi import APIRouter

from app.api.v1 import admin, auth, tasks, telegram, updates, users, webpush
from schemas.auth import ErrorResponse

_ERRORS = {
    401: {"model": ErrorResponse, "description": "Missing, invalid or revoked access token"},
    403: {"model": ErrorResponse, "description": "Not allowed"},
    404: {"model": ErrorResponse, "description": "Not found"},
    409: {"model": ErrorResponse, "description": "Conflict"},
    429: {"model": ErrorResponse, "description": "Too many requests"},
}

api_router = APIRouter(prefix="/v1", responses=_ERRORS)
api_router.include_router(auth.router, prefix="/auth")
api_router.include_router(users.router, prefix="/user")
api_router.include_router(tasks.router, prefix="/tasks")
api_router.include_router(updates.router, prefix="/updates")
api_router.include_router(telegram.router, prefix="/integrations/telegram")
api_router.include_router(webpush.router, prefix="/integrations/webpush")
api_router.include_router(admin.router, prefix="/admin")
