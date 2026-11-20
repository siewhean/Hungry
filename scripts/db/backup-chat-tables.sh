#!/usr/bin/env bash
# Data-only backup of the four direct-message tables, taken BEFORE
# supabase/migrations/20261119090000_drop_direct_message_chat.sql is applied.
#   scripts/db/backup-chat-tables.sh staging|prod [label]
# Writes $HUNGRY_BACKUP_DIR (default ~/hungry-backups)/<env>-<ref>-chat-tables-<UTC time>[-label]/ with:
#   chat-data.dump   pg_dump -Fc --data-only of conversations, conversation_participants, messages, read_receipts
#   rowcounts.tsv    row count per table, taken in the same exported snapshot the dump uses (pg_dump --snapshot)
#   toc.txt          pg_restore --list (proves the dump is readable)
#   MANIFEST         sha256 of the files above
# It only READS the database. It does not apply or change anything. The dump holds private messages:
# keep it on the encrypted Mac disk, never in a project folder, a PR or staging.
# Full procedure: supabase/manual/chat-db-drop-runbook.md.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
[ $# -ge 1 ] || die "usage: backup-chat-tables.sh staging|prod [label]"
load_env "$1"
LABEL="${2:-}"
check_pg_dump_version

OUT="$BACKUP_ROOT/${ENV_NAME}-${DB_REF}-chat-tables-$(date -u +%Y%m%dT%H%M%SZ)${LABEL:+-$LABEL}"
mkdir -p "$OUT"
chmod 700 "$OUT"

TABLES=(conversations conversation_participants messages read_receipts)
for t in "${TABLES[@]}"; do
  [ "$(psql_db -At -c "select to_regclass('public.$t') is not null")" = t ] \
    || die "public.$t does not exist on $ENV_NAME; the drop migration may already be applied"
done

# One consistent snapshot: a held-open session exports its transaction snapshot, counts the rows in
# that transaction, and stays open until pg_dump (--snapshot) has finished. Count and dump therefore
# see exactly the same rows even while old app versions are still writing. Read-only throughout.
WORK="$(mktemp -d)"
PSQL_PID=""
cleanup() {
  exec 3>&- || true
  [ -z "$PSQL_PID" ] || kill "$PSQL_PID" 2>/dev/null || true
  rm -rf "$WORK"
}
trap cleanup EXIT
mkfifo "$WORK/in"
psql "$DB_URL" -X -q -At -F $'\t' -v ON_ERROR_STOP=1 <"$WORK/in" >"$WORK/out" 2>"$WORK/err" &
PSQL_PID=$!
exec 3>"$WORK/in"

say "opening a snapshot and counting rows ($ENV_NAME, $DB_REF)"
{
  echo "begin isolation level repeatable read read only;"
  echo "select 'SNAPSHOT', pg_export_snapshot();"
  for t in "${TABLES[@]}"; do echo "select '$t', count(*) from public.$t;"; done
  echo "select 'DONE', 'ok';"
} >&3
for _ in $(seq 1 600); do
  grep -q '^DONE' "$WORK/out" 2>/dev/null && break
  kill -0 "$PSQL_PID" 2>/dev/null || die "snapshot session ended early: $(head -c 300 "$WORK/err")"
  sleep 0.1
done
grep -q '^DONE' "$WORK/out" || die "timed out opening the snapshot session"
SNAPSHOT="$(awk -F'\t' '$1 == "SNAPSHOT" { print $2 }' "$WORK/out")"
[ -n "$SNAPSHOT" ] || die "no snapshot id returned"
awk -F'\t' '$1 != "SNAPSHOT" && $1 != "DONE"' "$WORK/out" >"$OUT/rowcounts.tsv"
[ "$(wc -l <"$OUT/rowcounts.tsv" | tr -d ' ')" = "${#TABLES[@]}" ] || die "row counts incomplete"

say "dumping data (snapshot $SNAPSHOT)"
pg_dump "$DB_URL" --data-only --no-owner -Fc --snapshot="$SNAPSHOT" \
  -t public.conversations -t public.conversation_participants -t public.messages -t public.read_receipts \
  -f "$OUT/chat-data.dump"
echo "rollback;" >&3
exec 3>&-
wait "$PSQL_PID" 2>/dev/null || true
PSQL_PID=""
pg_restore --list "$OUT/chat-data.dump" >"$OUT/toc.txt"
[ -s "$OUT/toc.txt" ] || die "backup is empty or unreadable: $OUT"

# The counts and the dump are one snapshot. Rows written after it are not in the backup; say so.
for t in "${TABLES[@]}"; do
  now="$(psql_db -At -c "select count(*) from public.$t")"
  was="$(awk -F'\t' -v t="$t" '$1 == t { print $2 }' "$OUT/rowcounts.tsv")"
  [ "$now" = "$was" ] || say "NOTE: $t has $now rows now, $was in the backup snapshot; take a fresh backup right before the migration"
done

(cd "$OUT" && for f in chat-data.dump rowcounts.tsv toc.txt; do echo "$(sha256_of "$f")  $f"; done >MANIFEST)
say "backup ok: $(du -sh "$OUT/chat-data.dump" | cut -f1)"
cat "$OUT/rowcounts.tsv"
echo "$OUT"
