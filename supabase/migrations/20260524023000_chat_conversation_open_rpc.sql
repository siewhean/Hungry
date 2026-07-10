-- Full Audit V1 chat live-smoke hardening:
-- - Create conversations and initial participants through a checked RPC so
--   clients do not depend on selecting a not-yet-participated conversation.
-- - Ensure read_receipts can be deleted while published through Realtime.

alter table if exists public.read_receipts replica identity full;

create or replace function public.open_chat_conversation(
  p_target_user_id uuid default null,
  p_target_merchant_account_id uuid default null,
  p_conversation_type text default 'user'
)
returns table (
  id uuid,
  conversation_type text,
  subject_merchant_account_id uuid,
  created_by_user_id uuid,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_type text;
  v_dedupe_key text;
  v_conversation public.conversations%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required to start a chat.' using errcode = '42501';
  end if;

  if (p_target_user_id is null and p_target_merchant_account_id is null)
    or (p_target_user_id is not null and p_target_merchant_account_id is not null) then
    raise exception 'Provide exactly one chat target.' using errcode = '22023';
  end if;

  if p_target_user_id is not null then
    v_type := 'user';

    if p_target_user_id = v_user_id then
      raise exception 'Cannot start a chat with yourself.' using errcode = '22023';
    end if;

    if not exists (select 1 from public.user_profiles up where up.id = p_target_user_id) then
      raise exception 'Target user is unavailable.' using errcode = '22023';
    end if;

    if public.app_user_block_exists(v_user_id, p_target_user_id)
      or public.app_user_block_exists(p_target_user_id, v_user_id) then
      raise exception 'Messaging is unavailable between these users.' using errcode = '42501';
    end if;

    select array_to_string(array_agg(part order by part), ':')
    into v_dedupe_key
    from unnest(array['user', v_user_id::text, p_target_user_id::text]) as parts(part);
  else
    v_type := 'merchant';

    if p_conversation_type not in ('merchant', 'user') then
      raise exception 'Invalid conversation type.' using errcode = '22023';
    end if;

    if not exists (
      select 1
      from public.merchant_accounts ma
      where ma.id = p_target_merchant_account_id
    ) then
      raise exception 'Target merchant is unavailable.' using errcode = '22023';
    end if;

    v_dedupe_key := 'merchant:' || v_user_id::text || ':' || p_target_merchant_account_id::text;
  end if;

  insert into public.conversations (
    conversation_type,
    dedupe_key,
    subject_merchant_account_id,
    created_by_user_id
  )
  values (
    v_type,
    v_dedupe_key,
    p_target_merchant_account_id,
    v_user_id
  )
  on conflict (dedupe_key) do update
  set updated_at = public.conversations.updated_at
  returning * into v_conversation;

  insert into public.conversation_participants (
    conversation_id,
    participant_kind,
    participant_user_id,
    participant_merchant_account_id
  )
  values (
    v_conversation.id,
    'user',
    v_user_id,
    null
  )
  on conflict (conversation_id, participant_user_id) do nothing;

  if p_target_user_id is not null then
    insert into public.conversation_participants (
      conversation_id,
      participant_kind,
      participant_user_id,
      participant_merchant_account_id
    )
    values (
      v_conversation.id,
      'user',
      p_target_user_id,
      null
    )
    on conflict (conversation_id, participant_user_id) do nothing;
  else
    insert into public.conversation_participants (
      conversation_id,
      participant_kind,
      participant_user_id,
      participant_merchant_account_id
    )
    values (
      v_conversation.id,
      'merchant',
      null,
      p_target_merchant_account_id
    )
    on conflict (conversation_id, participant_merchant_account_id) do nothing;
  end if;

  return query
  select
    v_conversation.id,
    v_conversation.conversation_type,
    v_conversation.subject_merchant_account_id,
    v_conversation.created_by_user_id,
    v_conversation.updated_at;
end;
$$;

revoke execute
on function public.open_chat_conversation(uuid, uuid, text)
from public, anon;

grant execute
on function public.open_chat_conversation(uuid, uuid, text)
to authenticated, service_role;

comment on function public.open_chat_conversation(uuid, uuid, text) is
  'Checked conversation opener that creates the conversation and first participants atomically for app clients.';
