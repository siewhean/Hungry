-- Smoke checks for set_dish_tried (H29, then 20261127090000_untick_reviewed_tried).
-- The Tried mark is saved on the caller's profile, a reviewed dish can be
-- un-ticked while its review stays, and guests cannot call it. Builds its own
-- building, stall and dishes; runs in a transaction and rolls back.

begin;

-- Fixed ids for this smoke only.
--   diner: 00000000-0000-0d29-b000-000000000001
--   other: 00000000-0000-0d29-b000-000000000002
insert into user_profiles (id, display_name, reviewed_dish_ids)
values
  ('00000000-0000-0d29-b000-000000000001', 'Tried Smoke', '{}'),
  ('00000000-0000-0d29-b000-000000000002', 'Tried Smoke Other', array['untouched-dish'])
on conflict (id) do nothing;

insert into buildings (id, name, building_type, latitude, longitude)
values ('smoke-tried-building', 'Smoke Tried Building', 'hawker_centre', 1.3404, 103.7090);
insert into venues (id, building_id, name, floor)
values ('smoke-tried-venue', 'smoke-tried-building', 'Smoke Tried Stall', '1');
insert into dishes (id, venue_id, building_id, name)
values
  ('smoke-tried-dish-1', 'smoke-tried-venue', 'smoke-tried-building', 'Smoke Tried Dish 1'),
  ('smoke-tried-dish-2', 'smoke-tried-venue', 'smoke-tried-building', 'Smoke Tried Dish 2');

select set_config('smoke.dish_id', 'smoke-tried-dish-1', true);
select set_config('smoke.dish_id_2', 'smoke-tried-dish-2', true);

do $$
begin
  if nullif(current_setting('smoke.dish_id_2', true), '') is null then
    raise exception 'Smoke needs at least two dish rows';
  end if;
  if has_function_privilege('anon', 'public.set_dish_tried(text, boolean)', 'execute') then
    raise exception 'anon must not execute set_dish_tried';
  end if;
  if (select p.prosecdef from pg_proc p
      where p.oid = 'public.set_dish_tried(text, boolean)'::regprocedure) then
    raise exception 'set_dish_tried must be security invoker';
  end if;
end $$;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0d29-b000-000000000001', true);
set local role authenticated;

do $$
declare
  v_ids text[];
begin
  v_ids := public.set_dish_tried(current_setting('smoke.dish_id'), true);
  -- A repeat tap does not duplicate it.
  v_ids := public.set_dish_tried(current_setting('smoke.dish_id'), true);
  if v_ids is distinct from array[current_setting('smoke.dish_id')] then
    raise exception 'Tried should add the dish once, got %', v_ids;
  end if;

  v_ids := public.set_dish_tried(current_setting('smoke.dish_id'), false);
  if cardinality(v_ids) <> 0 then
    raise exception 'Un-ticking an unreviewed dish should remove it, got %', v_ids;
  end if;

  -- A reviewed dish can be un-ticked; the review stays.
  insert into reviews (id, user_id, dish_id, rating, text)
  values (
    '00000000-0000-0d29-e000-000000000001',
    '00000000-0000-0d29-b000-000000000001',
    current_setting('smoke.dish_id_2'),
    4,
    'Solid'
  );
  v_ids := public.set_dish_tried(current_setting('smoke.dish_id_2'), true);
  if not (current_setting('smoke.dish_id_2') = any(v_ids)) then
    raise exception 'Tried should add the reviewed dish, got %', v_ids;
  end if;
  v_ids := public.set_dish_tried(current_setting('smoke.dish_id_2'), false);
  if current_setting('smoke.dish_id_2') = any(v_ids) then
    raise exception 'A reviewed dish should come off the Tried list, got %', v_ids;
  end if;
  if not exists (
    select 1 from reviews where id = '00000000-0000-0d29-e000-000000000001'
  ) then
    raise exception 'Un-ticking Tried must keep the review';
  end if;
  -- Leave it Tried for the saved-profile check below.
  v_ids := public.set_dish_tried(current_setting('smoke.dish_id_2'), true);
end $$;

reset role;

do $$
begin
  if (select reviewed_dish_ids from user_profiles
      where id = '00000000-0000-0d29-b000-000000000001')
    is distinct from array[current_setting('smoke.dish_id_2')] then
    raise exception 'The Tried list should be saved on the profile';
  end if;
  if (select reviewed_dish_ids from user_profiles
      where id = '00000000-0000-0d29-b000-000000000002')
    is distinct from array['untouched-dish'] then
    raise exception 'Another user''s Tried list must not change';
  end if;
end $$;

select 'set_dish_tried_smoke_passed' as result;

rollback;
