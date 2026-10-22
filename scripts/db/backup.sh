#!/usr/bin/env bash
# Back up a project's data before touching it.
#   scripts/db/backup.sh staging|prod [label]
# Writes $HUNGRY_BACKUP_DIR (default ~/hungry-backups)/<env>-<ref>-<UTC time>[-label]/ with:
#   data.dump    pg_dump custom format: public, app_private, auth, storage, supabase_migrations
#   schema.sql   schema-only dump of public + app_private (grants included, owners left out)
#   rowstats.tsv table, row count, row hash for every table
#   toc.txt      pg_restore --list of data.dump (proves the dump is readable)
#   MANIFEST     sha256 of the files above
# Prints the directory on the last line. Not covered: storage file bytes, Edge Function secrets,
# Auth dashboard settings, Vault secret values. See supabase/manual/safe-migration-runbook.md.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
[ $# -ge 1 ] || die "usage: backup.sh staging|prod [label]"
load_env "$1"
LABEL="${2:-}"
check_pg_dump_version

OUT="$BACKUP_ROOT/${ENV_NAME}-${DB_REF}-$(date -u +%Y%m%dT%H%M%SZ)${LABEL:+-$LABEL}"
mkdir -p "$OUT"
chmod 700 "$OUT"

SCHEMA_ARGS=()
for s in public app_private auth storage supabase_migrations; do
  if [ "$(psql_db -At -c "select count(*) from pg_namespace where nspname = '$s'")" != 0 ]; then SCHEMA_ARGS+=(-n "$s"); fi
done

say "dumping data ($ENV_NAME, $DB_REF)"
pg_dump "$DB_URL" -Fc --no-owner -f "$OUT/data.dump" "${SCHEMA_ARGS[@]}"
pg_dump "$DB_URL" --schema-only --no-owner -f "$OUT/schema.sql" -n public $(psql_db -At -c "select '-n app_private' where exists (select 1 from pg_namespace where nspname = 'app_private')")
psql_db -X -At -F $'\t' -f "$DB_DIR/sql/rowstats.sql" -c "select tbl, n, h from pg_temp.hungry_rowstats(true) order by 1" >"$OUT/rowstats.tsv"
pg_restore --list "$OUT/data.dump" >"$OUT/toc.txt"
[ -s "$OUT/toc.txt" ] || die "backup is empty or unreadable: $OUT"
(cd "$OUT" && for f in data.dump schema.sql rowstats.tsv toc.txt; do echo "$(sha256_of "$f")  $f"; done >MANIFEST)

say "backup ok: $(du -sh "$OUT/data.dump" | cut -f1) data, $(wc -l <"$OUT/rowstats.tsv" | tr -d ' ') tables"
echo "$OUT"
