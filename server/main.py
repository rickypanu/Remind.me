import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from routes import auth, tasks, user

# Load environment variables from the .env file
load_dotenv()

app = FastAPI(title="RemindMe API")

origins = [
    "https://remindme-psi.vercel.app", 
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

@app.get("/")
async def root():
    return {"message": "Welcome to the RemindMe API"}

@app.get("/health", tags=["Health"])
async def health_check():
   
    return {"status": "ok", "message": "Backend is awake!"}