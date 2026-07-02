import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from routes import auth, tasks, user, webpush, notification, squad, chatwebsocket, squad_analytics, update
from fastapi.staticfiles import StaticFiles

# Load environment variables from the .env file
load_dotenv()

app = FastAPI(title="RemindMe API")

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

origins = [
    "https://remindme-psi.vercel.app",
    "https://getremindme.vercel.app", 
    "http://localhost:3000",           
    "http://localhost:5173",   
]        

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(tasks.router, prefix="/tasks", tags=["Tasks"])
app.include_router(user.router, prefix="/user", tags=["User"])
app.include_router(webpush.router, tags=["Notification"])
app.include_router(notification.router, tags=["Notification"])
app.include_router(update.router, tags=["Updates"])

app.include_router(squad.router, tags=["Squad"])
app.include_router(squad_analytics.router, tags=["Squad"])
app.include_router(chatwebsocket.router, tags=["Chat"])

@app.get("/")
async def root():
    return {"message": "Welcome to the RemindMe API"}


@app.api_route("/health", methods=["GET", "HEAD"], status_code=200, tags=["Health"])
def health_check():
    """
    Endpoint for UptimeRobot to ping and keep the server awake.
    """
    return {"status": "ok", "message": "Remind me backend is active and awake"}