-- smoke: supabase/smoke/merchant_closed_until_and_daily_series.sql
-- Merchant Centre round-four phase 2 (MERCH-R4-4, MERCH-R4-5, MERCH-21).
--
-- 1. merchant_outlets.closed_until: a structured temporary closure ("Closed today", "Closed
--    until 3 Nov"). The stall and dish pages already read the closure through
--    get_public_merchant_profile().temporary_closure and treat any text as closed, so the
--    function now turns an unexpired closed_until into that text (computed at read time: nothing
--    has to switch the stall back on when the date passes). The free-text temporary_closure
--    still works and is shown when there is no active closed_until.
-- 2. get_merchant_daily_series(outlet, since, until): visits, menu views, dish views, direction
--    taps and saves per Singapore day, zero-filled, in one call, for the Performance chart.
--    SECURITY DEFINER body in app_private behind a SECURITY INVOKER public wrapper (the same
--    shape as get_merchant_analytics), team-only, range capped at 31 days, rate limited.
-- Rollback: supabase/rollbacks/20261029150000_merchant_closed_until_and_daily_series.down.sql.

alter table public.merchant_outlets
  add column if not exists closed_until timestamptz;

comment on column public.merchant_outlets.closed_until is
  'The stall is closed until this moment (set from the merchant app: closed today, or until a date). Ignored once it has passed.';

-- Same columns and rules as 20261018171000 (verified outlets only); only temporary_closure changes.
create or replace function public.get_public_merchant_profile(p_venue_id text)
returns table (
  outlet_id uuid,
  description text,
  contact_phone text,
  contact_email text,
  social_links jsonb,
  cuisine_categories text[],
  profile_photo_url text,
  cover_photo_url text,
  temporary_closure text,
  is_verified boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    mo.id,
    nullif(trim(mo.description), ''),
    nullif(trim(coalesce(mo.contact_phone, '')), ''),
    nullif(trim(coalesce(mo.contact_email, '')), ''),
    coalesce(mo.social_links, '[]'::jsonb),
    coalesce(mo.cuisine_categories, '{}'),
    mo.profile_photo_url,
    mo.cover_photo_url,
    coalesce(
      case
        when mo.closed_until is not null and mo.closed_until > now() then
          case
            when mo.closed_until <=
              ((date_trunc('day', now() at time zone 'Asia/Singapore') + interval '1 day') at time zone 'Asia/Singapore')
              then 'Closed today'
            else 'Closed until ' || to_char(mo.closed_until at time zone 'Asia/Singapore', 'FMDD Mon')
          end
      end,
      nullif(trim(coalesce(mo.temporary_closure, '')), '')
    ),
    true
  from merchant_outlets mo
  where mo.venue_id = p_venue_id
    and mo.is_live
    and public.merchant_outlet_is_verified(mo.id)
  order by mo.updated_at desc
  limit 1;
$$;

revoke all on function public.get_public_merchant_profile(text) from public;
grant execute on function public.get_public_merchant_profile(text) to anon, authenticated;

-- 2. Daily series for the Performance chart.
create or replace function app_private.get_merchant_daily_series(
  p_outlet_id uuid,
  p_since timestamptz default null,
  p_until timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_until timestamptz := coalesce(p_until, now());
  v_since timestamptz := coalesce(p_since, coalesce(p_until, now()) - interval '7 days');
  v_result jsonb;
begin
  if not exists (select 1 from merchant_outlets where id = p_outlet_id)
     or not public.merchant_can_manage_outlet_v2(p_outlet_id) then
    raise exception 'not authorized to read merchant analytics' using errcode = '42501';
  end if;

  if v_until <= v_since or v_until - v_since > interval '31 days' then
    raise exception 'analytics range must be between 0 and 31 days' using errcode = '22023';
  end if;

  with days as (
    select gs::date as day
    from generate_series(
      (v_since at time zone 'Asia/Singapore')::date::timestamp,
      ((v_until - interval '1 microsecond') at time zone 'Asia/Singapore')::date::timestamp,
      interval '1 day'
    ) gs
  ),
  events as (
    select
      (occurred_at at time zone 'Asia/Singapore')::date as day,
      count(*) filter (where event_type in ('stall_profile_view', 'promotion_profile_visit'))::integer as profile_visits,
      count(*) filter (where event_type = 'menu_view')::integer as menu_views,
      count(*) filter (where event_type = 'direction_tap')::integer as direction_taps,
      count(*) filter (where event_type in ('save', 'promotion_save'))::integer as saves
    from merchant_analytics_events
    where outlet_id = p_outlet_id
      and occurred_at >= v_since
      and occurred_at < v_until
    group by 1
  ),
  dish_views as (
    select day, count(*)::integer as views
    from (
      select (viewed_at at time zone 'Asia/Singapore')::date as day
      from merchant_dish_view_events
      where outlet_id = p_outlet_id and viewed_at >= v_since and viewed_at < v_until
      union all
      select (occurred_at at time zone 'Asia/Singapore')::date
      from merchant_promotion_events
      where outlet_id = p_outlet_id and event_type = 'dish_view'
        and occurred_at >= v_since and occurred_at < v_until
    ) v
    group by day
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', to_char(days.day, 'YYYY-MM-DD'),
        'profileVisits', coalesce(events.profile_visits, 0),
        'menuViews', coalesce(events.menu_views, 0),
        'dishViews', coalesce(dish_views.views, 0),
        'directionTaps', coalesce(events.direction_taps, 0),
        'saves', coalesce(events.saves, 0)
      )
      order by days.day
    ),
    '[]'::jsonb
  )
  into v_result
  from days
  left join events on events.day = days.day
  left join dish_views on dish_views.day = days.day;

  return v_result;
end;
$function$;

create or replace function public.get_merchant_daily_series(
  p_outlet_id uuid,
  p_since timestamptz default null,
  p_until timestamptz default null
)
returns jsonb
language sql
security invoker
set search_path = public, app_private
as $$
  select app_private.get_merchant_daily_series(p_outlet_id, p_since, p_until);
$$;

revoke all on function app_private.get_merchant_daily_series(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function public.get_merchant_daily_series(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function app_private.get_merchant_daily_series(uuid, timestamptz, timestamptz)
  to authenticated, service_role;
grant execute on function public.get_merchant_daily_series(uuid, timestamptz, timestamptz)
  to authenticated, service_role;

-- Rate limit (signed-in callers only; the wrapper is VOLATILE so the limiter can count it).
insert into app_private.request_rate_rules (route, anon_per_minute, user_per_minute, note) values
  ('rpc/get_merchant_daily_series', null, 30, 'merchant Performance daily chart')
on conflict (route) do nothing;

notify pgrst, 'reload schema';
