# GetRemindMe: run locally, deploy, fix common errors

Repo layout: **this folder is the repo root.** `client/`, `server/` and `render.yaml` must sit at the top of the GitHub repo. If you push the parent folder instead, Render and Vercel will not find them.

You need: **Node 22.12+**, **Python 3.11+** (3.13 recommended), **MongoDB** (a free Atlas cluster, or MongoDB Community installed on your PC).

---

## A. Run it on your computer

### 1. Database
Easiest (free, nothing to install): make a free **Atlas M0** cluster (section B1) and put its connection string in `server/.env` as `MONGODB_URL`. Allow your own IP (or `0.0.0.0/0`) in Atlas Network Access.

Or install the free MongoDB Community Server on your PC and keep the default `MONGODB_URL=mongodb://localhost:27017`.

### 2. Backend (terminal 1)
```bash
cd server
python -m venv venv
source venv/bin/activate            # Windows PowerShell: venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m scripts.init_env          # creates server/.env with random SECRET_KEY + REMINDER_ENCRYPTION_KEY
uvicorn app.main:app --reload       # http://localhost:8000  (check http://localhost:8000/health and /docs)
```
Optional in `server/.env`: `GEMINI_API_KEYS=...` (Quick Add AI). Push needs the three `VAPID_*` values; leave them empty to skip push.

### 3. Frontend (terminal 2)
```bash
cd client
node --version                      # must be 22.12 or newer
npm install                         # use install, not ci (see Troubleshooting 1)
npm run dev                         # http://localhost:5173
```
No `client/.env` is needed locally: the app talks to `http://localhost:8000` by default, and the server allows any `localhost` port in development.

### 4. Check it works
Open http://localhost:5173, sign up, log in, add a reminder, refresh the page and see it is still there.

### Tests (optional)
```bash
cd server && pip install -r requirements-dev.txt && pytest tests
cd client && npm test
```

### Local production preview (optional)
```bash
cd client
ALLOW_LOCAL_API_BUILD=1 npm run build && npm run preview        # PowerShell: $env:ALLOW_LOCAL_API_BUILD=1; npm run build; npm run preview
```
Push notifications and the service worker only work on this build or on the deployed site, not in `npm run dev`.

---

## B. Deploy (all free): Atlas, Render, Vercel, UptimeRobot

Do them in this order. [DEPLOY_FREE.md](DEPLOY_FREE.md) has the same steps in Hinglish.

### B0. GitHub
Push this folder's contents as a repo (`client/`, `server/`, `render.yaml` at the top). Never commit `.env`.

### B1. MongoDB Atlas
1. Create a free **M0** cluster.
2. Database Access: create a user and password.
3. Network Access: allow `0.0.0.0/0` (Render's free tier has no fixed IP).
4. Connect, then Drivers: copy `mongodb+srv://USER:PASS@.../?retryWrites=true&w=majority`. URL-encode special characters in the password (`@` becomes `%40`).

### B2. Secrets (on your computer)
```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"     # REMINDER_ENCRYPTION_KEY. Generate once, never change.
npx web-push generate-vapid-keys                                  # VAPID public + private (optional, for push)
```
Render creates `SECRET_KEY` itself.

### B3. Render (backend)
1. New, Blueprint, pick the repo. `render.yaml` creates the free web service.
2. Fill the prompted variables:
   - `MONGODB_URL`: from B1
   - `REMINDER_ENCRYPTION_KEY`: from B2
   - `FRONTEND_URL` and `CORS_ORIGINS`: your Vercel URL, e.g. `https://myapp.vercel.app` (https, **no trailing slash, no path**). Use a placeholder first if you do not have it yet.
   - `GEMINI_API_KEYS`: from aistudio.google.com/apikey
   - `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_EMAIL`: all three or none
   - `BREVO_*`: leave empty
3. Open `https://<name>.onrender.com/health`. You should see JSON. That URL is your **API URL**.

### B4. Vercel (frontend)
1. Add New, Project, pick the repo.
2. **Root Directory = `client`**. Framework = Vite.
3. Environment Variables (set them **before** the first deploy):
   - `VITE_API_BASE_URL` = your Render API URL, no trailing `/` (**required: the build fails without it**)
   - `VITE_VAPID_PUBLIC_KEY` = the VAPID public key (for push)
4. Deploy. Then go back to Render and set `FRONTEND_URL` and `CORS_ORIGINS` to the real Vercel URL (Render redeploys by itself).

### B5. UptimeRobot (keeps the backend awake)
New HTTP(s) monitor on `https://<name>.onrender.com/health`, every 5 minutes. Without it the free server sleeps and sleeping servers send no reminders.

### B6. After deploying
- [ ] `/health` opens
- [ ] Sign up, log in, add a reminder, refresh and it is still there
- [ ] Quick Add works
- [ ] Allow notifications and push works (HTTPS site only)

---

## C. Troubleshooting (what each error means)

| # | You see | Cause | Fix |
|---|---|---|---|
| 1 | `npm ci` fails: "package.json and package-lock.json are not in sync" | The lock file was missing the test tools | Run `npm install` once and commit the new `package-lock.json` |
| 2 | `npm run dev` crashes, or "Unsupported engine" / Node version errors | Node older than 22.12 | Install Node 22 (`nvm install 22 && nvm use`) |
| 3 | Server stops with `SECRET_KEY Field required` | No `server/.env` | `cd server && python -m scripts.init_env` |
| 4 | `Cannot reach MongoDB` at start | MongoDB not running, wrong `MONGODB_URL`, or Atlas blocks your IP | Start your local MongoDB, or fix the URL / allow your IP (or `0.0.0.0/0`) in Atlas Network Access |
| 5 | `ImportError: cannot import name 'UTC'` | Python older than 3.11 | Use Python 3.11+ |
| 6 | Render logs: `Invalid configuration: ... must be a public https URL` | `FRONTEND_URL` / `CORS_ORIGINS` empty or not https | Set both to the exact Vercel URL |
| 7 | Browser console: `blocked by CORS policy` | `CORS_ORIGINS` does not exactly match the site URL (http vs https, www, trailing slash, preview URL) | Fix the value in Render; add extra origins separated by commas |
| 8 | Vercel build fails: `VITE_API_BASE_URL must be set` | The variable is missing | Add it in Vercel, then redeploy |
| 9 | Site loads but login/signup does nothing or says network error | `VITE_API_BASE_URL` is wrong, or Render is asleep | Open `<API>/health`; wait about a minute after a cold start; check the variable has no trailing slash |
| 10 | "Too many requests" for everyone | Rate limit sees every user as one IP (wrong `TRUSTED_PROXY_HOPS`) | Check Render logs; try `TRUSTED_PROXY_HOPS=2` if the login limit hits all users together |
| 11 | Reminders arrive late or not at all | Render free server asleep | UptimeRobot monitor (B5) |
| 12 | Old reminders show "could not be decrypted" | `REMINDER_ENCRYPTION_KEY` was changed | Put the old key back; to rotate use `REMINDER_ENCRYPTION_KEY_PREVIOUS` |
| 13 | "Push alerts are not configured" | `VITE_VAPID_PUBLIC_KEY` missing on Vercel, or you are on `npm run dev` | Set it in Vercel and redeploy; test on the deployed site |
| 14 | Forgot-password email never arrives | Brevo not set up (`ALLOW_PRODUCTION_WITHOUT_EMAIL=true`) | Optional: set `BREVO_API_KEY` + `EMAIL_SENDER_ADDRESS`, then set that flag to `false` |
