"""Transactional e-mail through Brevo (finding S6).

Reads the API key and the sender from Settings (the sender address used to be hard-coded). Reset links are
HTML-escaped, never logged in production, and the HTTP call has a timeout so a slow provider cannot pin a worker.
"""

import html
import logging

from app.core.config import get_settings
from app.core.http import get_http_client

log = logging.getLogger("email")
BREVO_URL = "https://api.brevo.com/v3/smtp/email"


async def _send(to_email: str, subject: str, html_content: str) -> bool:
    settings = get_settings()
    if not settings.email_enabled:
        log.warning("E-mail is not configured (BREVO_API_KEY / EMAIL_SENDER_ADDRESS); not sending %r", subject)
        return False
    payload = {
        "sender": {"name": settings.email_sender_name, "email": str(settings.email_sender_address)},
        "to": [{"email": to_email}],
        "subject": subject,
        "htmlContent": html_content,
    }
    headers = {
        "accept": "application/json",
        "api-key": settings.brevo_api_key.get_secret_value(),  # type: ignore[union-attr]
        "content-type": "application/json",
    }
    response = await get_http_client().post(BREVO_URL, headers=headers, json=payload)
    response.raise_for_status()
    return True


async def send_reset_email(to_email: str, reset_link: str, expires_minutes: int) -> bool:
    settings = get_settings()
    if not settings.email_enabled and settings.environment == "development":
        # Local development without Brevo: print the link so the flow can still be tested. Never in production.
        log.warning("DEV ONLY: password reset link for %s: %s", to_email, reset_link)
    safe_link = html.escape(reset_link, quote=True)
    return await _send(
        to_email,
        "Password Reset Request",
        f"""
        <h3>Password Reset</h3>
        <p>You requested a password reset. Click the link below to set a new password:</p>
        <p><a href="{safe_link}">Reset Password</a></p>
        <p>If you didn't request this, you can ignore this email. This link expires in {int(expires_minutes)} minutes
        and works only once.</p>
        """,
    )


async def send_success_email(to_email: str) -> bool:
    return await _send(
        to_email,
        "Password Reset Successful",
        """
        <h3>Password Changed Successfully</h3>
        <p>Your RemindMe account password has been successfully updated and you were signed out on every device.</p>
        <p>If you did not perform this action, please reset your password again immediately and contact support.</p>
        """,
    )
