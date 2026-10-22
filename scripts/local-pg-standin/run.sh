#!/usr/bin/env bash
# Fresh stand-in, every migration in filename order, seed.sql, then every smoke.
# Each smoke runs in its own clone of the migrated+seeded database, so smokes
# that commit (or fail half way) cannot affect one another.
# Prints one PASS/FAIL line per file; full output goes to $BASE/logs/.
#
#   scripts/local-pg-standin/run.sh                  # migrations + seed + smokes
#   SEED_EXTRA=1 scripts/local-pg-standin/run.sh     # also apply seed-extra.sql
#   SKIP_SEED=1 scripts/local-pg-standin/run.sh      # no seed at all
#   SMOKES="a.sql b.sql" scripts/local-pg-standin/run.sh
#   NO_SETUP=1 SMOKES=... scripts/local-pg-standin/run.sh   # reuse migrated db
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
BASE="${BASE:-/var/tmp/hungry-standin}"
PORT="${PORT:-5501}"
LOGS="$BASE/logs"
DB=hungry
psql_db() { local db="$1"; shift; psql -X -q -h "$BASE/sock" -p "$PORT" -U postgres -d "$db" -v ON_ERROR_STOP=1 "$@"; }

if [ -z "${NO_SETUP:-}" ]; then
  "$HERE/setup.sh" || exit 1
  rm -rf "$LOGS"; mkdir -p "$LOGS/migrations" "$LOGS/smoke"
  psql_db postgres -c "create database $DB template postgres" || exit 1

  for f in $(ls "$ROOT"/supabase/migrations/*.sql | sort); do
    name="$(basename "$f")"
    if psql_db "$DB" -f "$f" >"$LOGS/migrations/$name.log" 2>&1; then
      psql_db "$DB" -c "insert into supabase_migrations.schema_migrations (version, name) values ('${name%%_*}', '$name')" >/dev/null
      echo "PASS migration $name"
    else
      echo "FAIL migration $name"; grep -m3 -E "ERROR" "$LOGS/migrations/$name.log" | sed 's/^/    /'
      exit 1
    fi
  done

  if [ -z "${SKIP_SEED:-}" ]; then
    if psql_db "$DB" -f "$ROOT/supabase/seed.sql" >"$LOGS/seed.log" 2>&1; then
      echo "PASS seed supabase/seed.sql"
    else
      echo "FAIL seed supabase/seed.sql"; grep -m3 ERROR "$LOGS/seed.log" | sed 's/^/    /'
    fi
    if [ -n "${SEED_EXTRA:-}" ]; then
      if psql_db "$DB" -f "$HERE/seed-extra.sql" >"$LOGS/seed-extra.log" 2>&1; then
        echo "PASS seed seed-extra.sql"
      else
        echo "FAIL seed seed-extra.sql"; grep -m3 ERROR "$LOGS/seed-extra.log" | sed 's/^/    /'
      fi
    fi
  fi
fi
mkdir -p "$LOGS/smoke"

run_isolated() { # kind file
  local kind="$1" file="$2" name; name="$(basename "$2")"
  psql_db postgres -c "drop database if exists smoke_run" -c "create database smoke_run template $DB" >/dev/null 2>&1 \
    || { echo "FAIL $kind $name (could not clone database)"; return; }
  if psql_db smoke_run -f "$file" >"$LOGS/smoke/$kind-$name.log" 2>&1; then
    echo "PASS $kind $name"
  else
    echo "FAIL $kind $name"; grep -m3 -E "ERROR|FATAL" "$LOGS/smoke/$kind-$name.log" | sed 's/^/    /'
  fi
}

smokes="${SMOKES:-$(cd "$ROOT/supabase/smoke" && ls *.sql | sort)}"
for name in $smokes; do
  run_isolated smoke "$ROOT/supabase/smoke/$name"
done
# Extra end-to-end checks kept with the stand-in (skipped when SMOKES is set).
if [ -z "${SMOKES:-}" ]; then
  for f in "$HERE"/checks/*.sql; do
    run_isolated check "$f"
  done
fi
psql_db postgres -c "drop database if exists smoke_run" >/dev/null 2>&1
