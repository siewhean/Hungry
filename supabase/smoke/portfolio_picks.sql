-- Smoke checks for 20261111090000_portfolio_picks.sql.
-- 1. set_portfolio_pick makes a dish the best of its dish type (a second dish of that type
--    replaces it), puts dishes in the top three and moves one within it, and refuses a private
--    entry and another person's post.
-- 2. set_post_visibility to "Only me" drops the entry's picks and voids its board points; back to
--    public credits it again. A post published as private earns nothing.
-- 3. get_portfolio_diary shows private entries only to their owner; get_portfolio_picks returns
--    the top three first, then the bests.
-- 4. get_review_portfolio_labels labels a review with its dish's best and top three place, only
--    when the author has 5 public dishes.
-- 5. Moderation hiding a post drops its picks.
-- 6. anon cannot run the RPCs, nobody writes the table directly, and each RPC has a rate rule.
-- Runs in a transaction and rolls back.
--   viewer:   00000000-0000-1111-b000-000000000001
--   author:   00000000-0000-1111-b000-000000000002
--   stranger: 00000000-0000-1111-b000-000000000003

begin;

insert into auth.users (id, email)
values
  ('00000000-0000-1111-b000-000000000001', 'portfolio-picks-smoke-1@example.test'),
  ('00000000-0000-1111-b000-000000000002', 'portfolio-picks-smoke-2@example.test'),
  ('00000000-0000-1111-b000-000000000003', 'portfolio-picks-smoke-3@example.test')
on conflict (id) do nothing;

insert into user_profiles (id, display_name)
values
  ('00000000-0000-1111-b000-000000000001', 'Picks Viewer'),
  ('00000000-0000-1111-b000-000000000002', 'Picks Author'),
  ('00000000-0000-1111-b000-000000000003', 'Picks Stranger')
on conflict (id) do nothing;

-- Six dishes, each posted at its own stall. The smoke gives them its own dish types (rolled back
-- with everything else): dishes 1 and 2 share one, dishes 3 to 6 each have another.
create temp table smoke_dishes on commit drop as
select d.id, d.venue_id, row_number() over (order by d.id) as n, null::text as food_type
from (select d.id, d.venue_id from dishes d where d.venue_id is not null order by d.id limit 6) d;

update smoke_dishes
set food_type = case when n <= 2 then 'Smoke picks shared' else 'Smoke picks ' || n end;

do $$
begin
  if (select count(*) from smoke_dishes) < 6 then
    raise exception 'smoke needs six dishes with a stall in the catalog';
  end if;
end $$;

update dishes d set food_type = sd.food_type from smoke_dishes sd where sd.id = d.id;

-- Author: p1..p6 public (dishes 1-6), p7 published as "Only me" (dish 1). Stranger: p8 (dish 1).
insert into posts (id, author_id, status, visibility, caption, published_at, venue_id, dish_id)
select
  ('00000000-0000-1111-c000-00000000000' || d.n)::uuid,
  '00000000-0000-1111-b000-000000000002',
  'published', 'public', 'p' || d.n, now() - (d.n || ' hours')::interval, d.venue_id, d.id
from smoke_dishes d;

insert into posts (id, author_id, status, visibility, caption, published_at, venue_id, dish_id)
select '00000000-0000-1111-c000-000000000007', '00000000-0000-1111-b000-000000000002',
  'published', 'private', 'p7 only me', now(), d.venue_id, d.id
from smoke_dishes d where d.n = 1;

insert into posts (id, author_id, status, visibility, caption, published_at, venue_id, dish_id)
select '00000000-0000-1111-c000-000000000008', '00000000-0000-1111-b000-000000000003',
  'published', 'public', 'p8 stranger', now(), d.venue_id, d.id
from smoke_dishes d where d.n = 1;

do $$
begin
  if exists (select 1 from leaderboard_events where post_id = '00000000-0000-1111-c000-000000000007') then
    raise exception 'a post published as Only me must earn no board points';
  end if;
  if not exists (
    select 1 from leaderboard_events
    where post_id = '00000000-0000-1111-c000-000000000003' and voided_at is null
  ) then
    raise exception 'a public post must earn board points';
  end if;
end $$;

-- Reviews by the author of dish 2 and dish 1, and by the stranger of dish 1.
insert into reviews (id, user_id, dish_id, venue_id, rating, text)
select '00000000-0000-1111-d000-000000000001', '00000000-0000-1111-b000-000000000002', d.id,
  d.venue_id, 5, 'author dish 2' from smoke_dishes d where d.n = 2;
insert into reviews (id, user_id, dish_id, venue_id, rating, text)
select '00000000-0000-1111-d000-000000000002', '00000000-0000-1111-b000-000000000002', d.id,
  d.venue_id, 4, 'author dish 1' from smoke_dishes d where d.n = 1;
insert into reviews (id, user_id, dish_id, venue_id, rating, text)
select '00000000-0000-1111-d000-000000000003', '00000000-0000-1111-b000-000000000003', d.id,
  d.venue_id, 5, 'stranger dish 1' from smoke_dishes d where d.n = 1;

select set_config('smoke.type', (select food_type from smoke_dishes where n = 1), true);

-- 1 and 2 as the author.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-1111-b000-000000000002', true);
set local role authenticated;

do $$
declare
  v_result jsonb;
  v_type text := current_setting('smoke.type');
  v_overall text;
  v_diary integer;
begin
  v_result := public.set_portfolio_pick('00000000-0000-1111-c000-000000000001', 'dish_type');
  if v_result ->> 'slot' is distinct from left(v_type, 80) or v_result ->> 'replaced_post_id' is not null then
    raise exception 'first best was %, expected slot % with nothing replaced', v_result, v_type;
  end if;
  v_result := public.set_portfolio_pick('00000000-0000-1111-c000-000000000002', 'dish_type');
  if v_result ->> 'replaced_post_id' is distinct from '00000000-0000-1111-c000-000000000001' then
    raise exception 'a second dish of the same type must replace the first, got %', v_result;
  end if;

  -- Top three: p1 first, p3 second, then p1 moves to third.
  perform public.set_portfolio_pick('00000000-0000-1111-c000-000000000001', 'overall', 1);
  perform public.set_portfolio_pick('00000000-0000-1111-c000-000000000003', 'overall', 2);
  perform public.set_portfolio_pick('00000000-0000-1111-c000-000000000001', 'overall', 3);
  select string_agg(slot || ':' || right(post_id::text, 1), ',' order by slot) into v_overall
  from portfolio_picks
  where user_id = '00000000-0000-1111-b000-000000000002' and kind = 'overall';
  if v_overall is distinct from '2:3,3:1' then
    raise exception 'top three was %, expected 2:3,3:1', v_overall;
  end if;

  begin
    perform public.set_portfolio_pick('00000000-0000-1111-c000-000000000007', 'dish_type');
    raise exception 'an Only me entry must not become a best';
  exception when sqlstate '22023' then
    null;
  end;
  begin
    perform public.set_portfolio_pick('00000000-0000-1111-c000-000000000008', 'overall', 1);
    raise exception 'another person''s post must be refused';
  exception when sqlstate '42501' then
    null;
  end;
  begin
    perform public.set_portfolio_pick('00000000-0000-1111-c000-000000000004', 'overall', 4);
    raise exception 'a fourth top place must be refused';
  exception when sqlstate '22023' then
    null;
  end;
  begin
    perform public.set_post_visibility('00000000-0000-1111-c000-000000000008', 'private');
    raise exception 'another person''s post visibility must be refused';
  exception when sqlstate '42501' then
    null;
  end;

  -- p3 goes Only me: its top three place goes, its points are voided.
  if public.set_post_visibility('00000000-0000-1111-c000-000000000003', 'private') <> 'private' then
    raise exception 'set_post_visibility must return the new visibility';
  end if;
  if exists (select 1 from portfolio_picks where post_id = '00000000-0000-1111-c000-000000000003') then
    raise exception 'an Only me entry must lose its picks';
  end if;

  select count(*) into v_diary
  from public.get_portfolio_diary('00000000-0000-1111-b000-000000000002');
  if v_diary <> 7 then
    raise exception 'the owner''s diary had % entries, expected 7 (private ones included)', v_diary;
  end if;
end $$;

reset role;

do $$
begin
  if exists (
    select 1 from leaderboard_events
    where post_id = '00000000-0000-1111-c000-000000000003' and voided_at is null
  ) or not exists (
    select 1 from leaderboard_events
    where post_id = '00000000-0000-1111-c000-000000000003' and void_reason = 'post_private'
  ) then
    raise exception 'an entry going Only me must have its points voided as post_private';
  end if;
end $$;

-- p3 back to public earns its points again (but does not get its pick back).
set local role authenticated;
select public.set_post_visibility('00000000-0000-1111-c000-000000000003', 'public');
reset role;

do $$
begin
  if not exists (
    select 1 from leaderboard_events
    where post_id = '00000000-0000-1111-c000-000000000003' and voided_at is null
  ) then
    raise exception 'an entry made public again must be credited again';
  end if;
end $$;

-- 3 and 4 as the viewer.
select set_config('request.jwt.claim.sub', '00000000-0000-1111-b000-000000000001', true);
set local role authenticated;

do $$
declare
  v_diary integer;
  v_picks text;
  v_labels text;
begin
  select count(*) into v_diary
  from public.get_portfolio_diary('00000000-0000-1111-b000-000000000002') d
  where d.visibility = 'private';
  if v_diary <> 0 then
    raise exception 'another diner must not see Only me entries';
  end if;
  select count(*) into v_diary
  from public.get_portfolio_diary('00000000-0000-1111-b000-000000000002', 2);
  if v_diary <> 2 then
    raise exception 'the diary must honour its page size';
  end if;

  select string_agg(p.kind || ':' || right(p.id::text, 1), ',') into v_picks
  from public.get_portfolio_picks('00000000-0000-1111-b000-000000000002') p;
  if v_picks is distinct from 'overall:1,dish_type:2' then
    raise exception 'picks were %, expected overall:1,dish_type:2', v_picks;
  end if;

  select string_agg(
    right(l.review_id::text, 1) || ':' || coalesce(l.food_type, '-') || ':'
      || coalesce(l.overall_place::text, '-') || ':' || l.dish_count,
    ',' order by l.review_id
  ) into v_labels
  from public.get_review_portfolio_labels(array[
    '00000000-0000-1111-d000-000000000001',
    '00000000-0000-1111-d000-000000000002',
    '00000000-0000-1111-d000-000000000003'
  ]::uuid[]) l;
  -- Review 1: dish 2 is the best of its type. Review 2: dish 1 is third in the top three.
  -- Review 3: the stranger has no picks and one dish.
  if v_labels is distinct from
    '1:' || current_setting('smoke.type') || ':-:6,2:-:3:6' then
    raise exception 'labels were %', v_labels;
  end if;
end $$;

reset role;

-- 5. Hiding p2 drops its pick.
insert into post_moderation_states (post_id, state)
values ('00000000-0000-1111-c000-000000000002', 'hidden')
on conflict (post_id) do update set state = excluded.state;

do $$
begin
  if exists (select 1 from portfolio_picks where post_id = '00000000-0000-1111-c000-000000000002') then
    raise exception 'a hidden post must lose its picks';
  end if;
end $$;

-- 6. Grants and rate rules.
do $$
begin
  if has_function_privilege('anon', 'public.set_portfolio_pick(uuid, text, integer)', 'execute')
    or has_function_privilege('anon', 'public.remove_portfolio_pick(uuid, text)', 'execute')
    or has_function_privilege('anon', 'public.set_post_visibility(uuid, text)', 'execute')
    or has_function_privilege('anon', 'public.get_portfolio_picks(uuid)', 'execute')
    or has_function_privilege('anon', 'public.get_portfolio_diary(uuid, integer, timestamptz, uuid)', 'execute')
    or has_function_privilege('anon', 'public.get_review_portfolio_labels(uuid[])', 'execute') then
    raise exception 'anon must not execute the portfolio picks RPCs';
  end if;
  if has_table_privilege('authenticated', 'public.portfolio_picks', 'insert')
    or has_table_privilege('authenticated', 'public.portfolio_picks', 'update')
    or has_table_privilege('authenticated', 'public.portfolio_picks', 'delete') then
    raise exception 'picks are written only through the RPCs';
  end if;
  if (select count(*) from app_private.request_rate_rules where route in (
    'rpc/set_portfolio_pick', 'rpc/remove_portfolio_pick', 'rpc/set_post_visibility',
    'rpc/get_portfolio_picks', 'rpc/get_portfolio_diary', 'rpc/get_review_portfolio_labels'
  )) <> 6 then
    raise exception 'each portfolio picks RPC needs a rate rule';
  end if;
end $$;

rollback;
