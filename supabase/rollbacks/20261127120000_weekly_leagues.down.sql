-- Undo 20261127120000_weekly_leagues: drops get_my_league_status and its rate rule, the league
-- triggers and functions, puts leaderboard_scores back to 20261107120000, close_leaderboard_week
-- back to 20261108120000 and export_my_data back to its 20261119090000 state, archives the 'task'
-- ledger rows and the four league tables to rollback_archive, deletes or drops them, and restores
-- the leaderboard_events kind check without 'task'.
-- expect-row-loss: public.leaderboard_events, app_private.request_rate_rules

drop function if exists public.get_my_league_status();
drop function if exists app_private.get_my_league_status();
delete from app_private.request_rate_rules where route = 'rpc/get_my_league_status';

drop trigger if exists trg_food_cred_events_league_task on public.food_cred_events;
drop trigger if exists trg_leaderboard_events_join_league on public.leaderboard_events;

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

drop function if exists app_private.credit_food_cred_task();
drop function if exists app_private.join_league_on_points();
drop function if exists app_private.join_league_week(uuid, timestamptz);
drop function if exists app_private.close_league_week(date);
drop function if exists app_private.league_cohort_scores(date, uuid);
drop function if exists app_private.league_task_points(text, integer);
drop function if exists app_private.league_setting(text);

create schema if not exists rollback_archive;
drop table if exists rollback_archive.leaderboard_events_task_20261127120000;
create table rollback_archive.leaderboard_events_task_20261127120000 as
select * from public.leaderboard_events where kind = 'task' or food_cred_event_id is not null;
delete from public.leaderboard_events where kind = 'task' or food_cred_event_id is not null;
drop index if exists public.uniq_leaderboard_events_food_cred_event;
alter table public.leaderboard_events drop column if exists food_cred_event_id;

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
    'follower', 'like', 'save', 'share'
  ));

drop table if exists rollback_archive.league_week_results_20261127120000;
create table rollback_archive.league_week_results_20261127120000 as select * from public.league_week_results;
drop table if exists rollback_archive.league_user_tiers_20261127120000;
create table rollback_archive.league_user_tiers_20261127120000 as select * from public.league_user_tiers;
drop table if exists rollback_archive.league_memberships_20261127120000;
create table rollback_archive.league_memberships_20261127120000 as select * from public.league_memberships;
drop table if exists rollback_archive.league_cohorts_20261127120000;
create table rollback_archive.league_cohorts_20261127120000 as select * from public.league_cohorts;
drop table if exists public.league_week_results;
drop table if exists public.league_user_tiers;
drop table if exists public.league_memberships;
drop table if exists public.league_cohorts;

notify pgrst, 'reload schema';
