# Whistle — Deployment Guide

Handoff notes for hosting Whistle on a server or AWS. The system is one
NestJS REST API + PostgreSQL + Redis, an admin web console (Next.js), and two
Expo (React Native) apps that also build for the web.

```
backend/          NestJS API  — needs Node 20+, PostgreSQL, Redis
apps/admin-web/   Next.js     — needs Node 20+, talks to the API
apps/coach-app/   Expo app    — native builds via EAS, or static web build
apps/parent-app/  Expo app    — same
packages/shared/  Shared types/theme (built as part of the workspace)
```

Package manager is **pnpm** (workspace monorepo): `npm i -g pnpm && pnpm install` from the repo root.

---

## 1. Infrastructure (typical AWS layout)

| Piece | AWS service | Notes |
|---|---|---|
| PostgreSQL | RDS PostgreSQL 16/17 (db.t4g.micro is fine to start) | Set `DATABASE_URL` |
| Redis | ElastiCache Redis (cache.t4g.micro) | Set `REDIS_HOST`/`REDIS_PORT`; used only for background jobs (renewal reminders, rating recalc) — the API boots and serves without it |
| API | ECS Fargate, App Runner, or a single EC2 + PM2 | Container port 4000; put behind an ALB with HTTPS |
| Admin web | Vercel (easiest for Next.js) or same ECS/EC2 | Needs `NEXT_PUBLIC_API_URL`-style config — see §4 |
| Mobile apps | Expo EAS Build → App Store / Play Store | Web builds can also be served from S3+CloudFront |

A single EC2 box running Postgres + Redis + API + admin web behind nginx is a
perfectly reasonable first deployment for a pilot.

## 2. Backend (NestJS)

```bash
cd backend
cp .env.example .env         # fill in every value — see below
pnpm install                 # from repo root actually: pnpm install
npx prisma migrate deploy    # applies committed migrations (NOT migrate dev)
npx prisma generate
pnpm build                   # nest build → dist/
node dist/main.js            # or: pm2 start dist/main.js --name whistle-api
```

Required environment:
- `DATABASE_URL` — Postgres connection string (RDS endpoint)
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — **generate fresh 48-byte random
  hex for production** (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).
  Never reuse the dev values.
- `PORT` (default 4000), `REDIS_HOST`, `REDIS_PORT`

Hardening TODOs for the hosting developer:
- CORS is currently `origin: true` (allow-all) in `src/main.ts` — lock it to
  the admin web + app origins for production.
- Terminate TLS at the load balancer / nginx; the API itself serves HTTP.
- The daily renewal-reminder job self-schedules at boot (02:00 server time)
  once Redis is reachable.

## 3. Admin web (Next.js)

```bash
cd apps/admin-web
pnpm build
pnpm start        # serves on :3000; put behind nginx/ALB or deploy to Vercel
```

The browser API client reads the API base URL — point it at the public API
URL (see `src/lib/api-client.ts`; wire it to an env var like
`NEXT_PUBLIC_API_URL` as part of production config).

## 4. Mobile apps (Expo)

Set the API URL per app (already env-driven):
```
# apps/coach-app/.env and apps/parent-app/.env
EXPO_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
```

- **Native (recommended)**: `npx eas build --platform android|ios` per app
  (needs an Expo account + store credentials). Location + biometric venue
  check-in only fully works in native builds.
- **Web**: `npx expo export --platform web` produces a static bundle you can
  host on S3+CloudFront or nginx.

## 5. First-run data

A fresh database is empty. Either:
- sign up the first academy through the admin web (`/signup` provisions
  grades + a trial subscription automatically), or
- adapt the idempotent demo seed script the team used in development
  (creates demo academy, staff of every role, sports/drills/lesson plans,
  an LBL tournament, etc.) — ask for `demo-seed.mjs` if wanted.

Note: `POST /sports` is admin-only and sports are global; seed the sports
catalogue once.

## 6. Known production gaps (deliberate, not bugs)

- **Payments are mocked** — LBL registration "payment" and pay-to-join flip a
  status flag; real Razorpay integration is planned but not wired.
- **WhatsApp integration is mocked** (settings exist, no real sends).
- **Role guards are enforced server-side**; the staff "module access" picker
  currently tailors app navigation and is stored on the profile, but is not
  yet enforced per-endpoint.
- Local dev on Windows used a portable Redis (`.redis/`, git-ignored) —
  production should use a managed/systemd Redis.

## 7. Local development quick reference

See `README.md`. Demo logins (dev DB only, password `whistle123`):
admin@whistle.test · coach@whistle.test · parent@whistle.test ·
referee@whistle.test · riverside@whistle.test (second academy).
