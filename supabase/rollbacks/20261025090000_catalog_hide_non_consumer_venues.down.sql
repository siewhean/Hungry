-- Undo 20261025090000_catalog_hide_non_consumer_venues: put the stashed cards back, restore
-- the Home feed body and the cursor-helper grants, then drop the exclusion objects.

drop trigger if exists trg_catalog_raw_skip_excluded_venue on public.catalog_raw_venue_cards;
drop trigger if exists trg_catalog_raw_skip_excluded_venue on public.catalog_raw_dish_cards;
drop trigger if exists trg_catalog_raw_skip_excluded_venue on public.catalog_raw_dish_media;
drop function if exists app_private.catalog_raw_skip_excluded_venue();

drop trigger if exists trg_catalog_sync_excluded_venue on public.venues;
drop function if exists app_private.catalog_sync_excluded_venue();

-- The stashed rows already went through the card triggers when they were first published,
-- so put them back exactly as they were.
alter table public.catalog_raw_venue_cards disable trigger user;
alter table public.catalog_raw_dish_cards disable trigger user;
alter table public.catalog_raw_dish_media disable trigger user;

insert into public.catalog_raw_venue_cards
select s.* from app_private.catalog_excluded_venue_cards_stash s
where exists (select 1 from public.catalog_releases r where r.id = s.release_id)
on conflict do nothing;
insert into public.catalog_raw_dish_cards
select s.* from app_private.catalog_excluded_dish_cards_stash s
where exists (select 1 from public.catalog_releases r where r.id = s.release_id)
on conflict do nothing;
insert into public.catalog_raw_dish_media
select s.* from app_private.catalog_excluded_dish_media_stash s
where exists (select 1 from public.catalog_releases r where r.id = s.release_id)
on conflict do nothing;

alter table public.catalog_raw_venue_cards enable trigger user;
alter table public.catalog_raw_dish_cards enable trigger user;
alter table public.catalog_raw_dish_media enable trigger user;

update public.catalog_releases r
set venue_total = r.venue_total + s.venues,
    dish_total = r.dish_total + s.dishes
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

drop table if exists app_private.catalog_excluded_venue_cards_stash;
drop table if exists app_private.catalog_excluded_dish_cards_stash;
drop table if exists app_private.catalog_excluded_dish_media_stash;

do $$
declare
  v_find constant text := E'\n      where not exists (select 1 from app_private.catalog_excluded_venues ex where ex.venue_id = v.id)\n        and ';
  v_def text;
begin
  v_def := pg_get_functiondef('public.get_discovery_feed_by_location(text,double precision,double precision,integer,integer,text)'::regprocedure);
  if position(v_find in v_def) > 0 then
    execute replace(v_def, v_find, E'\n      where ');
  end if;
end;
$$;

grant execute on function public.catalog_raw_cursor(jsonb) to public, anon, authenticated, service_role;
grant execute on function public.catalog_raw_cursor_value(text) to public, anon, authenticated, service_role;

drop table if exists app_private.catalog_excluded_venues;
drop function if exists app_private.catalog_non_consumer_reason(text);
