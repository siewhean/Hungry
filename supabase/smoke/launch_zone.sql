-- Smoke checks for 20261116130000_launch_zone.sql.
-- 1. Stalls in buildings named by the street addresses of the three launch zone places (and in the
--    split Pioneer Mall rows) end up in one building per place, with the place's real name and type,
--    and the dish follows its stall.
-- 2. Running the fix again moves nothing.
-- 3. The zone list lists the three places for a signed-in caller, and not for anon.
-- 4. The report runs and its total row is the sum of the places.
-- Runs in a transaction and rolls back. Brings its own buildings, so it runs on prod too (where the
-- real zone rows may or may not exist: the checks hold either way).

begin;

insert into buildings (id, slug, name, building_type, latitude, longitude, floors)
values
  ('smoke-lz-hawker', 'smoke-lz-hawker', '50 Jurong West Street 61', 'other', 1.5401, 103.8401, array['01']),
  ('smoke-lz-pm-a', 'smoke-lz-pm-a', 'Pioneer Mall', 'mall', 1.5402, 103.8401, array['01']),
  ('smoke-lz-pm-b', 'smoke-lz-pm-b', '638A Jurong West Street 61', 'other', 1.5403, 103.8401, array['01']),
  ('smoke-lz-651', 'smoke-lz-651', '651 Jurong West Street 61', 'other', 1.5404, 103.8401, array['01']);

insert into venues (id, building_id, name, unit_number, floor, latitude, longitude)
values
  ('smoke-lz-v-hawker', 'smoke-lz-hawker', 'Smoke LZ Hawker Stall', '#01-01', '01', 1.5401, 103.8401),
  ('smoke-lz-v-pm-a', 'smoke-lz-pm-a', 'Smoke LZ Mall Stall A', '#01-01', '01', 1.5402, 103.8401),
  ('smoke-lz-v-pm-b1', 'smoke-lz-pm-b', 'Smoke LZ Mall Stall B1', '#02-01', '02', 1.5403, 103.8401),
  ('smoke-lz-v-pm-b2', 'smoke-lz-pm-b', 'Smoke LZ Mall Stall B2', '#02-02', '02', 1.5403, 103.8401),
  ('smoke-lz-v-651', 'smoke-lz-651', 'Smoke LZ 651 Stall', '#01-01', '01', 1.5404, 103.8401);

insert into dishes (
  id, venue_id, building_id, name, price,
  menu_approved_for_display, menu_rights_status, media_approved_for_display, media_rights_status
)
values
  ('smoke-lz-dish', 'smoke-lz-v-pm-a', 'smoke-lz-pm-a', 'Smoke LZ Noodles', 5,
   true, 'merchant_owned', false, 'unverified');

do $$
declare
  v_first jsonb;
  v_second jsonb;
  v_building text;
  v_name text;
  v_type text;
  v_b1 text;
  v_b2 text;
  v_dish_building text;
  v_slug text;
begin
  v_first := app_private.apply_launch_zone();
  if (v_first->>'places')::integer <> 3 then
    raise exception 'launch zone smoke: expected 3 places, got %', v_first;
  end if;

  -- 1. One building per place, with its real name.
  select b.id, b.name, b.building_type into v_building, v_name, v_type
  from venues v join buildings b on b.id = v.building_id where v.id = 'smoke-lz-v-hawker';
  if v_name <> 'Jurong West Hawker Centre' or v_type <> 'hawker_centre' then
    raise exception 'hawker stall is in "%" (%), expected Jurong West Hawker Centre (hawker_centre)', v_name, v_type;
  end if;
  select slug into v_slug from launch_zone_places where building_id = v_building;
  if v_slug is distinct from 'jurong-west-hawker-centre' then
    raise exception 'the hawker centre is not on the zone list (slug %)', v_slug;
  end if;

  select v.building_id into v_b1 from venues v where v.id = 'smoke-lz-v-pm-a';
  select v.building_id into v_b2 from venues v where v.id = 'smoke-lz-v-pm-b1';
  if v_b1 <> v_b2 or (select building_id from venues where id = 'smoke-lz-v-pm-b2') <> v_b1 then
    raise exception 'the two Pioneer Mall rows were not merged';
  end if;
  select name into v_name from buildings where id = v_b1;
  if v_name <> 'Pioneer Mall' then
    raise exception 'Pioneer Mall is named "%"', v_name;
  end if;
  select building_id into v_dish_building from dishes where id = 'smoke-lz-dish';
  if v_dish_building <> v_b1 then
    raise exception 'the dish did not follow its stall to Pioneer Mall (it is in %)', v_dish_building;
  end if;

  select b.name into v_name from venues v join buildings b on b.id = v.building_id where v.id = 'smoke-lz-v-651';
  if v_name <> 'Block 651' then
    raise exception 'block 651 is named "%"', v_name;
  end if;

  -- 2. A second run changes nothing.
  v_second := app_private.apply_launch_zone();
  if (v_second->>'rows_moved')::integer <> 0 or (v_second->>'renamed')::integer <> 0 then
    raise exception 'running the launch zone fix again changed something: %', v_second;
  end if;
end;
$$;

-- 3. The zone list. Needs a signed-in caller, as the catalogue reads do.
do $$
declare
  v_anon_blocked boolean := false;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-1116-a000-000000000001', true);
  set local role anon;
  begin
    perform public.get_launch_zone_places();
  exception when insufficient_privilege then
    v_anon_blocked := true;
  end;
  reset role;
  if not v_anon_blocked then
    raise exception 'anon can read the launch zone list';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-1116-a000-000000000001', true);
set local role authenticated;

do $$
declare
  v_places jsonb := public.get_launch_zone_places();
begin
  if jsonb_array_length(v_places) <> 3 then
    raise exception 'the zone list has % places, expected 3', jsonb_array_length(v_places);
  end if;
  if v_places->0->>'slug' <> 'jurong-west-hawker-centre'
     or v_places->1->>'slug' <> 'pioneer-mall'
     or v_places->2->>'slug' <> 'block-651' then
    raise exception 'the zone list is out of order: %', v_places;
  end if;
  if v_places->0->>'name' <> 'Jurong West Hawker Centre' then
    raise exception 'the zone list names the hawker centre "%"', v_places->0->>'name';
  end if;
end;
$$;

reset role;

-- 4. The report. Runs for the owner role only; its total row is the sum of the places.
do $$
declare
  v_total record;
  v_sum record;
begin
  select * into v_total from app_private.launch_zone_report() where place = 'total';
  select coalesce(sum(stalls), 0) as stalls, coalesce(sum(dishes), 0) as dishes,
         coalesce(sum(priced_dishes), 0) as priced_dishes
    into v_sum
  from app_private.launch_zone_report() where place <> 'total';
  if v_total.stalls <> v_sum.stalls or v_total.dishes <> v_sum.dishes or v_total.priced_dishes <> v_sum.priced_dishes then
    raise exception 'the report total does not add up: %', v_total;
  end if;
  if v_total.stalls < 5 or v_total.priced_dishes < 1 then
    raise exception 'the report misses the smoke stalls or the priced dish: %', v_total;
  end if;
end;
$$;

rollback;
