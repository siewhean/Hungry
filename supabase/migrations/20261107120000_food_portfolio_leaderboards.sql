-- smoke: supabase/smoke/food_portfolio_leaderboards.sql
-- Food Portfolio leaderboards (plan approved by the owner 2026-11-07, PR B).
--
-- Two boards, both read from one points ledger:
--   Most active: Portfolio points from dish posts (this week, Monday 00:00 Singapore time, and
--     all time). A post with a photo at a catalogue stall earns 10, +5 for a stall you never
--     posted at, +5 for the first photo of that dish on Hungry, +3 for a note of 80+ characters
--     or a rating. Without a photo or a stall it earns 2 "off the board" (counts for your total,
--     not for the board). At most 6 credited posts a day and 1 per stall per 30 minutes.
--   Trending: the last 7 days of engagement on your dishes (approved follower 3, like 1, save 2,
--     share 2), each halving every 3 days. One event per person per kind per day, never your
--     own, never across a block, and only from accounts older than a day with a post or review.
-- Board achievements: Posted, First to post, Followed, Weekly contender, Crowd favourite. A tier
-- reached is recorded once in achievement_unlocks and pays 15/30/60/120 points once.
--
-- 1. Tables: leaderboard_events (the ledger), leaderboard_standings (refreshed every 10
--    minutes), leaderboard_exclusions (admin), leaderboard_week_results (written by the Monday
--    close), achievement_unlocks; posts.board_credit_points. RLS on, no policies: the app reads
--    only through the RPCs below.
-- 2. Triggers: posts publish credits points under a per-author advisory lock (and a per-dish
--    lock for "first photo"), so two posts landing together cannot pass the daily cap or the
--    stall cooldown. A delete, or moderation hiding or removing a post, voids every ledger row
--    for it in one statement. Likes, saves, shares and approved follows insert one row each
--    (a unique partial index enforces one a day); undoing them voids the row.
-- 3. app_private.refresh_leaderboards() rebuilds the standings in one transaction under a lock
--    (readers see the old board until it commits) and unlocks board achievements first.
--    app_private.close_leaderboard_week() writes last week's results once (on conflict do
--    nothing) and unlocks the weekly achievements. pg_cron runs both when it is installed.
--    Withheld from the board: accounts under 7 days old, excluded accounts, posts with 2 or more
--    open reports or under moderation review.
-- 4. RPCs (signed-in only, VOLATILE so the request hook counts them, each with a rate rule):
--    get_leaderboard, get_my_leaderboard_summary, get_my_portfolio_points.
--    exclude_from_leaderboards is service role only.
-- 5. app_private.export_my_data also exports portfolioPoints, achievementUnlocks and
--    leaderboardWeekResults.
--
-- Rollback: supabase/rollbacks/20261107120000_food_portfolio_leaderboards.down.sql.

create schema if not exists app_private;
grant usage on schema app_private to authenticated, service_role;

-- 1. Tables.
create table if not exists public.leaderboard_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  kind text not null check (kind in (
    'post', 'off_board_post', 'new_stall', 'first_dish_photo', 'rich_post', 'achievement',
    'follower', 'like', 'save', 'share'
  )),
  points numeric(8, 2) not null,
  actor_id uuid references public.user_profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  venue_id text,
  achievement_id text,
  tier smallint,
  event_day date not null default ((now() at time zone 'Asia/Singapore')::date),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  void_reason text
);

create index if not exists idx_leaderboard_events_user_created
  on public.leaderboard_events (user_id, created_at desc);
create index if not exists idx_leaderboard_events_post
  on public.leaderboard_events (post_id) where post_id is not null;
create index if not exists idx_leaderboard_events_kind_created
  on public.leaderboard_events (kind, created_at) where voided_at is null;
-- One engagement event per actor, per kind, per person, per Singapore day.
create unique index if not exists uniq_leaderboard_events_engagement_daily
  on public.leaderboard_events (user_id, kind, actor_id, event_day)
  where actor_id is not null and voided_at is null;
-- A post is credited once per kind.
create unique index if not exists uniq_leaderboard_events_post_credit
  on public.leaderboard_events (post_id, kind)
  where actor_id is null and post_id is not null and voided_at is null;

create table if not exists public.leaderboard_standings (
  board text not null check (board in ('active', 'trending')),
  period text not null check (period in ('week', 'all')),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  score numeric(12, 2) not null,
  rank integer not null,
  computed_at timestamptz not null default now(),
  primary key (board, period, user_id)
);
create index if not exists idx_leaderboard_standings_rank
  on public.leaderboard_standings (board, period, rank);

create table if not exists public.leaderboard_exclusions (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  reason text not null,
  until timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.leaderboard_week_results (
  week_start date not null,
  board text not null check (board in ('active', 'trending')),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  rank integer not null,
  score numeric(12, 2) not null,
  primary key (week_start, board, user_id)
);

create table if not exists public.achievement_unlocks (
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  achievement_id text not null,
  tier smallint not null check (tier between 1 and 10),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id, tier)
);

alter table public.posts
  add column if not exists board_credit_points integer not null default 0;

alter table public.leaderboard_events enable row level security;
alter table public.leaderboard_standings enable row level security;
alter table public.leaderboard_exclusions enable row level security;
alter table public.leaderboard_week_results enable row level security;
alter table public.achievement_unlocks enable row level security;

revoke all on table public.leaderboard_events, public.leaderboard_standings,
  public.leaderboard_exclusions, public.leaderboard_week_results, public.achievement_unlocks
  from public, anon, authenticated;
grant all on table public.leaderboard_events, public.leaderboard_standings,
  public.leaderboard_exclusions, public.leaderboard_week_results, public.achievement_unlocks
  to service_role;

-- 2. Credit and void triggers.

-- An account that may move someone's Trending score: older than a day, with a published post or
-- a review. The cheapest filter against throwaway accounts that does not punish new real users.
create or replace function app_private.leaderboard_actor_is_eligible(p_actor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
      select 1 from public.user_profiles up
      where up.id = p_actor_id and up.created_at <= now() - interval '24 hours'
    )
    and (
      exists (
        select 1 from public.posts p
        where p.author_id = p_actor_id and p.status = 'published' and p.deleted_at is null
      )
      or exists (select 1 from public.reviews r where r.user_id = p_actor_id)
    );
$$;

revoke all on function app_private.leaderboard_actor_is_eligible(uuid) from public, anon, authenticated;

create or replace function app_private.credit_post_board_points()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'Asia/Singapore')::date;
  v_credited_today integer;
  v_on_cooldown boolean;
  v_rating numeric := 0;
  v_total integer;
begin
  if new.status <> 'published' or new.deleted_at is not null then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.status = 'published' then
    return null;
  end if;

  -- One author at a time: the cap and cooldown below read committed rows after this lock.
  perform pg_advisory_xact_lock(hashtextextended('board:' || new.author_id::text, 0));
  -- One poster of a dish at a time, so "first photo of this dish" is paid once.
  if new.dish_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('board-dish:' || new.dish_id, 0));
  end if;

  if exists (
    select 1 from leaderboard_events e
    where e.post_id = new.id and e.actor_id is null and e.voided_at is null
  ) then
    return null;
  end if;

  if new.venue_id is null or not exists (
    select 1 from post_media m where m.post_id = new.id and m.media_type = 'image'
  ) then
    insert into leaderboard_events (user_id, kind, points, post_id, venue_id)
    values (new.author_id, 'off_board_post', 2, new.id, new.venue_id)
    on conflict do nothing;
    return null;
  end if;

  select count(*) into v_credited_today
  from leaderboard_events e
  where e.user_id = new.author_id
    and e.kind = 'post'
    and e.event_day = v_today
    and e.voided_at is null;

  v_on_cooldown := exists (
    select 1 from leaderboard_events e
    where e.user_id = new.author_id
      and e.kind = 'post'
      and e.venue_id = new.venue_id
      and e.voided_at is null
      and e.created_at > now() - interval '30 minutes'
  );

  -- Over the daily cap or inside the stall cooldown: the post is live but earns nothing.
  if v_credited_today >= 6 or v_on_cooldown then
    return null;
  end if;

  if jsonb_typeof(new.generated_content -> 'rating') = 'number' then
    v_rating := (new.generated_content ->> 'rating')::numeric;
  end if;

  insert into leaderboard_events (user_id, kind, points, post_id, venue_id)
  select new.author_id, credit.kind, credit.points, new.id, new.venue_id
  from (values
    ('post', 10, true),
    ('new_stall', 5, not exists (
      select 1 from posts p
      where p.author_id = new.author_id
        and p.venue_id = new.venue_id
        and p.id <> new.id
        and p.status = 'published'
        and p.deleted_at is null
    )),
    ('first_dish_photo', 5, new.dish_id is not null and not exists (
      select 1 from posts p
      join post_media m on m.post_id = p.id and m.media_type = 'image'
      where p.dish_id = new.dish_id
        and p.id <> new.id
        and p.status = 'published'
        and p.deleted_at is null
    )),
    ('rich_post', 3, char_length(btrim(coalesce(new.caption, ''))) >= 80 or v_rating > 0)
  ) as credit(kind, points, applies)
  where credit.applies
  on conflict do nothing;

  select coalesce(sum(e.points), 0)::integer into v_total
  from leaderboard_events e
  where e.post_id = new.id and e.actor_id is null and e.voided_at is null;

  update posts set board_credit_points = v_total where id = new.id;
  return null;
end;
$$;

revoke all on function app_private.credit_post_board_points() from public, anon, authenticated;

drop trigger if exists trg_posts_credit_board_points on public.posts;
create trigger trg_posts_credit_board_points
after insert or update of status on public.posts
for each row execute function app_private.credit_post_board_points();

-- A post deleted by its owner, or hidden or removed by moderation: every ledger row for it
-- (its own credit and the likes, saves and shares it earned) is voided in one statement.
create or replace function app_private.void_post_board_points()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_post_id uuid;
  v_reason text;
begin
  if tg_table_name = 'posts' then
    if not (new.status = 'deleted' or new.deleted_at is not null) then
      return null;
    end if;
    if old.status = 'deleted' or old.deleted_at is not null then
      return null;
    end if;
    v_post_id := new.id;
    v_reason := 'post_deleted';
  else
    if new.state not in ('hidden', 'removed') then
      return null;
    end if;
    v_post_id := new.post_id;
    v_reason := 'moderation_' || new.state;
  end if;

  update leaderboard_events
  set voided_at = now(), void_reason = v_reason
  where post_id = v_post_id and voided_at is null;
  return null;
end;
$$;

revoke all on function app_private.void_post_board_points() from public, anon, authenticated;

drop trigger if exists trg_posts_void_board_points on public.posts;
create trigger trg_posts_void_board_points
after update of status, deleted_at on public.posts
for each row execute function app_private.void_post_board_points();

drop trigger if exists trg_post_moderation_void_board_points on public.post_moderation_states;
create trigger trg_post_moderation_void_board_points
after insert or update of state on public.post_moderation_states
for each row execute function app_private.void_post_board_points();

-- Likes, saves, shares and approved follows: one Trending row each, voided when undone.
create or replace function app_private.credit_engagement_board_points()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target uuid;
  v_actor uuid;
  v_kind text;
  v_points numeric;
  v_post_id uuid;
begin
  if tg_table_name = 'follows' then
    if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.status = 'approved' and new.status <> 'approved') then
      update leaderboard_events
      set voided_at = now(), void_reason = 'unfollowed'
      where user_id = old.followee_id
        and kind = 'follower'
        and actor_id = old.follower_id
        and voided_at is null;
      return null;
    end if;
    if new.status <> 'approved' or (tg_op = 'UPDATE' and old.status = 'approved') then
      return null;
    end if;
    v_target := new.followee_id;
    v_actor := new.follower_id;
    v_kind := 'follower';
    v_points := 3;
  else
    v_kind := case tg_table_name when 'post_likes' then 'like' when 'post_saves' then 'save' else 'share' end;
    if tg_op = 'DELETE' then
      update leaderboard_events
      set voided_at = now(), void_reason = 'undone'
      where post_id = old.post_id
        and kind = v_kind
        and actor_id = old.user_id
        and voided_at is null;
      return null;
    end if;
    -- Lock the post row: a delete running at the same moment either finishes first (and this
    -- sees it) or waits for this like, then voids it. Same lock type as the like counter takes.
    select p.author_id into v_target
    from posts p
    where p.id = new.post_id
      and p.status = 'published'
      and p.deleted_at is null
      and not exists (
        select 1 from post_moderation_states pms
        where pms.post_id = p.id and pms.state in ('hidden', 'removed')
      )
    for no key update of p;
    if v_target is null then
      return null;
    end if;
    v_actor := new.user_id;
    v_post_id := new.post_id;
    v_points := case v_kind when 'like' then 1 else 2 end;
  end if;

  if v_actor = v_target
    or public.app_user_block_exists(v_actor, v_target)
    or not app_private.leaderboard_actor_is_eligible(v_actor) then
    return null;
  end if;

  insert into leaderboard_events (user_id, kind, points, actor_id, post_id)
  values (v_target, v_kind, v_points, v_actor, v_post_id)
  on conflict (user_id, kind, actor_id, event_day)
    where actor_id is not null and voided_at is null
  do nothing;
  return null;
end;
$$;

revoke all on function app_private.credit_engagement_board_points() from public, anon, authenticated;

drop trigger if exists trg_post_likes_board_points on public.post_likes;
create trigger trg_post_likes_board_points
after insert or delete on public.post_likes
for each row execute function app_private.credit_engagement_board_points();

drop trigger if exists trg_post_saves_board_points on public.post_saves;
create trigger trg_post_saves_board_points
after insert or delete on public.post_saves
for each row execute function app_private.credit_engagement_board_points();

drop trigger if exists trg_post_shares_board_points on public.post_shares;
create trigger trg_post_shares_board_points
after insert on public.post_shares
for each row execute function app_private.credit_engagement_board_points();

drop trigger if exists trg_follows_board_points on public.follows;
create trigger trg_follows_board_points
after insert or update of status or delete on public.follows
for each row execute function app_private.credit_engagement_board_points();

-- 3. Scores, refresh, weekly close, achievements.

-- Scores for one board over [p_from, p_to). Trending decays: each event halves every 3 days.
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
      (p_board = 'active' and e.kind in ('post', 'new_stall', 'first_dish_photo', 'rich_post', 'achievement'))
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

-- Records every board achievement tier reached and pays its points once. Idempotent: the
-- unlock's primary key decides, and only rows it inserted are paid.
create or replace function app_private.unlock_board_achievements()
returns integer
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  with tiers (achievement_id, tier, target) as (
    values
      ('posted', 1, 1), ('posted', 2, 10), ('posted', 3, 50), ('posted', 4, 200),
      ('first-to-post', 1, 5), ('first-to-post', 2, 20), ('first-to-post', 3, 50),
      ('followed', 1, 10), ('followed', 2, 50), ('followed', 3, 200), ('followed', 4, 1000),
      ('weekly-contender', 1, 1), ('weekly-contender', 2, 4), ('weekly-contender', 3, 12), ('weekly-contender', 4, 26),
      ('crowd-favourite', 1, 1), ('crowd-favourite', 2, 4), ('crowd-favourite', 3, 12)
  ),
  counts as (
    select e.user_id, 'posted'::text as achievement_id, count(*)::integer as reached
    from public.leaderboard_events e
    where e.kind = 'post' and e.voided_at is null
    group by e.user_id
    union all
    select e.user_id, 'first-to-post', count(*)::integer
    from public.leaderboard_events e
    where e.kind = 'first_dish_photo' and e.voided_at is null
    group by e.user_id
    union all
    select f.followee_id, 'followed', count(*)::integer
    from public.follows f
    where f.status = 'approved'
    group by f.followee_id
    union all
    select w.user_id, 'weekly-contender', count(*)::integer
    from public.leaderboard_week_results w
    where w.board = 'active' and w.rank <= 10
    group by w.user_id
    union all
    select w.user_id, 'crowd-favourite', count(*)::integer
    from public.leaderboard_week_results w
    where w.board = 'trending' and w.rank <= 10
    group by w.user_id
  ),
  unlocked as (
    insert into public.achievement_unlocks (user_id, achievement_id, tier)
    select c.user_id, t.achievement_id, t.tier
    from counts c
    join tiers t on t.achievement_id = c.achievement_id and c.reached >= t.target
    join public.user_profiles up on up.id = c.user_id
    on conflict do nothing
    returning user_id, achievement_id, tier
  ),
  paid as (
    insert into public.leaderboard_events (user_id, kind, points, achievement_id, tier)
    select u.user_id, 'achievement',
      case u.tier when 1 then 15 when 2 then 30 when 3 then 60 else 120 end,
      u.achievement_id, u.tier
    from unlocked u
    returning 1
  )
  select count(*)::integer from paid;
$$;

revoke all on function app_private.unlock_board_achievements() from public, anon, authenticated;
grant execute on function app_private.unlock_board_achievements() to service_role;

-- Rebuilds the three standings in one transaction. Two refreshes at once queue on the lock.
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

-- Writes one finished week's results (default: the week that just ended), once, then unlocks
-- Weekly contender and Crowd favourite.
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

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'refresh-leaderboards') then
      perform cron.unschedule('refresh-leaderboards');
    end if;
    perform cron.schedule(
      'refresh-leaderboards',
      '*/10 * * * *',
      $job$select app_private.refresh_leaderboards()$job$
    );
    if exists (select 1 from cron.job where jobname = 'close-leaderboard-week') then
      perform cron.unschedule('close-leaderboard-week');
    end if;
    -- Sunday 16:05 UTC is Monday 00:05 in Singapore.
    perform cron.schedule(
      'close-leaderboard-week',
      '5 16 * * 0',
      $job$select app_private.close_leaderboard_week()$job$
    );
  end if;
end;
$$;

-- 4. RPCs.

create or replace function app_private.get_leaderboard(
  p_board text,
  p_period text default 'week',
  p_scope text default 'everyone',
  p_limit integer default 50
)
returns table (
  rank integer,
  user_id uuid,
  display_name text,
  avatar_url text,
  score numeric,
  is_me boolean,
  computed_at timestamptz
)
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  select
    (case when p_scope = 'following'
      then rank() over (order by s.score desc)
      else s.rank
    end)::integer as rank,
    s.user_id,
    up.display_name,
    up.avatar_url,
    s.score,
    s.user_id = auth.uid() as is_me,
    s.computed_at
  from public.leaderboard_standings s
  join public.user_profiles up on up.id = s.user_id
  where auth.uid() is not null
    and s.board = p_board
    and s.period = case when p_board = 'trending' then 'week' else p_period end
    and (
      coalesce(p_scope, 'everyone') <> 'following'
      or s.user_id = auth.uid()
      or exists (
        select 1 from public.follows f
        where f.follower_id = auth.uid() and f.followee_id = s.user_id and f.status = 'approved'
      )
    )
    and app_private.can_read_author_content(s.user_id)
  order by 1, s.user_id
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

revoke all on function app_private.get_leaderboard(text, text, text, integer) from public, anon, authenticated;
grant execute on function app_private.get_leaderboard(text, text, text, integer) to authenticated, service_role;

create or replace function public.get_leaderboard(
  p_board text,
  p_period text default 'week',
  p_scope text default 'everyone',
  p_limit integer default 50
)
returns table (
  rank integer,
  user_id uuid,
  display_name text,
  avatar_url text,
  score numeric,
  is_me boolean,
  computed_at timestamptz
)
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select * from app_private.get_leaderboard(p_board, p_period, p_scope, p_limit);
$$;

revoke all on function public.get_leaderboard(text, text, text, integer) from public, anon;
grant execute on function public.get_leaderboard(text, text, text, integer) to authenticated, service_role;

create or replace function app_private.get_my_leaderboard_summary()
returns table (
  total_points numeric,
  week_points numeric,
  active_week_rank integer,
  active_all_rank integer,
  trending_rank integer,
  credited_posts_today integer,
  daily_cap integer,
  computed_at timestamptz
)
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  select
    coalesce((
      select sum(e.points) from public.leaderboard_events e
      where e.user_id = auth.uid()
        and e.voided_at is null
        and e.kind in ('post', 'off_board_post', 'new_stall', 'first_dish_photo', 'rich_post', 'achievement')
    ), 0) as total_points,
    coalesce((
      select s.score from public.leaderboard_standings s
      where s.board = 'active' and s.period = 'week' and s.user_id = auth.uid()
    ), 0) as week_points,
    (select s.rank from public.leaderboard_standings s
      where s.board = 'active' and s.period = 'week' and s.user_id = auth.uid()) as active_week_rank,
    (select s.rank from public.leaderboard_standings s
      where s.board = 'active' and s.period = 'all' and s.user_id = auth.uid()) as active_all_rank,
    (select s.rank from public.leaderboard_standings s
      where s.board = 'trending' and s.period = 'week' and s.user_id = auth.uid()) as trending_rank,
    (
      select count(*)::integer from public.leaderboard_events e
      where e.user_id = auth.uid()
        and e.kind = 'post'
        and e.voided_at is null
        and e.event_day = (now() at time zone 'Asia/Singapore')::date
    ) as credited_posts_today,
    6 as daily_cap,
    (select max(s.computed_at) from public.leaderboard_standings s) as computed_at
  where auth.uid() is not null;
$$;

revoke all on function app_private.get_my_leaderboard_summary() from public, anon, authenticated;
grant execute on function app_private.get_my_leaderboard_summary() to authenticated, service_role;

create or replace function public.get_my_leaderboard_summary()
returns table (
  total_points numeric,
  week_points numeric,
  active_week_rank integer,
  active_all_rank integer,
  trending_rank integer,
  credited_posts_today integer,
  daily_cap integer,
  computed_at timestamptz
)
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select * from app_private.get_my_leaderboard_summary();
$$;

revoke all on function public.get_my_leaderboard_summary() from public, anon;
grant execute on function public.get_my_leaderboard_summary() to authenticated, service_role;

create or replace function app_private.get_my_portfolio_points(p_limit integer default 30)
returns table (
  id uuid,
  kind text,
  points numeric,
  post_id uuid,
  achievement_id text,
  tier smallint,
  created_at timestamptz,
  voided boolean
)
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  select e.id, e.kind, e.points, e.post_id, e.achievement_id, e.tier, e.created_at,
    e.voided_at is not null as voided
  from public.leaderboard_events e
  where auth.uid() is not null
    and e.user_id = auth.uid()
    and e.kind in ('post', 'off_board_post', 'new_stall', 'first_dish_photo', 'rich_post', 'achievement')
  order by e.created_at desc, e.id
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

revoke all on function app_private.get_my_portfolio_points(integer) from public, anon, authenticated;
grant execute on function app_private.get_my_portfolio_points(integer) to authenticated, service_role;

create or replace function public.get_my_portfolio_points(p_limit integer default 30)
returns table (
  id uuid,
  kind text,
  points numeric,
  post_id uuid,
  achievement_id text,
  tier smallint,
  created_at timestamptz,
  voided boolean
)
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select * from app_private.get_my_portfolio_points(p_limit);
$$;

revoke all on function public.get_my_portfolio_points(integer) from public, anon;
grant execute on function public.get_my_portfolio_points(integer) to authenticated, service_role;

-- Admin: keep an account off the boards (until a date, or for good) and drop it from the
-- current standings straight away. Its points stay in the ledger.
create or replace function public.exclude_from_leaderboards(
  p_user_id uuid,
  p_reason text,
  p_until timestamptz default null
)
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  insert into public.leaderboard_exclusions (user_id, reason, until)
  values (p_user_id, p_reason, p_until)
  on conflict (user_id) do update set reason = excluded.reason, until = excluded.until;
  delete from public.leaderboard_standings where user_id = p_user_id;
$$;

revoke all on function public.exclude_from_leaderboards(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.exclude_from_leaderboards(uuid, text, timestamptz) to service_role;

-- PDPA export: your points history, achievement unlocks and finished weeks. Body is
-- 20261029090000's app_private.export_my_data plus the last jsonb_build_object.
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
    'conversations',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.conversation_participants t where t.participant_user_id = v_user), '[]'::jsonb),
    'messagesSent',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.messages t where t.sender_user_id = v_user), '[]'::jsonb),
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
      coalesce((select jsonb_agg(to_jsonb(t) order by t.week_start) from public.leaderboard_week_results t where t.user_id = v_user), '[]'::jsonb)
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

-- Rate rules (signed-in callers only; anon cannot execute these).
insert into app_private.request_rate_rules (route, anon_per_minute, user_per_minute, note) values
  ('rpc/get_leaderboard', null, 60, 'food portfolio leaderboards'),
  ('rpc/get_my_leaderboard_summary', null, 60, 'own board ranks and points'),
  ('rpc/get_my_portfolio_points', null, 30, 'own portfolio points history')
on conflict (route) do nothing;

notify pgrst, 'reload schema';
