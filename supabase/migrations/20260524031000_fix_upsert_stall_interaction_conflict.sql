-- Fix PL/pgSQL output-column ambiguity in the private stall interaction RPC body.

create or replace function app_private.upsert_stall_interaction(
  p_stall_id text,
  p_is_saved boolean default null,
  p_is_tried boolean default null,
  p_is_reviewed boolean default null
)
returns table (
  user_id uuid,
  stall_id text,
  is_saved boolean,
  is_tried boolean,
  is_reviewed boolean,
  saved_at timestamptz,
  tried_at timestamptz,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required to update stall interactions.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.venues v where v.id = p_stall_id) then
    raise exception 'Unknown stall id: %', p_stall_id;
  end if;

  insert into public.user_stall_interactions (
    user_id,
    stall_id,
    is_saved,
    is_tried,
    is_reviewed,
    saved_at,
    tried_at,
    reviewed_at,
    updated_at
  )
  values (
    current_user_id,
    p_stall_id,
    coalesce(p_is_saved, false),
    coalesce(p_is_tried, false),
    coalesce(p_is_reviewed, false),
    case when coalesce(p_is_saved, false) then now() else null end,
    case when coalesce(p_is_tried, false) then now() else null end,
    case when coalesce(p_is_reviewed, false) then now() else null end,
    now()
  )
  on conflict on constraint user_stall_interactions_pkey do update
  set
    is_saved = coalesce(p_is_saved, public.user_stall_interactions.is_saved),
    is_tried = coalesce(p_is_tried, public.user_stall_interactions.is_tried),
    is_reviewed = coalesce(p_is_reviewed, public.user_stall_interactions.is_reviewed),
    saved_at = case
      when p_is_saved is true and public.user_stall_interactions.saved_at is null then now()
      when p_is_saved is false then null
      else public.user_stall_interactions.saved_at
    end,
    tried_at = case
      when p_is_tried is true and public.user_stall_interactions.tried_at is null then now()
      when p_is_tried is false then null
      else public.user_stall_interactions.tried_at
    end,
    reviewed_at = case
      when p_is_reviewed is true and public.user_stall_interactions.reviewed_at is null then now()
      when p_is_reviewed is false then null
      else public.user_stall_interactions.reviewed_at
    end,
    updated_at = now()
  returning
    public.user_stall_interactions.user_id,
    public.user_stall_interactions.stall_id,
    public.user_stall_interactions.is_saved,
    public.user_stall_interactions.is_tried,
    public.user_stall_interactions.is_reviewed,
    public.user_stall_interactions.saved_at,
    public.user_stall_interactions.tried_at,
    public.user_stall_interactions.reviewed_at;
end;
$$;

revoke all
on function app_private.upsert_stall_interaction(text, boolean, boolean, boolean)
from public, anon, authenticated;

grant execute
on function app_private.upsert_stall_interaction(text, boolean, boolean, boolean)
to authenticated, service_role;

comment on function app_private.upsert_stall_interaction(text, boolean, boolean, boolean) is
  'Private checked stall interaction writer with unambiguous primary-key conflict handling.';
