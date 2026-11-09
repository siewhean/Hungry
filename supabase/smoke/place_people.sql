-- Smoke checks for 20261109090000_place_people.sql.
-- 1. get_place_people lists who reviewed a stall's dish, followed people first, and leaves out
--    the caller, a blocked diner and a review hidden by moderation.
-- 2. The same people show for the dish, and asking for both or neither returns nothing.
-- 3. anon cannot run it, and it has a rate rule.
-- Runs in a transaction and rolls back. Uses an existing dish and its stall.
--   viewer:   00000000-0000-1109-a000-000000000001
--   followed: 00000000-0000-1109-a000-000000000002 (followed by the viewer)
--   other:    00000000-0000-1109-a000-000000000003 (two reviews)
--   blocked:  00000000-0000-1109-a000-000000000004 (blocked by the viewer)
--   hidden:   00000000-0000-1109-a000-000000000005 (review hidden by moderation)

begin;

insert into auth.users (id, email)
select ('00000000-0000-1109-a000-00000000000' || n)::uuid, 'place-people-smoke-' || n || '@example.test'
from generate_series(1, 5) as n
on conflict (id) do nothing;

insert into user_profiles (id, display_name, created_at)
values
  ('00000000-0000-1109-a000-000000000001', 'Place Viewer', now() - interval '30 days'),
  ('00000000-0000-1109-a000-000000000002', 'Place Followed', now() - interval '30 days'),
  ('00000000-0000-1109-a000-000000000003', 'Place Other', now() - interval '30 days'),
  ('00000000-0000-1109-a000-000000000004', 'Place Blocked', now() - interval '30 days'),
  ('00000000-0000-1109-a000-000000000005', 'Place Hidden', now() - interval '30 days')
on conflict (id) do nothing;

create temporary table smoke_place on commit drop as
select d.id as dish_id, d.venue_id
from dishes d
where d.venue_id is not null
order by d.id
limit 1;

insert into reviews (id, user_id, dish_id, venue_id, rating, text)
select x.id::uuid, x.user_id::uuid, sp.dish_id, sp.venue_id, 4, 'smoke'
from smoke_place sp,
  (values
    ('00000000-0000-1109-b000-000000000001', '00000000-0000-1109-a000-000000000001'),
    ('00000000-0000-1109-b000-000000000002', '00000000-0000-1109-a000-000000000002'),
    ('00000000-0000-1109-b000-000000000003', '00000000-0000-1109-a000-000000000003'),
    ('00000000-0000-1109-b000-000000000004', '00000000-0000-1109-a000-000000000004'),
    ('00000000-0000-1109-b000-000000000005', '00000000-0000-1109-a000-000000000005')
  ) as x(id, user_id);

-- A second review from "other", on the same stall with no dish venue filled in.
insert into reviews (id, user_id, dish_id, venue_id, rating, text)
select '00000000-0000-1109-b000-000000000006'::uuid, '00000000-0000-1109-a000-000000000003'::uuid,
  sp.dish_id, null, 5, 'smoke'
from smoke_place sp;

insert into review_moderation_states (review_id, state, reason_code)
values ('00000000-0000-1109-b000-000000000005', 'hidden', 'spam');

insert into follows (follower_id, followee_id, status, approved_at)
values ('00000000-0000-1109-a000-000000000001', '00000000-0000-1109-a000-000000000002', 'approved', now());

insert into user_blocks (blocker_id, blocked_user_key, reason)
values ('00000000-0000-1109-a000-000000000001', '00000000-0000-1109-a000-000000000004', 'smoke');

grant select on smoke_place to authenticated;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-1109-a000-000000000001', true);
set local role authenticated;

do $$
declare
  v_venue text := (select venue_id from smoke_place);
  v_dish text := (select dish_id from smoke_place);
  v_first record;
  v_ids uuid[];
  v_other record;
begin
  -- 1. The stall.
  select * into v_first from public.get_place_people(v_venue, null, 10) limit 1;
  if v_first.user_id is distinct from '00000000-0000-1109-a000-000000000002'::uuid
     or not v_first.is_followed then
    raise exception 'the person you follow comes first: %', row_to_json(v_first);
  end if;
  select array_agg(p.user_id) into v_ids from public.get_place_people(v_venue, null, 10) p;
  if not ('00000000-0000-1109-a000-000000000003'::uuid = any(v_ids)) then
    raise exception 'another reviewer is listed: %', v_ids;
  end if;
  if '00000000-0000-1109-a000-000000000001'::uuid = any(v_ids) then
    raise exception 'you are not listed among the people here';
  end if;
  if '00000000-0000-1109-a000-000000000004'::uuid = any(v_ids) then
    raise exception 'a blocked diner is not listed';
  end if;
  if '00000000-0000-1109-a000-000000000005'::uuid = any(v_ids) then
    raise exception 'a hidden review does not list its author';
  end if;
  select * into v_other from public.get_place_people(v_venue, null, 10) p
    where p.user_id = '00000000-0000-1109-a000-000000000003';
  if v_other.contributions <> 2 or v_other.total_people < 2 then
    raise exception 'other has two reviews here: %', row_to_json(v_other);
  end if;

  -- 2. The dish, the limit, and the wrong shapes.
  select array_agg(p.user_id) into v_ids from public.get_place_people(null, v_dish, 10) p;
  if not ('00000000-0000-1109-a000-000000000002'::uuid = any(v_ids))
     or not ('00000000-0000-1109-a000-000000000003'::uuid = any(v_ids)) then
    raise exception 'the dish lists its reviewers: %', v_ids;
  end if;
  if (select count(*) from public.get_place_people(v_venue, null, 1)) <> 1 then
    raise exception 'p_limit 1 returns one person';
  end if;
  if exists (select 1 from public.get_place_people(v_venue, v_dish, 5))
     or exists (select 1 from public.get_place_people(null, null, 5)) then
    raise exception 'both or neither place returns nothing';
  end if;
end;
$$;

-- 3. anon and the rate rule.
reset role;
set local role anon;
do $$
begin
  begin
    perform * from public.get_place_people('x', null, 5);
    raise exception 'anon must not run get_place_people';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

do $$
begin
  if not exists (select 1 from app_private.request_rate_rules where route = 'rpc/get_place_people') then
    raise exception 'get_place_people needs a rate rule';
  end if;
end;
$$;

rollback;
