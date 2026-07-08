## GameNight Host Web Deploy (Render)

This guide prepares a standalone web deploy without enabling web payments yet.

### Architecture

- Frontend: Render **Static Site**
- Backend API: Render **Web Service**
- Telegram bot on web backend: **disabled by default** (`BOT_ENABLED=false`)

---

## 1) Frontend Deploy (Render Static Site)

### Build settings

- Build command: `npm install && npm run build`
- Publish directory: `dist`

### Required frontend env

- `VITE_API_BASE_URL=https://<your-backend-service>.onrender.com`

Supported fallback envs (legacy compatibility):

- `VITE_API_URL`
- `VITE_API_BASE`

### SPA rewrite (required)

Configure in Render Static Site:

- Source: `/*`
- Destination: `/index.html`
- Action: `Rewrite`

See `RENDER_STATIC_REWRITE.md`.

---

## 2) Backend Deploy (Render Web Service)

### Build/start settings

- Root directory: `server`
- Build command: `npm install && npm run build`
- Start command: `npm start`

### Required backend env

- `NODE_ENV=production`
- `PORT` (Render usually sets automatically)
- `DATABASE_URL`
- `CORS_ORIGIN=https://<your-frontend-domain>`
- `BOT_ENABLED=false` (mandatory for web backend)

### Optional backend env

- `ADMIN_SECRET` (for protected `/api/dev/grant-premium` in production)
- Telegram/YooKassa vars can stay configured for existing flows, but web deploy must keep `BOT_ENABLED=false`.

### Do not expose in frontend

- `DATABASE_URL`
- `TELEGRAM_BOT_TOKEN` / `BOT_TOKEN`
- `YOOKASSA_SECRET_KEY`
- `ADMIN_SECRET`

---

## 3) Health Checks

Backend health endpoint:

- `GET /api/health`

Expected response:

```json
{
  "ok": true,
  "service": "gamenight-web-api",
  "time": "2026-01-01T00:00:00.000Z"
}
```

---

## 4) Verify Bot Is Not Running

On backend logs you should see:

- `[bot] BOT_ENABLED is not true; bot is disabled`

And webhook handling should not run bot logic unless explicitly enabled with `BOT_ENABLED=true`.

---

## 5) Mobile Browser Check

1. Open frontend URL from a phone browser (Safari/Chrome).
2. Verify main route loads without Telegram.
3. Navigate to a few routes (`/`, `/games`, game pages).
4. Hard refresh a deep route to confirm rewrite works (no 404).
5. Confirm API calls succeed against `VITE_API_BASE_URL` backend.

---

## 6) Payments Status (Current Stage)

- YooKassa/web purchase flow is intentionally not connected for standalone web checkout yet.
- Existing Telegram payment flow remains untouched.
