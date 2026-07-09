# Whistle

Multi-sport coaching-academy platform: an admin web console plus coach and
parent/student mobile apps, backed by one NestJS + PostgreSQL API.

```
apps/admin-web/   Next.js admin console (web)
apps/coach-app/    Expo app for coaches
apps/parent-app/    Expo app for parents/students
backend/           NestJS API (auth now; Academy Operations, Coaching Content,
                    Interschool/Rating, Scoring Engine modules land in later phases)
packages/shared/   Shared TS types/enums, theme tokens, sports taxonomy
```

## One-time setup

1. **Install PostgreSQL** (this dev environment uses PostgreSQL 17 installed
   locally). Create a database and user, then set `DATABASE_URL` in
   `backend/.env` (copy `backend/.env.example`).
2. Generate JWT secrets and fill in `backend/.env`:
   ```
   JWT_ACCESS_SECRET=<random>
   JWT_REFRESH_SECRET=<random>
   ```
3. Install dependencies from the repo root:
   ```
   pnpm install
   ```
4. Generate the Prisma client and run migrations:
   ```
   pnpm --filter backend prisma:generate
   pnpm --filter backend prisma:migrate
   ```
5. Copy each app's env template and point it at the backend (defaults to
   `http://localhost:4000/api/v1`, no changes needed for local dev):
   ```
   apps/admin-web/.env.local.example  -> apps/admin-web/.env.local
   apps/coach-app/.env.example         -> apps/coach-app/.env
   apps/parent-app/.env.example         -> apps/parent-app/.env
   ```

## Running everything

```
pnpm --filter backend dev   # NestJS API, http://localhost:4000/api/v1
pnpm dev:admin              # Next.js dev server, http://localhost:3000
pnpm dev:coach              # expo start (scan the QR code with Expo Go, or press w for web)
pnpm dev:parent              # expo start
```

- **Admin web** signup provisions a brand-new academy and an `admin` user
  (`POST /auth/signup`).
- **Coach app** has no self-signup: per the BRD, a coach is invited by an
  admin from Staff → Add Staff (a later Admin Web phase). The signup screen
  explains this instead of pretending to create an account.
- **Parent app** self-registers (`POST /auth/signup-parent`, no academy
  attached), then links to an existing student record via "Link your player"
  — that flow needs the backend's Clients module (a later phase), so the
  screen currently shows an honest "not available yet" state.
- The admin web app's refresh token lives in an httpOnly cookie (set by
  Next.js Route Handlers under `src/app/api/auth/*` that proxy to the NestJS
  API); the two Expo apps store both tokens via `expo-secure-store` (falling
  back to `localStorage` only when running via `--web`, since SecureStore has
  no web implementation).

## Status

Architecture pivoted from an initial Firebase/Firestore build to
Postgres + NestJS + Prisma per `Whistle_Technical_Design_Document.docx`,
which also added two new modules — Interschool Events & a DUPR-style Rating
Engine, and a Universal Sport Scoring Engine — folded into the Prisma schema
now (`backend/prisma/schema.prisma`) and built in a later phase. Auth is
live end-to-end (signup/login/refresh/logout, JWT + role guards) across all
three apps. Screens reachable from the admin sidebar that aren't wired to the
API yet show a placeholder noting which phase implements them.
