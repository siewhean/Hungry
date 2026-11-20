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
| `scripts/db/backup-chat-tables.sh`, `scripts/db/restore-chat-tables.sh`, this page | needed for the procedure below |

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
   and only reads the database. The row counts and the dump come from one exported snapshot
   (`pg_export_snapshot` held open while `pg_dump --snapshot` runs), so they always agree even while
   old app versions are still writing; rows written after the snapshot are not in the backup, and the
   script prints a NOTE when the live count has moved on. Also take the normal full backup (`scripts/db/backup.sh prod`).
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

   Known: the down file leaves five `GRANT ... TO authenticated` lines out on purpose (see "Undoing";
   the restore script adds them back). `rehearse.sh` compares a schema dump from before the up migration
   with one after the down file, so until it is taught about that restore step it reports exactly those
   five grant lines as a schema difference and does not write the evidence.

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
  the rate rules, and puts the chat statements back into the export and account deletion. If any
  `post_shares.target_conversation_id` value survived (the up migration keeps the column's values),
  `post_shares_target_conversation_id_fkey` is added `NOT VALID` instead of failing the rollback;
  without such values it is added validated, exactly as before.
  **The chat RPCs come back closed:** `open_chat_conversation`, `send_chat_message` (public wrapper and
  `app_private` body) and `mark_conversation_read` are executable by `service_role` only, not by
  `authenticated`. While the tables are empty, any signed-in user who could call them would create a
  conversation and make the restore script refuse (it only imports into empty tables). The restore
  script gives `authenticated` its grants back, inside its transaction. If you roll back and do NOT
  restore rows (chat should simply work again, on empty tables), run these once by hand:

  ```sql
  grant execute on function public.open_chat_conversation(uuid, uuid, text) to authenticated;
  grant execute on function app_private.open_chat_conversation(uuid, uuid, text) to authenticated;
  grant execute on function public.send_chat_message(uuid, text, text, uuid) to authenticated;
  grant execute on function app_private.send_chat_message(uuid, text, text, uuid) to authenticated;
  grant execute on function public.mark_conversation_read(uuid) to authenticated;
  ```
- **Rows**: the down file cannot bring rows back. Restore them from the step-2 backup with:

  ```bash
  scripts/db/restore-chat-tables.sh prod <backup dir>     # staging|prod; prod asks you to type chat-restore
  ```

  Do not use a plain `pg_restore --data-only --single-transaction`. The chat tables reference
  `user_profiles` and `merchant_accounts`, so one account deleted after the backup makes a row violate
  a foreign key and rolls the whole import back, including every unrelated chat. The script, in ONE
  transaction (any error leaves the database as it was):
  1. checks the backup against its `MANIFEST` and refuses unless the four tables and the five chat RPCs
     exist; then, inside the transaction, locks the four tables (`ACCESS EXCLUSIVE`, 15 s
     `lock_timeout`) and refuses unless they are all empty, so the check and the import are atomic;
  2. loads the archive into a scratch schema without constraints;
  3. removes archive rows whose user or merchant no longer exists, with the live foreign keys' rules
     (`ON DELETE CASCADE` removes the row; `ON DELETE SET NULL` clears `created_by_user_id` /
     `subject_merchant_account_id`), then rows left without their conversation or message;
  4. inserts the rest into the real tables with every foreign key enforced;
  5. sets `post_shares.target_conversation_id` to NULL where the conversation is not there (what
     `ON DELETE SET NULL` does) and runs `VALIDATE CONSTRAINT` on `post_shares_target_conversation_id_fkey`
     when the down file had added it `NOT VALID`;
  6. grants execute on the five chat RPCs back to `authenticated` (the grants they had before the drop),
     so they only become callable once every row is in place;
  7. drops the scratch schema, then prints the backup row counts next to the live counts. A lower live
     count is expected exactly when accounts were deleted after the backup.

  By hand, if you ever must: the post-restore step for the share foreign key is
  `update public.post_shares set target_conversation_id = null where target_conversation_id is not null and not exists (select 1 from public.conversations c where c.id = target_conversation_id);`
  followed by `alter table public.post_shares validate constraint post_shares_target_conversation_id_fkey;`.
- Messages written after the backup and before the drop are not in the dump.
- Account deletions that ran after the drop did not anonymise the chat rows (the deletion function no
  longer touched them). A restored row of an account whose profile still exists is restored as it was
  backed up. Re-run the anonymisation for any such account, or delete its restored rows, before the
  app reads them again.

## Why not a forward drop of the other chat leftovers

`post_shares.target_conversation_id` and the `'message'` report type are left alone: removing them
changes tables and constraints that live code still uses. Drop them in a later migration if the app
stops sending them.
