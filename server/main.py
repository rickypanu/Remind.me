import os
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI, HTTPException, Response
from database import db

load_dotenv()

from routes.auth import auth_router
from routes.user import user_router
from routes.tasks import task_router

from routes.notification import notification_router, start_scheduler_tele, start_scheduler_web, start_scheduler_recurring
from utils.crypto import assert_encryption_configured

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail fast (before serving anything) if the reminder-encryption key is missing
    assert_encryption_configured()

    scheduler_tele = start_scheduler_tele()
    scheduler_web = start_scheduler_web()
    scheduler_recurring = start_scheduler_recurring()

    yield

    for scheduler in (scheduler_tele, scheduler_web, scheduler_recurring):
        if scheduler:
            scheduler.shutdown()

app = FastAPI(title="RemindMe API", lifespan=lifespan)


# CORS_ORIGINS="https://your-site.com,https://www.your-site.com" in production. Defaults to "*" for local dev.
# _origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=_origins,
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )
# CORS_ORIGINS="https://your-site.com,https://www.your-site.com" in production. Unset = allow every origin.
# Trailing slashes are ignored ("https://x.com/" would otherwise never match the browser's Origin header).
_origins = [o.strip().rstrip("/") for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
_allow_all = "*" in _origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _allow_all else _origins,
    allow_origin_regex=None if _allow_all else r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$",
    allow_credentials=not _allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)
print(f"[startup] CORS: {'all origins' if _allow_all else _origins + ['localhost (any port)']}")

# Include Routers
app.include_router(auth_router, prefix="/auth")
app.include_router(user_router, prefix="/user")
app.include_router(task_router, prefix ="/tasks")
app.include_router(notification_router)

@app.get("/")
async def root():
    return {"message": "Welcome to the RemindMe API"}

@app.get("/uploads/avatars/{user_id}")
async def get_avatar(user_id: str):
    doc = await db["avatars"].find_one({"_id": user_id.split(".")[0]})
    if not doc:
        raise HTTPException(status_code=404, detail="Avatar not found")
    return Response(
        content=bytes(doc["data"]),
        media_type=doc["content_type"],
        headers={"Cache-Control": "public, max-age=86400"},
    )
    
@app.api_route("/health", methods=["GET", "HEAD"], status_code=200, tags=["Health"])
def health_check():
    """
    Endpoint for UptimeRobot to ping and keep the server awake.
    """
    return {"status": "ok", "message": "Remind me backend is active and awake"}