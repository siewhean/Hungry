#!/usr/bin/env bash
# One-time move of production to a NEW, empty Supabase project (for example Seoul -> Singapore).
# The old project is only read, never written, so it stays a working fallback.
#
#   scripts/db/move-project.sh bootstrap   apply every migration to the new project (empty project only)
#   scripts/db/move-project.sh data        copy rows: public, app_private, auth.users, auth.identities
#   scripts/db/move-project.sh storage     copy every storage file (needs both service_role keys)
#   scripts/db/move-project.sh verify-storage   compare storage object counts per bucket, old vs new
#   scripts/db/move-project.sh secrets     create the account-deletion Vault secrets on the new project
#   scripts/db/move-project.sh verify      compare row counts and hashes, old vs new
#
# Environment (never committed; URLs carry no password):
#   SRC_DB_URL SRC_PGPASSWORD      the old project (pooler URL)
#   DST_DB_URL DST_PGPASSWORD      the new project (pooler URL)
#   SRC_API_URL SRC_SERVICE_KEY    https://<old ref>.supabase.co and its legacy service_role key  (storage)
#   DST_API_URL DST_SERVICE_KEY    https://<new ref>.supabase.co and its legacy service_role key  (storage, secrets)
# Not copied: auth sessions (everyone signs in again), Edge Function secrets, Auth dashboard settings,
# the Send Email hook and Vault secret values. See supabase/manual/safe-migration-runbook.md (Moving region).
set -euo pipefail
DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DB_DIR/common.sh"

for v in SRC_DB_URL DST_DB_URL; do [ -n "${!v:-}" ] || die "$v is not set"; done
SRC_REF="$(ref_of "$SRC_DB_URL")"
DST_REF="$(ref_of "$DST_DB_URL")"
[ "$SRC_REF" != "$DST_REF" ] || die "SRC and DST are the same project ($SRC_REF)"
command -v psql >/dev/null && command -v pg_dump >/dev/null || die "psql/pg_dump not found (brew install libpq)"

src() { PGPASSWORD="${SRC_PGPASSWORD:-}" psql "$SRC_DB_URL" -X -v ON_ERROR_STOP=1 "$@"; }
dst() { PGPASSWORD="${DST_PGPASSWORD:-}" psql "$DST_DB_URL" -X -v ON_ERROR_STOP=1 "$@"; }

cmd_bootstrap() {
  dst -q -c "create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);" >/dev/null
  local n; n="$(dst -At -c "select count(*) from supabase_migrations.schema_migrations")"
  [ "$n" = 0 ] || die "$DST_REF already has $n migrations recorded. Bootstrap is for an empty project."
  local f base
  for f in "$REPO_ROOT"/supabase/migrations/*.sql; do
    base="$(basename "$f" .sql)"
    say "$base"
    dst -q -f "$f" >/dev/null
    dst -q -c "insert into supabase_migrations.schema_migrations(version, name) values ('${base%%_*}', '${base#*_}') on conflict do nothing" >/dev/null
  done
  say "$DST_REF is at the repo's latest migration. No seed data was loaded."
}

# Rows that mention the old project's URL (storage links) must point at the new project.
SRC_HOST_REF="${SRC_REF}"
cmd_data() {
  local out; out="$(mktemp)"
  local migrated; migrated="$(dst -At -c "select count(*) from supabase_migrations.schema_migrations")"
  local have; have="$(ls "$REPO_ROOT"/supabase/migrations/*.sql | wc -l | tr -d ' ')"
  [ "$migrated" = "$have" ] || die "new project has $migrated of $have migrations. Run bootstrap first."
  say "dumping rows from $SRC_REF"
  {
    # psql -1 wraps the file in one transaction. Triggers and FK checks off for it, so rows land exactly as they were.
    echo "set local session_replication_role = replica;"
    dst -At -c "select 'truncate table ' || string_agg(format('%I.%I', schemaname, tablename), ', ') || ' restart identity cascade;' from pg_tables t where schemaname in ('public','app_private') and not exists (select 1 from pg_depend d where d.objid = (quote_ident(t.schemaname) || '.' || quote_ident(t.tablename))::regclass and d.deptype = 'e')"
    echo "truncate table auth.users, auth.identities cascade;"
    PGPASSWORD="${SRC_PGPASSWORD:-}" pg_dump "$SRC_DB_URL" --data-only --no-owner --no-privileges --quote-all-identifiers -n public -n app_private -T public.spatial_ref_sys
    PGPASSWORD="${SRC_PGPASSWORD:-}" pg_dump "$SRC_DB_URL" --data-only --no-owner --no-privileges --quote-all-identifiers -t auth.users -t auth.identities
    if [ -n "${SRC_API_URL:-}" ] && [ -n "${DST_API_URL:-}" ]; then
      echo "update public.venues set logo_url = replace(logo_url, '${SRC_API_URL%/}', '${DST_API_URL%/}') where logo_url like '${SRC_API_URL%/}%';"
    fi
  } >"$out"
  [ -s "$out" ] || die "empty dump"
  say "restoring into $DST_REF ($(du -h "$out" | cut -f1)), one transaction"
  dst -q -1 -f "$out" >/dev/null
  rm -f "$out"
  say "rows copied. Next: verify"
}

cmd_storage() {
  for v in SRC_API_URL SRC_SERVICE_KEY DST_API_URL DST_SERVICE_KEY; do [ -n "${!v:-}" ] || die "$v is not set"; done
  command -v python3 >/dev/null || die "python3 not found"
  local list; list="$(mktemp)"
  src -At -c "select coalesce(json_agg(json_build_object('bucket', bucket_id, 'name', name, 'type', metadata->>'mimetype', 'cache', metadata->>'cacheControl') order by bucket_id, name), '[]'::json) from storage.objects" >"$list"
  python3 -I "$DB_DIR/storage-copy.py" "$list"
  rm -f "$list"
  verify_storage
}

verify_storage() {
  local a b
  a="$(src -At -c "select bucket_id || ' ' || count(*) from storage.objects group by bucket_id order by bucket_id")"
  b="$(dst -At -c "select bucket_id || ' ' || count(*) from storage.objects group by bucket_id order by bucket_id")"
  if [ "$a" = "$b" ]; then say "storage object counts match per bucket ($(echo "$a" | wc -l | tr -d ' ') buckets)"
  else echo "OLD:"; echo "$a"; echo "NEW:"; echo "$b"; die "storage counts differ"; fi
}

cmd_secrets() {
  [ -n "${DST_API_URL:-}" ] || die "DST_API_URL is not set"
  local token; token="$(openssl rand -hex 32)"
  dst -q -c "select vault.create_secret('${DST_API_URL%/}/functions/v1/process-account-deletions', 'account_deletion_worker_url'); select vault.create_secret('$token', 'account_deletion_worker_token');" >/dev/null
  say "Vault secrets created on $DST_REF. Set this as the Edge Function secret (shown once):"
  echo "ACCOUNT_DELETION_WORKER_TOKEN=$token"
}

cmd_verify() {
  local a b
  a="$(mktemp)"; b="$(mktemp)"
  src -At -F $'\t' -f "$DB_DIR/sql/rowstats.sql" -c "select tbl, n, h from pg_temp.hungry_rowstats(true) order by 1" >"$a"
  dst -At -F $'\t' -f "$DB_DIR/sql/rowstats.sql" -c "select tbl, n, h from pg_temp.hungry_rowstats(true) order by 1" >"$b"
  # Only what was copied. venues differs in hash by design (logo URLs were rewritten); its count must match.
  local keep='^(public|app_private)\.|^auth\.(users|identities)	'
  # spatial_ref_sys belongs to PostGIS: each project fills it itself.
  grep -E "$keep" "$a" | grep -v '^public\.spatial_ref_sys	' >"$a.k"; grep -E "$keep" "$b" | grep -v '^public\.spatial_ref_sys	' >"$b.k"
  if diff -q <(grep -v '^public\.venues	' "$a.k") <(grep -v '^public\.venues	' "$b.k") >/dev/null; then
    local va vb; va="$(grep '^public\.venues	' "$a.k" | cut -f2)"; vb="$(grep '^public\.venues	' "$b.k" | cut -f2)"
    [ "$va" = "$vb" ] || die "public.venues row count differs: old $va, new $vb"
    say "verified: $(wc -l <"$a.k" | tr -d ' ') tables match (row counts and hashes); venues count matches ($va)"
  else
    diff <(cut -f1,2,3 "$a.k") <(cut -f1,2,3 "$b.k") | head -40 || true
    die "tables differ (above)"
  fi
  rm -f "$a" "$b" "$a.k" "$b.k"
}

case "${1:-}" in
  bootstrap) cmd_bootstrap ;;
  data) cmd_data ;;
  storage) cmd_storage ;;
  secrets) cmd_secrets ;;
  verify-storage) verify_storage ;;
  verify) cmd_verify ;;
  *) die "usage: move-project.sh bootstrap|data|storage|verify-storage|secrets|verify" ;;
esac
