-- smoke: supabase/smoke/leaderboard_rank_movement.sql
-- Leaderboard rank movement (redesign PR 4, plan approved by the owner 2026-11-08).
--
-- 1. leaderboard_rank_snapshots: each diner's all-time Most active rank when a week closes
--    (Monday 00:05 Singapore time). close_leaderboard_week writes it once per week, under the
--    refresh lock, with on conflict do nothing, so a second close or a re-run adds nothing.
--    RLS on, no policies: read only through get_my_rank_movement.
-- 2. Activity: a new event type, board_top_ten. refresh_leaderboards adds one row the first
--    time a diner reaches this week's Most active top ten. target_id is a per-diner, per-week
--    key (md5 of user id and week start), and a unique partial index on it makes a repeat
--    insert a no-op, so two refreshes at once still add one row. No push: the inbox only.
-- 3. RPC get_my_rank_movement (signed in only, VOLATILE, rate rule 60 a minute): your final
--    Most active rank last week, your all-time rank when this week began, and your all-time
--    rank now. The app shows "Up 3 places since Monday" and "Last week #5".
--
-- Rollback: supabase/rollbacks/20261108120000_leaderboard_rank_movement.down.sql.

create schema if not exists app_private;

-- 1. Snapshot table.
create table if not exists public.leaderboard_rank_snapshots (
  week_start date not null,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  rank integer not null,
  score numeric(12, 2) not null,
  primary key (week_start, user_id)
);
create index if not exists idx_leaderboard_rank_snapshots_user
  on public.leaderboard_rank_snapshots (user_id, week_start desc);

alter table public.leaderboard_rank_snapshots enable row level security;
revoke all on table public.leaderboard_rank_snapshots from public, anon, authenticated;
grant all on table public.leaderboard_rank_snapshots to service_role;

-- 2. Activity event type and its once-a-week key.
do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.activity_events'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%event_type%'
  loop
    execute format('alter table public.activity_events drop constraint %I', v_constraint.conname);
  end loop;
end $$;

alter table public.activity_events
  add constraint activity_events_event_type_check
  check (event_type in (
    'new_like',
    'new_comment',
    'new_reply',
    'new_follower',
    'follow_request',
    'board_top_ten'
  ));

create unique index if not exists uniq_activity_events_board_top_ten
  on public.activity_events (recipient_id, event_type, target_id)
  where event_type = 'board_top_ten';

-- 3. Refresh: as in 20261107120000, then the top ten Activity rows.
create or replace function app_private.refresh_leaderboards()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz;
  v_week_start timestamptz;
  v_rows integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('leaderboard:refresh', 0));
  perform app_private.unlock_board_achievements();
  -- The wall clock, not the transaction start, so rows written earlier in this transaction
  -- (the achievement points just paid) fall inside the window.
  v_now := clock_timestamp();
  v_week_start := date_trunc('week', v_now at time zone 'Asia/Singapore') at time zone 'Asia/Singapore';

  delete from leaderboard_standings;
  insert into leaderboard_standings (board, period, user_id, score, rank, computed_at)
  select 'active', 'week', s.user_id, s.score, rank() over (order by s.score desc)::integer, v_now
  from app_private.leaderboard_scores('active', v_week_start, v_now) s
  union all
  select 'active', 'all', s.user_id, s.score, rank() over (order by s.score desc)::integer, v_now
  from app_private.leaderboard_scores('active', '-infinity'::timestamptz, v_now) s
  union all
  select 'trending', 'week', s.user_id, s.score, rank() over (order by s.score desc)::integer, v_now
  from app_private.leaderboard_scores('trending', v_now - interval '7 days', v_now) s;
  get diagnostics v_rows = row_count;

  -- First time in this week's Most active top ten: one inbox row a week. The key is per diner
  -- and per week, and the unique index turns a repeat into nothing.
  insert into activity_events (recipient_id, actor_id, event_type, target_type, target_id)
  select s.user_id, s.user_id, 'board_top_ten', 'profile',
    md5(s.user_id::text || ':board_top_ten:' || (v_week_start at time zone 'Asia/Singapore')::date::text)::uuid
  from leaderboard_standings s
  where s.board = 'active' and s.period = 'week' and s.rank <= 10 and s.score > 0
  on conflict (recipient_id, event_type, target_id) where event_type = 'board_top_ten'
  do nothing;

  return v_rows;
end;
$$;

revoke all on function app_private.refresh_leaderboards() from public, anon, authenticated;
grant execute on function app_private.refresh_leaderboards() to service_role;

-- 4. Weekly close: as in 20261107120000, plus everyone's all-time rank as the week ends.
create or replace function app_private.close_leaderboard_week(p_week_start date default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_start date := coalesce(
    p_week_start,
    (date_trunc('week', now() at time zone 'Asia/Singapore') - interval '7 days')::date
  );
  v_from timestamptz := v_start::timestamp at time zone 'Asia/Singapore';
  v_to timestamptz := (v_start + 7)::timestamp at time zone 'Asia/Singapore';
  v_rows integer;
begin
  if extract(isodow from v_start) <> 1 then
    raise exception 'week_start must be a Monday' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('leaderboard:refresh', 0));

  insert into leaderboard_week_results (week_start, board, user_id, rank, score)
  select v_start, 'active', s.user_id, rank() over (order by s.score desc)::integer, s.score
  from app_private.leaderboard_scores('active', v_from, v_to) s
  union all
  select v_start, 'trending', s.user_id, rank() over (order by s.score desc)::integer, s.score
  from app_private.leaderboard_scores('trending', v_to - interval '7 days', v_to) s
  on conflict do nothing;
  get diagnostics v_rows = row_count;

  -- The all-time board as the week ended: "since Monday" movement reads from this.
  insert into leaderboard_rank_snapshots (week_start, user_id, rank, score)
  select v_start, s.user_id, rank() over (order by s.score desc)::integer, s.score
  from app_private.leaderboard_scores('active', '-infinity'::timestamptz, v_to) s
  on conflict do nothing;

  perform app_private.unlock_board_achievements();
  return v_rows;
end;
$$;

revoke all on function app_private.close_leaderboard_week(date) from public, anon, authenticated;
grant execute on function app_private.close_leaderboard_week(date) to service_role;

-- 5. RPC.
create or replace function app_private.get_my_rank_movement()
returns table (
  last_week_rank integer,
  week_start_all_rank integer,
  all_rank integer
)
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  with week as (
    select (date_trunc('week', now() at time zone 'Asia/Singapore') - interval '7 days')::date as last_start
  )
  select
    (select r.rank from public.leaderboard_week_results r, week
      where r.board = 'active' and r.user_id = auth.uid() and r.week_start = week.last_start)
      as last_week_rank,
    (select s.rank from public.leaderboard_rank_snapshots s, week
      where s.user_id = auth.uid() and s.week_start = week.last_start) as week_start_all_rank,
    (select st.rank from public.leaderboard_standings st
      where st.board = 'active' and st.period = 'all' and st.user_id = auth.uid()) as all_rank
  where auth.uid() is not null;
$$;

revoke all on function app_private.get_my_rank_movement() from public, anon, authenticated;
grant execute on function app_private.get_my_rank_movement() to authenticated, service_role;

create or replace function public.get_my_rank_movement()
returns table (
  last_week_rank integer,
  week_start_all_rank integer,
  all_rank integer
)
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select * from app_private.get_my_rank_movement();
$$;

revoke all on function public.get_my_rank_movement() from public, anon;
grant execute on function public.get_my_rank_movement() to authenticated, service_role;

insert into app_private.request_rate_rules (route, anon_per_minute, user_per_minute, note) values
  ('rpc/get_my_rank_movement', null, 60, 'own leaderboard rank movement')
on conflict (route) do nothing;

notify pgrst, 'reload schema';
