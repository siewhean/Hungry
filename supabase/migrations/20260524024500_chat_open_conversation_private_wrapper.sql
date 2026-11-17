-- Keep the checked chat opener off the public SECURITY DEFINER surface.

create schema if not exists app_private;

revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated, service_role;

alter function public.open_chat_conversation(uuid, uuid, text) set schema app_private;

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
language sql
security invoker
set search_path = public, app_private
as $$
  select *
  from app_private.open_chat_conversation(
    p_target_user_id,
    p_target_merchant_account_id,
    p_conversation_type
  );
$$;

revoke all
on function public.open_chat_conversation(uuid, uuid, text)
from public, anon, authenticated;

revoke all
on function app_private.open_chat_conversation(uuid, uuid, text)
from public, anon, authenticated;

grant execute
on function public.open_chat_conversation(uuid, uuid, text)
to authenticated, service_role;

grant execute
on function app_private.open_chat_conversation(uuid, uuid, text)
to authenticated, service_role;

comment on function public.open_chat_conversation(uuid, uuid, text) is
  'Public invoker wrapper for checked conversation creation.';

comment on function app_private.open_chat_conversation(uuid, uuid, text) is
  'Private checked conversation opener that creates the conversation and first participants atomically.';
