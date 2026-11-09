-- Undo 20261108120000_leaderboard_rank_movement: drops get_my_rank_movement and its rate rule,
-- puts refresh_leaderboards and close_leaderboard_week back to 20261107120000, archives the
-- board_top_ten Activity rows and the rank snapshots to rollback_archive and deletes them, then
-- restores the activity_events type check from 20261019074000.
-- expect-row-loss: public.activity_events, public.leaderboard_rank_snapshots, app_private.request_rate_rules

drop function if exists public.get_my_rank_movement();
drop function if exists app_private.get_my_rank_movement();
delete from app_private.request_rate_rules where route = 'rpc/get_my_rank_movement';

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
  return v_rows;
end;
$$;

revoke all on function app_private.refresh_leaderboards() from public, anon, authenticated;
grant execute on function app_private.refresh_leaderboards() to service_role;

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

  perform app_private.unlock_board_achievements();
  return v_rows;
end;
$$;

revoke all on function app_private.close_leaderboard_week(date) from public, anon, authenticated;
grant execute on function app_private.close_leaderboard_week(date) to service_role;

create schema if not exists rollback_archive;
drop table if exists rollback_archive.activity_events_20261108120000;
create table rollback_archive.activity_events_20261108120000 as
select * from public.activity_events where event_type = 'board_top_ten';
delete from public.activity_events where event_type = 'board_top_ten';
drop index if exists public.uniq_activity_events_board_top_ten;

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
    'follow_request'
  ));

drop table if exists rollback_archive.leaderboard_rank_snapshots_20261108120000;
create table rollback_archive.leaderboard_rank_snapshots_20261108120000 as
select * from public.leaderboard_rank_snapshots;
drop table if exists public.leaderboard_rank_snapshots;

notify pgrst, 'reload schema';
