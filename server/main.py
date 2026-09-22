import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles

load_dotenv()

from routes.auth import auth_router
from routes.user import user_router
from routes.tasks import task_router
from routes.notification import notification_router, start_scheduler 

# --- ADD THIS: Get the absolute path to the project root ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = start_scheduler()
    yield
    scheduler.shutdown()

app = FastAPI(title="RemindMe API", lifespan=lifespan)

# --- UPDATE THIS: Use the absolute path ---
os.makedirs(os.path.join(UPLOAD_DIR, "avatars"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

origin = os.getenv("FRONTEND_ORIGINS", "http://localhost:3000")
origins_list = [o.strip() for o in origin.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_router, prefix="/auth")
app.include_router(user_router, prefix="/user")
app.include_router(task_router, prefix ="/tasks")
app.include_router(notification_router)

@app.get("/")
async def root():
    return {"message": "Welcome to the RemindMe API"}

@app.api_route("/health", methods=["GET", "HEAD"], status_code=200, tags=["Health"])
def health_check():
    """
    Endpoint for UptimeRobot to ping and keep the server awake.
    """
    return {"status": "ok", "message": "Remind me backend is active and awake"}