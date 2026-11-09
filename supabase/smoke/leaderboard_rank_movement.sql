-- Smoke checks for 20261108120000_leaderboard_rank_movement.sql.
-- 1. Closing last week snapshots everyone's all-time Most active rank, once.
-- 2. A refresh adds one board_top_ten Activity row for a diner in this week's top ten, however
--    often it runs, and none for a diner off this week's board.
-- 3. get_my_rank_movement answers last week's rank, the rank when this week began and the rank
--    now for a signed-in caller; anon cannot run it; it has a rate rule.
-- Runs in a transaction and rolls back.
--   climber: 00000000-0000-1108-a000-000000000001 (10 points last week, a lot this week)
--   steady:  00000000-0000-1108-a000-000000000002 (30 points last week, none this week)

begin;

insert into auth.users (id, email)
values
  ('00000000-0000-1108-a000-000000000001', 'rank-movement-smoke-1@example.test'),
  ('00000000-0000-1108-a000-000000000002', 'rank-movement-smoke-2@example.test')
on conflict (id) do nothing;

insert into user_profiles (id, display_name, created_at)
values
  ('00000000-0000-1108-a000-000000000001', 'Rank Climber', now() - interval '60 days'),
  ('00000000-0000-1108-a000-000000000002', 'Rank Steady', now() - interval '60 days')
on conflict (id) do update set created_at = excluded.created_at;

-- The steady diner already holds the first-tier achievements this smoke would otherwise pay them
-- now (Posted, Weekly contender, Crowd favourite), so nothing puts them on this week's board.
-- Without this, those points land this week and, on a quiet board, in the top ten.
insert into achievement_unlocks (user_id, achievement_id, tier)
values
  ('00000000-0000-1108-a000-000000000002', 'posted', 1),
  ('00000000-0000-1108-a000-000000000002', 'weekly-contender', 1),
  ('00000000-0000-1108-a000-000000000002', 'crowd-favourite', 1)
on conflict do nothing;

select set_config(
  'smoke.last_week',
  (date_trunc('week', now() at time zone 'Asia/Singapore') - interval '7 days')::date::text,
  true
);

-- Last week (Thursday): the climber 10, the steady diner 30. This week: the climber far ahead
-- of anyone on staging.
insert into leaderboard_events (user_id, kind, points, created_at)
values
  ('00000000-0000-1108-a000-000000000001', 'post', 10,
    (current_setting('smoke.last_week')::date + 3)::timestamp at time zone 'Asia/Singapore'),
  ('00000000-0000-1108-a000-000000000002', 'post', 30,
    (current_setting('smoke.last_week')::date + 3)::timestamp at time zone 'Asia/Singapore'),
  ('00000000-0000-1108-a000-000000000001', 'post', 900000, now() - interval '1 minute');

-- 1. Snapshot at the close, written once.
select app_private.close_leaderboard_week(current_setting('smoke.last_week')::date);
select app_private.close_leaderboard_week(current_setting('smoke.last_week')::date);

do $$
declare
  v_week date := current_setting('smoke.last_week')::date;
  v_climber integer;
  v_steady integer;
begin
  select rank into v_climber from leaderboard_rank_snapshots
  where week_start = v_week and user_id = '00000000-0000-1108-a000-000000000001';
  select rank into v_steady from leaderboard_rank_snapshots
  where week_start = v_week and user_id = '00000000-0000-1108-a000-000000000002';
  if v_climber is null or v_steady is null then
    raise exception 'the week close must snapshot both diners (got %, %)', v_climber, v_steady;
  end if;
  if v_steady >= v_climber then
    raise exception 'more points rank higher in the snapshot (steady %, climber %)', v_steady, v_climber;
  end if;
  if (select count(*) from leaderboard_rank_snapshots
      where week_start = v_week and user_id in (
        '00000000-0000-1108-a000-000000000001', '00000000-0000-1108-a000-000000000002'
      )) <> 2 then
    raise exception 'a second close must not add snapshot rows';
  end if;
end;
$$;

-- 2. Top ten Activity row, once a week.
select app_private.refresh_leaderboards();
select app_private.refresh_leaderboards();

do $$
begin
  if (select count(*) from activity_events
      where recipient_id = '00000000-0000-1108-a000-000000000001'
        and event_type = 'board_top_ten') <> 1 then
    raise exception 'the climber gets one top ten row, however often the board refreshes';
  end if;
  if exists (select 1 from leaderboard_standings
      where board = 'active' and period = 'week'
        and user_id = '00000000-0000-1108-a000-000000000002' and score > 0) then
    raise exception 'the steady diner earned nothing this week, so is off this week''s board';
  end if;
  if exists (select 1 from activity_events
      where recipient_id = '00000000-0000-1108-a000-000000000002'
        and event_type = 'board_top_ten') then
    raise exception 'a diner off this week''s board gets no top ten row';
  end if;
end;
$$;

-- 3. The RPC, as the climber.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-1108-a000-000000000001', true);
set local role authenticated;

do $$
declare
  v record;
begin
  select * into v from public.get_my_rank_movement();
  if v.last_week_rank is null or v.week_start_all_rank is null or v.all_rank is null then
    raise exception 'movement is %', row_to_json(v);
  end if;
  if v.all_rank <> 1 or v.week_start_all_rank <= v.all_rank then
    raise exception 'the climber moved up since Monday: %', row_to_json(v);
  end if;
  if not exists (select 1 from activity_events where event_type = 'board_top_ten') then
    raise exception 'the climber can read their own top ten row';
  end if;
end;
$$;

reset role;
set local role anon;
do $$
begin
  begin
    perform * from public.get_my_rank_movement();
    raise exception 'anon must not run get_my_rank_movement';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

do $$
begin
  if not exists (select 1 from app_private.request_rate_rules where route = 'rpc/get_my_rank_movement') then
    raise exception 'get_my_rank_movement needs a rate rule';
  end if;
end;
$$;

rollback;
