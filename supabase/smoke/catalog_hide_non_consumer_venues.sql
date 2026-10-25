-- Smoke checks for 20261025090000_catalog_hide_non_consumer_venues.sql.
-- A new 7-Eleven is listed as hidden as soon as it is loaded, a publish leaves it out of the
-- raw catalog, a renamed venue comes back, a real "factory" cafe and a merchant's venue stay
-- visible, the Home feed filters all three candidate queries, and the cursor helpers are
-- service-role only. Runs in a transaction and rolls back.

begin;

insert into venues (id, building_id, name, floor)
values
  ('smoke-0048-seven', 'building-maxwell', '7-Eleven', '1'),
  ('smoke-0048-cafe', 'building-maxwell', 'Beans Factory', '1'),
  ('smoke-0048-rename', 'building-maxwell', 'Kimly Food Manufacturing Pte Ltd', '1'),
  ('smoke-0048-shell', 'building-maxwell', 'Shell Select', '1');

insert into dishes (id, venue_id, building_id, name, price)
values ('smoke-0048-seven-dish', 'smoke-0048-seven', 'building-maxwell', 'Onigiri', 2.5);

do $$
begin
  if (select reason from app_private.catalog_excluded_venues where venue_id = 'smoke-0048-seven') is distinct from 'convenience_store' then
    raise exception 'a loaded 7-Eleven should be hidden as a convenience store';
  end if;
  if (select reason from app_private.catalog_excluded_venues where venue_id = 'smoke-0048-rename') is distinct from 'non_consumer_business' then
    raise exception 'a food manufacturer should be hidden';
  end if;
  if exists (select 1 from app_private.catalog_excluded_venues where venue_id = 'smoke-0048-cafe') then
    raise exception 'a cafe with "Factory" in its name must stay visible';
  end if;
end $$;

-- A rename that no longer matches brings the venue back; a manual row survives renames.
update venues set name = 'Kimly Kopitiam' where id = 'smoke-0048-rename';
update app_private.catalog_excluded_venues set reason = 'manual' where venue_id = 'smoke-0048-shell';
update venues set name = 'Shell Select Cafe' where id = 'smoke-0048-shell';

do $$
begin
  if exists (select 1 from app_private.catalog_excluded_venues where venue_id = 'smoke-0048-rename') then
    raise exception 'a venue renamed to a food name should come back';
  end if;
  if (select reason from app_private.catalog_excluded_venues where venue_id = 'smoke-0048-shell') is distinct from 'manual' then
    raise exception 'a manual exclusion must survive a rename';
  end if;
end $$;

select public.catalog_raw_publish_release(null, null);

do $$
declare
  v_release uuid := (select id from public.catalog_releases where status = 'active');
begin
  if v_release is null then
    raise exception 'publish should activate a release';
  end if;
  if exists (select 1 from public.catalog_raw_venue_cards where release_id = v_release and id in ('smoke-0048-seven', 'smoke-0048-shell')) then
    raise exception 'hidden venues must not get venue cards';
  end if;
  if exists (select 1 from public.catalog_raw_dish_cards where release_id = v_release and venue_id = 'smoke-0048-seven') then
    raise exception 'dishes of hidden venues must not get dish cards';
  end if;
  if not exists (select 1 from public.catalog_raw_venue_cards where release_id = v_release and id = 'smoke-0048-cafe')
    or not exists (select 1 from public.catalog_raw_venue_cards where release_id = v_release and id = 'smoke-0048-rename') then
    raise exception 'visible venues must still be published';
  end if;
  if (select venue_total from public.catalog_releases where id = v_release)
     <> (select count(*) from public.catalog_raw_venue_cards where release_id = v_release) then
    raise exception 'release venue_total should match the published cards';
  end if;
end $$;

-- A single-venue refresh (merchant edits, venue updates) skips hidden venues too.
select public.catalog_raw_refresh_venue('smoke-0048-seven');

do $$
begin
  if exists (select 1 from public.catalog_raw_venue_cards where id = 'smoke-0048-seven') then
    raise exception 'refresh must not publish a hidden venue';
  end if;
  if (select count(*) from pg_proc
      where oid = 'public.get_discovery_feed_by_location(text,double precision,double precision,integer,integer,text)'::regprocedure
        and (length(prosrc) - length(replace(prosrc, 'app_private.catalog_excluded_venues', '')))
            / length('app_private.catalog_excluded_venues') = 3) <> 1 then
    raise exception 'the Home feed should filter hidden venues in all three candidate queries';
  end if;
  if has_function_privilege('anon', 'public.catalog_raw_cursor(jsonb)', 'execute')
    or has_function_privilege('authenticated', 'public.catalog_raw_cursor_value(text)', 'execute') then
    raise exception 'cursor helpers should be service-role only';
  end if;
  if not has_table_privilege('authenticated', 'app_private.catalog_excluded_venues', 'select')
    or has_table_privilege('authenticated', 'app_private.catalog_excluded_venues', 'insert') then
    raise exception 'callers may read the hidden-venue list but not change it';
  end if;
end $$;

-- Signed-in reads still work after the cursor revoke (definer page RPCs call the helpers).
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'ec8f3702-bf39-4f40-a978-65e490c7c3bd', true);
set local role authenticated;

do $$
declare
  v_page jsonb;
begin
  v_page := public.catalog_raw_venues_page(p_lat => 1.2803, p_lng => 103.8448, p_radius_meters => 3000, p_sort => 'nearby', p_limit => 50);
  if exists (select 1 from jsonb_array_elements(v_page -> 'items') i where i ->> 'id' in ('smoke-0048-seven', 'smoke-0048-shell')) then
    raise exception 'venue page returned a hidden venue';
  end if;
  begin
    perform public.catalog_raw_venue_detail('smoke-0048-seven', null);
    raise exception 'venue detail returned a hidden venue';
  exception when others then
    if sqlerrm <> 'catalog venue not found' then
      raise;
    end if;
  end;
end $$;

rollback;
