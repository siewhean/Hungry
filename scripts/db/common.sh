#!/usr/bin/env bash
# Shared helpers for the safe-migration scripts. Source it, do not run it.
# See supabase/manual/safe-migration-runbook.md.
#
# Environment (set per shell, never committed):
#   STAGING_DB_URL / STAGING_PGPASSWORD   staging project (a different Supabase project from prod)
#   PROD_DB_URL    / PROD_PGPASSWORD      production project
# URLs carry no password. zsh: read -s "STAGING_PGPASSWORD?Staging DB password: "; echo; export STAGING_PGPASSWORD
set -euo pipefail

DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$DB_DIR/../.." && pwd)"
PROD_REF="${HUNGRY_PROD_REF:-yrlxjeovwslirseajomz}"
BACKUP_ROOT="${HUNGRY_BACKUP_DIR:-$HOME/hungry-backups}"
export PAGER=cat
export PGOPTIONS="${PGOPTIONS:--c statement_timeout=0}"

die() { echo "ERROR: $*" >&2; exit 1; }
say() { echo "==> $*"; }

# Project ref from a Supabase pooler/direct URL, else the database name (local tests).
ref_of() {
  local url="$1"
  if [[ "$url" =~ postgres\.([a-z0-9]{20})@ ]]; then echo "${BASH_REMATCH[1]}"
  elif [[ "$url" =~ @db\.([a-z0-9]{20})\.supabase\.co ]]; then echo "${BASH_REMATCH[1]}"
  else local tail="${url%%\?*}"; echo "${tail##*/}"; fi
}

# load_env staging|prod -> DB_URL, DB_REF, ENV_NAME, exports PGPASSWORD
load_env() {
  ENV_NAME="$1"
  local urlvar pwvar
  case "$ENV_NAME" in
    staging) urlvar=STAGING_DB_URL; pwvar=STAGING_PGPASSWORD ;;
    prod) urlvar=PROD_DB_URL; pwvar=PROD_PGPASSWORD ;;
    *) die "environment must be 'staging' or 'prod', got '$ENV_NAME'" ;;
  esac
  DB_URL="${!urlvar:-}"
  [ -n "$DB_URL" ] || die "$urlvar is not set"
  if [ -n "${!pwvar:-}" ]; then export PGPASSWORD="${!pwvar}"; fi
  DB_REF="$(ref_of "$DB_URL")"
  if [ "$ENV_NAME" = prod ] && [ "$DB_REF" != "$PROD_REF" ]; then
    die "PROD_DB_URL points at '$DB_REF', not the production project '$PROD_REF'"
  fi
  if [ "$ENV_NAME" = staging ] && [ "$DB_REF" = "$PROD_REF" ]; then
    die "STAGING_DB_URL points at the production project. Staging must be a separate Supabase project."
  fi
  command -v psql >/dev/null || die "psql not found (brew install libpq)"
  command -v pg_dump >/dev/null || die "pg_dump not found (brew install libpq)"
  command -v shasum >/dev/null || command -v sha256sum >/dev/null || die "shasum/sha256sum not found"
}

psql_db() { psql "$DB_URL" -X -v ON_ERROR_STOP=1 "$@"; }

sha256_of() { if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }

# pg_dump must be at least as new as the server.
check_pg_dump_version() {
  local server client
  server="$(psql_db -At -c "show server_version_num" | cut -c1-2)"
  client="$(pg_dump --version | sed -E 's/[^0-9]*([0-9]+).*/\1/')"
  [ "$client" -ge "$server" ] || die "pg_dump $client is older than the server (Postgres $server). brew install postgresql@$server and put it first on PATH."
}

# Header helpers: `-- key: value` lines at the top of a migration.
sql_header_all() { sed -nE "s/^[[:space:]]*--[[:space:]]*$2[[:space:]]*:[[:space:]]*(.*)$/\1/p" "$1"; }
sql_header_has() { grep -qiE "^[[:space:]]*--[[:space:]]*$2([[:space:]]*:|[[:space:]]*$)" "$1"; }

# resolve_migration <version> -> UP, DOWN, MIG_NAME (full basename without .sql)
resolve_migration() {
  local version="$1"
  [[ "$version" =~ ^[0-9]{14}$ ]] || die "version must be the 14-digit migration timestamp, got '$version'"
  UP="$(ls "$REPO_ROOT"/supabase/migrations/${version}_*.sql 2>/dev/null | head -1 || true)"
  [ -n "$UP" ] || die "no migration with version $version"
  MIG_NAME="$(basename "$UP" .sql)"
  DOWN="$REPO_ROOT/supabase/rollbacks/${MIG_NAME}.down.sql"
  [ -f "$DOWN" ] || DOWN=""
  VERSION="$version"
}

# apply_guarded <file> <ledger: insert|delete>
# One transaction: row counts before, the file, the ledger change, row counts after.
# If any table lost rows that the file did not declare with `-- expect-row-loss: t1, t2`, it rolls back.
apply_guarded() {
  local file="$1" ledger="$2" allowed driver
  allowed="$(sql_header_all "$file" "expect-row-loss" | tr -d ' ' | paste -sd, - || true)"
  [[ "$allowed" =~ ^[A-Za-z0-9_.,]*$ ]] || die "bad expect-row-loss header in $file"
  driver="$(mktemp)"
  {
    echo '\set ON_ERROR_STOP on'
    echo "\\i $DB_DIR/sql/rowstats.sql"
    echo 'begin;'
    echo 'set local statement_timeout = 0;'
    echo 'create temp table _before as select * from pg_temp.hungry_rowstats(false);'
    echo "\\i $file"
    if [ "$ledger" = insert ]; then
      echo "insert into supabase_migrations.schema_migrations(version, name) values ('$VERSION', '${MIG_NAME#*_}') on conflict do nothing;"
    else
      echo "delete from supabase_migrations.schema_migrations where version = '$VERSION';"
    fi
    echo 'create temp table _after as select * from pg_temp.hungry_rowstats(false);'
    echo "select count(*) > 0 as rows_lost from _before b left join _after a using (tbl) where b.n >= 0 and coalesce(a.n, 0) < b.n and b.tbl <> all (string_to_array('$allowed', ',')) \\gset"
    echo '\if :rows_lost'
    echo "select b.tbl, b.n as rows_before, coalesce(a.n, 0) as rows_after from _before b left join _after a using (tbl) where b.n >= 0 and coalesce(a.n, 0) < b.n and b.tbl <> all (string_to_array('$allowed', ','));"
    echo "do \$\$ begin raise exception 'ROWS_LOST: rolled back, nothing was changed'; end \$\$;"
    echo '\endif'
    echo 'commit;'
  } >"$driver"
  local rc=0
  psql "$DB_URL" -X -q -f "$driver" || rc=$?
  rm -f "$driver"
  return $rc
}

# Whether the migration is already in the target's ledger.
ledger_has() { [ "$(psql_db -At -c "select count(*) from supabase_migrations.schema_migrations where version = '$1'")" != 0 ]; }

# Migrations in the repo older than $1 that the target has not recorded in its ledger.
missing_older_migrations() {
  local version="$1" f v missing="" applied
  applied="$(psql_db -At -c "select version from supabase_migrations.schema_migrations")"
  for f in "$REPO_ROOT"/supabase/migrations/*.sql; do
    v="$(basename "$f")"; v="${v%%_*}"
    [[ "$v" < "$version" ]] || continue
    grep -qx "$v" <<<"$applied" || missing="$missing $v"
  done
  echo "$missing"
}

run_smokes() {
  local file="$1" s any=0
  while IFS= read -r s; do
    [ -n "$s" ] || continue
    [ "$s" = none ] && continue
    any=1
    say "smoke $s"
    psql_db -q -f "$REPO_ROOT/$s" >/dev/null || return 1
  done < <(sql_header_all "$file" "smoke" | awk '{print $1}')
  return 0
}
