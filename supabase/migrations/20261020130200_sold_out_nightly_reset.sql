-- Sold out until tomorrow (medium/low decision 28).
--
-- The sold_out availability flag means "sold out today" (the stall page says
-- "Sold out today"). Every night at Singapore midnight a pg_cron job clears
-- it, so dishes come back on automatically. There is no separate indefinite
-- sold-out kind today: only the sold_out flag (any spelling the merchant
-- normaliser maps to sold_out) is cleared; featured and section:<Name> flags
-- are kept. Venues whose dishes changed get their raw catalog cards rebuilt.
-- app_private.reset_sold_out_dishes() returns how many dishes it turned back on.

begin;

create extension if not exists pg_cron;

create schema if not exists app_private;

create or replace function app_private.reset_sold_out_dishes()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_venue_id text;
  v_venues text[];
  v_count integer := 0;
begin
  with reset as (
    update public.dishes d
    set availability_flags = (
      select coalesce(array_agg(f.flag order by f.ord), '{}'::text[])
      from unnest(d.availability_flags) with ordinality as f(flag, ord)
      where public.merchant_normalize_availability_flag(f.flag) <> 'sold_out'
    )
    where exists (
      select 1
      from unnest(d.availability_flags) as existing(flag)
      where public.merchant_normalize_availability_flag(existing.flag) = 'sold_out'
    )
    returning d.venue_id
  )
  select count(*)::integer, array_agg(distinct venue_id) filter (where venue_id is not null)
  into v_count, v_venues
  from reset;

  foreach v_venue_id in array coalesce(v_venues, '{}'::text[]) loop
    perform public.catalog_raw_refresh_venue(v_venue_id);
  end loop;

  return v_count;
end;
$$;

revoke all on function app_private.reset_sold_out_dishes() from public, anon, authenticated;
grant execute on function app_private.reset_sold_out_dishes() to service_role;

-- 16:00 UTC = 00:00 Asia/Singapore (UTC+8, no daylight saving).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'reset-sold-out-dishes') then
    perform cron.unschedule('reset-sold-out-dishes');
  end if;
  perform cron.schedule(
    'reset-sold-out-dishes',
    '0 16 * * *',
    'select app_private.reset_sold_out_dishes()'
  );
end;
$$;

commit;
