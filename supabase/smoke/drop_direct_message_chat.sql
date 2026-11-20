-- Smoke checks for 20261119090000_drop_direct_message_chat.sql. Read-only: raises on the first
-- finding, so a clean run prints nothing. Run it after the migration is applied.
-- 1. The four chat tables, the chat functions, the trigger functions and the rate rules are gone.
-- 2. Nothing left in the database names a dropped table: no function body, no foreign key.
-- 3. What had to stay is still there: post_shares.target_conversation_id (as a plain column), the
--    helpers shared with blocks, rate limits and the merchant portal, the legacy chat_messages table,
--    the PDPA export without the chat keys, account deletion with its chat_messages statement.

do $$
declare
  v_name text;
  v_src text;
begin
  -- 1. Dropped objects.
  foreach v_name in array array['conversations', 'conversation_participants', 'messages', 'read_receipts'] loop
    if to_regclass('public.' || v_name) is not null then
      raise exception 'public.% still exists', v_name;
    end if;
  end loop;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app_private')
      and p.proname in (
        'open_chat_conversation', 'send_chat_message', 'can_access_conversation',
        'mark_conversation_read', 'enforce_conversation_participant_update_guard',
        'enforce_message_update_guard', 'enforce_read_receipt_update_guard'
      )
  ) then
    raise exception 'a chat function still exists';
  end if;

  if exists (
    select 1 from app_private.request_rate_rules
    where route in ('rpc/send_chat_message', 'rpc/open_chat_conversation', 'read_receipts')
  ) then
    raise exception 'a chat rate rule is still present';
  end if;

  -- 2. No dangling references (diagnostic RAISE statements stripped first; dynamic EXECUTE strings kept).
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral (
      select regexp_replace(
        p.prosrc,
        '\mraise\s+(debug|log|info|notice|warning|exception)\M[^;]*;',
        ';',
        'gi'
      ) as body
    ) stripped
    where n.nspname not in ('pg_catalog', 'information_schema')
      and (
        stripped.body ~* '\m(conversation_participants|read_receipts|conversations)\M'
        -- `messages` is a common word, so it is only matched after a keyword that takes a table:
        -- from/into/update/join/using (select, insert, delete, merge), copy, references (foreign key),
        -- table (alter/drop/lock/comment on table), `only`, or anywhere in a multi-table truncate/lock list.
        or stripped.body ~* '\m(from|into|update|join|using|copy|references|table|only)\s+(only\s+)?(public\.)?messages\M|\m(truncate|lock)(\s+table)?\s+([^;$]+,\s*)*(only\s+)?(public\.)?messages\M'
      )
  ) then
    raise exception 'a function still references a dropped chat table';
  end if;

  if exists (
    select 1 from pg_constraint where conname = 'post_shares_target_conversation_id_fkey'
  ) then
    raise exception 'post_shares still has a foreign key to conversations';
  end if;

  -- 3. Kept objects.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'post_shares' and column_name = 'target_conversation_id'
  ) then
    raise exception 'post_shares.target_conversation_id was dropped; the app still sends it';
  end if;

  foreach v_name in array array[
    'public.app_user_block_exists(uuid, uuid)',
    'public.app_can_make_user_request_window(uuid, text, text, integer)',
    'public.is_merchant_member(uuid)'
  ] loop
    if to_regprocedure(v_name) is null then
      raise exception '% is shared and must stay', v_name;
    end if;
  end loop;

  if to_regclass('public.chat_messages') is null then
    raise exception 'the legacy public.chat_messages scaffold must stay';
  end if;

  select prosrc into v_src from pg_proc where oid = 'app_private.export_my_data()'::regprocedure;
  if v_src ~ 'messagesSent' or v_src ~ 'conversation_participants' then
    raise exception 'the data export still reads the chat tables';
  end if;
  if v_src !~ 'activity' then
    raise exception 'the data export lost its other keys';
  end if;

  select prosrc into v_src
  from pg_proc where oid = 'public.anonymize_account_deletion_request(uuid, uuid)'::regprocedure;
  if v_src ~ 'conversation_participants' or v_src ~ 'read_receipts' then
    raise exception 'account deletion still touches the chat tables';
  end if;
  if v_src !~ 'update chat_messages' then
    raise exception 'account deletion lost its legacy chat_messages statement';
  end if;
end $$;
