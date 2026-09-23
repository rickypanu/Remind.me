import os
import secrets
import httpx
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordRequestForm
from schemas.auth import ForgotPasswordRequest, ResetPasswordRequest, Token
from utils.security import verify_password, create_access_token, get_password_hash 
from database import get_db

router = APIRouter(tags=["Auth"]) 

# --- Email Helpers ---
async def send_reset_email(to_email: str, reset_link: str):
    url = "https://api.brevo.com/v3/smtp/email"
    api_key = os.getenv("BREVO_API_KEY") 
    
    if not api_key:
        print("Warning: BREVO_API_KEY is not set.")
        return

    headers = {
        "accept": "application/json",
        "api-key": api_key,
        "content-type": "application/json"
    }
    
    payload = {
        "sender": {"name": "RemindMe App", "email": "rickypanu2005@gmail.com"},
        "to": [{"email": to_email}],
        "subject": "Password Reset Request",
        "htmlContent": f"""
        <h3>Password Reset</h3>
        <p>You requested a password reset. Click the link below to set a new password:</p>
        <p><a href='{reset_link}'>Reset Password</a></p>
        <p>If you didn't request this, please ignore this email. This link expires in 1 hour.</p>
        """
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()

async def send_success_email(to_email: str):
    url = "https://api.brevo.com/v3/smtp/email"
    api_key = os.getenv("BREVO_API_KEY") 
    
    if not api_key:
        print("Warning: BREVO_API_KEY is not set.")
        return

    headers = {
        "accept": "application/json",
        "api-key": api_key,
        "content-type": "application/json"
    }
    
    payload = {
        "sender": {"name": "RemindMe App", "email": "rickypanu2005@gmail.com"},
        "to": [{"email": to_email}],
        "subject": "Password Reset Successful",
        "htmlContent": """
        <h3>Password Changed Successfully</h3>
        <p>Your RemindMe account password has been successfully updated.</p>
        <p>If you did not perform this action, please contact support immediately to secure your account.</p>
        """
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()

# --- Routes ---
@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, db = Depends(get_db)):
    user = await db["users"].find_one({"email": request.email})
    
    # We always return success to prevent malicious users from discovering registered emails
    if user:
        # Generate a secure 32-character token and set expiration to 1 hour
        reset_token = secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc) + timedelta(hours=1)
        
        await db["users"].update_one(
            {"email": request.email},
            {"$set": {"reset_token": reset_token, "reset_token_expires": expires}}
        )
        
        # Pull frontend URL from environment, fallback to localhost for local testing
        frontend_url = os.getenv("FRONTEND_ORIGINS", "http://localhost:5173")
        reset_link = f"{frontend_url}/reset-password?token={reset_token}"
        
        await send_reset_email(request.email, reset_link)

    return {"message": "If an account with that email exists, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest, db = Depends(get_db)):
    # Find user by token and ensure token hasn't expired
    user = await db["users"].find_one({
        "reset_token": request.token,
        "reset_token_expires": {"$gt": datetime.now(timezone.utc)}
    })
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Invalid or expired reset token."
        )
    
    # Hash the new password and clean up the token fields
    new_hashed_password = get_password_hash(request.new_password)
    
    await db["users"].update_one(
        {"_id": user["_id"]},
        {
            "$set": {"password_hash": new_hashed_password},
            "$unset": {"reset_token": "", "reset_token_expires": ""}
        }
    )
    
    # Send the success confirmation email
    try:
        await send_success_email(user["email"])
    except Exception as e:
        print(f"Failed to send success confirmation email to {user.get('email')}: {e}")
    
    return {"message": "Password successfully reset."}