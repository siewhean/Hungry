-- Smoke checks for 20261021131000_profile_public_counters.sql.
-- Reviewing a dish and marking a stall tried update dishes_reviewed and
-- stalls_visited on user_profiles and public_profiles; deleting the review
-- lowers them again; the owner cannot PATCH the counters. Rolls back.

begin;

-- Fixed ids for this smoke only.
--   reviewer: 00000000-0000-0062-b000-000000000001
--   review:   00000000-0000-0062-e000-000000000001
insert into user_profiles (id, display_name)
values ('00000000-0000-0062-b000-000000000001', 'Counter Reviewer')
on conflict (id) do nothing;

select set_config(
  'smoke.dish_id',
  (select d.id from dishes d where d.venue_id is not null order by d.id limit 1),
  true
);
select set_config(
  'smoke.venue_id',
  (select d.venue_id from dishes d where d.id = current_setting('smoke.dish_id')),
  true
);
select set_config(
  'smoke.other_venue_id',
  (
    select v.id
    from venues v
    where v.id <> current_setting('smoke.venue_id')
    order by v.id
    limit 1
  ),
  true
);

do $$
begin
  if nullif(current_setting('smoke.dish_id', true), '') is null
    or nullif(current_setting('smoke.other_venue_id', true), '') is null then
    raise exception 'Smoke needs a dish with a venue and a second venue';
  end if;
end $$;

-- Marking a stall tried goes through an RPC in the app; insert it directly here.
insert into user_stall_interactions (user_id, stall_id, is_tried, tried_at)
values (
  '00000000-0000-0062-b000-000000000001',
  current_setting('smoke.other_venue_id'),
  true,
  now()
);

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0062-b000-000000000001', true);
set local role authenticated;

insert into reviews (id, user_id, dish_id, venue_id, author_name, rating, text)
values (
  '00000000-0000-0062-e000-000000000001',
  '00000000-0000-0062-b000-000000000001',
  current_setting('smoke.dish_id'),
  current_setting('smoke.venue_id'),
  'Counter Reviewer',
  5,
  'Counter smoke review'
);

-- The owner tries to inflate their own counters.
update user_profiles
set dishes_reviewed = 999, stalls_visited = 999
where id = '00000000-0000-0062-b000-000000000001';

reset role;

do $$
declare
  v_dishes integer;
  v_stalls integer;
  v_public_dishes integer;
  v_public_stalls integer;
begin
  select up.dishes_reviewed, up.stalls_visited, pp.dishes_reviewed, pp.stalls_visited
  into v_dishes, v_stalls, v_public_dishes, v_public_stalls
  from user_profiles up
  join public_profiles pp on pp.id = up.id
  where up.id = '00000000-0000-0062-b000-000000000001';

  if v_dishes is distinct from 1 or v_stalls is distinct from 2 then
    raise exception 'Expected 1 dish reviewed and 2 stalls visited (got %, %)', v_dishes, v_stalls;
  end if;
  if v_public_dishes is distinct from 1 or v_public_stalls is distinct from 2 then
    raise exception 'public_profiles should copy the counters (got %, %)',
      v_public_dishes, v_public_stalls;
  end if;
end $$;

set local role authenticated;
delete from reviews where id = '00000000-0000-0062-e000-000000000001';
reset role;

do $$
declare
  v_dishes integer;
  v_stalls integer;
begin
  select up.dishes_reviewed, up.stalls_visited
  into v_dishes, v_stalls
  from user_profiles up
  where up.id = '00000000-0000-0062-b000-000000000001';

  if v_dishes is distinct from 0 or v_stalls is distinct from 1 then
    raise exception 'Deleting the review should leave 0 dishes and 1 stall (got %, %)',
      v_dishes, v_stalls;
  end if;
end $$;

rollback;
