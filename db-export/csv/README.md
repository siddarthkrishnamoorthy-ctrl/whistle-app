# Whistle — CSV import bundle

For teams that want to **load the test data from CSV into an existing database**
(rather than restore the full `.sql.gz` dump).

Each `*.csv` is one table, exported UTF-8 with a header row. `load-csv.sql`
imports them all with `\copy`.

## What's included (core content — 18 tables)

`academies, sports, centers, users, plans, classes, clients, semesters, drills,
lesson_plans, enquiries, interschool_events, fixtures, ratings,
scrabble_word_lists, scrabble_word_entries, chess_puzzles, scrabble_puzzles`

~3,458 students, 111 lesson plans, 113 drills, 80 classes, 85 Match Center
events, 214 fixtures, ratings, word lists & puzzles.

> This CSV set is the **core content only**. It does **not** include games,
> enrolments, invoices, attendance, event chat, assessments, etc. For the
> **complete** dataset use `../whistle-demo-db.sql.gz` (the full dump).

## Prerequisites

1. **PostgreSQL 14+** running locally, `psql` on your PATH.
2. **The schema must already exist** — create it first with Prisma from the repo:
   ```bash
   cd backend
   # point .env DATABASE_URL at your local postgres, database `whistle`
   npx prisma migrate deploy    # creates all tables (empty)
   ```

## Import (one command, run from THIS folder)

**macOS / Linux / Git-Bash:**
```bash
./load-csv.sh                       # localhost 5432 postgres whistle
./load-csv.sh localhost 5432 postgres whistle
```

**Windows PowerShell:**
```powershell
./load-csv.ps1
./load-csv.ps1 -User postgres -Port 5432 -Db whistle
```

…or directly:
```bash
psql -h localhost -U postgres -d whistle -f load-csv.sql
```

### How it works / caveats
- Disables FK checks for the load (`session_replication_role = replica`), so
  table order and cross-references never fail.
- **`TRUNCATE … CASCADE` first**, so the import is repeatable. CASCADE also
  clears dependent tables not in this set (games, enrolments, invoices, event
  chat, …) — run it against a **fresh / test** `whistle` DB, not one holding
  data you want to keep.
- CSV column order matches the repo's Prisma schema. If your schema differs from
  this repo's migrations, the load may mismatch — use the same repo.
- The `users.csv` contains bcrypt password hashes (one-way; demo password
  `whistle123`). Rotate before any real deployment.
