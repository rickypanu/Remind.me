"""FastAPI dependencies: the database, the signed-in user, admin check and service providers (findings A1, A6).

Tests replace the database either by setting ``app.state.db`` or with
``app.dependency_overrides[get_db] = lambda: fake_db``; nothing here opens a connection at import time.
"""

import asyncio
from datetime import UTC, datetime
from typing import Annotated, Any

from bson import ObjectId
from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer

from app.core.config import get_settings
from app.core.deps import get_notifier  # noqa: F401 - re-exported: routes import every dependency from here
from app.core.errors import Forbidden, ServiceUnavailable, Unauthorized
from app.db.ids import to_object_id
from app.repositories import SessionRepository, UserRepository
from app.services.announcements import AnnouncementService
from app.services.auth import AuthService
from app.services.push import PushService
from app.services.quick_add import QuickAddService
from app.services.tasks import TaskService, build_task_service
from app.services.users import UserService
from utils.security import decode_access_token

# Swagger's "Authorize" button posts the login form here.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/v1/auth/login")


def get_db(request: Request) -> Any:
    """The database the application was started with (``app.state.db``, set by the lifespan)."""
    db = getattr(request.app.state, "db", None)
    if db is None:
        raise ServiceUnavailable("The database is not available right now.")
    return db


Db = Annotated[Any, Depends(get_db)]


async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: Db) -> dict[str, Any]:
    """Resolve the bearer token to a user document (``_id`` is returned as a string, ``session_id`` is added)."""
    payload = decode_access_token(token)
    if payload is None:
        raise Unauthorized()
    user_id = to_object_id(payload["sub"])
    if user_id is None:
        raise Unauthorized()

    # Two independent reads, issued together: every authenticated request used to pay for them one after the other
    # (two database round trips in a row, which against a remote cluster is most of the time an endpoint takes).
    user, session_alive = await asyncio.gather(
        UserRepository(db).get(user_id),
        SessionRepository(db).family_is_alive(payload["sid"], payload["sub"], datetime.now(UTC)),
    )
    if user is None:
        raise Unauthorized()

    # Password change / "log out everywhere" bumps token_version and invalidates every older token.
    if int(user.get("token_version", 0)) != payload["tv"]:
        raise Unauthorized()

    # The session this token belongs to must still exist (logout and reuse-detection delete it).
    if not session_alive:
        raise Unauthorized()

    user["_id"] = str(user["_id"])
    user["session_id"] = payload["sid"]
    return user


CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]


def get_user_id(current_user: CurrentUser) -> ObjectId:
    """The signed-in user's id as the canonical ObjectId (tasks.user_id is an ObjectId, finding A3)."""
    user_id = to_object_id(current_user.get("_id"))
    if user_id is None:  # cannot happen for a token-authenticated user; fail closed anyway
        raise Unauthorized()
    return user_id


UserId = Annotated[ObjectId, Depends(get_user_id)]


async def require_admin(current_user: CurrentUser) -> dict[str, Any]:
    if not current_user.get("is_admin", False):
        raise Forbidden("Forbidden: Admin privileges required")
    return current_user


AdminUser = Annotated[dict[str, Any], Depends(require_admin)]


# ---- services -----------------------------------------------------------------------------------------
def get_task_service(db: Db) -> TaskService:
    return build_task_service(db)


TaskSvc = Annotated[TaskService, Depends(get_task_service)]


def get_quick_add_service(tasks: TaskSvc) -> QuickAddService:
    return QuickAddService(tasks)


def get_auth_service(db: Db) -> AuthService:
    return AuthService(db)


def get_user_service(db: Db) -> UserService:
    return UserService(db)


def get_announcement_service(db: Db) -> AnnouncementService:
    return AnnouncementService(db)


def get_push_service(db: Db) -> PushService:
    return PushService(db, cap=get_settings().max_push_subscriptions)


AuthSvc = Annotated[AuthService, Depends(get_auth_service)]
UserSvc = Annotated[UserService, Depends(get_user_service)]
QuickAddSvc = Annotated[QuickAddService, Depends(get_quick_add_service)]
AnnouncementSvc = Annotated[AnnouncementService, Depends(get_announcement_service)]
PushSvc = Annotated[PushService, Depends(get_push_service)]
