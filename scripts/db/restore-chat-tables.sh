#!/usr/bin/env bash
# Restore the four direct-message tables from a backup made by scripts/db/backup-chat-tables.sh,
# AFTER supabase/rollbacks/20261119090000_drop_direct_message_chat.down.sql has recreated them.
#   scripts/db/restore-chat-tables.sh staging|prod <backup dir>
# Why not a plain `pg_restore --data-only --single-transaction`: the chat tables reference user_profiles
# and merchant_accounts. An account deleted after the backup was taken makes one row violate a foreign
# key, and that one row would roll back the whole import, including every unrelated chat. Instead:
#   1. the archive is loaded into a scratch schema (no constraints),
#   2. rows whose user or merchant account no longer exists are removed there, applying the same rules
#      the live foreign keys use (ON DELETE CASCADE removes the row, ON DELETE SET NULL clears the column),
#      and rows left without their conversation or message are removed too,
#   3. the rest is inserted into the real tables with every foreign key enforced,
#   4. post_shares.target_conversation_id values that point at a conversation that is not in the archive
#      are set to NULL (what ON DELETE SET NULL does) and post_shares_target_conversation_id_fkey is
#      validated if the down file had to add it NOT VALID,
#   5. the scratch schema is dropped.
# All of it is ONE transaction: any error leaves the database exactly as it was. Nothing is printed
# from message rows, only counts. Refuses unless the four tables exist and are empty.
# Full procedure: supabase/manual/chat-db-drop-runbook.md.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
[ $# -eq 2 ] || die "usage: restore-chat-tables.sh staging|prod <backup dir>"
load_env "$1"
BACKUP="$2"
check_pg_dump_version
command -v pg_restore >/dev/null || die "pg_restore not found (brew install libpq)"

[ -f "$BACKUP/chat-data.dump" ] && [ -f "$BACKUP/rowcounts.tsv" ] && [ -f "$BACKUP/MANIFEST" ] \
  || die "$BACKUP is not a backup-chat-tables.sh directory (needs chat-data.dump, rowcounts.tsv, MANIFEST)"
(cd "$BACKUP" && while read -r sum file; do
  [ "$(sha256_of "$file")" = "$sum" ] || { echo "ERROR: $file does not match MANIFEST" >&2; exit 1; }
done <MANIFEST) || die "backup files changed since they were written"

TABLES=(conversations conversation_participants messages read_receipts)
for t in "${TABLES[@]}"; do
  [ "$(psql_db -At -c "select to_regclass('public.$t') is not null")" = t ] \
    || die "public.$t does not exist on $ENV_NAME; apply the down file first"
  [ "$(psql_db -At -c "select count(*) from public.$t")" = 0 ] \
    || die "public.$t is not empty; this script only restores into empty tables"
done
[ "$(psql_db -At -c "select to_regclass('chat_restore_scratch.conversations') is null")" = t ] \
  || die "schema chat_restore_scratch already exists; a previous attempt left it behind. Inspect and drop it first."

if [ "$ENV_NAME" = prod ]; then
  CONFIRM="${CONFIRM_RESTORE:-}"
  if [ -z "$CONFIRM" ]; then
    [ -t 0 ] || die "not interactive: set CONFIRM_RESTORE=chat-restore"
    read -r -p "Type chat-restore to restore the chat tables on PRODUCTION ($DB_REF): " CONFIRM
  fi
  [ "$CONFIRM" = "chat-restore" ] || die "confirmation did not match"
fi

WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT

# Build the SQL in separate steps with explicit status checks. A `{ ...; } || die` group would run with
# errexit off, so a failed `pg_restore | sed` could be hidden by the `cat` after it and an empty
# scratch import would still "succeed". psql is not started until every piece is known to be good.
cat >"$WORK/head.sql" <<'SQL'
set statement_timeout = 0;
create schema chat_restore_scratch;
create table chat_restore_scratch.conversations (like public.conversations);
create table chat_restore_scratch.conversation_participants (like public.conversation_participants);
create table chat_restore_scratch.messages (like public.messages);
create table chat_restore_scratch.read_receipts (like public.read_receipts);
SQL
pg_restore --data-only --no-owner -f "$WORK/data.raw.sql" "$BACKUP/chat-data.dump" 2>"$WORK/gen.err" \
  || die "pg_restore could not read the backup dump: $(head -c 300 "$WORK/gen.err")"
# The COPY header of each table is the only line that names the target. Row lines start with a uuid.
sed -E 's/^COPY public\.(conversations|conversation_participants|messages|read_receipts) /COPY chat_restore_scratch.\1 /' \
  "$WORK/data.raw.sql" >"$WORK/data.sql" || die "could not rewrite the dump's COPY headers"
for t in "${TABLES[@]}"; do
  [ "$(grep -c "^COPY chat_restore_scratch\.$t " "$WORK/data.sql")" = 1 ] \
    || die "the backup dump has no data section for $t; refusing to import an incomplete archive"
done
! grep -q '^COPY public\.' "$WORK/data.sql" || die "the backup dump holds data for tables this script does not restore"
cat >"$WORK/tail.sql" <<'SQL'
select pg_catalog.set_config('search_path', 'pg_catalog', false);
set client_min_messages = notice;

-- Reconcile against live users and merchants, mirroring the foreign keys' delete rules.
do $$
declare
  n_conv_user int; n_conv_merchant int;
  n_part int; n_msg int; n_rr int;
begin
  update chat_restore_scratch.conversations c set created_by_user_id = null
   where c.created_by_user_id is not null
     and not exists (select 1 from public.user_profiles u where u.id = c.created_by_user_id);
  get diagnostics n_conv_user = row_count;
  update chat_restore_scratch.conversations c set subject_merchant_account_id = null
   where c.subject_merchant_account_id is not null
     and not exists (select 1 from public.merchant_accounts m where m.id = c.subject_merchant_account_id);
  get diagnostics n_conv_merchant = row_count;

  delete from chat_restore_scratch.conversation_participants p
   where (p.participant_user_id is not null
          and not exists (select 1 from public.user_profiles u where u.id = p.participant_user_id))
      or (p.participant_merchant_account_id is not null
          and not exists (select 1 from public.merchant_accounts m where m.id = p.participant_merchant_account_id))
      or not exists (select 1 from chat_restore_scratch.conversations c where c.id = p.conversation_id);
  get diagnostics n_part = row_count;

  delete from chat_restore_scratch.messages m
   where (m.sender_user_id is not null
          and not exists (select 1 from public.user_profiles u where u.id = m.sender_user_id))
      or (m.sender_merchant_account_id is not null
          and not exists (select 1 from public.merchant_accounts a where a.id = m.sender_merchant_account_id))
      or not exists (select 1 from chat_restore_scratch.conversations c where c.id = m.conversation_id);
  get diagnostics n_msg = row_count;

  delete from chat_restore_scratch.read_receipts r
   where (r.reader_user_id is not null
          and not exists (select 1 from public.user_profiles u where u.id = r.reader_user_id))
      or (r.reader_merchant_account_id is not null
          and not exists (select 1 from public.merchant_accounts a where a.id = r.reader_merchant_account_id))
      or not exists (select 1 from chat_restore_scratch.messages m where m.id = r.message_id and m.conversation_id = r.conversation_id)
      or not exists (select 1 from chat_restore_scratch.conversations c where c.id = r.conversation_id);
  get diagnostics n_rr = row_count;

  raise notice 'reconciled: conversations created_by cleared % / merchant cleared %, participants removed %, messages removed %, read_receipts removed %',
    n_conv_user, n_conv_merchant, n_part, n_msg, n_rr;
end
$$;

insert into public.conversations select * from chat_restore_scratch.conversations;
insert into public.conversation_participants select * from chat_restore_scratch.conversation_participants;
insert into public.messages select * from chat_restore_scratch.messages;
insert into public.read_receipts select * from chat_restore_scratch.read_receipts;

-- post_shares: targets that point at a conversation that is not there become NULL (ON DELETE SET NULL),
-- then the foreign key the down file may have added NOT VALID is validated.
do $$
declare n_share int;
begin
  update public.post_shares ps set target_conversation_id = null
   where ps.target_conversation_id is not null
     and not exists (select 1 from public.conversations c where c.id = ps.target_conversation_id);
  get diagnostics n_share = row_count;
  raise notice 'post_shares: % unmatched target_conversation_id values set to NULL', n_share;
  if exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'post_shares_target_conversation_id_fkey'
      and conrelid = 'public.post_shares'::regclass
      and not convalidated
  ) then
    alter table public.post_shares validate constraint post_shares_target_conversation_id_fkey;
    raise notice 'post_shares_target_conversation_id_fkey validated';
  end if;
end
$$;

drop schema chat_restore_scratch cascade;
SQL
cat "$WORK/head.sql" "$WORK/data.sql" "$WORK/tail.sql" >"$WORK/restore.sql"
rm -f "$WORK/data.raw.sql" "$WORK/data.sql"

say "restoring into $ENV_NAME ($DB_REF) in one transaction"
if ! psql "$DB_URL" -X -q -1 -v ON_ERROR_STOP=1 -f "$WORK/restore.sql" >"$WORK/out" 2>"$WORK/err"; then
  # psql errors can quote a row (CONTEXT, "Failing row"): show only the error headline.
  grep -E '(^|: )ERROR:' "$WORK/err" | cut -c1-240 | head -5 >&2 || true
  die "restore failed and was rolled back; nothing changed on $ENV_NAME"
fi
grep -E 'NOTICE:' "$WORK/err" | sed -E 's/^.*NOTICE: +//' | grep -v '^drop cascades' || true

say "row counts: backup vs now"
for t in "${TABLES[@]}"; do
  was="$(awk -F'\t' -v t="$t" '$1 == t { print $2 }' "$BACKUP/rowcounts.tsv")"
  now="$(psql_db -At -c "select count(*) from public.$t")"
  note=""; [ "$was" = "$now" ] || { note="  (differs: rows of deleted accounts were skipped)"; }
  printf '%s\t%s\t%s%s\n' "$t" "$was" "$now" "$note"
done
say "restored. Accounts deleted since the backup keep no chat rows; re-run anonymization for any account whose deletion ran while the tables were gone."
exit 0
