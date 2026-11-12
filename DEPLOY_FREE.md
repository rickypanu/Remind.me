# GetRemindMe – 100% free deploy guide

Sab kuch free plans par chalta hai. Koi card ya paid plan zaroori nahi. Order follow karo: **Atlas → Render → Vercel → UptimeRobot**.

| Part | Service | Plan | Cost |
|---|---|---|---|
| Frontend (PWA) | Vercel | Hobby | Free (sirf non-commercial use) |
| Backend (FastAPI + reminder scheduler) | Render | Free web service | Free |
| Database | MongoDB Atlas | M0 (512 MB) | Free |
| Backend ko jagaye rakhna | UptimeRobot | Free (5-min ping) | Free |
| Quick Add (AI) | Google Gemini API | Free tier | Free (rate-limited) |
| Push notifications | Web Push (VAPID) | – | Free |
| Telegram reminders (optional) | Telegram Bot | – | Free |
| Password-reset email (optional) | Brevo | Free (300 mail/day) | Free |

> Limits kabhi bhi badal sakti hain — deploy se pehle har service ka pricing page ek baar dekh lo.

## 0. GitHub par code daalo
Is folder ko ek GitHub repo bana ke push karo (root par `client/`, `server/`, `render.yaml` hone chahiye). `.env` kabhi commit mat karna (`.gitignore` already block karta hai).

## 1. MongoDB Atlas (database)
1. mongodb.com/atlas → free account → **Create cluster → M0 Free** (region: Mumbai ya Singapore).
2. **Database Access** → user banao (username + strong password).
3. **Network Access** → `0.0.0.0/0` allow karo (Render free ka fixed IP nahi hota; security password + TLS se aati hai).
4. **Connect → Drivers** → connection string copy karo: `mongodb+srv://USER:PASS@cluster.../?retryWrites=true&w=majority`. Password me special characters ho to URL-encode karo.

## 2. Secrets generate karo (apne laptop par)
```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"   # REMINDER_ENCRYPTION_KEY  (ek baar banao, hamesha same rakho!)
npx web-push generate-vapid-keys                                 # VAPID public + private
```
`SECRET_KEY` Render khud generate kar deta hai (`render.yaml`). **`REMINDER_ENCRYPTION_KEY` kho diya ya badal diya = purane reminders padhe nahi jayenge.** Kahin safe save karo.

Gemini key (free): aistudio.google.com/apikey → key banao → `GEMINI_API_KEYS`. Free tier ki limit kam hoti hai, isliye app kai keys/models me fallback karta hai (comma se alag karke multiple keys daal sakte ho). Free tier me prompts Google product improve karne ke liye use kar sakta hai — sensitive reminders ke liye yeh policy padh lo.

## 3. Render (backend)
1. render.com → GitHub se sign in → **New → Blueprint** → apna repo chuno. `render.yaml` apne aap `plan: free` service banata hai.
2. Dashboard me ye values bharo (jo `sync: false` hain):
   - `MONGODB_URL` – step 1 ki string
   - `REMINDER_ENCRYPTION_KEY` – step 2
   - `FRONTEND_URL` aur `CORS_ORIGINS` – abhi Vercel URL pata nahi → pehle `https://placeholder.vercel.app` daalo, step 4 me asli URL se badal dena (**https hona zaroori hai, trailing path nahi**)
   - `GEMINI_API_KEYS`, `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_EMAIL` (`mailto:tumhari@email.com`)
   - `BREVO_API_KEY`, `EMAIL_SENDER_ADDRESS` – khali chhod sakte ho (step 6)
3. Deploy ke baad `https://<naam>.onrender.com/health` kholo — JSON aana chahiye. Yehi tumhara **API URL** hai.

Backend ko free instance (0.1 CPU) ke hisaab se tune kiya gaya hai: argon2 password cost kam (`ARGON2_*`, OWASP minimum), 1 worker, chhota Mongo pool, in-memory rate-limit (Redis ki zaroorat nahi).

## 4. Vercel (frontend)
1. vercel.com → GitHub se sign in → **Add New → Project** → same repo.
2. **Root Directory = `client`**, Framework = Vite (build command `npm run build` already `package.json` me hai).
3. **Environment Variables**:
   - `VITE_API_BASE_URL` = Render API URL (bina trailing `/`)
   - `VITE_VAPID_PUBLIC_KEY` = step 2 ki public key
   - `VITE_SITE_URL` = apna Vercel URL (optional; na daalo to `VERCEL_PROJECT_PRODUCTION_URL` use hota hai)
4. Deploy. Phir Render me `FRONTEND_URL` aur `CORS_ORIGINS` ko asli Vercel URL (`https://xyz.vercel.app`) se badlo → Render automatically redeploy karega.

## 5. UptimeRobot (zaroori!)
Render free service 15 min bina traffic ke so jati hai, aur so gayi service reminders nahi bhej sakti (scheduler usi process me chalta hai).
1. uptimerobot.com → free account → **Add monitor → HTTP(s)**.
2. URL: `https://<naam>.onrender.com/health`, interval **5 minutes**.
Isse service jagi rehti hai. Free instance-hours (750/month) ek hi always-on service ke liye kaafi hain; is workspace me doosri free service mat chalao.

## 6. Optional: password-reset email (Brevo free)
`ALLOW_PRODUCTION_WITHOUT_EMAIL=true` par app email ke bina bhi chalta hai (sirf "forgot password" mail nahi jayegi). Chahiye to:
1. brevo.com free account → SMTP & API → API key (`BREVO_API_KEY`).
2. Sender verify karo (apna domain ho to best; sirf personal Gmail se deliverability kharab ho sakti hai) → `EMAIL_SENDER_ADDRESS`.
3. Render me `ALLOW_PRODUCTION_WITHOUT_EMAIL=false` kar do.

## 7. Optional: Telegram reminders
1. Telegram par @BotFather se bot banao → token.
2. Render env: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` (random string), optional `ADMIN_TELEGRAM_ID`.
3. Apne laptop par (same env vars set karke, `server/` folder se):
   `python -m scripts.set_telegram_webhook https://<naam>.onrender.com/v1/integrations/telegram/webhook`

## 8. Check list (deploy ke baad)
- [ ] `/health` chal raha hai
- [ ] Signup → login → task banao → refresh karke dikha
- [ ] Quick Add: "gym" likho → aaj ki date, abhi + 2 ghante (IST); raat me ho to +10 min
- [ ] Notification permission do → push test
- [ ] Phone par "Add to Home Screen"

## Honest limits (free ka matlab)
- **Cold start**: UptimeRobot ke bawajood kabhi-kabhi (restart/deploy ke baad) pehla request ~1 min le sakta hai. App me warm-up ping hai, aur dashboard saved profile se turant khulta hai.
- **0.1 CPU**: login/signup ~1 sec tak le sakte hain; busy time par slow.
- **Vercel Hobby** sirf personal/non-commercial use ke liye hai. Commercial karna ho to paid plan ya kisi aur free host par jana padega.
- **Atlas M0**: 512 MB; storage bhar jaye to writes ruk jate hain.
- **Gemini free tier**: kam requests/min aur din; limit lagne par Quick Add ruk sakta hai.
- **Render disk ephemeral hai**: server par file me kuch store nahi hota (avatars/tasks DB me jate hain), isliye ok.
- Rate-limit server ki memory me hota hai (Redis nahi), restart par reset hota hai.
- Yeh sab dashboards (Atlas/Render/Vercel/UptimeRobot) mere environment se nahi chalaye gaye — config docs ke hisaab se likha hai; pehle deploy par logs dekhna.

## 7. Quick add: instant + free (v6)
- **Quick add now works on the phone first.** The sentence is understood by the app itself (English + Hinglish: "kal sham 6 baje", "every monday 7am", "in 30 min"), saved to the device in about a second and uploaded in the background. A sleeping Render server or a busy Gemini key can no longer make the first reminder wait.
- **Gemini is only a background polish** for long sentences the app was unsure about (`POST /v1/tasks/magic-parse`, nothing is saved by that call). Per-attempt timeout is now 8 s and one request stops after 14 s in total (`GEMINI_TIMEOUT_SECONDS`, `GEMINI_TOTAL_BUDGET_SECONDS`).
- **More Gemini keys, still free:** create each key in a *different Google AI Studio project* (aistudio.google.com/apikey → Create key in new project) and list them: `GEMINI_API_KEYS=key1,key2,key3`. Every project has its own free quota; the pool rotates and skips a key that hit its limit.
- **Keep the server awake (free):** use BOTH UptimeRobot (step 5) and the GitHub Action `.github/workflows/keep-alive.yml` (set the repository variable `API_URL`). The app also pings `/health` whenever it is opened or comes back to the foreground. Reminders are sent by this same server, so keeping it awake also keeps notifications on time.
