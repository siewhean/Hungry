# Dropping the direct-message database objects

Migration: `supabase/migrations/20261119090000_drop_direct_message_chat.sql`
Down: `supabase/rollbacks/20261119090000_drop_direct_message_chat.down.sql`
Smoke: `supabase/smoke/drop_direct_message_chat.sql`
General process: `supabase/manual/safe-migration-runbook.md` (this page adds the chat-specific steps).

Direct messages were removed from the app on 2026-11-18. The database still holds the tables and the
RPCs, because installed older versions of the app call them. **Nothing in this change may be applied
to any database until every step in "Order" below is done.** Dropping the tables deletes private
messages for good; the down migration restores the schema only.

## What the migration removes and keeps

| Removed | Why it is safe |
| --- | --- |
| tables `read_receipts`, `messages`, `conversation_participants`, `conversations` (indexes, RLS policies, `trg_enforce_*_update_guard` triggers, realtime publication entries) | only the removed chat client and the functions below use them |
| functions `open_chat_conversation`, `send_chat_message`, `can_access_conversation` (public wrapper and `app_private` body), `public.mark_conversation_read`, `enforce_conversation_participant_update_guard`, `enforce_message_update_guard`, `enforce_read_receipt_update_guard` | no other function calls them; the migration checks every function body for leftovers and rolls back if one is found |
| `'conversations'` and `'messagesSent'` keys of `app_private.export_my_data()` | the data they exported is gone; the other keys are untouched |
| chat statements in `public.anonymize_account_deletion_request` | the tables no longer exist; the `chat_messages` statement stays |
| `app_private.request_rate_rules` rows `rpc/send_chat_message`, `rpc/open_chat_conversation`, `read_receipts` | the endpoints no longer exist |
| the foreign key `post_shares_target_conversation_id_fkey` | `conversations` goes; the column stays |

| Kept on purpose | Why |
| --- | --- |
| `post_shares.target_conversation_id` (plain uuid column) | `post_shares` is live and the app still sends the column (always null now) |
| `app_user_block_exists`, `app_can_make_user_request_window`, `is_merchant_member` | used by blocks, other rate limits and the merchant portal |
| `public.chat_messages` (0008 scaffold) and its account-deletion statement | separate legacy table, not part of this drop |
| `'message'` as a `content_reports` target type | a report-type value, not a table |
| `scripts/db/backup-chat-tables.sh`, this page | needed for the procedure below |

## Order

1. **Ship the app without direct messages** (PR "Remove legacy screens, the archived Feed tab,
   stall-follow UI and direct messages") through the stores, and wait until old versions have gone
   quiet. On prod, check that nothing writes chat any more:

   ```sql
   select count(*) as messages_last_7_days from public.messages where created_at > now() - interval '7 days';
   select count(*) as receipts_last_7_days from public.read_receipts where read_at > now() - interval '7 days';
   select count(*) as conversations_touched_last_7_days from public.conversations where updated_at > now() - interval '7 days';
   ```

   All three should be 0 (or tiny and explained) before going on. If old clients still send, wait.
2. **Back up the four tables** (data only) and record the row counts:

   ```bash
   scripts/db/backup-chat-tables.sh prod before-chat-drop
   ```

   It writes `chat-data.dump`, `rowcounts.tsv`, `toc.txt` and `MANIFEST` under `~/hungry-backups/`
   and only reads the database. Also take the normal full backup (`scripts/db/backup.sh prod`).
   The dump holds private messages: keep it on the encrypted Mac disk, never upload it.
   Write the row counts in the PR.
3. **Rehearse on staging**: `scripts/db/rehearse.sh 20261119090000` (applies up, applies down,
   compares schema and data, re-applies up, runs the smokes) and commit
   `supabase/rehearsals/20261119090000.json`. CI refuses the migration without it. The four staging
   chat tables must be EMPTY for the rehearsal. Do not insert chat rows by hand: the down file only
   recreates the tables, never their rows, so any staging row makes the row-content comparison after
   the down step fail and the script aborts (check with `select count(*) from public.messages`, and
   likewise `conversations`, `conversation_participants`, `read_receipts`). Row restore is covered by
   the backup and `pg_restore` path under "Undoing", which was tested separately on a scratch
   Postgres. Staging will show whether the down migration reproduces production's schema exactly
   (`prod_schema_matched`); a mismatch means fix the down file, not the check.

   If the script stops with "production has migration X that this checkout lacks" and X is not on
   `origin/main`, merging main cannot help: X was applied to prod from a branch that never landed on
   main. Get X's file into `supabase/migrations/` of the checkout you rehearse from (untracked, not
   committed to this PR) and re-run. A file that contains its own `begin;`/`commit;` must have those
   two lines removed first, because the runner already wraps each file in one transaction.
4. **Prod, only with the owner's explicit approval**: after the PR is merged,
   `scripts/db/ship.sh 20261119090000`. It declares the four tables (and `request_rate_rules`) in
   `-- expect-row-loss:`, so the row-loss guard lets those drops through; nothing else may lose rows.
5. Run `supabase/smoke/drop_direct_message_chat.sql` against prod (read-only; no output means pass).

## Undoing

- **Schema only**: `scripts/db/rollback.sh prod 20261119090000` runs the down file. It recreates the
  four tables with their indexes, policies, triggers, grants and realtime entries, the functions,
  the rate rules, and puts the chat statements back into the export and account deletion.
- **Rows**: the down file cannot bring rows back. Restore them from the step-2 backup, data only,
  after the down file has run (tested on a scratch Postgres: counts and content matched):

  ```bash
  pg_restore --data-only --no-owner --single-transaction -d "$DB_URL" <backup dir>/chat-data.dump
  ```

  Compare `select count(*)` per table with `rowcounts.tsv`.
- Messages written after the backup and before the drop are not in the dump.
- Account deletions that ran after the drop will not have anonymised the restored message rows
  (the deletion function no longer touched them). Re-run the anonymisation for those accounts, or
  delete their restored rows, before the app reads them again.

## Why not a forward drop of the other chat leftovers

`post_shares.target_conversation_id` and the `'message'` report type are left alone: removing them
changes tables and constraints that live code still uses. Drop them in a later migration if the app
stops sending them.
