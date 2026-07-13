#!/usr/bin/env bash
# Load the Whistle core test data from CSV into an EXISTING (migrated) `whistle` schema.
# Usage: ./load-csv.sh [host] [port] [user] [db]   (defaults: localhost 5432 postgres whistle)
set -euo pipefail
HOST="${1:-localhost}"; PORT="${2:-5432}"; USER="${3:-postgres}"; DB="${4:-whistle}"
cd "$(dirname "$0")"
echo "Loading CSVs into database '$DB' @ $HOST:$PORT (user $USER)…"
psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" -f load-csv.sql
echo "Done."
