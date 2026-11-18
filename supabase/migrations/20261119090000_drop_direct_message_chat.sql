-- smoke: supabase/smoke/drop_direct_message_chat.sql
-- Direct messages were removed from the app (owner decision, 2026-11-18). Nothing in the app, the
-- Edge Functions or the scripts reads or writes the chat tables any more, so this drops them.
--
-- DO NOT APPLY before the app release without direct messages has been adopted: an older installed
-- app still calls open_chat_conversation, send_chat_message and mark_conversation_read and reads
-- these tables. Order: ship the app release, back up (supabase/manual/chat-db-drop-runbook.md),
-- rehearse on staging, then prod with the owner's explicit approval.
--
-- Dropped, in dependency order:
--   * app_private.export_my_data (the PDPA export) loses its 'conversations' and 'messagesSent'
--     keys, and public.anonymize_account_deletion_request loses its chat clean-up statements.
--     Both are patched in place (pg_temp.patch_function, as in 20261111130000) so every other line
--     stays exactly as it is; the patch aborts the whole migration if the text is not found once.
--   * tables read_receipts, messages, conversation_participants, conversations with their indexes,
--     RLS policies, the three trg_enforce_*_update_guard triggers and the realtime publication entries.
--     No CASCADE: Postgres refuses the drop (and the migration rolls back) if anything else, such as
--     a view or another function's column default, still depends on them.
--   * functions public/app_private open_chat_conversation, send_chat_message, can_access_conversation,
--     public.mark_conversation_read and the three enforce_*_update_guard trigger functions.
--   * the three app_private.request_rate_rules rows for the chat endpoints.
-- Kept on purpose:
--   * post_shares.target_conversation_id stays as a plain uuid column (post_shares is live and the
--     app still sends the column, always null now); only its foreign key to conversations goes.
--   * public.app_user_block_exists, public.app_can_make_user_request_window, public.is_merchant_member
--     (used by blocks, other rate limits and the merchant portal), the legacy public.chat_messages
--     scaffold from 0008 (its own account-deletion statement stays) and the 'message' report target.
-- Down: supabase/rollbacks/20261119090000_drop_direct_message_chat.down.sql recreates the schema
-- only. The rows are gone for good: restore them from the backup taken in the runbook.
-- expect-row-loss: public.conversations, public.conversation_participants, public.messages, public.read_receipts, app_private.request_rate_rules

create or replace function pg_temp.patch_function(
  p_oid regprocedure,
  p_find text,
  p_replace text,
  p_must_be_gone text
)
returns void
language plpgsql
as $patch$
declare
  v_src text := (select prosrc from pg_proc where oid = p_oid);
  v_count integer := (length(v_src) - length(replace(v_src, p_find, ''))) / length(p_find);
begin
  if v_count = 0 then
    -- Nothing to remove only if the chat reference is really gone (a re-run); never a silent no-op.
    if position(p_must_be_gone in v_src) = 0 then
      return;
    end if;
    raise exception 'patch_function: % still mentions % but the expected text was not found', p_oid, p_must_be_gone;
  end if;
  if v_count <> 1 then
    raise exception 'patch_function: % has % copies of the expected text', p_oid, v_count;
  end if;
  execute replace(pg_get_functiondef(p_oid), p_find, p_replace);
end;
$patch$;

-- 1. The data export and account deletion stop touching the chat tables.
select pg_temp.patch_function(
  'app_private.export_my_data()'::regprocedure,
  $find$    'conversations',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.conversation_participants t where t.participant_user_id = v_user), '[]'::jsonb),
    'messagesSent',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.messages t where t.sender_user_id = v_user), '[]'::jsonb),
$find$,
  $repl$$repl$,
  'conversation_participants'
);

select pg_temp.patch_function(
  'public.anonymize_account_deletion_request(uuid, uuid)'::regprocedure,
  $find$  delete from conversation_participants
  where participant_user_id = v_user_id;

  update conversations
  set created_by_user_id = null
  where created_by_user_id = v_user_id;

  update messages
  set
    body = '[deleted]',
    deleted_at = coalesce(deleted_at, now()),
    edited_at = coalesce(edited_at, now())
  where sender_user_id = v_user_id;

  delete from read_receipts
  where reader_user_id = v_user_id;

$find$,
  $repl$$repl$,
  'conversation_participants'
);

-- 2. Tables (children first). Policies, indexes and triggers go with them; so do the realtime entries.
alter table if exists public.post_shares drop constraint if exists post_shares_target_conversation_id_fkey;

drop table if exists public.read_receipts;
drop table if exists public.messages;
drop table if exists public.conversation_participants;
drop table if exists public.conversations;

-- 3. Functions: public wrapper first, then the private body.
drop function if exists public.mark_conversation_read(uuid);
drop function if exists public.open_chat_conversation(uuid, uuid, text);
drop function if exists app_private.open_chat_conversation(uuid, uuid, text);
drop function if exists public.send_chat_message(uuid, text, text, uuid);
drop function if exists app_private.send_chat_message(uuid, text, text, uuid);
drop function if exists public.can_access_conversation(uuid);
drop function if exists app_private.can_access_conversation(uuid);
drop function if exists public.enforce_conversation_participant_update_guard();
drop function if exists public.enforce_message_update_guard();
drop function if exists public.enforce_read_receipt_update_guard();

-- 4. Safety net: no function body anywhere may still name a dropped table. A late-bound reference
-- would only fail when someone calls the function, so check now and roll the migration back.
do $$
declare
  v_leftover text;
begin
  select string_agg(n.nspname || '.' || p.proname, ', ' order by n.nspname, p.proname)
    into v_leftover
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname not in ('pg_catalog', 'information_schema')
    and (
      p.prosrc ~* '\m(conversation_participants|read_receipts|conversations)\M'
      or p.prosrc ~* '\m(from|into|update|join)\s+(public\.)?messages\M'
    );
  if v_leftover is not null then
    raise exception 'functions still reference the dropped chat tables: %', v_leftover;
  end if;
end
$$;

-- 5. Rate rules for endpoints that no longer exist.
delete from app_private.request_rate_rules where route = 'rpc/send_chat_message';
delete from app_private.request_rate_rules where route = 'rpc/open_chat_conversation';
delete from app_private.request_rate_rules where route = 'read_receipts';

-- PostgREST caches the schema.
notify pgrst, 'reload schema';
