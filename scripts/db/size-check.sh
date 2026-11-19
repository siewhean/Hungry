#!/usr/bin/env bash
# Records the production database size and the photo storage size, and fails when either is over its
# warning line, so the scheduled GitHub run is marked failed and GitHub emails the owner.
#   BACKUP_DB_URL        same read-only login as nightly-backup.sh
#   SIZE_DB_WARN_MB      default 400 (Supabase Free caps a database at 500 MB)
#   SIZE_STORAGE_WARN_MB default 800 (Supabase Free caps file storage at 1 GB)
#   SIZE_FIXTURE         tests only: "<db bytes> <storage bytes>" instead of asking the database
# Prints one line: db_mb=<n> storage_mb=<n> status=ok|over. Appends a table to $GITHUB_STEP_SUMMARY.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

DB_WARN="${SIZE_DB_WARN_MB:-400}"
STORAGE_WARN="${SIZE_STORAGE_WARN_MB:-800}"
[[ "$DB_WARN" =~ ^[0-9]+$ && "$STORAGE_WARN" =~ ^[0-9]+$ ]] || die "size limits must be whole numbers of MB"

if [ -n "${SIZE_FIXTURE:-}" ]; then
  read -r DB_BYTES STORAGE_BYTES <<<"$SIZE_FIXTURE"
else
  [ -n "${BACKUP_DB_URL:-}" ] || die "BACKUP_DB_URL is not set"
  if [[ "$BACKUP_DB_URL" =~ ^([a-z]+://[^:/@]+):([^@]+)@(.*)$ ]]; then
    export PROD_DB_URL="${BASH_REMATCH[1]}@${BASH_REMATCH[3]}"
    export PROD_PGPASSWORD="${BASH_REMATCH[2]}"
  else
    export PROD_DB_URL="$BACKUP_DB_URL"
  fi
  load_env prod
  # One cheap read. A database login also counts as activity, so the project is not paused for being idle.
  IFS='|' read -r DB_BYTES STORAGE_BYTES < <(psql_db -At -F '|' -c "select pg_database_size(current_database()), coalesce((select sum((metadata->>'size')::bigint) from storage.objects), 0)") || die "could not query database sizes"
fi
[[ "$DB_BYTES" =~ ^[0-9]+$ && "$STORAGE_BYTES" =~ ^[0-9]+$ ]] || die "could not read sizes (got '$DB_BYTES' '$STORAGE_BYTES')"

DB_MB=$((DB_BYTES / 1048576))
STORAGE_MB=$((STORAGE_BYTES / 1048576))
STATUS=ok
[ "$DB_MB" -lt "$DB_WARN" ] || STATUS=over
[ "$STORAGE_MB" -lt "$STORAGE_WARN" ] || STATUS=over

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "| What | Now | Warning line |"
    echo "| --- | --- | --- |"
    echo "| Database | ${DB_MB} MB | ${DB_WARN} MB |"
    echo "| Photo storage | ${STORAGE_MB} MB | ${STORAGE_WARN} MB |"
  } >>"$GITHUB_STEP_SUMMARY"
fi

echo "db_mb=${DB_MB} storage_mb=${STORAGE_MB} status=${STATUS}"
if [ "$STATUS" = over ]; then
  echo "ERROR: size over the warning line (database ${DB_MB}/${DB_WARN} MB, storage ${STORAGE_MB}/${STORAGE_WARN} MB)" >&2
  exit 1
fi
