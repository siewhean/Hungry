-- merchant-L18: write paths without per-user limits.
-- 1. submit_merchant_claim_interest: at most 5 new claims per user per 24 hours (the existing
--    per-venue dedupe is unchanged). Redefines app_private.submit_merchant_claim_interest, based
--    on its only definition (0012, moved to app_private by 20260522142004); the public invoker
--    wrapper is untouched.
-- 2. merchant_promotions counters (impressions, clicks, saves, profile_visits, dish_views) are
--    server-only: written by the analytics event function (definer) and service jobs, never
--    directly by a merchant.
-- Not done here: a per-user limit inside record_merchant_analytics_event (left for ops).

create schema if not exists app_private;

create or replace function app_private.submit_merchant_claim_interest(
  p_venue_id      text,
  p_contact_name  text default null,
  p_contact_phone text default null,
  p_contact_email text default null,
  p_uen           text default null,
  p_notes         text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_building_id text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'must be signed in to claim a stall' using errcode = '28000';
  end if;

  select building_id into v_building_id
    from venues
    where id = p_venue_id;

  if v_building_id is null then
    raise exception 'unknown venue: %', p_venue_id using errcode = '22023';
  end if;

  -- An existing claim for this venue is returned as "already exists" without counting.
  if exists (
    select 1
    from merchant_claim_interests
    where venue_id = p_venue_id
      and claimed_by = auth.uid()
  ) then
    return null;
  end if;

  if (
    select count(*)
    from merchant_claim_interests
    where claimed_by = auth.uid()
      and created_at >= now() - interval '24 hours'
  ) >= 5 then
    raise exception 'claim rate limit exceeded' using errcode = 'P0001';
  end if;

  insert into merchant_claim_interests (
    venue_id, building_id, claimed_by,
    contact_name, contact_phone, contact_email, uen, notes, source
  ) values (
    p_venue_id, v_building_id, auth.uid(),
    p_contact_name, p_contact_phone, p_contact_email, p_uen, p_notes,
    'stall_detail_cta'
  )
  on conflict (venue_id, claimed_by)
    where claimed_by is not null
    do nothing
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function app_private.enforce_merchant_promotion_counters_server_only()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  -- Definer functions (analytics counters) and service jobs.
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.impressions <> 0 or new.clicks <> 0 or new.saves <> 0
      or new.profile_visits <> 0 or new.dish_views <> 0 then
      raise exception 'promotion counters are server-managed' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.impressions is distinct from old.impressions
    or new.clicks is distinct from old.clicks
    or new.saves is distinct from old.saves
    or new.profile_visits is distinct from old.profile_visits
    or new.dish_views is distinct from old.dish_views then
    raise exception 'promotion counters are server-managed' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function app_private.enforce_merchant_promotion_counters_server_only()
  from public, anon;

drop trigger if exists trg_enforce_merchant_promotion_counters_server_only
  on public.merchant_promotions;
create trigger trg_enforce_merchant_promotion_counters_server_only
before insert or update on public.merchant_promotions
for each row
execute function app_private.enforce_merchant_promotion_counters_server_only();
