#!/usr/bin/env bash
# Restore the Whistle demo database. Usage: ./restore.sh [user] [host] [port]
# Drops + recreates the `whistle` database and loads all demo data.
set -euo pipefail
USER="${1:-postgres}"
HOST="${2:-localhost}"
PORT="${3:-5432}"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Restoring Whistle demo DB into postgres://$USER@$HOST:$PORT (database 'whistle')…"
gunzip -c "$DIR/whistle-demo-db.sql.gz" | psql -h "$HOST" -p "$PORT" -U "$USER"
echo "Done. Set backend/.env DATABASE_URL to …@$HOST:$PORT/whistle and start the backend."
