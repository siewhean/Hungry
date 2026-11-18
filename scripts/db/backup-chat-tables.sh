#!/usr/bin/env bash
# Data-only backup of the four direct-message tables, taken BEFORE
# supabase/migrations/20261119090000_drop_direct_message_chat.sql is applied.
#   scripts/db/backup-chat-tables.sh staging|prod [label]
# Writes $HUNGRY_BACKUP_DIR (default ~/hungry-backups)/<env>-<ref>-chat-tables-<UTC time>[-label]/ with:
#   chat-data.dump   pg_dump -Fc --data-only of conversations, conversation_participants, messages, read_receipts
#   rowcounts.tsv    row count per table, taken in the same transaction snapshot as the dump
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

say "counting rows ($ENV_NAME, $DB_REF)"
{
  for t in "${TABLES[@]}"; do
    printf '%s\t%s\n' "$t" "$(psql_db -At -c "select count(*) from public.$t")"
  done
} >"$OUT/rowcounts.tsv"

say "dumping data"
pg_dump "$DB_URL" --data-only --no-owner -Fc \
  -t public.conversations -t public.conversation_participants -t public.messages -t public.read_receipts \
  -f "$OUT/chat-data.dump"
pg_restore --list "$OUT/chat-data.dump" >"$OUT/toc.txt"
[ -s "$OUT/toc.txt" ] || die "backup is empty or unreadable: $OUT"

# Counts must not have moved while the dump ran (writers are the old app versions).
for t in "${TABLES[@]}"; do
  now="$(psql_db -At -c "select count(*) from public.$t")"
  was="$(awk -F'\t' -v t="$t" '$1 == t { print $2 }' "$OUT/rowcounts.tsv")"
  [ "$now" = "$was" ] || say "NOTE: $t went from $was to $now rows during the dump; take a fresh backup right before the migration"
done

(cd "$OUT" && for f in chat-data.dump rowcounts.tsv toc.txt; do echo "$(sha256_of "$f")  $f"; done >MANIFEST)
say "backup ok: $(du -sh "$OUT/chat-data.dump" | cut -f1)"
cat "$OUT/rowcounts.tsv"
echo "$OUT"
