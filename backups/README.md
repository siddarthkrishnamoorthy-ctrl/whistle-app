# Database backups

Point-in-time dumps of the local `whistle` PostgreSQL database (demo/dev data).
The application **code** is versioned by Git itself; these files capture the
**data** that lives outside the repo. Secrets (`.env` files) are intentionally
**not** here — they stay gitignored.

## Files

| File | Taken | Contents |
|------|-------|----------|
| `whistle-db-2026-07-12.sql.gz` | 2026-07-12 | Full `whistle` DB — includes the Chess **and Scrabble** modules. `pg_dump --no-owner --no-privileges`, gzip-compressed. |

Password hashes in these dumps are bcrypt (one-way). The demo login password
(`whistle123`) should still be rotated before any public deployment.

## Restore

Recreate the database from a dump (PostgreSQL 17, local dev):

```bash
# 1. (Re)create an empty database
export PGPASSWORD='whistle_dev_pw'
psql -h 127.0.0.1 -U postgres -c "DROP DATABASE IF EXISTS whistle;"
psql -h 127.0.0.1 -U postgres -c "CREATE DATABASE whistle;"

# 2. Load the dump
gunzip -c backups/whistle-db-2026-07-12.sql.gz | \
  psql -h 127.0.0.1 -U postgres -d whistle
```

The connection string the backend expects lives in `backend/.env`
(`DATABASE_URL`), which is not committed.

## Take a fresh backup

```bash
export PGPASSWORD='whistle_dev_pw'
"/c/Program Files/PostgreSQL/17/bin/pg_dump.exe" \
  -h 127.0.0.1 -p 5432 -U postgres -d whistle \
  --no-owner --no-privileges | gzip > "backups/whistle-db-$(date +%F).sql.gz"
```
