# TalkDrill Internship Portal (`intern.talkdrill.com`)

Standalone frontend for the Internship Management System. Talks to the existing
TalkDrill backend (`BackEndTalkDrill/`) over the API — **no backend of its own,
no separate auth system.**

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript + MUI 7 — mirrors `UserWebSiteTalkCode/`
- Bearer-JWT auth against the existing backend (cross-origin SPA)

## Auth

| Who | How | Endpoints |
|-----|-----|-----------|
| Intern (regular TalkDrill user) | Email OTP | `POST /api/v1/auth/send-email-otp` → `POST /api/v1/auth/verify-email-otp` |
| Admin (team member) | Password + email 2FA | `POST /api/v1/admin/passwordAuth/forTeam` → `POST /api/v1/admin/passwordAuth/twofa/verify` |

Tokens are stored in `localStorage` (`td_internship_auth`) and sent as
`Authorization: Bearer <jwt>` on every call. Intern sessions silently rotate via
`POST /api/v1/auth/refresh` on 401; admin tokens (7d) just re-login.

Route guards: `/admin/*` requires a team principal; everything else requires any login.
`GET /api/v1/internship/me` tells the app which principal you are and whether the
account is enrolled as an intern.

## Local development

```bash
cd internship-frontend
npm install
cp .env.example .env.local        # defaults to http://localhost:2040
npm run dev                       # http://localhost:3037 (port is whitelisted in backend CORS)
```

Run the backend (`BackEndTalkDrill`: `npm run dev`, port 2040) alongside.

## Environment

| Var | Meaning |
|-----|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend origin, no trailing slash (`https://api.talkdrill.com` in prod) |

## Deploy (Vercel + subdomain)

1. Import this folder as a Vercel project; set `NEXT_PUBLIC_API_BASE_URL` to the prod API origin.
2. Add domain `intern.talkdrill.com` in Vercel → copy the CNAME target.
3. In DNS (Cloudflare), add `CNAME intern → cname.vercel-dns.com` (DNS-only/grey cloud recommended).
4. Backend CORS: `https://intern.talkdrill.com` is already in `PROD_ORIGINS` (`server.js`).
   For Vercel *preview* URLs, set `EXTRA_ALLOWED_ORIGINS=https://<preview>.vercel.app` on the backend.

## Structure

```
src/
  app/            # routes: /login, /tasks, /admin (more per phase)
  components/     # shared UI (AppShell, …)
  features/       # feature modules (arrive Phase 1+)
  lib/api/        # typed API client — ALL backend calls go through client.ts
  lib/auth/       # token storage, AuthContext, route guards
  config/         # env-driven config
```
"# talkdrillIntern" 
