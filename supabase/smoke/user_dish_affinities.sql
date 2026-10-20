-- Smoke checks for 20261020080000_user_dish_affinities.sql.
-- Signals land in user_dish_affinities with 90-day decay, the table is
-- read/delete-own only, and apply_affinity_event is not callable by clients.
-- The replay below matches the "server parity" case in src/lib/ai/foodHistory.test.ts.
-- Runs in a transaction and rolls back.

begin;

insert into user_profiles (id, display_name)
values
  ('00000000-0000-0045-b000-000000000001', 'Affinity Owner'),
  ('00000000-0000-0045-b000-000000000002', 'Affinity Other')
on conflict (id) do nothing;

create temp table smoke_dish on commit drop as
select id from dishes order by id limit 1;
grant select on smoke_dish to authenticated;

-- Favourite at T (+3), dish_like at T+90d (+2), dismissed at T+90d (-4).
insert into user_favourite_dishes (user_id, dish_id, created_at)
select '00000000-0000-0045-b000-000000000001', id, '2026-01-01T00:00:00Z' from smoke_dish;
insert into taste_interaction_events (user_id, type, surface, dish_id, applied, created_at)
select '00000000-0000-0045-b000-000000000001', 'dish_like', 'smoke', id, true, '2026-04-01T00:00:00Z' from smoke_dish;
insert into taste_interaction_events (user_id, type, surface, dish_id, applied, created_at)
select '00000000-0000-0045-b000-000000000001', 'dismissed', 'smoke', id, true, '2026-04-01T00:00:00Z' from smoke_dish;
insert into user_favourite_dishes (user_id, dish_id)
select '00000000-0000-0045-b000-000000000002', id from smoke_dish;

do $$
declare
  v_row public.user_dish_affinities;
begin
  select a.* into v_row from public.user_dish_affinities a join smoke_dish d on d.id = a.dish_id
  where a.user_id = '00000000-0000-0045-b000-000000000001';
  if v_row is null then raise exception 'no affinity row written'; end if;
  if abs(v_row.evidence - (-0.5)) > 0.001 then raise exception 'evidence % <> -0.5', v_row.evidence; end if;
  if abs(v_row.abs_evidence - 7.5) > 0.001 then raise exception 'abs_evidence % <> 7.5', v_row.abs_evidence; end if;
  if v_row.evidence_count <> 3 then raise exception 'evidence_count % <> 3', v_row.evidence_count; end if;
  if v_row.dismissed_until <> '2026-05-01T00:00:00Z'::timestamptz then
    raise exception 'dismissed_until % <> 2026-05-01', v_row.dismissed_until;
  end if;
end $$;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0045-b000-000000000001', true);
set local role authenticated;

do $$
begin
  if (select count(*) from public.get_my_food_history(50)) <> 1 then
    raise exception 'get_my_food_history should return only the caller''s row';
  end if;
  if (select count(*) from public.user_dish_affinities) <> 1 then
    raise exception 'RLS should hide other users'' rows';
  end if;
end $$;

do $$
begin
  perform public.apply_affinity_event('00000000-0000-0045-b000-000000000001', 'x', 5);
  raise exception 'apply_affinity_event must not be callable by authenticated';
exception
  when insufficient_privilege then null;
end $$;

do $$
begin
  insert into public.user_dish_affinities (user_id, dish_id, evidence)
  select '00000000-0000-0045-b000-000000000001', id, 10 from smoke_dish;
  raise exception 'clients must not insert affinities';
exception
  when insufficient_privilege then null;
end $$;

-- "Reset food history": delete-own works and leaves other users alone.
delete from public.user_dish_affinities;
do $$
begin
  if (select count(*) from public.get_my_food_history(50)) <> 0 then
    raise exception 'reset should clear the caller''s history';
  end if;
end $$;

reset role;
do $$
begin
  if (select count(*) from public.user_dish_affinities where user_id = '00000000-0000-0045-b000-000000000002') <> 1 then
    raise exception 'reset must not touch other users';
  end if;
end $$;

rollback;
