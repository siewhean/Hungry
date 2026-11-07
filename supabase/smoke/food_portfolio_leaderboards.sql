-- Smoke checks for 20261107120000_food_portfolio_leaderboards.sql.
-- 1. Publishing a dish post credits points: 10 base, +5 new stall, +5 first photo of the dish,
--    +3 for a long note; a second post at the same stall within 30 minutes earns nothing; a
--    post without a photo earns 2 off the board; the 7th credited post of the day earns nothing.
-- 2. Likes, saves and approved follows add Trending rows: one per actor per kind per day, never
--    your own, never from an account under a day old; unfollowing voids the row.
-- 3. Deleting a post or moderation removing it voids its rows.
-- 4. refresh_leaderboards builds the standings and pays the Posted tier 1 achievement once;
--    exclude_from_leaderboards takes an account off the boards.
-- 5. The RPCs answer for a signed-in caller, anon cannot run them, and each has a rate rule;
--    the data export includes the points history and achievement unlocks.
-- 6. close_leaderboard_week writes a week once.
-- Runs in a transaction and rolls back.
--   author: 00000000-0000-1107-d000-000000000001
--   fan:    00000000-0000-1107-d000-000000000002
--   new:    00000000-0000-1107-d000-000000000003 (account two hours old)

begin;

insert into auth.users (id, email)
values
  ('00000000-0000-1107-d000-000000000001', 'leaderboard-smoke-1@example.test'),
  ('00000000-0000-1107-d000-000000000002', 'leaderboard-smoke-2@example.test'),
  ('00000000-0000-1107-d000-000000000003', 'leaderboard-smoke-3@example.test')
on conflict (id) do nothing;

insert into user_profiles (id, display_name, created_at)
values
  ('00000000-0000-1107-d000-000000000001', 'Board Author', now() - interval '30 days'),
  ('00000000-0000-1107-d000-000000000002', 'Board Fan', now() - interval '30 days'),
  ('00000000-0000-1107-d000-000000000003', 'Board Newcomer', now() - interval '2 hours')
on conflict (id) do update set created_at = excluded.created_at;

-- The fan and the newcomer have each posted a review, so only the newcomer's age holds them back.
insert into reviews (user_id, dish_id, rating, text)
select u.id, (select d.id from dishes d order by d.id limit 1), 4, 'smoke'
from (values
  ('00000000-0000-1107-d000-000000000002'::uuid),
  ('00000000-0000-1107-d000-000000000003'::uuid)
) as u(id);

-- Nine stalls and a dish nobody has posted a photo of.
create temporary table smoke_venues on commit drop as
select v.id, row_number() over (order by v.id) as n from venues v order by v.id limit 9;
select set_config('smoke.dish', (
  select d.id from dishes d
  where not exists (select 1 from posts p where p.dish_id = d.id)
  order by d.id limit 1
), true);

-- Posts are drafted, given media, then published, the way the app does it.
create temporary table smoke_posts (n int, id uuid, venue_n int, with_photo boolean, dish text, caption text) on commit drop;
insert into smoke_posts values
  (1, '00000000-0000-1107-e000-000000000001', 1, true, current_setting('smoke.dish'), repeat('Silky chicken, fragrant rice. ', 3)),
  (2, '00000000-0000-1107-e000-000000000002', 1, true, null, 'same stall again'),
  (3, '00000000-0000-1107-e000-000000000003', 2, false, null, 'no photo'),
  (4, '00000000-0000-1107-e000-000000000004', 3, true, null, 'p4'),
  (5, '00000000-0000-1107-e000-000000000005', 4, true, null, 'p5'),
  (6, '00000000-0000-1107-e000-000000000006', 5, true, null, 'p6'),
  (7, '00000000-0000-1107-e000-000000000007', 6, true, null, 'p7'),
  (8, '00000000-0000-1107-e000-000000000008', 7, true, null, 'p8'),
  (9, '00000000-0000-1107-e000-000000000009', 8, true, null, 'over the daily cap');

do $$
declare
  r record;
begin
  for r in select sp.*, sv.id as venue_id from smoke_posts sp join smoke_venues sv on sv.n = sp.venue_n order by sp.n loop
    insert into posts (id, author_id, status, visibility, caption, venue_id, dish_id)
    values (r.id, '00000000-0000-1107-d000-000000000001', 'draft', 'public', r.caption, r.venue_id, r.dish);
    if r.with_photo then
      insert into post_media (post_id, media_type, storage_path, sort_order)
      values (r.id, 'image', '00000000-0000-1107-d000-000000000001/smoke-' || r.n || '.jpg', 0);
    end if;
    update posts set status = 'published', published_at = now() where id = r.id;
  end loop;
end;
$$;

do $$
declare
  v_points int[];
begin
  select array_agg(p.board_credit_points order by sp.n) into v_points
  from smoke_posts sp join posts p on p.id = sp.id;
  if v_points is distinct from array[23, 0, 0, 15, 15, 15, 15, 15, 0] then
    raise exception 'board credit per post is %, expected 23,0,0,15,15,15,15,15,0', v_points;
  end if;
  if not exists (
    select 1 from leaderboard_events
    where post_id = '00000000-0000-1107-e000-000000000003' and kind = 'off_board_post' and points = 2
  ) then
    raise exception 'a post without a photo must earn 2 off the board';
  end if;
  if (select count(*) from leaderboard_events
      where user_id = '00000000-0000-1107-d000-000000000001' and kind = 'post' and voided_at is null) <> 6 then
    raise exception 'six credited posts a day, no more';
  end if;
end;
$$;

-- 2. Engagement.
insert into post_likes (post_id, user_id) values
  ('00000000-0000-1107-e000-000000000001', '00000000-0000-1107-d000-000000000002'),
  ('00000000-0000-1107-e000-000000000006', '00000000-0000-1107-d000-000000000002'),
  ('00000000-0000-1107-e000-000000000001', '00000000-0000-1107-d000-000000000003'),
  ('00000000-0000-1107-e000-000000000001', '00000000-0000-1107-d000-000000000001');
insert into post_saves (post_id, user_id) values
  ('00000000-0000-1107-e000-000000000001', '00000000-0000-1107-d000-000000000002');
insert into follows (follower_id, followee_id, status, approved_at) values
  ('00000000-0000-1107-d000-000000000002', '00000000-0000-1107-d000-000000000001', 'approved', now());
delete from follows
where follower_id = '00000000-0000-1107-d000-000000000002'
  and followee_id = '00000000-0000-1107-d000-000000000001';

do $$
declare
  v_live text;
begin
  select string_agg(kind || ':' || points::int, ',' order by kind) into v_live
  from leaderboard_events
  where user_id = '00000000-0000-1107-d000-000000000001'
    and kind in ('like', 'save', 'follower', 'share')
    and voided_at is null;
  if v_live is distinct from 'like:1,save:2' then
    raise exception 'live trending rows are %, expected like:1,save:2', v_live;
  end if;
  if not exists (
    select 1 from leaderboard_events
    where user_id = '00000000-0000-1107-d000-000000000001' and kind = 'follower' and voided_at is not null
  ) then
    raise exception 'unfollowing must void the follower row';
  end if;
end;
$$;

-- 3. A delete and a moderation removal void their posts' rows.
update posts set status = 'deleted', deleted_at = now() where id = '00000000-0000-1107-e000-000000000004';
insert into post_moderation_states (post_id, state) values ('00000000-0000-1107-e000-000000000005', 'removed');

do $$
begin
  if exists (
    select 1 from leaderboard_events
    where post_id in ('00000000-0000-1107-e000-000000000004', '00000000-0000-1107-e000-000000000005')
      and voided_at is null
  ) then
    raise exception 'a deleted or removed post must keep no live points';
  end if;
end;
$$;

-- 4. Standings: p1 23 + p6..p8 45 + Posted tier 1 15 = 83 this week; Trending like 1 + save 2.
select app_private.refresh_leaderboards();
select app_private.refresh_leaderboards();

do $$
declare
  v_active numeric;
  v_trending numeric;
begin
  select score into v_active from leaderboard_standings
  where board = 'active' and period = 'week' and user_id = '00000000-0000-1107-d000-000000000001';
  select score into v_trending from leaderboard_standings
  where board = 'trending' and period = 'week' and user_id = '00000000-0000-1107-d000-000000000001';
  if v_active is distinct from 83.00 then
    raise exception 'this week''s active score is %, expected 83', v_active;
  end if;
  if v_trending is null or round(v_trending) <> 3 then
    raise exception 'trending score is %, expected about 3', v_trending;
  end if;
  if (select count(*) from achievement_unlocks
      where user_id = '00000000-0000-1107-d000-000000000001' and achievement_id = 'posted') <> 1 then
    raise exception 'Posted tier 1 must unlock once';
  end if;
  if (select count(*) from leaderboard_events
      where user_id = '00000000-0000-1107-d000-000000000001' and kind = 'achievement') <> 1 then
    raise exception 'an achievement tier pays once, however often the board refreshes';
  end if;
  if exists (select 1 from leaderboard_standings where user_id = '00000000-0000-1107-d000-000000000003') then
    raise exception 'an account under 7 days old stays off the board';
  end if;
end;
$$;

-- 5. RPCs, as the fan.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-1107-d000-000000000002', true);
set local role authenticated;

do $$
begin
  if not exists (
    select 1 from public.get_leaderboard('active', 'week', 'everyone', 50)
    where user_id = '00000000-0000-1107-d000-000000000001' and score = 83 and not is_me
  ) then
    raise exception 'get_leaderboard must list the author';
  end if;
  if exists (select 1 from public.get_leaderboard('active', 'week', 'following', 50)
             where user_id = '00000000-0000-1107-d000-000000000001') then
    raise exception 'the following scope lists only people you follow';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-1107-d000-000000000001', true);
set local role authenticated;

do $$
declare
  v_summary record;
begin
  select * into v_summary from public.get_my_leaderboard_summary();
  if v_summary.total_points <> 85 or v_summary.week_points <> 83
    or v_summary.credited_posts_today <> 4 or v_summary.daily_cap <> 6
    or v_summary.active_week_rank is null then
    raise exception 'summary is %', v_summary;
  end if;
  if (select count(*) from public.get_my_portfolio_points(100)) < 10 then
    raise exception 'the points history lists the credited rows';
  end if;
  if jsonb_array_length(public.export_my_data() -> 'data' -> 'portfolioPoints') < 10
    or jsonb_array_length(public.export_my_data() -> 'data' -> 'achievementUnlocks') <> 1 then
    raise exception 'the data export must include points history and achievement unlocks';
  end if;
end;
$$;

reset role;
set local role anon;
do $$
begin
  begin
    perform * from public.get_leaderboard('active', 'week', 'everyone', 50);
    raise exception 'anon must not run get_leaderboard';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

do $$
begin
  if (select count(*) from app_private.request_rate_rules where route in (
    'rpc/get_leaderboard', 'rpc/get_my_leaderboard_summary', 'rpc/get_my_portfolio_points'
  )) <> 3 then
    raise exception 'each leaderboard RPC needs a rate rule';
  end if;
end;
$$;

select public.exclude_from_leaderboards('00000000-0000-1107-d000-000000000001', 'smoke', null);
select app_private.refresh_leaderboards();
do $$
begin
  if exists (select 1 from leaderboard_standings where user_id = '00000000-0000-1107-d000-000000000001') then
    raise exception 'an excluded account stays off the boards';
  end if;
end;
$$;
delete from leaderboard_exclusions where user_id = '00000000-0000-1107-d000-000000000001';

-- 6. Closing this week twice writes it once.
do $$
declare
  v_week date := date_trunc('week', now() at time zone 'Asia/Singapore')::date;
begin
  perform app_private.close_leaderboard_week(v_week);
  if not exists (
    select 1 from leaderboard_week_results
    where week_start = v_week and board = 'active' and user_id = '00000000-0000-1107-d000-000000000001'
  ) then
    raise exception 'the week close must record the author';
  end if;
  if app_private.close_leaderboard_week(v_week) <> 0 then
    raise exception 'a week is written once';
  end if;
end;
$$;

rollback;
