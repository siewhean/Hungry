-- Smoke checks for 20261019140000_award_food_cred_server_points.sql.
-- A signed-in caller cannot choose the Food Cred amount, a repeat award for the
-- same entity on the same day earns 0, and mission rewards come from the
-- mission row only after it is completed. Runs in a transaction and rolls back.

begin;

-- Fixed ids for this smoke only.
--   user:    00000000-0000-0044-b000-000000000001
--   mission: smoke-award-food-cred-mission
insert into user_profiles (id, display_name)
values ('00000000-0000-0044-b000-000000000001', 'Food Cred Smoke User')
on conflict (id) do nothing;

insert into weekly_missions (
  id,
  title,
  description,
  mission_type,
  requirement_count,
  reward_type,
  reward_value,
  week_start,
  week_end,
  is_active
)
values (
  'smoke-award-food-cred-mission',
  'Smoke mission',
  'Smoke mission',
  'helpful_vote',
  1,
  'food_cred',
  20,
  current_date - 1,
  current_date + 1,
  false
);

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0044-b000-000000000001', true);
set local role authenticated;

do $$
declare
  v_awarded integer;
begin
  -- A client-supplied amount is ignored: stall_marked_tried pays its default 5.
  select points_awarded into v_awarded
  from public.award_food_cred('stall_marked_tried', 'smoke-stall', 'stall', 100000);
  if v_awarded <> 5 then
    raise exception 'Expected the default 5 points, got %', v_awarded;
  end if;

  -- Same stall again today earns nothing.
  select points_awarded into v_awarded
  from public.award_food_cred('stall_marked_tried', 'smoke-stall', 'stall', 100000);
  if v_awarded <> 0 then
    raise exception 'Expected 0 points for a repeat award on the same stall, got %', v_awarded;
  end if;

  -- A mission the caller has not completed pays nothing, whatever p_points says.
  select points_awarded into v_awarded
  from public.award_food_cred('mission_completed', 'smoke-award-food-cred-mission', 'mission', 9999);
  if v_awarded <> 0 then
    raise exception 'Expected 0 points for an uncompleted mission, got %', v_awarded;
  end if;
end $$;

reset role;

insert into user_mission_progress (user_id, mission_id, current_count, completed_at)
values (
  '00000000-0000-0044-b000-000000000001',
  'smoke-award-food-cred-mission',
  1,
  now()
);

set local role authenticated;

do $$
declare
  v_awarded integer;
  v_total integer;
begin
  -- A completed mission pays its own reward value, once.
  select points_awarded, total_points into v_awarded, v_total
  from public.award_food_cred('mission_completed', 'smoke-award-food-cred-mission', 'mission', 9999);
  if v_awarded <> 20 then
    raise exception 'Expected the mission reward of 20 points, got %', v_awarded;
  end if;
  if v_total <> 25 then
    raise exception 'Expected a total of 25 points, got %', v_total;
  end if;

  select points_awarded into v_awarded
  from public.award_food_cred('mission_completed', 'smoke-award-food-cred-mission', 'mission', 9999);
  if v_awarded <> 0 then
    raise exception 'Expected a completed mission to pay only once, got %', v_awarded;
  end if;
end $$;

reset role;

select 'award_food_cred_server_points_smoke_passed' as result;

rollback;
