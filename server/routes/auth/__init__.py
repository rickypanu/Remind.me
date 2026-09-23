from fastapi import APIRouter
from routes.auth.signup import router as signup_router
from routes.auth.login import router as login_router
from routes.auth.forgetpassword import router as forget_password_router

auth_router = APIRouter()

auth_router.include_router(signup_router)
auth_router.include_router(login_router)
auth_router.include_router(forget_password_router)