-- Undo 20261029150000_merchant_closed_until_and_daily_series: the public merchant profile reads
-- only the free-text closure again, the daily series function and its rate rule are removed,
-- the three-featured-dishes cap trigger, the closed_until 60-day limit and get_venue_closures
-- are removed and closed_until is dropped. A closed_until a
-- merchant set (a "closed today" or "closed until" they have not yet reopened from) is lost; the
-- table is copied to rollback_archive first.
-- expect-row-loss: app_private.request_rate_rules

drop trigger if exists trg_enforce_merchant_closed_until_limit on public.merchant_outlets;
drop function if exists app_private.enforce_merchant_closed_until_limit();
drop function if exists public.get_venue_closures(text[]);

drop trigger if exists trg_enforce_merchant_dish_featured_cap on public.dishes;
drop function if exists app_private.enforce_merchant_dish_featured_cap();

create schema if not exists rollback_archive;
drop table if exists rollback_archive.merchant_outlets_closed_until_20261029150000;
create table rollback_archive.merchant_outlets_closed_until_20261029150000 as
select id, closed_until, now() as archived_at
from public.merchant_outlets
where closed_until is not null;

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
volatile
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
    nullif(trim(coalesce(mo.temporary_closure, '')), ''),
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

drop function if exists public.get_merchant_daily_series(uuid, timestamptz, timestamptz);
drop function if exists app_private.get_merchant_daily_series(uuid, timestamptz, timestamptz);

delete from app_private.request_rate_rules
where route in ('rpc/get_merchant_daily_series', 'rpc/get_venue_closures');

alter table public.merchant_outlets drop column if exists closed_until;

notify pgrst, 'reload schema';
