-- Audit 2026-10-18 fixes:
-- 1. Sign-out unbinds this device's push token from the account, so the next
--    person who uses the phone doesn't get the previous user's stall alerts.
-- 2. mood-search checks its daily cap and claims a slot in one locked step,
--    so parallel calls can't all pass the check before any is recorded.

-- ---------------------------------------------------------------------------
-- Push token unbind (own token only)
-- ---------------------------------------------------------------------------

create or replace function public.unregister_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  delete from public.user_push_tokens
  where token = p_token
    and user_id = v_user_id;
end;
$$;

revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.unregister_push_token(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Mood-search daily cap: atomic check + reserve
-- ---------------------------------------------------------------------------

-- A reserved slot counts toward the cap at once; the function fills in the
-- intent when Claude answers (or deletes the slot when it fails). Pending rows
-- are never served from cache.
alter table public.mood_search_queries
  add column if not exists pending boolean not null default false;

create or replace function public.reserve_mood_search_slot(
  p_user_id uuid,
  p_query_norm text,
  p_daily_limit integer
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used integer;
  v_id bigint;
begin
  if p_user_id is null then
    raise exception 'user required' using errcode = '22023';
  end if;

  -- Serialise reservations per user for the rest of this transaction.
  perform pg_advisory_xact_lock(hashtextextended('mood_search_slot:' || p_user_id::text, 0));

  select count(*) into v_used
  from public.mood_search_queries
  where user_id = p_user_id
    and cached = false
    and created_at >= now() - interval '24 hours';

  if v_used >= greatest(coalesce(p_daily_limit, 0), 0) then
    return null;
  end if;

  insert into public.mood_search_queries (user_id, query_norm, intent, cached, pending)
  values (p_user_id, p_query_norm, '{}'::jsonb, false, true)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.reserve_mood_search_slot(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_mood_search_slot(uuid, text, integer) to service_role;
