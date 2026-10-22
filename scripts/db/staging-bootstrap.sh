#!/usr/bin/env bash
# One-time: build an empty staging project up to the current repo state.
#   scripts/db/staging-bootstrap.sh
# Applies every migration in order, records the ledger, then loads supabase/seed.sql
# (set SKIP_SEED=1 to skip). Refuses to run on a database that already has migrations.
# No production user data is copied: staging holds seed and synthetic rows only.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
load_env staging

# A fresh Supabase project has no migration ledger yet; create it the way the CLI does.
psql_db -q -c "create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);" >/dev/null
n="$(psql_db -At -c "select count(*) from supabase_migrations.schema_migrations")"
[ "$n" = 0 ] || die "staging already has $n migrations recorded. Bootstrap is for an empty project."

for f in "$REPO_ROOT"/supabase/migrations/*.sql; do
  base="$(basename "$f" .sql)"
  say "$base"
  psql_db -q -f "$f" >/dev/null
  psql_db -q -c "insert into supabase_migrations.schema_migrations(version, name) values ('${base%%_*}', '${base#*_}') on conflict do nothing" >/dev/null
done
if [ -z "${SKIP_SEED:-}" ]; then
  say "seed.sql"
  psql_db -q -f "$REPO_ROOT/supabase/seed.sql" >/dev/null
fi
say "staging is at the repo's latest migration."
echo "Next: deploy Edge Functions and secrets to staging if you need them (supabase/manual/new-project-bootstrap.md)."
