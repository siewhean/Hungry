-- smoke: supabase/smoke/profile_stats_taste_match_favourites.sql
-- Profile rework, server pieces (round four, PROF4-12, PROF4-13, PROF4-14).
--
-- 1. get_my_review_stats(): your review count, average and 1-5 histogram over ALL your reviews,
--    not just the pages loaded on screen. Read-only SECURITY INVOKER (the reviews RLS applies);
--    declared VOLATILE only so the request rate limit can write its counter.
-- 2. get_taste_match(user): a 0-100 score for how close another diner's six taste levels are to
--    yours. Returns the score and nothing else, never their vector. Null for yourself, for a
--    blocked pair, for a private account you do not follow, for a pending-deletion account, and
--    while either of you has not built a taste fingerprint yet. The definer body lives in
--    app_private; public.get_taste_match is an invoker wrapper.
--      score = round(100 - 100 * mean(|your level - their level|) / 6), floored at 0
--    (identical tastes 100, an average gap of 3 levels 50, a gap of 6 or more 0).
-- 3. profile_favourite_dishes: up to four dishes pinned on a profile, picked from the dishes the
--    owner saved or reviewed. Readable wherever the owner's profile content is readable
--    (app_private.can_read_author_content); written only through
--    set_profile_favourite_dishes, which takes a per-user lock so two taps cannot interleave.
-- 4. app_private.export_my_data() also exports the pinned dishes (PROF4-V6).
-- Rollback: supabase/rollbacks/20261028100000_profile_stats_taste_match_favourites.down.sql.

-- 1. Review stats ------------------------------------------------------------------------

create or replace function public.get_my_review_stats()
returns table (
  review_count integer,
  average_rating numeric,
  rating_1 integer,
  rating_2 integer,
  rating_3 integer,
  rating_4 integer,
  rating_5 integer
)
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select
    count(*)::integer,
    round(avg(r.rating), 1),
    (count(*) filter (where greatest(1, least(5, round(r.rating)::integer)) = 1))::integer,
    (count(*) filter (where greatest(1, least(5, round(r.rating)::integer)) = 2))::integer,
    (count(*) filter (where greatest(1, least(5, round(r.rating)::integer)) = 3))::integer,
    (count(*) filter (where greatest(1, least(5, round(r.rating)::integer)) = 4))::integer,
    (count(*) filter (where greatest(1, least(5, round(r.rating)::integer)) = 5))::integer
  from public.reviews r
  where r.user_id = (select auth.uid());
$$;

revoke all on function public.get_my_review_stats() from public, anon;
grant execute on function public.get_my_review_stats() to authenticated, service_role;

comment on function public.get_my_review_stats() is
  'Count, average and 1-5 histogram over all of the caller''s reviews.';

-- 2. Taste match -------------------------------------------------------------------------

create or replace function app_private.get_taste_match(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_viewer uuid := auth.uid();
  v_score integer;
begin
  if v_viewer is null or p_user_id is null or p_user_id = v_viewer then
    return null;
  end if;
  -- Blocked pairs, private accounts the viewer does not follow and pending-deletion accounts.
  if not app_private.can_read_author_content(p_user_id) then
    return null;
  end if;

  select
    case
      when greatest(
             abs(a.sweet - 5), abs(a.spicy - 5), abs(a.sour - 5),
             abs(a.salty - 5), abs(a.rich - 5), abs(a.aromatic - 5)
           ) >= 1
       and greatest(
             abs(b.sweet - 5), abs(b.spicy - 5), abs(b.sour - 5),
             abs(b.salty - 5), abs(b.rich - 5), abs(b.aromatic - 5)
           ) >= 1
      then greatest(
             0,
             round(
               100 - 100 * (
                 abs(a.sweet - b.sweet) + abs(a.spicy - b.spicy) + abs(a.sour - b.sour)
                 + abs(a.salty - b.salty) + abs(a.rich - b.rich) + abs(a.aromatic - b.aromatic)
               ) / 36.0
             )
           )::integer
    end
  into v_score
  from public.user_taste_vectors a
  join public.user_taste_vectors b on b.user_id = p_user_id
  where a.user_id = v_viewer;

  return v_score;
end;
$$;

revoke all on function app_private.get_taste_match(uuid) from public, anon, authenticated;
grant execute on function app_private.get_taste_match(uuid) to authenticated, service_role;

create or replace function public.get_taste_match(p_user_id uuid)
returns integer
language sql
volatile
security invoker
set search_path = public, app_private
as $$
  select app_private.get_taste_match(p_user_id);
$$;

revoke all on function public.get_taste_match(uuid) from public, anon;
grant execute on function public.get_taste_match(uuid) to authenticated, service_role;

comment on function public.get_taste_match(uuid) is
  '0-100 closeness of the caller''s taste to another diner''s. Score only; null when it cannot be shown.';

-- 3. Favourite dishes --------------------------------------------------------------------

create table if not exists public.profile_favourite_dishes (
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  dish_id text not null references public.dishes(id) on delete cascade,
  position smallint not null check (position between 1 and 4),
  created_at timestamptz not null default now(),
  primary key (user_id, position),
  unique (user_id, dish_id)
);

alter table public.profile_favourite_dishes enable row level security;

revoke all on public.profile_favourite_dishes from anon, authenticated;
grant select on public.profile_favourite_dishes to anon, authenticated;

drop policy if exists profile_favourite_dishes_select_visible on public.profile_favourite_dishes;
create policy profile_favourite_dishes_select_visible on public.profile_favourite_dishes
  for select to anon, authenticated
  using (app_private.can_read_author_content(user_id));

-- Replaces the caller's pinned dishes (at most four, in the order given). One lock per user
-- makes the delete-and-insert atomic against a second tap or a second device.
create or replace function app_private.set_profile_favourite_dishes(p_dish_ids text[])
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_ids text[];
begin
  if v_user is null then
    raise exception 'sign in to pin dishes' using errcode = '42501';
  end if;

  -- First occurrence of each id wins; blanks are dropped.
  select coalesce(array_agg(s.id order by s.first_position), '{}')
  into v_ids
  from (
    select t.id, min(t.position) as first_position
    from unnest(coalesce(p_dish_ids, '{}')) with ordinality as t(id, position)
    where t.id is not null and btrim(t.id) <> ''
    group by t.id
  ) s;

  if cardinality(v_ids) > 4 then
    raise exception 'pin at most 4 dishes' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('profile_favourite_dishes:' || v_user::text, 0));

  -- Only dishes the caller saved or reviewed can be pinned.
  if exists (
    select 1
    from unnest(v_ids) as d(id)
    where not exists (
            select 1 from public.user_favourite_dishes f
            where f.user_id = v_user and f.dish_id = d.id
          )
      and not exists (
            select 1 from public.reviews r
            where r.user_id = v_user and r.dish_id = d.id
          )
  ) then
    raise exception 'pin dishes you saved or reviewed' using errcode = '22023';
  end if;

  delete from public.profile_favourite_dishes where user_id = v_user;

  insert into public.profile_favourite_dishes (user_id, dish_id, position)
  select v_user, d.id, d.position::smallint
  from unnest(v_ids) with ordinality as d(id, position);
end;
$$;

revoke all on function app_private.set_profile_favourite_dishes(text[]) from public, anon, authenticated;
grant execute on function app_private.set_profile_favourite_dishes(text[]) to authenticated, service_role;

create or replace function public.set_profile_favourite_dishes(p_dish_ids text[])
returns void
language sql
volatile
security invoker
set search_path = public, app_private
as $$
  select app_private.set_profile_favourite_dishes(p_dish_ids);
$$;

revoke all on function public.set_profile_favourite_dishes(text[]) from public, anon;
grant execute on function public.set_profile_favourite_dishes(text[]) to authenticated, service_role;

comment on function public.set_profile_favourite_dishes(text[]) is
  'Pins up to four saved or reviewed dishes on the caller''s profile, replacing the previous pins.';

-- PDPA export: the pinned dishes are part of the user's data. Body is
-- 20261022100100_export_my_data_more_stores.sql plus the 'profileFavouriteDishes' category; the
-- public SECURITY INVOKER wrapper and its grants are unchanged.
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
      coalesce((select jsonb_agg(to_jsonb(t)) from public.merchant_claim_interests t where t.claimed_by = v_user), '[]'::jsonb),
    'profileFavouriteDishes',
      coalesce((select jsonb_agg(to_jsonb(t) order by t.position) from public.profile_favourite_dishes t where t.user_id = v_user), '[]'::jsonb)
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

-- Rate limits (signed-in callers only; nothing here is callable by anon).
insert into app_private.request_rate_rules (route, anon_per_minute, user_per_minute, note) values
  ('rpc/get_my_review_stats', null, 30, 'own review stats on Review history'),
  ('rpc/get_taste_match', null, 30, 'taste match on another profile; score only'),
  ('rpc/set_profile_favourite_dishes', null, 20, 'pin or reorder favourite dishes')
on conflict (route) do nothing;

notify pgrst, 'reload schema';
