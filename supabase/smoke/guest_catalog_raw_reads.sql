-- Smoke checks for 20261019210000_guest_catalog_raw_reads.sql.
-- A guest (anon key, no user) can call every read-only catalog_raw_* browse RPC.
-- A guest still cannot select the catalog base tables or call any write RPC.
-- Runs in a transaction and rolls back.

begin;

-- Use the active release when one exists; otherwise add a one-venue fixture.
do $$
declare
  v_release uuid;
  v_venue text;
  v_dish text;
begin
  select id into v_release from public.catalog_releases where status = 'active' limit 1;
  if v_release is null then
    insert into public.catalog_releases (status, activated_at, venue_total, dish_total)
    values ('active', now(), 1, 1)
    returning id into v_release;
    insert into public.catalog_raw_venue_cards (
      release_id, id, building_id, name, latitude, longitude, listing_location, verification_status
    ) values (
      v_release, 'guest-smoke-venue', 'guest-smoke-building', 'Guest Smoke Stall', 1.3, 103.8,
      st_setsrid(st_makepoint(103.8, 1.3), 4326)::geography, 'verified'
    );
    insert into public.catalog_raw_dish_cards (
      release_id, id, venue_id, building_id, name, venue_name, listing_location, verification_status
    ) values (
      v_release, 'guest-smoke-dish', 'guest-smoke-venue', 'guest-smoke-building', 'Guest Smoke Noodles',
      'Guest Smoke Stall', st_setsrid(st_makepoint(103.8, 1.3), 4326)::geography, 'verified'
    );
  end if;
  select id into v_venue from public.catalog_raw_venue_cards where release_id = v_release order by id limit 1;
  select id into v_dish from public.catalog_raw_dish_cards where release_id = v_release order by id limit 1;
  if v_venue is null or v_dish is null then
    raise exception 'Active catalog release has no venue or dish to read';
  end if;
  perform set_config('smoke.venue_id', v_venue, true);
  perform set_config('smoke.dish_id', v_dish, true);
end $$;

-- Act as a guest: anon role and anon JWT claims, no user id.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);

do $$
declare
  v_result jsonb;
  v_venue text := current_setting('smoke.venue_id');
  v_dish text := current_setting('smoke.dish_id');
begin
  if auth.uid() is not null then
    raise exception 'Guest smoke must run without a user id';
  end if;

  v_result := public.catalog_raw_map_view(1.0, 103.5, 1.6, 104.1, 15);
  if jsonb_typeof(v_result->'items') <> 'array' then
    raise exception 'Guest map_view should return items, got %', v_result;
  end if;

  v_result := public.catalog_raw_venues_page(p_limit => 1000);
  if jsonb_typeof(v_result->'items') <> 'array' or jsonb_array_length(v_result->'items') > 50 then
    raise exception 'Guest venues_page should return at most 50 items';
  end if;

  v_result := public.catalog_raw_dishes_page(p_limit => 1000);
  if jsonb_typeof(v_result->'items') <> 'array' or jsonb_array_length(v_result->'items') > 50 then
    raise exception 'Guest dishes_page should return at most 50 items';
  end if;

  v_result := public.catalog_raw_venue_menu_page(p_venue_id => v_venue, p_limit => 1000);
  if jsonb_typeof(v_result->'items') <> 'array' or jsonb_array_length(v_result->'items') > 50 then
    raise exception 'Guest venue_menu_page should return at most 50 items';
  end if;

  v_result := public.catalog_raw_venue_detail(v_venue);
  if v_result->>'id' is distinct from v_venue then
    raise exception 'Guest venue_detail should return the venue';
  end if;

  v_result := public.catalog_raw_dish_detail(v_dish);
  if v_result->>'id' is distinct from v_dish then
    raise exception 'Guest dish_detail should return the dish';
  end if;
end $$;

reset role;

-- Base tables and write/admin RPCs stay closed to guests.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'public.catalog_releases',
    'public.catalog_raw_venue_cards',
    'public.catalog_raw_dish_cards',
    'public.catalog_raw_dish_media'
  ] loop
    if has_table_privilege('anon', v_table, 'select')
      or has_table_privilege('anon', v_table, 'insert')
      or has_table_privilege('anon', v_table, 'update')
      or has_table_privilege('anon', v_table, 'delete') then
      raise exception 'anon should have no access to %', v_table;
    end if;
  end loop;

  if has_function_privilege('anon', 'public.catalog_raw_publish_release(integer, integer)', 'execute') then
    raise exception 'anon should not execute catalog_raw_publish_release';
  end if;
  if to_regprocedure('public.catalog_raw_refresh_venue(text)') is not null
    and has_function_privilege('anon', 'public.catalog_raw_refresh_venue(text)', 'execute') then
    raise exception 'anon should not execute catalog_raw_refresh_venue';
  end if;
  if has_function_privilege('anon', 'public.catalog_raw_require_authenticated()', 'execute')
    or has_function_privilege('anon', 'public.catalog_raw_release_for_read(uuid)', 'execute') then
    raise exception 'anon should not execute internal catalog helpers';
  end if;
end $$;

-- A direct select as anon fails at the privilege check.
set local role anon;
do $$
begin
  perform 1 from public.catalog_raw_venue_cards limit 1;
  raise exception 'anon select on catalog_raw_venue_cards should be denied';
exception
  when insufficient_privilege then null;
end $$;
do $$
begin
  perform public.catalog_raw_publish_release();
  raise exception 'anon catalog_raw_publish_release call should be denied';
exception
  when insufficient_privilege then null;
end $$;
reset role;

select 'guest_catalog_raw_reads_smoke_passed' as result;

rollback;
