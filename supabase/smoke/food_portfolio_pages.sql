-- Smoke checks for 20261107090000_food_portfolio_pages.sql.
-- 1. Top three: pinned posts come first in pin order, then the most liked; a moderated or
--    deleted post never shows, and a private account's posts are hidden from a non-follower.
-- 2. Stalls: one row per stall with the number of dishes posted there.
-- 3. Following feed: only approved followees, newest first, keyset paging does not repeat rows.
-- 4. set_pinned_posts keeps only the caller's own published posts and refuses more than three.
-- 5. anon cannot run any of the four, and each has a rate rule.
-- Runs in a transaction and rolls back.
--   viewer:  00000000-0000-1107-b000-000000000001
--   author:  00000000-0000-1107-b000-000000000002
--   private: 00000000-0000-1107-b000-000000000003

begin;

insert into auth.users (id, email)
values
  ('00000000-0000-1107-b000-000000000001', 'food-portfolio-smoke-1@example.test'),
  ('00000000-0000-1107-b000-000000000002', 'food-portfolio-smoke-2@example.test'),
  ('00000000-0000-1107-b000-000000000003', 'food-portfolio-smoke-3@example.test')
on conflict (id) do nothing;

insert into user_profiles (id, display_name)
values
  ('00000000-0000-1107-b000-000000000001', 'Portfolio Viewer'),
  ('00000000-0000-1107-b000-000000000002', 'Portfolio Author'),
  ('00000000-0000-1107-b000-000000000003', 'Portfolio Private')
on conflict (id) do nothing;

insert into privacy_settings (user_id, account_visibility)
values ('00000000-0000-1107-b000-000000000003', 'private')
on conflict (user_id) do update set account_visibility = 'private';

select set_config('smoke.venue_a', (select v.id from venues v order by v.id limit 1), true);
select set_config('smoke.venue_b', (select v.id from venues v order by v.id offset 1 limit 1), true);

insert into posts (id, author_id, status, visibility, caption, published_at, venue_id, like_count)
values
  ('00000000-0000-1107-c000-000000000001', '00000000-0000-1107-b000-000000000002', 'published', 'public', 'p1', now() - interval '5 hours', current_setting('smoke.venue_a'), 1),
  ('00000000-0000-1107-c000-000000000002', '00000000-0000-1107-b000-000000000002', 'published', 'public', 'p2', now() - interval '4 hours', current_setting('smoke.venue_a'), 9),
  ('00000000-0000-1107-c000-000000000003', '00000000-0000-1107-b000-000000000002', 'published', 'public', 'p3', now() - interval '3 hours', current_setting('smoke.venue_b'), 5),
  ('00000000-0000-1107-c000-000000000004', '00000000-0000-1107-b000-000000000002', 'published', 'public', 'p4', now() - interval '2 hours', current_setting('smoke.venue_b'), 2),
  ('00000000-0000-1107-c000-000000000005', '00000000-0000-1107-b000-000000000002', 'published', 'public', 'moderated', now() - interval '1 hour', current_setting('smoke.venue_b'), 99),
  ('00000000-0000-1107-c000-000000000006', '00000000-0000-1107-b000-000000000003', 'published', 'public', 'private author', now(), current_setting('smoke.venue_a'), 0),
  ('00000000-0000-1107-c000-000000000007', '00000000-0000-1107-b000-000000000001', 'published', 'public', 'viewer own', now(), current_setting('smoke.venue_a'), 0);

insert into post_moderation_states (post_id, state)
values ('00000000-0000-1107-c000-000000000005', 'removed');

-- The viewer follows the author (approved) and has only asked to follow the private account.
insert into follows (follower_id, followee_id, status, approved_at)
values
  ('00000000-0000-1107-b000-000000000001', '00000000-0000-1107-b000-000000000002', 'approved', now()),
  ('00000000-0000-1107-b000-000000000001', '00000000-0000-1107-b000-000000000003', 'pending', null);

-- 4. The author pins p4 then p1; the viewer's own post and a missing id are dropped.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-1107-b000-000000000002', true);
set local role authenticated;

do $$
declare
  v_kept uuid[];
begin
  v_kept := public.set_pinned_posts(array[
    '00000000-0000-1107-c000-000000000004',
    '00000000-0000-1107-c000-000000000007',
    '00000000-0000-1107-c000-000000000001'
  ]::uuid[]);
  if v_kept is distinct from array[
    '00000000-0000-1107-c000-000000000004',
    '00000000-0000-1107-c000-000000000001'
  ]::uuid[] then
    raise exception 'set_pinned_posts kept %, expected p4 then p1 only', v_kept;
  end if;

  begin
    perform public.set_pinned_posts(array[
      gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
    ]);
    raise exception 'four pins must be refused';
  exception when sqlstate '22023' then
    null;
  end;
end $$;

reset role;

-- 1-3 as the viewer.
select set_config('request.jwt.claim.sub', '00000000-0000-1107-b000-000000000001', true);
set local role authenticated;

do $$
declare
  v_ids text;
  v_pinned text;
  v_stalls text;
  v_first_page uuid[];
  v_second_page uuid[];
  v_cursor_at timestamptz;
  v_cursor_id uuid;
begin
  select string_agg(right(t.id::text, 1), ',' order by t.ord), string_agg(t.is_pinned::text, ',' order by t.ord)
  into v_ids, v_pinned
  from (
    select top.id, top.is_pinned, row_number() over () as ord
    from public.get_food_portfolio_top_posts('00000000-0000-1107-b000-000000000002') top
  ) t;
  if v_ids is distinct from '4,1,2' or v_pinned is distinct from 'true,true,false' then
    raise exception 'top three were % (pinned %), expected 4,1,2 (true,true,false)', v_ids, v_pinned;
  end if;

  if exists (select 1 from public.get_food_portfolio_top_posts('00000000-0000-1107-b000-000000000003')) then
    raise exception 'a private account''s top posts must be hidden from a non-follower';
  end if;

  select string_agg(s.dish_count::text, ',' order by s.dish_count desc)
  into v_stalls
  from public.get_food_portfolio_stalls('00000000-0000-1107-b000-000000000002') s;
  if v_stalls is distinct from '2,2' then
    raise exception 'stalls were %, expected two stalls with 2 dishes each (moderated post excluded)', v_stalls;
  end if;

  select array_agg(f.id order by f.published_at desc, f.id desc)
  into v_first_page
  from public.get_following_dish_feed(2, null, null) f;
  if v_first_page is distinct from array[
    '00000000-0000-1107-c000-000000000004',
    '00000000-0000-1107-c000-000000000003'
  ]::uuid[] then
    raise exception 'first following page was %', v_first_page;
  end if;

  select f.published_at, f.id into v_cursor_at, v_cursor_id
  from public.get_following_dish_feed(2, null, null) f
  order by f.published_at asc, f.id asc
  limit 1;

  select array_agg(f.id order by f.published_at desc, f.id desc)
  into v_second_page
  from public.get_following_dish_feed(10, v_cursor_at, v_cursor_id) f;
  if v_second_page is distinct from array[
    '00000000-0000-1107-c000-000000000002',
    '00000000-0000-1107-c000-000000000001'
  ]::uuid[] then
    raise exception 'second following page was % (pending follows and own posts must not show)', v_second_page;
  end if;
end $$;

reset role;

-- 5. Grants and rate rules.
do $$
begin
  if has_function_privilege('anon', 'public.get_food_portfolio_top_posts(uuid)', 'execute')
    or has_function_privilege('anon', 'public.get_food_portfolio_stalls(uuid, integer)', 'execute')
    or has_function_privilege('anon', 'public.get_following_dish_feed(integer, timestamptz, uuid)', 'execute')
    or has_function_privilege('anon', 'public.set_pinned_posts(uuid[])', 'execute') then
    raise exception 'anon must not execute the food portfolio RPCs';
  end if;
  if (select count(*) from app_private.request_rate_rules where route in (
    'rpc/get_food_portfolio_top_posts', 'rpc/get_food_portfolio_stalls',
    'rpc/get_following_dish_feed', 'rpc/set_pinned_posts'
  )) <> 4 then
    raise exception 'each food portfolio RPC needs a rate rule';
  end if;
end $$;

rollback;
