# GetRemindMe

**Developed by:** Ricky Panu

## Overview
GetRemindMe is a full-stack, student-focused reminder app. A React + Vite PWA frontend talks to a FastAPI + MongoDB backend. Google Gemini turns natural language into reminders, and reminders are delivered through Web Push and Telegram.

## Features
* **Natural-language add:** "Remind me to revise physics every weekday at 7pm" becomes a structured reminder.
* **One-time, daily and weekly reminders:** daily and weekly reminders repeat automatically and roll forward when completed or missed.
* **Encrypted reminders:** title, description and category are encrypted at rest (AES-256-GCM, a separate key per user).
* **Content moderation:** sexual, vulgar, hateful and harmful reminders are rejected with a clear message.
* **Resilient Gemini:** any number of API keys and models, with automatic fallback on rate limits and errors.
* **Dark / light theme:** saved and applied on every page.
* **Responsive PWA:** hamburger menu on mobile, no horizontal scrolling, installable, with offline support.
* **SEO basics:** per-page titles and descriptions, favicon set, `robots.txt`, styled 404 page.

## Tech Stack
**Client:** React 19, Vite, Tailwind v4, react-hot-toast, vite-plugin-pwa
**Server:** FastAPI, Motor (MongoDB), APScheduler, google-genai, pywebpush, cryptography

## Prerequisites
* Node.js 18+
* Python 3.10+
* MongoDB (local or Atlas)
* At least one Gemini API key
* Telegram bot token (optional, for Telegram reminders)

## Backend setup
```bash
cd server
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # then fill it in
```

Required in `.env`:
* `MONGODB_URL`, `DATABASE_NAME`, `SECRET_KEY`
* `REMINDER_ENCRYPTION_KEY` – generate with
  `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
  **Back it up.** Without it, stored reminders cannot be read. The server refuses to start if it is missing.
* `GEMINI_API_KEYS=key1,key2,key3` (see `.env.example` for other styles and `GEMINI_MODELS`)

Optional: Telegram, VAPID, Brevo and `CORS_ORIGINS` (set this in production).

Run:
```bash
uvicorn main:app --reload
```

### Encrypt existing reminders (one time)
Reminders created before this update are stored as plaintext and are still readable. Encrypt them with:
```bash
python -m scripts.encrypt_existing_tasks
```

### Key rotation
Put the new key in `REMINDER_ENCRYPTION_KEY` and the old one in `REMINDER_ENCRYPTION_KEY_PREVIOUS`, then re-run the script.

### Tests
```bash
pip install -r requirements-dev.txt
pytest tests
```

## Frontend setup
```bash
cd client
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```
Update the site URL and contact details in `client/src/config/site.js`.

## Notes on privacy
* Reminders are encrypted in the database and decrypted by the server only for the authenticated owner. The server holds the key, so this protects against database leaks and other users, not against someone with access to both the server and its key.
* Reminder text is never sent to Gemini to write notification wording. Text typed into "magic add" is sent to Gemini to be parsed.
* Telegram and Web Push messages leave your server and contain the reminder text.

## Recurrence model
`schedule_type` is `once`, `daily` or `weekly`. `time_of_day` is `HH:MM` in IST, `weekdays` is 0 (Mon) to 6 (Sun), and `ends_on` is optional. `due_date` always holds the next occurrence in UTC.

## License
This project is proprietary and developed by Ricky Panu.

## Deploy (free)
See [DEPLOY_FREE.md](DEPLOY_FREE.md): Vercel Hobby + Render free + MongoDB Atlas M0 + UptimeRobot, no paid service.
