#!/usr/bin/env bash
# Rehearse one migration on STAGING and write the evidence CI and ship.sh check.
#   scripts/db/rehearse.sh <14-digit migration version>
# Steps: backup staging -> fingerprint -> up (row-loss guarded) -> down -> compare schema and
# every row to the fingerprint -> up again -> smokes -> write supabase/rehearsals/<version>.json.
# Commit that JSON with the migration. Any later edit to the migration or down file makes it stale.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
[ $# -eq 1 ] || die "usage: rehearse.sh <migration version>"
load_env staging
resolve_migration "$1"
check_pg_dump_version

NO_DOWN=0
if [ -z "$DOWN" ]; then
  sql_header_has "$UP" "no-down" || die "no down migration at supabase/rollbacks/${MIG_NAME}.down.sql"
  NO_DOWN=1
fi
sql_header_all "$UP" smoke | grep -q . || die "$MIG_NAME has no '-- smoke: supabase/smoke/<file>.sql' header (use '-- smoke: none <reason>' if a smoke is truly not possible)"

MISSING="$(missing_older_migrations "$VERSION")"
[ -z "$MISSING" ] || die "staging is behind. Missing older migrations:$MISSING. Run scripts/db/staging-bootstrap.sh or apply them first."
if ledger_has "$VERSION"; then die "$VERSION is already applied on staging. Run scripts/db/rollback.sh staging $VERSION first."; fi

WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
dump_schema() { # dump_schema <url> <password> <out>
  PGPASSWORD="$2" pg_dump "$1" --schema-only --no-owner -n public $(PGPASSWORD="$2" psql "$1" -X -At -c "select '-n app_private' where exists (select 1 from pg_namespace where nspname = 'app_private')") | grep -Ev '^\\(un)?restrict ' >"$3"
}
stats() { psql_db -X -At -F $'\t' -f "$DB_DIR/sql/rowstats.sql" -c "select tbl, n, h from pg_temp.hungry_rowstats(true) order by 1" >"$1"; }

# Staging must look exactly like production before the migration, or the rehearsal proves nothing.
PROD_MATCHED=false
if [ -n "${PROD_DB_URL:-}" ]; then
  say "0/6 comparing staging's schema with production's (read-only)"
  dump_schema "$DB_URL" "${PGPASSWORD:-}" "$WORK/schema.staging"
  dump_schema "$PROD_DB_URL" "${PROD_PGPASSWORD:-}" "$WORK/schema.prod"
  if ! diff -u "$WORK/schema.prod" "$WORK/schema.staging" >"$WORK/schema.prodstaging.diff"; then
    head -60 "$WORK/schema.prodstaging.diff"
    die "staging's schema differs from production's (diff above, truncated). Bring staging level with prod first; recreating the staging project and running staging-bootstrap.sh is the quickest fix."
  fi
  PROD_MATCHED=true
elif [ -z "${SKIP_PROD_COMPARE:-}" ]; then
  die "set PROD_DB_URL/PROD_PGPASSWORD (read-only use) so staging can be compared with prod, or SKIP_PROD_COMPARE=1 (the evidence will say it was skipped)"
fi

say "1/6 backing up staging"
BACKUP_DIR="$("$DB_DIR/backup.sh" staging "pre-$VERSION" | tail -1)"
dump_schema "$DB_URL" "${PGPASSWORD:-}" "$WORK/schema.before"; stats "$WORK/stats.before"

say "2/6 applying up ($MIG_NAME)"
apply_guarded "$UP" insert || die "up migration failed; nothing changed (single transaction). Fix it and re-run."

if [ "$NO_DOWN" = 0 ]; then
  say "3/6 applying down"
  apply_guarded "$DOWN" delete || die "down migration failed. Staging is at the 'up' state; restore from $BACKUP_DIR if needed."
  dump_schema "$DB_URL" "${PGPASSWORD:-}" "$WORK/schema.after"; stats "$WORK/stats.after"
  say "4/6 comparing against the pre-migration fingerprint"
  if ! diff -u "$WORK/schema.before" "$WORK/schema.after" >"$WORK/schema.diff"; then
    cat "$WORK/schema.diff"; die "schema after down differs from before up. The down migration does not fully reverse the up migration. Staging is now dirty (backup: $BACKUP_DIR). Recreate the staging project and run staging-bootstrap.sh before re-running."
  fi
  if ! diff -u "$WORK/stats.before" "$WORK/stats.after" >"$WORK/stats.diff"; then
    cat "$WORK/stats.diff"; die "row contents after down differ from before up. Data was changed or lost. Staging is now dirty (backup: $BACKUP_DIR). Recreate the staging project and run staging-bootstrap.sh before re-running."
  fi
  say "5/6 re-applying up"
  apply_guarded "$UP" insert || die "re-applying up failed after down. Migration is not safely repeatable."
else
  say "3-5/6 skipped (no-down waiver)"
fi

say "6/6 smokes"
run_smokes "$UP" || die "a smoke failed on staging (backup: $BACKUP_DIR)."
SMOKES="$(sql_header_all "$UP" smoke | awk '{print "\"" $1 "\""}' | paste -sd, -)"

OUT="$REPO_ROOT/supabase/rehearsals/${VERSION}.json"
UPSHA="$(sha256_of "$UP")"
DOWNSHA=""; [ "$NO_DOWN" = 1 ] || DOWNSHA="$(sha256_of "$DOWN")"
GIT_SHA="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo unknown)"
BOOL=true; [ "$NO_DOWN" = 0 ] || BOOL=false
cat >"$OUT" <<JSON
{
  "version": "$VERSION",
  "name": "$MIG_NAME",
  "result": "pass",
  "rehearsed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "staging_ref": "$DB_REF",
  "prod_schema_matched": $PROD_MATCHED,
  "git_sha": "$GIT_SHA",
  "up_sha256": "$UPSHA",
  "down_sha256": "$DOWNSHA",
  "steps": { "backup": true, "up": true, "down": $BOOL, "schema_roundtrip": $BOOL, "data_roundtrip": $BOOL, "reapply": $BOOL },
  "rows_lost": [],
  "smokes": [${SMOKES}]
}
JSON
say "PASS. Evidence written to supabase/rehearsals/${VERSION}.json (commit it with the migration)."
echo "Staging backup: $BACKUP_DIR"
