-- Smoke checks for 20261109150000_portfolio_ranking.sql.
-- 1. rank_portfolio_post puts a post at a place, moves it when already ranked, sends a place past
--    the end to last, and refuses another person's post.
-- 2. set_pinned_posts sets the top three and keeps the dishes ranked below it; get_my_portfolio_ranking
--    returns the whole ranking.
-- 3. get_review_portfolio_ranks returns a review only when its dish is in the author's top three
--    AND the author has at least 5 dishes; a dish ranked fourth or lower gets no label.
-- 4. anon cannot run either RPC, and each has a rate rule.
-- Runs in a transaction and rolls back.
--   viewer: 00000000-0000-1109-b000-000000000001
--   author: 00000000-0000-1109-b000-000000000002
--   small:  00000000-0000-1109-b000-000000000003 (only 2 dishes)

begin;

insert into auth.users (id, email)
values
  ('00000000-0000-1109-b000-000000000001', 'portfolio-ranking-smoke-1@example.test'),
  ('00000000-0000-1109-b000-000000000002', 'portfolio-ranking-smoke-2@example.test'),
  ('00000000-0000-1109-b000-000000000003', 'portfolio-ranking-smoke-3@example.test')
on conflict (id) do nothing;

insert into user_profiles (id, display_name)
values
  ('00000000-0000-1109-b000-000000000001', 'Ranking Viewer'),
  ('00000000-0000-1109-b000-000000000002', 'Ranking Author'),
  ('00000000-0000-1109-b000-000000000003', 'Ranking Small')
on conflict (id) do nothing;

select set_config('smoke.venue', (select v.id from venues v order by v.id limit 1), true);
-- Six dishes at that venue (or as many as exist); the smoke needs five distinct dishes.
create temp table smoke_dishes on commit drop as
select d.id, row_number() over (order by d.id) as n
from dishes d
order by d.id
limit 6;

do $$
begin
  if (select count(*) from smoke_dishes) < 6 then
    raise exception 'smoke needs six dishes in the catalog';
  end if;
end $$;

-- Author posts dishes 1-6 (posts p1..p6); small posts dishes 1-2 (p7, p8).
insert into posts (id, author_id, status, visibility, caption, published_at, venue_id, dish_id)
select
  ('00000000-0000-1109-c000-00000000000' || d.n)::uuid,
  '00000000-0000-1109-b000-000000000002',
  'published', 'public', 'p' || d.n, now() - (d.n || ' hours')::interval,
  current_setting('smoke.venue'), d.id
from smoke_dishes d;

insert into posts (id, author_id, status, visibility, caption, published_at, venue_id, dish_id)
select
  ('00000000-0000-1109-c000-00000000001' || d.n)::uuid,
  '00000000-0000-1109-b000-000000000003',
  'published', 'public', 's' || d.n, now(), current_setting('smoke.venue'), d.id
from smoke_dishes d where d.n <= 2;

-- A review by the author and by the small portfolio for dish 1, plus the author's review of dish 4.
insert into reviews (id, user_id, dish_id, venue_id, rating, text)
select '00000000-0000-1109-d000-000000000001', '00000000-0000-1109-b000-000000000002', d.id,
  current_setting('smoke.venue'), 5, 'author dish 1' from smoke_dishes d where d.n = 1;
insert into reviews (id, user_id, dish_id, venue_id, rating, text)
select '00000000-0000-1109-d000-000000000002', '00000000-0000-1109-b000-000000000002', d.id,
  current_setting('smoke.venue'), 4, 'author dish 4' from smoke_dishes d where d.n = 4;
insert into reviews (id, user_id, dish_id, venue_id, rating, text)
select '00000000-0000-1109-d000-000000000003', '00000000-0000-1109-b000-000000000003', d.id,
  current_setting('smoke.venue'), 5, 'small dish 1' from smoke_dishes d where d.n = 1;

-- 1 and 2 as the author.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-1109-b000-000000000002', true);
set local role authenticated;

do $$
declare
  v_ranked uuid[];
begin
  -- Rank p1, p2, p3 at 1, 2, 3 then p4 at 1: [p4, p1, p2, p3].
  perform public.rank_portfolio_post('00000000-0000-1109-c000-000000000001', 1);
  perform public.rank_portfolio_post('00000000-0000-1109-c000-000000000002', 2);
  perform public.rank_portfolio_post('00000000-0000-1109-c000-000000000003', 3);
  v_ranked := public.rank_portfolio_post('00000000-0000-1109-c000-000000000004', 1);
  if v_ranked is distinct from array[
    '00000000-0000-1109-c000-000000000004', '00000000-0000-1109-c000-000000000001',
    '00000000-0000-1109-c000-000000000002', '00000000-0000-1109-c000-000000000003'
  ]::uuid[] then
    raise exception 'ranking was %, expected p4,p1,p2,p3', v_ranked;
  end if;

  -- Move p4 from first to third: [p1, p2, p4, p3].
  v_ranked := public.rank_portfolio_post('00000000-0000-1109-c000-000000000004', 3);
  if v_ranked is distinct from array[
    '00000000-0000-1109-c000-000000000001', '00000000-0000-1109-c000-000000000002',
    '00000000-0000-1109-c000-000000000004', '00000000-0000-1109-c000-000000000003'
  ]::uuid[] then
    raise exception 'moved ranking was %, expected p1,p2,p4,p3', v_ranked;
  end if;

  -- A place past the end goes last: [p1, p2, p4, p3, p5].
  v_ranked := public.rank_portfolio_post('00000000-0000-1109-c000-000000000005', 99);
  if v_ranked[5] is distinct from '00000000-0000-1109-c000-000000000005'::uuid
     or cardinality(v_ranked) <> 5 then
    raise exception 'a place past the end must go last, got %', v_ranked;
  end if;

  begin
    perform public.rank_portfolio_post('00000000-0000-1109-c000-000000000017', 1);
    raise exception 'another person''s post must be refused';
  exception when sqlstate '22023' then
    null;
  end;

  -- The ranking is [p1, p2, p4, p3, p5]. Setting the top three to just p1, p2 drops p4 (it was in
  -- the old top three) and keeps what was ranked below it: [p1, p2, p3, p5].
  v_ranked := public.set_pinned_posts(array[
    '00000000-0000-1109-c000-000000000001', '00000000-0000-1109-c000-000000000002'
  ]::uuid[]);
  if v_ranked is distinct from array[
    '00000000-0000-1109-c000-000000000001', '00000000-0000-1109-c000-000000000002',
    '00000000-0000-1109-c000-000000000003', '00000000-0000-1109-c000-000000000005'
  ]::uuid[] then
    raise exception 'set_pinned_posts kept %, expected p1,p2 then the old fourth place onwards (p3,p5)', v_ranked;
  end if;

  begin
    perform public.set_pinned_posts(array[
      gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
    ]);
    raise exception 'four pins must be refused';
  exception when sqlstate '22023' then
    null;
  end;

  -- Put the ranking back to p1, p2, p3, p4 for the label checks (dish 4 is fourth).
  perform public.rank_portfolio_post('00000000-0000-1109-c000-000000000004', 4);
  v_ranked := public.get_my_portfolio_ranking();
  if v_ranked is distinct from array[
    '00000000-0000-1109-c000-000000000001', '00000000-0000-1109-c000-000000000002',
    '00000000-0000-1109-c000-000000000003', '00000000-0000-1109-c000-000000000004',
    '00000000-0000-1109-c000-000000000005'
  ]::uuid[] then
    raise exception 'ranking read was %, expected p1..p5', v_ranked;
  end if;
end $$;

reset role;

-- The small portfolio ranks its dish first, but has only two dishes.
select set_config('request.jwt.claim.sub', '00000000-0000-1109-b000-000000000003', true);
set local role authenticated;
select public.rank_portfolio_post('00000000-0000-1109-c000-000000000011', 1);
reset role;

-- 3 as the viewer.
select set_config('request.jwt.claim.sub', '00000000-0000-1109-b000-000000000001', true);
set local role authenticated;

do $$
declare
  v_rows text;
begin
  select string_agg(right(r.review_id::text, 1) || ':' || r.portfolio_rank || ':' || r.dish_count, ',' order by r.review_id)
  into v_rows
  from public.get_review_portfolio_ranks(array[
    '00000000-0000-1109-d000-000000000001',
    '00000000-0000-1109-d000-000000000002',
    '00000000-0000-1109-d000-000000000003'
  ]::uuid[]) r;
  -- Review 1: dish 1 is the author's #1 and they have 6 dishes. Review 2: dish 4 is fourth, no
  -- label. Review 3: the small portfolio has only 2 dishes, no label.
  if v_rows is distinct from '1:1:6' then
    raise exception 'ranks were %, expected only 1:1:6', v_rows;
  end if;
end $$;

reset role;

-- 4. Grants and rate rules.
do $$
begin
  if has_function_privilege('anon', 'public.rank_portfolio_post(uuid, integer)', 'execute')
    or has_function_privilege('anon', 'public.get_my_portfolio_ranking()', 'execute')
    or has_function_privilege('anon', 'public.get_review_portfolio_ranks(uuid[])', 'execute') then
    raise exception 'anon must not execute the portfolio ranking RPCs';
  end if;
  if (select count(*) from app_private.request_rate_rules where route in (
    'rpc/rank_portfolio_post', 'rpc/get_my_portfolio_ranking', 'rpc/get_review_portfolio_ranks'
  )) <> 3 then
    raise exception 'each portfolio ranking RPC needs a rate rule';
  end if;
end $$;

rollback;
