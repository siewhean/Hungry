-- Smoke checks for 20261028180000_stall_visit_points_need_review.sql.
-- A visit pays 5 Food Cred only after the diner has a review at that stall, and only once per
-- stall, ever. A client that asks without a review earns 0. Runs in a transaction and rolls
-- back. Brings its own building, stall and dish, so it runs on prod (no seed data) as well as
-- staging.
--   user: 00000000-0000-0049-b000-000000000001

begin;

insert into buildings (id, name, building_type, latitude, longitude)
values ('smoke-visit-building', 'Smoke Visit Building', 'hawker_centre', 1.2803, 103.8448);

insert into venues (id, building_id, name, floor)
values
  ('smoke-visit-stall', 'smoke-visit-building', 'Smoke Visit Stall', '1'),
  ('smoke-visit-other', 'smoke-visit-building', 'Smoke Visit Other', '1');

insert into dishes (id, venue_id, building_id, name, price)
values ('smoke-visit-dish', 'smoke-visit-stall', 'smoke-visit-building', 'Smoke Visit Dish', 3.5);

insert into user_profiles (id, display_name)
values ('00000000-0000-0049-b000-000000000001', 'Visit Gate Smoke User')
on conflict (id) do nothing;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0049-b000-000000000001', true);
set local role authenticated;

do $$
declare
  v_awarded integer;
begin
  -- No review yet: asking for the visit points pays nothing.
  select points_awarded into v_awarded
  from public.award_food_cred('stall_marked_tried', 'smoke-visit-stall', 'stall', null);
  if v_awarded <> 0 then
    raise exception 'A visit without a review should pay 0, got %', v_awarded;
  end if;

  -- A client-supplied amount does not help either.
  select points_awarded into v_awarded
  from public.award_food_cred('stall_marked_tried', 'smoke-visit-stall', 'stall', 100000);
  if v_awarded <> 0 then
    raise exception 'A visit without a review should pay 0 whatever p_points says, got %', v_awarded;
  end if;
end $$;

reset role;

insert into reviews (user_id, dish_id, venue_id, rating, text)
values (
  '00000000-0000-0049-b000-000000000001',
  'smoke-visit-dish',
  'smoke-visit-stall',
  5,
  'Smoke review'
);

set local role authenticated;

do $$
declare
  v_awarded integer;
begin
  -- With a review at the stall the visit pays its 5 points...
  select points_awarded into v_awarded
  from public.award_food_cred('stall_marked_tried', 'smoke-visit-stall', 'stall', null);
  if v_awarded <> 5 then
    raise exception 'A visit after a review should pay 5, got %', v_awarded;
  end if;

  -- ...once. A second ask for the same stall pays nothing.
  select points_awarded into v_awarded
  from public.award_food_cred('stall_marked_tried', 'smoke-visit-stall', 'stall', null);
  if v_awarded <> 0 then
    raise exception 'A second visit award for the same stall should pay 0, got %', v_awarded;
  end if;

  -- A stall the diner has not reviewed still pays nothing.
  select points_awarded into v_awarded
  from public.award_food_cred('stall_marked_tried', 'smoke-visit-other', 'stall', null);
  if v_awarded <> 0 then
    raise exception 'A visit to an unreviewed stall should pay 0, got %', v_awarded;
  end if;
end $$;

reset role;

select 'stall_visit_points_need_review_smoke_passed' as result;

rollback;
