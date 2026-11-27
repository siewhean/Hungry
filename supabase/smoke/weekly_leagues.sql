-- Smoke checks for 20261127120000_weekly_leagues.sql.
-- 1. A Food Cred award for a tried stall, a saved stall, a review or a mission writes one 'task'
--    row to leaderboard_events worth the points paid; other awards and zero-point awards write
--    none; the ledger refuses a second row for the same award.
-- 2. The first points of a Singapore week put the account in a tier 1 cohort once, however many
--    awards follow; an excluded account does not join; no cohort is ever bigger than 30 or
--    disagrees with its memberships (31 accounts earn at once).
-- 3. close_leaderboard_week also closes the leagues, once: of a 14 person tier 2 cohort the top
--    7 move up, the bottom 5 move down, the rest stay; a second close changes nothing.
-- 4. get_my_league_status answers for a signed-in caller, anon cannot run it, it has a rate rule
--    and a tier 1 diner has a promotion line; the data export includes the league tables.
-- 5. The league tables are closed to the app roles.
-- Self-seeding. Runs in a transaction and rolls back.
--   a:       00000000-0000-1127-f000-000000000001 (earns this week)
--   b:       00000000-0000-1127-f000-000000000002 (excluded from the boards)
--   cap:     00000000-0000-1127-f200-0000000000NN (31 accounts, NN 01..31)
--   closing: 00000000-0000-1127-f100-0000000000NN (14 accounts in a tier 2 cohort, NN 01..14)

begin;

insert into auth.users (id, email)
select ('00000000-0000-1127-f000-' || lpad(g::text, 12, '0'))::uuid, 'league-smoke-a' || g || '@example.test'
from generate_series(1, 2) g
union all
select ('00000000-0000-1127-f100-' || lpad(g::text, 12, '0'))::uuid, 'league-smoke-c' || g || '@example.test'
from generate_series(1, 14) g
union all
select ('00000000-0000-1127-f200-' || lpad(g::text, 12, '0'))::uuid, 'league-smoke-k' || g || '@example.test'
from generate_series(1, 31) g
on conflict (id) do nothing;

insert into user_profiles (id, display_name, created_at)
select u.id, 'League Smoke ' || right(u.id::text, 6), now() - interval '30 days'
from auth.users u
where u.id::text like '00000000-0000-1127-f%'
on conflict (id) do update set created_at = excluded.created_at;

-- 0. The tables, their locks, the settings and the task kind.
do $$
declare
  v_table text;
begin
  foreach v_table in array array['league_cohorts', 'league_memberships', 'league_user_tiers', 'league_week_results'] loop
    if to_regclass('public.' || v_table) is null then
      raise exception '% is missing', v_table;
    end if;
    if not (select c.relrowsecurity from pg_class c where c.oid = ('public.' || v_table)::regclass) then
      raise exception '% must have row level security on', v_table;
    end if;
    if has_table_privilege('anon', 'public.' || v_table, 'select')
      or has_table_privilege('authenticated', 'public.' || v_table, 'select') then
      raise exception '% must be closed to the app roles', v_table;
    end if;
  end loop;
  if app_private.league_setting('cohort_size') <> 30
    or app_private.league_setting('tier_count') <> 5
    or app_private.league_setting('promote_count') <> 7
    or app_private.league_setting('relegate_count') <> 5
    or app_private.league_setting('start_tier') <> 1 then
    raise exception 'the league settings changed';
  end if;
  if has_function_privilege('anon', 'public.get_my_league_status()', 'execute') then
    raise exception 'anon must not execute get_my_league_status';
  end if;
  if (select p.prosecdef from pg_proc p where p.oid = 'public.get_my_league_status()'::regprocedure) then
    raise exception 'public.get_my_league_status must be security invoker';
  end if;
  if (select p.provolatile from pg_proc p where p.oid = 'public.get_my_league_status()'::regprocedure) <> 'v' then
    raise exception 'get_my_league_status must be volatile so its rate rule counts';
  end if;
  if has_function_privilege('authenticated', 'app_private.close_league_week(date)', 'execute') then
    raise exception 'only the service role may close a league week';
  end if;
end $$;

-- 1. Awards become task rows.
insert into food_cred_events (id, user_id, source_action, points, related_entity_id, related_entity_type)
values
  ('00000000-0000-1127-aa00-000000000001', '00000000-0000-1127-f000-000000000001', 'stall_saved', 2, 'smoke-league-stall-1', 'stall'),
  ('00000000-0000-1127-aa00-000000000002', '00000000-0000-1127-f000-000000000001', 'review_created', 15, 'smoke-league-review-1', 'review'),
  ('00000000-0000-1127-aa00-000000000003', '00000000-0000-1127-f000-000000000001', 'photo_uploaded', 5, 'smoke-league-photo-1', null),
  ('00000000-0000-1127-aa00-000000000004', '00000000-0000-1127-f000-000000000001', 'mission_completed', 0, 'smoke-league-mission-1', 'mission');

do $$
begin
  if (select count(*) from leaderboard_events
      where user_id = '00000000-0000-1127-f000-000000000001' and kind = 'task') <> 2 then
    raise exception 'a saved stall and a review make two task rows, a photo and a zero-point award make none';
  end if;
  if (select sum(points) from leaderboard_events
      where user_id = '00000000-0000-1127-f000-000000000001' and kind = 'task') <> 17 then
    raise exception 'a task row is worth the Food Cred paid';
  end if;
  if exists (
    select 1 from leaderboard_events e
    where e.kind = 'task' and e.user_id = '00000000-0000-1127-f000-000000000001'
      and not exists (select 1 from food_cred_events f where f.id = e.food_cred_event_id)
  ) then
    raise exception 'every task row points at its award';
  end if;
  -- One award, one task row: the ledger refuses a second row for the same award id.
  begin
    insert into leaderboard_events (user_id, kind, points, food_cred_event_id)
    values ('00000000-0000-1127-f000-000000000001', 'task', 2, '00000000-0000-1127-aa00-000000000001');
    raise exception 'a second task row for one award must be refused';
  exception when unique_violation then null;
  end;
end $$;

-- 2. Auto-join: once, at tier 1, with the cohort counting its own members.
do $$
declare
  v_week date := date_trunc('week', now() at time zone 'Asia/Singapore')::date;
begin
  if (select count(*) from league_memberships
      where user_id = '00000000-0000-1127-f000-000000000001' and week_start = v_week) <> 1 then
    raise exception 'two awards make one membership';
  end if;
  if (select tier from league_memberships
      where user_id = '00000000-0000-1127-f000-000000000001' and week_start = v_week) <> 1 then
    raise exception 'a new account starts in tier 1';
  end if;
end $$;

-- An excluded account earns points and plays in no league.
insert into leaderboard_exclusions (user_id, reason)
values ('00000000-0000-1127-f000-000000000002', 'league smoke');
insert into food_cred_events (user_id, source_action, points, related_entity_id, related_entity_type)
values ('00000000-0000-1127-f000-000000000002', 'stall_saved', 2, 'smoke-league-stall-2', 'stall');

do $$
begin
  if exists (select 1 from league_memberships where user_id = '00000000-0000-1127-f000-000000000002') then
    raise exception 'an excluded account does not join a league';
  end if;
end $$;

-- 31 accounts earn at once: no cohort passes 30 and every count matches its memberships.
insert into food_cred_events (user_id, source_action, points, related_entity_id, related_entity_type)
select ('00000000-0000-1127-f200-' || lpad(g::text, 12, '0'))::uuid, 'stall_saved', 2, 'smoke-league-stall-cap', 'stall'
from generate_series(1, 31) g;

do $$
declare
  v_week date := date_trunc('week', now() at time zone 'Asia/Singapore')::date;
begin
  if (select count(distinct m.cohort_id) from league_memberships m
      where m.week_start = v_week and m.user_id::text like '00000000-0000-1127-f2%') < 2 then
    raise exception '31 accounts need at least two tier 1 cohorts';
  end if;
  if exists (select 1 from league_cohorts where member_count > 30) then
    raise exception 'a cohort never passes 30';
  end if;
  if exists (
    select 1 from league_cohorts c
    where c.member_count <> (select count(*) from league_memberships m where m.cohort_id = c.id)
  ) then
    raise exception 'a cohort counts exactly its members';
  end if;
end $$;

-- 3. The weekly close. A 14 person tier 2 cohort the Monday of 2020-01-06, scored 14 down to 1.
insert into league_user_tiers (user_id, tier)
select ('00000000-0000-1127-f100-' || lpad(g::text, 12, '0'))::uuid, 2
from generate_series(1, 14) g;

insert into leaderboard_events (user_id, kind, points, created_at)
select ('00000000-0000-1127-f100-' || lpad(g::text, 12, '0'))::uuid, 'task', 15 - g,
  timestamp '2020-01-07 10:00' at time zone 'Asia/Singapore'
from generate_series(1, 14) g;

do $$
begin
  if (select count(*) from league_memberships
      where week_start = date '2020-01-06' and tier = 2
        and user_id::text like '00000000-0000-1127-f1%') <> 14
    or (select count(distinct cohort_id) from league_memberships
        where week_start = date '2020-01-06' and user_id::text like '00000000-0000-1127-f1%') <> 1 then
    raise exception 'the 14 closing accounts share one tier 2 cohort';
  end if;
  perform app_private.close_leaderboard_week(date '2020-01-06');
  if (select count(*) from league_week_results
      where week_start = date '2020-01-06' and user_id::text like '00000000-0000-1127-f1%') <> 14 then
    raise exception 'the close writes one result per member';
  end if;
  if (select count(*) from league_week_results where week_start = date '2020-01-06'
        and user_id::text like '00000000-0000-1127-f1%' and outcome = 'promoted') <> 7
    or (select count(*) from league_week_results where week_start = date '2020-01-06'
        and user_id::text like '00000000-0000-1127-f1%' and outcome = 'relegated') <> 5
    or (select count(*) from league_week_results where week_start = date '2020-01-06'
        and user_id::text like '00000000-0000-1127-f1%' and outcome = 'stayed') <> 2 then
    raise exception 'the top 7 move up, the bottom 5 move down, the rest stay';
  end if;
  if (select tier from league_user_tiers where user_id = '00000000-0000-1127-f100-000000000001') <> 3
    or (select tier from league_user_tiers where user_id = '00000000-0000-1127-f100-000000000008') <> 2
    or (select tier from league_user_tiers where user_id = '00000000-0000-1127-f100-000000000014') <> 1 then
    raise exception 'next week''s tiers follow the outcomes';
  end if;
  if (select rank from league_week_results
      where week_start = date '2020-01-06' and user_id = '00000000-0000-1127-f100-000000000001') <> 1 then
    raise exception 'the highest score ranks first';
  end if;
  -- Closing again changes nothing.
  if app_private.close_league_week(date '2020-01-06') <> 0 then
    raise exception 'a league week is closed once';
  end if;
  if (select tier from league_user_tiers where user_id = '00000000-0000-1127-f100-000000000001') <> 3 then
    raise exception 'a second close must not move a tier twice';
  end if;
end $$;

-- 4. get_my_league_status, as the first account.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-1127-f000-000000000001', true);
set local role authenticated;

do $$
declare
  v_status record;
begin
  select * into v_status from public.get_my_league_status();
  if v_status.tier is distinct from 1 or not v_status.is_member or v_status.cohort_id is null
    or v_status.rank is null or v_status.week_points <> 17 or v_status.cohort_size < 1
    or v_status.promote_count <> 7 or v_status.relegate_count <> 5
    or v_status.promotion_line_points is null or v_status.week_ends_at <= now() then
    raise exception 'league status is %', v_status;
  end if;
  if jsonb_array_length(public.export_my_data() -> 'data' -> 'leagueMemberships') < 1
    or not (public.export_my_data() -> 'data') ? 'leagueTier'
    or not (public.export_my_data() -> 'data') ? 'leagueWeekResults' then
    raise exception 'the data export must include the league tables';
  end if;
  begin
    perform 1 from public.league_memberships;
    raise exception 'a signed-in diner must not read league_memberships directly';
  exception when insufficient_privilege then null;
  end;
end $$;

-- A diner who has not earned yet still gets an answer: the start tier and no membership.
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-1127-f000-000000000002', true);
set local role authenticated;

do $$
declare
  v_status record;
begin
  select * into v_status from public.get_my_league_status();
  if v_status.tier is distinct from 1 or v_status.is_member or v_status.week_points <> 0 then
    raise exception 'a diner outside the league sees tier 1, not a member, 0 points, got %', v_status;
  end if;
end $$;

reset role;
set local role anon;
do $$
begin
  begin
    perform * from public.get_my_league_status();
    raise exception 'anon must not run get_my_league_status';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$
begin
  if not exists (
    select 1 from app_private.request_rate_rules
    where route = 'rpc/get_my_league_status' and anon_per_minute is null and user_per_minute is not null
  ) then
    raise exception 'get_my_league_status needs a signed-in rate rule';
  end if;
end $$;

rollback;
