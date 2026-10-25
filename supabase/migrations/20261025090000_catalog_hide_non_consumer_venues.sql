-- smoke: supabase/smoke/catalog_hide_non_consumer_venues.sql
-- Hide venues that are not places to eat (7-Eleven, Cheers, Shell Select, food factories and
-- warehouses, school and staff canteens, camps) from Search, the map, venue and dish pages,
-- place lists, suggestions and the Home feed. The source rows in public.venues stay as they are.
--
-- Rebuilt on today's functions from the parked (now removed) 20260715013000 and
-- 20260715020000 (which patched older page bodies) and the cursor-helper part of 20260724090000.
-- The name rules are narrower than the old ones: plain "factory", "school", "university" and
-- "industrial" matched real cafes (Beans Factory, Modern Old School, Tokyo Milk Cheese Factory),
-- so only explicit non-consumer phrases count. A venue linked to a merchant outlet is never hidden.
--
-- How it works, without restating the large catalog builders:
-- 1. app_private.catalog_excluded_venues lists the hidden venue ids. It is filled from
--    public.venues here and kept in step by a trigger on venues (insert, or a name change).
--    reason = 'manual' rows are never touched by the trigger.
-- 2. A BEFORE INSERT trigger on the raw catalog card tables drops rows for those venues, so
--    every publish and single-venue refresh skips them (same pattern as the merchant-draft skip).
-- 3. Rows already published are moved to app_private stash tables (the rollback puts them back).
-- 4. get_discovery_feed_by_location reads public.venues directly, so its three candidate
--    queries get a not-exists filter, patched in place from the live body.
-- 5. catalog_raw_cursor(jsonb) / catalog_raw_cursor_value(text) become service-role only; their
--    only callers are the SECURITY DEFINER page RPCs.
-- Rollback: supabase/rollbacks/20261025090000_catalog_hide_non_consumer_venues.down.sql.

create schema if not exists app_private;

create or replace function app_private.catalog_non_consumer_reason(p_name text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when lower(trim(coalesce(p_name, ''))) ~ '(^|[^a-z0-9])(7[- ]?eleven|fairprice xpress|shell select|caltex star ?mart|spc ?go)([^a-z0-9]|$)'
      or lower(trim(coalesce(p_name, ''))) ~ '^cheers( convenience store| holdings.*)?$'
      then 'convenience_store'
    when lower(coalesce(p_name, '')) ~ '(primary school|secondary school|junior college|polytechnic|kindergarten|child ?care|student care)'
      then 'education_site'
    when lower(coalesce(p_name, '')) ~ '(staff canteen|employee canteen|workers? canteen|army camp|military camp|air base|naval base|police station|prison)'
      then 'private_or_restricted_site'
    when lower(coalesce(p_name, '')) ~ '(food processing|manufactur|warehouse|cold store|distribution cent(re|er)|food factory)'
      then 'non_consumer_business'
  end
$$;

revoke all on function app_private.catalog_non_consumer_reason(text) from public, anon, authenticated;
grant execute on function app_private.catalog_non_consumer_reason(text) to service_role;

create table if not exists app_private.catalog_excluded_venues (
  venue_id text primary key,
  reason text not null check (reason in (
    'convenience_store', 'education_site', 'private_or_restricted_site', 'non_consumer_business', 'manual'
  )),
  created_at timestamptz not null default now()
);

-- app_private is not exposed through the API. The Home feed runs as the caller, so the
-- caller roles may read the ids (nothing else is in the table).
revoke all on table app_private.catalog_excluded_venues from public, anon, authenticated;
grant select on table app_private.catalog_excluded_venues to anon, authenticated;
grant all on table app_private.catalog_excluded_venues to service_role;

insert into app_private.catalog_excluded_venues (venue_id, reason)
select v.id, app_private.catalog_non_consumer_reason(v.name)
from public.venues v
where app_private.catalog_non_consumer_reason(v.name) is not null
  and not exists (select 1 from public.merchant_outlets mo where mo.venue_id = v.id)
on conflict (venue_id) do nothing;

-- Keep the list in step with venue names (catalog loads, renames).
create or replace function app_private.catalog_sync_excluded_venue()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_reason text := app_private.catalog_non_consumer_reason(new.name);
begin
  if v_reason is not null
    and not exists (select 1 from public.merchant_outlets mo where mo.venue_id = new.id) then
    insert into app_private.catalog_excluded_venues (venue_id, reason)
    values (new.id, v_reason)
    on conflict (venue_id) do update set reason = excluded.reason
    where app_private.catalog_excluded_venues.reason <> 'manual';
  else
    delete from app_private.catalog_excluded_venues
    where venue_id = new.id and reason <> 'manual';
  end if;
  return null;
end;
$$;

revoke all on function app_private.catalog_sync_excluded_venue() from public, anon, authenticated;

drop trigger if exists trg_catalog_sync_excluded_venue on public.venues;
create trigger trg_catalog_sync_excluded_venue
after insert or update of name on public.venues
for each row
execute function app_private.catalog_sync_excluded_venue();

-- Raw catalog cards: never publish a row for a hidden venue.
create or replace function app_private.catalog_raw_skip_excluded_venue()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if tg_table_name = 'catalog_raw_venue_cards' then
    if exists (select 1 from app_private.catalog_excluded_venues e where e.venue_id = new.id) then
      return null;
    end if;
  elsif tg_table_name = 'catalog_raw_dish_cards' then
    if exists (select 1 from app_private.catalog_excluded_venues e where e.venue_id = new.venue_id) then
      return null;
    end if;
  elsif exists (
    select 1
    from public.dishes d
    join app_private.catalog_excluded_venues e on e.venue_id = d.venue_id
    where d.id = new.dish_id
  ) then
    return null;
  end if;
  return new;
end;
$$;

revoke all on function app_private.catalog_raw_skip_excluded_venue() from public, anon, authenticated;

drop trigger if exists trg_catalog_raw_skip_excluded_venue on public.catalog_raw_venue_cards;
create trigger trg_catalog_raw_skip_excluded_venue
before insert on public.catalog_raw_venue_cards
for each row
execute function app_private.catalog_raw_skip_excluded_venue();

drop trigger if exists trg_catalog_raw_skip_excluded_venue on public.catalog_raw_dish_cards;
create trigger trg_catalog_raw_skip_excluded_venue
before insert on public.catalog_raw_dish_cards
for each row
execute function app_private.catalog_raw_skip_excluded_venue();

drop trigger if exists trg_catalog_raw_skip_excluded_venue on public.catalog_raw_dish_media;
create trigger trg_catalog_raw_skip_excluded_venue
before insert on public.catalog_raw_dish_media
for each row
execute function app_private.catalog_raw_skip_excluded_venue();

-- Move rows already published (every release) to stash tables, and fix the release totals.
create table if not exists app_private.catalog_excluded_venue_cards_stash
  (like public.catalog_raw_venue_cards including defaults);
create table if not exists app_private.catalog_excluded_dish_cards_stash
  (like public.catalog_raw_dish_cards including defaults);
create table if not exists app_private.catalog_excluded_dish_media_stash
  (like public.catalog_raw_dish_media including defaults);
revoke all on table app_private.catalog_excluded_venue_cards_stash from public, anon, authenticated;
revoke all on table app_private.catalog_excluded_dish_cards_stash from public, anon, authenticated;
revoke all on table app_private.catalog_excluded_dish_media_stash from public, anon, authenticated;

with moved as (
  delete from public.catalog_raw_dish_media m
  using public.catalog_raw_dish_cards c, app_private.catalog_excluded_venues e
  where c.release_id = m.release_id and c.id = m.dish_id and e.venue_id = c.venue_id
  returning m.*
)
insert into app_private.catalog_excluded_dish_media_stash select * from moved;

with moved as (
  delete from public.catalog_raw_dish_cards c
  using app_private.catalog_excluded_venues e
  where e.venue_id = c.venue_id
  returning c.*
)
insert into app_private.catalog_excluded_dish_cards_stash select * from moved;

with moved as (
  delete from public.catalog_raw_venue_cards c
  using app_private.catalog_excluded_venues e
  where e.venue_id = c.id
  returning c.*
)
insert into app_private.catalog_excluded_venue_cards_stash select * from moved;

update public.catalog_releases r
set venue_total = r.venue_total - s.venues,
    dish_total = r.dish_total - s.dishes
from (
  select release_id, sum(venues)::integer as venues, sum(dishes)::integer as dishes
  from (
    select release_id, 1 as venues, 0 as dishes from app_private.catalog_excluded_venue_cards_stash
    union all
    select release_id, 0, 1 from app_private.catalog_excluded_dish_cards_stash
  ) moved
  group by release_id
) s
where s.release_id = r.id;

-- Home feed: skip hidden venues in each of its three candidate queries.
do $$
declare
  v_find constant text := E'join buildings b on b.id = v.building_id\n      cross join params\n      where ';
  v_replace constant text := E'join buildings b on b.id = v.building_id\n      cross join params\n      where not exists (select 1 from app_private.catalog_excluded_venues ex where ex.venue_id = v.id)\n        and ';
  v_src text;
  v_hits integer;
begin
  select prosrc into v_src from pg_proc where oid = 'public.get_discovery_feed_by_location(text,double precision,double precision,integer,integer,text)'::regprocedure;
  if position('app_private.catalog_excluded_venues' in v_src) > 0 then
    return;
  end if;
  v_hits := (length(v_src) - length(replace(v_src, v_find, ''))) / length(v_find);
  if v_hits <> 3 then
    raise exception 'get_discovery_feed_by_location: expected 3 candidate queries, found %', v_hits;
  end if;
  execute replace(
    pg_get_functiondef('public.get_discovery_feed_by_location(text,double precision,double precision,integer,integer,text)'::regprocedure),
    v_find, v_replace
  );
end;
$$;

-- Cursor helpers: only the SECURITY DEFINER page RPCs call them.
revoke all on function public.catalog_raw_cursor(jsonb) from public, anon, authenticated;
revoke all on function public.catalog_raw_cursor_value(text) from public, anon, authenticated;
grant execute on function public.catalog_raw_cursor(jsonb) to service_role;
grant execute on function public.catalog_raw_cursor_value(text) to service_role;
