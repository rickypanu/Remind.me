"""The un-versioned URLs the already-installed PWA still calls (``/auth/login``, ``/tasks/`` ...).

Served only while ``LEGACY_API_ENABLED=true`` (default), and HIDDEN from the OpenAPI document. They reuse the v1
handlers, so behaviour is identical, with three compatibility differences:

  * ``GET /tasks`` and ``GET /tasks/`` return a plain array (every live reminder, max 1000), not the sync envelope.
  * ``POST /tasks`` and ``POST /tasks/`` both work (the old client sent the trailing slash).
  * ``/user/updates``, ``/telegram/*``, ``/webpush/*`` and ``/admin/broadcast`` keep their old paths.

Delete this module (and the ``include_router`` call in ``app/main.py``) once no client older than the /v1 release
is in use; set LEGACY_API_ENABLED=false to switch it off earlier.
"""

from typing import Annotated

from fastapi import APIRouter, Body, status

from app.api.deps import PushSvc, TaskSvc, UserId
from app.api.v1 import admin, auth, tasks, telegram, updates, users, webpush
from schemas.notification import PushResult, UnsubscribePayload
from schemas.task import TaskCreate, TaskResponse

legacy_router = APIRouter(include_in_schema=False)

# --- tasks: the list / create routes first, so they win over the v1 router mounted at the same prefix ---------
_tasks = APIRouter(tags=["Task (legacy)"])


@_tasks.get("", response_model=list[TaskResponse])
@_tasks.get("/", response_model=list[TaskResponse])
async def list_tasks_legacy(user_id: UserId, svc: TaskSvc) -> list[dict]:
    return await svc.list_all(user_id)


@_tasks.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
@_tasks.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task_legacy(payload: TaskCreate, user_id: UserId, svc: TaskSvc) -> dict:
    return await svc.create(user_id, payload)


# --- web push: the old DELETE /webpush/unsubscribe/{user_id} (the id is ignored) --------------------------------
_push = APIRouter(tags=["WebPush (legacy)"])


@_push.delete("/unsubscribe/{user_id}", response_model=PushResult, deprecated=True)
async def unsubscribe_legacy(
    user_id: str,  # ignored: kept so already-deployed clients keep working
    me: UserId,
    push: PushSvc,
    payload: Annotated[UnsubscribePayload | None, Body()] = None,
) -> dict:
    endpoint = None
    if payload is not None:
        endpoint = payload.endpoint or (payload.subscription or {}).get("endpoint")
    return await push.unsubscribe(me, endpoint)


legacy_router.include_router(_tasks, prefix="/tasks")
legacy_router.include_router(tasks.router, prefix="/tasks")
legacy_router.include_router(auth.router, prefix="/auth")
legacy_router.include_router(users.router, prefix="/user")
legacy_router.include_router(updates.router, prefix="/user/updates")
legacy_router.include_router(telegram.router, prefix="/telegram")
legacy_router.include_router(_push, prefix="/webpush")
legacy_router.include_router(webpush.router, prefix="/webpush")
legacy_router.include_router(admin.router, prefix="/admin")
