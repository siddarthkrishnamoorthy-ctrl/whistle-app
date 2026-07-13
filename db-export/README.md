# Whistle — shareable demo data

Two files, two purposes:

| File | What it's for |
|------|---------------|
| **`whistle-test-data.xlsx`** | **Review / share the data** — one tab per table (Students, Lesson Plans, Drills, Classes, Fixtures, …). Open in Excel / Google Sheets, no database needed. |
| **`whistle-demo-db.sql.gz`** | **Load the data into the app to test** — a full PostgreSQL dump (schema + all data). Restore it and point the backend at it. |
| **`csv/`** | **Import from CSV** into an already-created schema (`\copy`). Core content only (students, lesson plans, drills, classes, events, fixtures, …) — not the full dataset. See `csv/README.md`. |

The `.xlsx` and the `.sql.gz` contain the **same** test data:
~3,450 students, 111 lesson plans, 113 drills (all with videos), 80 classes,
85 Match Center events, 214 fixtures, ratings, Chess & Scrabble games, etc.

- Just want to **look at / hand over the data**? → open `whistle-test-data.xlsx`.
- Want the team to **run the app against it**? → restore `whistle-demo-db.sql.gz` (below). **Recommended.**
- Specifically want to **import from CSV** into an existing schema? → see `csv/` (core content only).

---

## Loading the database (to run the app)

### Prerequisites
- **PostgreSQL 14+** installed and running locally (the dump was taken from PG 17).
- The `psql` client on your PATH.
- A superuser you can log in as (usually `postgres`).

## Restore (one command)

The dump **drops and recreates** a database called `whistle`, so restoring is a
single step. Replace `postgres` if your superuser differs.

**macOS / Linux / Git-Bash:**
```bash
gunzip -c whistle-demo-db.sql.gz | psql -h localhost -U postgres
```

**Windows PowerShell:** run the helper (decompresses, then loads):
```powershell
./restore.ps1                      # uses postgres@localhost:5432
./restore.ps1 -User postgres -Port 5432
```
…or manually: decompress the `.gz` with 7-Zip/gzip, then
`psql -U postgres -f whistle-demo-db.sql`.

You'll be prompted for your Postgres password.

## Point the backend at it
In `backend/.env` set `DATABASE_URL` to your local Postgres, database `whistle`:
```
DATABASE_URL="postgresql://postgres:<your-password>@127.0.0.1:5432/whistle"
```
Then start the backend (`npm run dev` in `backend/`) — it will connect straight to
the restored data.

## Demo logins (all password `whistle123`)
| Login | Where |
|-------|-------|
| `admin@whistle.test` | Academy admin — web `:3000` |
| `owner@whistle.app` | Platform/owner console — `:3000/platform` |
| `coach@whistle.test` | Coach app — Expo `:8081` |
| `parent@whistle.test` | Parent app — Expo `:8082` (child: Aarav Demo) |
| `referee@whistle.test` | Referee/scorer — `:3000` |
| `organizer@tourney.test` | Tournament organizer — `:3000/organizer` |
| `official@tourney.test` | Tournament official — `:3000/play` |
| `player1@tourney.test` | Tournament player — `:3000/play` |

> ⚠️ This is **demo data only**. Passwords are shared; rotate them before any real
> deployment. The dump contains bcrypt password hashes (one-way), not plaintext.
