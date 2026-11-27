-- smoke: supabase/smoke/set_dish_tried.sql
-- smoke: supabase/smoke/weekly_leagues.sql
-- Weekly leagues (package H, defaults approved by the owner 2026-11-26).
--
-- Everyone who earns points in a week plays in a league that week, with no opt-in:
--   * Tasks count. A Food Cred award for a tried stall, a saved stall, a review or a weekly
--     mission (with its existing daily caps and dedupe) writes one 'task' row to
--     leaderboard_events, worth the Food Cred it paid. Posts and achievements already count.
--     The Most active board counts 'task' rows too.
--   * Auto-join. The first positive Most active or task row of a Singapore week (Monday 00:00)
--     puts the account in a cohort of up to 30 at its tier, in the same transaction as the
--     award. A per week and tier advisory lock picks or opens the cohort, so two first awards
--     at once make one membership and a cohort never passes 30. New accounts start in tier 1.
--     Accounts under 7 days old stay off the global board but play in a league; excluded
--     accounts do not join.
--   * Five tiers (Bronze, Silver, Gold, Platinum, Diamond). At the weekly close the top 7 of a
--     cohort with points move up a tier and the bottom 5 (below the top 7) move down, once
--     (on conflict do nothing on the results).
--
-- 1. app_private.league_setting(): the numbers above, in one place (src/constants/leagueConfig.ts
--    mirrors them and a contract test keeps the two equal).
-- 2. Tables: league_cohorts, league_memberships, league_user_tiers, league_week_results. RLS on,
--    no policies: read only through get_my_league_status.
-- 3. leaderboard_events: kind 'task' and food_cred_event_id (one task row per award).
--    Triggers: food_cred_events insert -> task row; leaderboard_events insert -> join.
-- 4. leaderboard_scores counts 'task' on the Most active board. close_leaderboard_week also
--    closes the leagues (app_private.close_league_week).
-- 5. RPC get_my_league_status() (signed-in only, VOLATILE, rate rule): tier, live rank in the
--    cohort, week points, the promotion line, points to promotion and when the week ends.
-- 6. app_private.export_my_data also exports leagueMemberships, leagueTier, leagueWeekResults.
--
-- Rollback: supabase/rollbacks/20261127150000_weekly_leagues.down.sql.

create schema if not exists app_private;
grant usage on schema app_private to authenticated, service_role;

-- 1. Settings.
create or replace function app_private.league_setting(p_key text)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_key
    when 'cohort_size' then 30
    when 'tier_count' then 5
    when 'promote_count' then 7
    when 'relegate_count' then 5
    when 'start_tier' then 1
    else null
  end;
$$;

revoke all on function app_private.league_setting(text) from public, anon, authenticated;

-- Food Cred actions that count as league tasks, and what they are worth (the Food Cred paid).
create or replace function app_private.league_task_points(p_source_action text, p_points integer)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_source_action in ('stall_marked_tried', 'stall_saved', 'review_created', 'mission_completed')
      then greatest(coalesce(p_points, 0), 0)
    else 0
  end;
$$;

revoke all on function app_private.league_task_points(text, integer) from public, anon, authenticated;

-- 2. Tables.
create table if not exists public.league_cohorts (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  tier smallint not null check (tier between 1 and 5),
  member_count integer not null default 0 check (member_count >= 0),
  created_at timestamptz not null default now()
);
create index if not exists idx_league_cohorts_week_tier
  on public.league_cohorts (week_start, tier, created_at);

create table if not exists public.league_memberships (
  week_start date not null,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  cohort_id uuid not null references public.league_cohorts(id) on delete cascade,
  tier smallint not null check (tier between 1 and 5),
  joined_at timestamptz not null default now(),
  primary key (week_start, user_id)
);
create index if not exists idx_league_memberships_cohort
  on public.league_memberships (cohort_id);

-- A membership that goes (an account deleted cascades here) frees its place: one statement,
-- so it needs no lock against a join that is counting the same cohort.
create or replace function app_private.release_league_place()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update league_cohorts set member_count = greatest(member_count - 1, 0) where id = old.cohort_id;
  return old;
end;
$$;

revoke all on function app_private.release_league_place() from public, anon, authenticated;

drop trigger if exists trg_league_memberships_release_place on public.league_memberships;
create trigger trg_league_memberships_release_place
  after delete on public.league_memberships
  for each row
  execute function app_private.release_league_place();

-- The tier an account plays at next; no row means the start tier.
create table if not exists public.league_user_tiers (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  tier smallint not null check (tier between 1 and 5),
  updated_at timestamptz not null default now()
);

create table if not exists public.league_week_results (
  week_start date not null,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  cohort_id uuid not null references public.league_cohorts(id) on delete cascade,
  tier smallint not null check (tier between 1 and 5),
  rank integer not null,
  score numeric(12, 2) not null,
  outcome text not null check (outcome in ('promoted', 'stayed', 'relegated')),
  next_tier smallint not null check (next_tier between 1 and 5),
  primary key (week_start, user_id)
);

alter table public.league_cohorts enable row level security;
alter table public.league_memberships enable row level security;
alter table public.league_user_tiers enable row level security;
alter table public.league_week_results enable row level security;

revoke all on table public.league_cohorts, public.league_memberships, public.league_user_tiers,
  public.league_week_results from public, anon, authenticated;
grant all on table public.league_cohorts, public.league_memberships, public.league_user_tiers,
  public.league_week_results to service_role;

-- 3. The task ledger kind and the triggers.
do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.leaderboard_events'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%kind%'
  loop
    execute format('alter table public.leaderboard_events drop constraint %I', v_constraint.conname);
  end loop;
end $$;

alter table public.leaderboard_events
  add constraint leaderboard_events_kind_check check (kind in (
    'post', 'off_board_post', 'new_stall', 'first_dish_photo', 'rich_post', 'achievement',
    'follower', 'like', 'save', 'share', 'task'
  ));

alter table public.leaderboard_events
  add column if not exists food_cred_event_id uuid references public.food_cred_events(id) on delete cascade;

-- One task row per Food Cred award.
create unique index if not exists uniq_leaderboard_events_food_cred_event
  on public.leaderboard_events (food_cred_event_id)
  where food_cred_event_id is not null;

create or replace function app_private.credit_food_cred_task()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_points integer := app_private.league_task_points(new.source_action, new.points);
begin
  if v_points <= 0 then
    return new;
  end if;
  insert into leaderboard_events (user_id, kind, points, food_cred_event_id, created_at)
  values (new.user_id, 'task', v_points, new.id, new.created_at)
  on conflict (food_cred_event_id) where food_cred_event_id is not null do nothing;
  return new;
end;
$$;

revoke all on function app_private.credit_food_cred_task() from public, anon, authenticated;

drop trigger if exists trg_food_cred_events_league_task on public.food_cred_events;
create trigger trg_food_cred_events_league_task
  after insert on public.food_cred_events
  for each row
  when (new.points > 0)
  execute function app_private.credit_food_cred_task();

-- Puts the account in this week's cohort at its tier, once. Two first awards at once queue on
-- the week and tier lock; the one that waited sees the membership committed by the other
-- (READ COMMITTED reads after the lock) and inserts nothing, so a cohort never passes its size.
create or replace function app_private.join_league_week(p_user_id uuid, p_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_week date := date_trunc('week', coalesce(p_at, now()) at time zone 'Asia/Singapore')::date;
  v_tier smallint;
  v_cohort uuid;
  v_joined uuid;
begin
  if p_user_id is null then
    return null;
  end if;
  -- Every point of the week holds this week's lock shared until it commits; the close takes it
  -- exclusive, so a close waits for points still in flight instead of missing them.
  perform pg_advisory_xact_lock_shared(hashtextextended('league:week:' || v_week::text, 0));
  select m.cohort_id into v_cohort
  from league_memberships m
  where m.week_start = v_week and m.user_id = p_user_id;
  if v_cohort is not null then
    return v_cohort;
  end if;
  if exists (
    select 1 from leaderboard_exclusions x
    where x.user_id = p_user_id and (x.until is null or x.until > now())
  ) then
    return null;
  end if;

  -- This week's tier is what last week's close decided. If the account played last week and
  -- that week is not closed yet (the first points after Monday 00:00, or a late close job),
  -- close it now; the close is once only, so the scheduled close later changes nothing.
  if exists (
    select 1 from league_memberships m
    where m.week_start = v_week - 7 and m.user_id = p_user_id
  ) and not exists (
    select 1 from league_week_results r
    where r.week_start = v_week - 7 and r.user_id = p_user_id
  ) then
    perform app_private.close_league_week(v_week - 7);
  end if;

  v_tier := coalesce(
    (select t.tier from league_user_tiers t where t.user_id = p_user_id),
    app_private.league_setting('start_tier')
  );
  perform pg_advisory_xact_lock(hashtextextended('league:join:' || v_week::text || ':' || v_tier::text, 0));

  select m.cohort_id into v_cohort
  from league_memberships m
  where m.week_start = v_week and m.user_id = p_user_id;
  if v_cohort is not null then
    return v_cohort;
  end if;

  select c.id into v_cohort
  from league_cohorts c
  where c.week_start = v_week
    and c.tier = v_tier
    and c.member_count < app_private.league_setting('cohort_size')
  order by c.created_at, c.id
  limit 1
  for update;

  if v_cohort is null then
    insert into league_cohorts (week_start, tier)
    values (v_week, v_tier)
    returning id into v_cohort;
  end if;

  insert into league_memberships (week_start, user_id, cohort_id, tier)
  values (v_week, p_user_id, v_cohort, v_tier)
  on conflict (week_start, user_id) do nothing
  returning cohort_id into v_joined;

  if v_joined is null then
    return (select m.cohort_id from league_memberships m
      where m.week_start = v_week and m.user_id = p_user_id);
  end if;
  update league_cohorts set member_count = member_count + 1 where id = v_cohort;
  return v_cohort;
end;
$$;

revoke all on function app_private.join_league_week(uuid, timestamptz) from public, anon, authenticated;

create or replace function app_private.join_league_on_points()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform app_private.join_league_week(new.user_id, new.created_at);
  return new;
end;
$$;

revoke all on function app_private.join_league_on_points() from public, anon, authenticated;

drop trigger if exists trg_leaderboard_events_join_league on public.leaderboard_events;
create trigger trg_leaderboard_events_join_league
  after insert on public.leaderboard_events
  for each row
  when (
    new.points > 0
    and new.voided_at is null
    and new.kind in ('post', 'new_stall', 'first_dish_photo', 'rich_post', 'achievement', 'task')
  )
  execute function app_private.join_league_on_points();

-- Points dated in a week that has already closed (an award whose transaction began before
-- Monday 00:00 and reached the week lock only after the close ran) would never count: the close
-- is once only. Before the row is written, take the week lock shared (held to commit, so a close
-- that starts later waits for it); if that week already has close results, the points count in
-- the current week instead.
create or replace function app_private.league_points_week_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_week date := date_trunc('week', coalesce(new.created_at, now()) at time zone 'Asia/Singapore')::date;
begin
  perform pg_advisory_xact_lock_shared(hashtextextended('league:week:' || v_week::text, 0));
  if v_week < date_trunc('week', clock_timestamp() at time zone 'Asia/Singapore')::date
    and (
      exists (select 1 from league_week_results r where r.week_start = v_week)
      or exists (select 1 from leaderboard_week_results r where r.week_start = v_week)
    )
  then
    new.created_at := clock_timestamp();
  end if;
  return new;
end;
$$;

revoke all on function app_private.league_points_week_guard() from public, anon, authenticated;

drop trigger if exists trg_leaderboard_events_league_week_guard on public.leaderboard_events;
create trigger trg_leaderboard_events_league_week_guard
  before insert on public.leaderboard_events
  for each row
  when (
    new.points > 0
    and new.voided_at is null
    and new.kind in ('post', 'new_stall', 'first_dish_photo', 'rich_post', 'achievement', 'task')
  )
  execute function app_private.league_points_week_guard();

-- 4. Scores and the weekly close.

-- 20261107120000's body with 'task' on the Most active board.
create or replace function app_private.leaderboard_scores(
  p_board text,
  p_from timestamptz,
  p_to timestamptz
)
returns table (user_id uuid, score numeric)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select e.user_id,
    round(sum(
      case when p_board = 'trending'
        then e.points * power(0.5, extract(epoch from (p_to - e.created_at)) / 259200.0)
        else e.points
      end
    )::numeric, 2) as score
  from public.leaderboard_events e
  join public.user_profiles up on up.id = e.user_id
  where e.voided_at is null
    and e.created_at >= p_from
    and e.created_at < p_to
    and (
      (p_board = 'active' and e.kind in ('post', 'new_stall', 'first_dish_photo', 'rich_post', 'achievement', 'task'))
      or (p_board = 'trending' and e.kind in ('follower', 'like', 'save', 'share'))
    )
    and up.created_at <= p_to - interval '7 days'
    and not exists (
      select 1 from public.leaderboard_exclusions x
      where x.user_id = e.user_id and (x.until is null or x.until > p_to)
    )
    and (
      e.post_id is null
      or (
        not exists (
          select 1 from public.post_moderation_states pms
          where pms.post_id = e.post_id and pms.state in ('under_review', 'hidden', 'removed')
        )
        and (
          select count(*) from public.post_reports r
          where r.post_id = e.post_id and r.status in ('open', 'reviewing')
        ) < 2
      )
    )
  group by e.user_id
  having sum(e.points) > 0;
$$;

revoke all on function app_private.leaderboard_scores(text, timestamptz, timestamptz) from public, anon, authenticated;

-- League points for one week, for one cohort (or every cohort that week): the Most active and
-- task rows, the same moderation filters as the board, no account-age filter. Members with no
-- live points score 0. One aggregate over at most the week's members, never one per member.
create or replace function app_private.league_cohort_scores(p_week_start date, p_cohort_id uuid default null)
returns table (user_id uuid, cohort_id uuid, tier smallint, score numeric, joined_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with bounds as (
    select p_week_start::timestamp at time zone 'Asia/Singapore' as from_at,
      (p_week_start + 7)::timestamp at time zone 'Asia/Singapore' as to_at
  ),
  members as (
    select m.user_id, m.cohort_id, m.tier, m.joined_at
    from public.league_memberships m
    where m.week_start = p_week_start
      and (p_cohort_id is null or m.cohort_id = p_cohort_id)
  ),
  points as (
    select e.user_id, sum(e.points) as score
    from public.leaderboard_events e
    join members mm on mm.user_id = e.user_id
    cross join bounds b
    where e.voided_at is null
      and e.created_at >= b.from_at
      and e.created_at < b.to_at
      and e.kind in ('post', 'new_stall', 'first_dish_photo', 'rich_post', 'achievement', 'task')
      and (
        e.post_id is null
        or (
          not exists (
            select 1 from public.post_moderation_states pms
            where pms.post_id = e.post_id and pms.state in ('under_review', 'hidden', 'removed')
          )
          and (
            select count(*) from public.post_reports r
            where r.post_id = e.post_id and r.status in ('open', 'reviewing')
          ) < 2
        )
      )
    group by e.user_id
  )
  select m.user_id, m.cohort_id, m.tier,
    round(greatest(coalesce(p.score, 0), 0)::numeric, 2) as score,
    m.joined_at
  from members m
  left join points p on p.user_id = m.user_id
  where not exists (
    select 1 from public.leaderboard_exclusions x
    where x.user_id = m.user_id
      and (x.until is null or x.until > (select b.to_at from bounds b))
  );
$$;

revoke all on function app_private.league_cohort_scores(date, uuid) from public, anon, authenticated;

-- Finishes one week's leagues, once: ranks each cohort (points, then who joined first), moves
-- the top 7 with points up and the bottom 5 below them down, and sets next week's tiers only
-- for result rows this call inserted, so a second close changes nothing.
create or replace function app_private.close_league_week(p_week_start date)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_promote integer := app_private.league_setting('promote_count');
  v_relegate integer := app_private.league_setting('relegate_count');
  v_top integer := app_private.league_setting('tier_count');
  v_rows integer;
begin
  -- Wait for the week's points still in flight (they hold this lock shared until commit). Taken
  -- before league:close, so nobody holds league:close while waiting on a week.
  perform pg_advisory_xact_lock(hashtextextended('league:week:' || p_week_start::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('league:close', 0));

  with ranked as (
    select s.user_id, s.cohort_id, s.tier, s.score,
      row_number() over (partition by s.cohort_id order by s.score desc, s.joined_at, s.user_id)::integer as rank,
      count(*) over (partition by s.cohort_id)::integer as size
    from app_private.league_cohort_scores(p_week_start, null) s
  ),
  decided as (
    select r.*,
      case
        when r.rank <= v_promote and r.score > 0 and r.tier < v_top then 'promoted'
        when r.rank > v_promote and r.size - r.rank < v_relegate and r.tier > 1 then 'relegated'
        else 'stayed'
      end as outcome
    from ranked r
  ),
  inserted as (
    insert into league_week_results (week_start, user_id, cohort_id, tier, rank, score, outcome, next_tier)
    select p_week_start, d.user_id, d.cohort_id, d.tier, d.rank, d.score, d.outcome,
      (d.tier + case d.outcome when 'promoted' then 1 when 'relegated' then -1 else 0 end)::smallint
    from decided d
    on conflict do nothing
    returning user_id, next_tier
  )
  insert into league_user_tiers (user_id, tier, updated_at)
  select i.user_id, i.next_tier, now() from inserted i
  on conflict (user_id) do update set tier = excluded.tier, updated_at = excluded.updated_at;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

revoke all on function app_private.close_league_week(date) from public, anon, authenticated;
grant execute on function app_private.close_league_week(date) to service_role;

-- 20261108120000's body, then the leagues for the same week.
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
  -- Wait for the week's in-flight points before any board reads them (same lock and order as
  -- close_league_week: the week lock first).
  perform pg_advisory_xact_lock(hashtextextended('league:week:' || v_start::text, 0));
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
  perform app_private.close_league_week(v_start);
  return v_rows;
end;
$$;

revoke all on function app_private.close_leaderboard_week(date) from public, anon, authenticated;
grant execute on function app_private.close_leaderboard_week(date) to service_role;

-- 5. RPC.
create or replace function app_private.get_my_league_status()
returns table (
  tier smallint,
  is_member boolean,
  cohort_id uuid,
  cohort_size integer,
  rank integer,
  week_points numeric,
  promotion_line_points numeric,
  points_to_promotion numeric,
  promote_count integer,
  relegate_count integer,
  week_start date,
  week_ends_at timestamptz
)
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  with wk as (
    select date_trunc('week', now() at time zone 'Asia/Singapore')::date as week_start
  ),
  me as (
    select m.cohort_id, m.tier
    from public.league_memberships m, wk
    where m.week_start = wk.week_start and m.user_id = auth.uid()
  ),
  board as (
    select s.user_id, s.score, s.joined_at,
      row_number() over (order by s.score desc, s.joined_at, s.user_id)::integer as rank
    from wk, me, app_private.league_cohort_scores(wk.week_start, me.cohort_id) s
  ),
  mine as (
    select b.rank, b.score, b.joined_at from board b where b.user_id = auth.uid()
  ),
  -- The member on the promotion line, and whether a tie with them would rank the caller ahead
  -- (the ranking breaks ties by who joined first, then by id).
  line as (
    select
      coalesce(
        (select b.score from board b where b.rank = app_private.league_setting('promote_count')),
        0
      ) as points,
      coalesce((
        select (m.joined_at, auth.uid()) < (b.joined_at, b.user_id)
        from board b, mine m
        where b.rank = app_private.league_setting('promote_count')
      ), false) as tie_wins
  ),
  tier as (
    select coalesce(
      (select me.tier from me),
      (select t.tier from public.league_user_tiers t where t.user_id = auth.uid()),
      app_private.league_setting('start_tier')
    )::smallint as tier
  )
  select
    tier.tier,
    exists (select 1 from me) as is_member,
    (select me.cohort_id from me),
    (select count(*)::integer from board),
    (select mine.rank from mine),
    coalesce((select mine.score from mine), 0),
    case when tier.tier < app_private.league_setting('tier_count') then line.points end,
    case
      when tier.tier >= app_private.league_setting('tier_count') then null
      when not exists (select 1 from mine) then null
      when (select mine.rank from mine) <= app_private.league_setting('promote_count')
        and (select mine.score from mine) > 0 then 0
      else greatest(
        line.points - (select mine.score from mine) + case when line.tie_wins then 0 else 1 end,
        1
      )
    end,
    app_private.league_setting('promote_count'),
    app_private.league_setting('relegate_count'),
    wk.week_start,
    (wk.week_start + 7)::timestamp at time zone 'Asia/Singapore'
  from wk, line, tier
  where auth.uid() is not null;
$$;

revoke all on function app_private.get_my_league_status() from public, anon, authenticated;
grant execute on function app_private.get_my_league_status() to authenticated, service_role;

create or replace function public.get_my_league_status()
returns table (
  tier smallint,
  is_member boolean,
  cohort_id uuid,
  cohort_size integer,
  rank integer,
  week_points numeric,
  promotion_line_points numeric,
  points_to_promotion numeric,
  promote_count integer,
  relegate_count integer,
  week_start date,
  week_ends_at timestamptz
)
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select * from app_private.get_my_league_status();
$$;

revoke all on function public.get_my_league_status() from public, anon;
grant execute on function public.get_my_league_status() to authenticated, service_role;

-- Rate rule (signed-in callers only; anon cannot execute it).
insert into app_private.request_rate_rules (route, anon_per_minute, user_per_minute, note) values
  ('rpc/get_my_league_status', null, 60, 'own weekly league tier, rank and points to promotion')
on conflict (route) do nothing;

-- 6. PDPA export.
create or replace function app_private.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_data jsonb;
begin
  if v_user is null then
    raise exception 'export_my_data requires a signed-in user' using errcode = '42501';
  end if;

  v_data := jsonb_build_object(
    'profile',
      (select to_jsonb(t) from public.user_profiles t where t.id = v_user),
    'privacySettings',
      (select to_jsonb(t) from public.privacy_settings t where t.user_id = v_user),
    'appSettings',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_settings t where t.user_id = v_user), '[]'::jsonb),
    'notificationPreferences',
      (select to_jsonb(t) from public.notification_preferences t where t.user_id = v_user),
    'tasteVector',
      (select to_jsonb(t) from public.user_taste_vectors t where t.user_id = v_user),
    'quizResponses',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.quiz_responses t where t.user_id = v_user), '[]'::jsonb),
    'tasteEvents',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.taste_interaction_events t where t.user_id = v_user), '[]'::jsonb),
    'favouriteDishes',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_favourite_dishes t where t.user_id = v_user), '[]'::jsonb),
    'foodHistory',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_dish_affinities t where t.user_id = v_user), '[]'::jsonb),
    'stallHistory',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_stall_affinities t where t.user_id = v_user), '[]'::jsonb),
    'reviews',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.reviews t where t.user_id = v_user), '[]'::jsonb),
    'posts',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.posts t where t.author_id = v_user), '[]'::jsonb),
    'postComments',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.post_comments t where t.user_id = v_user), '[]'::jsonb),
    'postLikes',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.post_likes t where t.user_id = v_user), '[]'::jsonb),
    'savedPosts',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.post_saves t where t.user_id = v_user), '[]'::jsonb),
    'postShares',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.post_shares t where t.user_id = v_user), '[]'::jsonb),
    'hiddenPosts',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.hidden_posts t where t.viewer_id = v_user), '[]'::jsonb),
    'bites',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.bites t where t.author_id = v_user), '[]'::jsonb),
    'biteReactions',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.bite_reactions t where t.user_id = v_user), '[]'::jsonb),
    'follows',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.follows t where t.follower_id = v_user or t.followee_id = v_user), '[]'::jsonb),
    'followedStalls',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.stall_follows t where t.user_id = v_user), '[]'::jsonb),
    'activityDays',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_activity_days t where t.user_id = v_user), '[]'::jsonb),
    'blocks',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_blocks t where t.blocker_id = v_user), '[]'::jsonb),
    'contentReports',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.content_reports t where t.reporter_id = v_user), '[]'::jsonb),
    'postReports',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.post_reports t where t.reporter_id = v_user), '[]'::jsonb),
    'checklists',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.checklists t where t.user_id = v_user), '[]'::jsonb),
    'checklistItems',
      coalesce((
        select jsonb_agg(to_jsonb(i))
        from public.checklist_items i
        join public.checklists c on c.id = i.checklist_id
        where c.user_id = v_user
      ), '[]'::jsonb),
    'portfolios',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.portfolios t where t.owner_id = v_user), '[]'::jsonb),
    'passportStamps',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.passport_stamps t where t.user_id = v_user), '[]'::jsonb),
    'foodCred',
      (select to_jsonb(t) from public.user_food_cred t where t.user_id = v_user),
    'foodCredEvents',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.food_cred_events t where t.user_id = v_user), '[]'::jsonb),
    'stallSubmissions',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_stall_submissions t where t.user_id = v_user), '[]'::jsonb),
    'menuPhotoSubmissions',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.menu_photo_submissions t where t.submitted_by = v_user), '[]'::jsonb),
    'activity',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.activity_events t where t.recipient_id = v_user), '[]'::jsonb),
    'merchantAccounts',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.merchant_accounts t where t.user_id = v_user), '[]'::jsonb),
    'accountDeletionRequests',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.account_deletion_requests t where t.user_id = v_user), '[]'::jsonb),
    'reviewHelpfulVotes',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.review_helpful_votes t where t.user_id = v_user), '[]'::jsonb),
    'portfolioItems',
      coalesce((
        select jsonb_agg(to_jsonb(i))
        from public.portfolio_items i
        join public.portfolios p on p.id = i.portfolio_id
        where p.owner_id = v_user
      ), '[]'::jsonb),
    'portfolioCollaborations',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.portfolio_collaborators t where t.user_id = v_user), '[]'::jsonb),
    'portfolioFollows',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.portfolio_follows t where t.user_id = v_user), '[]'::jsonb),
    'recommendationImpressions',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.recommendation_impressions t where t.user_id = v_user), '[]'::jsonb),
    'passportProgressEvents',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.passport_progress_events t where t.user_id = v_user), '[]'::jsonb),
    'stallInteractions',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_stall_interactions t where t.user_id = v_user), '[]'::jsonb),
    'missionProgress',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_mission_progress t where t.user_id = v_user), '[]'::jsonb),
    'moodSearchQueries',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.mood_search_queries t where t.user_id = v_user), '[]'::jsonb),
    'merchantMemberships',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.merchant_members t where t.user_id = v_user), '[]'::jsonb),
    'merchantClaimInterests',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.merchant_claim_interests t where t.claimed_by = v_user), '[]'::jsonb)
  ) || jsonb_build_object(
    'profileFavouriteDishes',
      coalesce((select jsonb_agg(to_jsonb(t) order by t.position) from public.profile_favourite_dishes t where t.user_id = v_user), '[]'::jsonb),
    'tasteRatings',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.dish_taste_ratings t where t.user_id = v_user), '[]'::jsonb),
    'catalogCorrections',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.catalog_corrections t where t.reporter_id = v_user), '[]'::jsonb),
    'notificationJobs',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.notification_jobs t where t.user_id = v_user), '[]'::jsonb)
  ) || jsonb_build_object(
    'portfolioPoints',
      coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.leaderboard_events t where t.user_id = v_user), '[]'::jsonb),
    'achievementUnlocks',
      coalesce((select jsonb_agg(to_jsonb(t) order by t.unlocked_at) from public.achievement_unlocks t where t.user_id = v_user), '[]'::jsonb),
    'leaderboardWeekResults',
      coalesce((select jsonb_agg(to_jsonb(t) order by t.week_start) from public.leaderboard_week_results t where t.user_id = v_user), '[]'::jsonb),
    'portfolioPicks',
      coalesce((select jsonb_agg(to_jsonb(t) order by t.kind, t.slot) from public.portfolio_picks t where t.user_id = v_user), '[]'::jsonb)
  ) || jsonb_build_object(
    'leagueMemberships',
      coalesce((select jsonb_agg(to_jsonb(t) order by t.week_start) from public.league_memberships t where t.user_id = v_user), '[]'::jsonb),
    'leagueTier',
      (select to_jsonb(t) from public.league_user_tiers t where t.user_id = v_user),
    'leagueWeekResults',
      coalesce((select jsonb_agg(to_jsonb(t) order by t.week_start) from public.league_week_results t where t.user_id = v_user), '[]'::jsonb)
  );

  return jsonb_build_object(
    'exportVersion', 2,
    'generatedAt', now(),
    'categories', (select jsonb_agg(k order by k) from jsonb_object_keys(v_data) as k),
    'notIncluded', jsonb_build_array(
      'Push notification tokens (device identifiers that are only used to deliver alerts).',
      'Security, moderation and legal records. Email support to request these.',
      'Rate-limit counters and abuse-protection logs (security records, not personal content).',
      'Lists you reported (list reports are moderation records).'
    ),
    'data', v_data
  );
end;
$$;

notify pgrst, 'reload schema';

-- Untick Tried (folded in from 20261127090000 so this PR has one migration to rehearse).
-- A reviewed dish can be un-ticked from Tried. The review stays; only the Tried mark
-- (user_profiles.reviewed_dish_ids) goes, so the "dishes tried" achievement count drops by one.
-- One statement, so two quick taps or two devices never overwrite each other.

create or replace function public.set_dish_tried(p_dish_id text, p_tried boolean)
returns text[]
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_dish_id text := nullif(btrim(coalesce(p_dish_id, '')), '');
  v_ids text[];
begin
  if v_user_id is null then
    raise exception 'Sign in to mark dishes as tried.' using errcode = '42501';
  end if;
  if v_dish_id is null or char_length(v_dish_id) > 200 then
    raise exception 'A dish id is required.' using errcode = '22023';
  end if;

  update user_profiles up
  set reviewed_dish_ids = case
    when coalesce(p_tried, true) then
      case
        when v_dish_id = any(up.reviewed_dish_ids) then up.reviewed_dish_ids
        else array_append(up.reviewed_dish_ids, v_dish_id)
      end
    else array_remove(up.reviewed_dish_ids, v_dish_id)
  end
  where up.id = v_user_id
  returning up.reviewed_dish_ids into v_ids;

  if not found then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;

  return v_ids;
end;
$$;

comment on function public.set_dish_tried(text, boolean) is
  'Adds or removes a dish in the caller''s Tried list (user_profiles.reviewed_dish_ids); reviews are untouched.';
