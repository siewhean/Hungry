-- Smoke checks for 20261022020000_profile_max_dish_budget.sql.
-- The owner can save a budget and clear it, and a zero, negative or absurd budget is rejected.
-- Reuses an existing profile. Runs in a transaction and rolls back.

begin;

select set_config(
  'smoke.budget_owner',
  (select id::text from public.user_profiles order by created_at nulls last limit 1),
  true
);

do $$
begin
  if nullif(current_setting('smoke.budget_owner', true), '') is null then
    raise exception 'profile_max_dish_budget smoke needs at least one existing user_profiles row';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('smoke.budget_owner'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);

update public.user_profiles
set max_dish_budget = 6
where id = current_setting('smoke.budget_owner')::uuid;

do $$
begin
  if (
    select max_dish_budget from public.user_profiles where id = current_setting('smoke.budget_owner')::uuid
  ) is distinct from 6 then
    raise exception 'Owner should be able to save a budget of 6';
  end if;

  begin
    update public.user_profiles set max_dish_budget = 0
    where id = current_setting('smoke.budget_owner')::uuid;
    raise exception 'A zero budget should be rejected';
  exception when check_violation then
    null;
  end;

  begin
    update public.user_profiles set max_dish_budget = 5000
    where id = current_setting('smoke.budget_owner')::uuid;
    raise exception 'A budget over 1000 should be rejected';
  exception when check_violation then
    null;
  end;
end $$;

-- "Any price" clears it.
update public.user_profiles
set max_dish_budget = null
where id = current_setting('smoke.budget_owner')::uuid;

do $$
begin
  if (
    select max_dish_budget from public.user_profiles where id = current_setting('smoke.budget_owner')::uuid
  ) is not null then
    raise exception 'Owner should be able to clear the budget';
  end if;
end $$;

reset role;
rollback;
