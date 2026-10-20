-- Food history for recommendations: what each user has eaten or liked, per dish.
--
-- One row per (user, dish). Signals add a signed weight; evidence decays with a
-- 90-day half-life, applied on write (E := E * 2^(-dt/90d) + w), so no recompute
-- job is needed. The app reads it with get_my_food_history() and scores
-- E / (2 + |E|sum), the same maths as src/lib/ai/foodHistory.ts.
--
-- Weights (keep in step with AFFINITY_WEIGHTS in foodHistory.ts):
--   review rating >= 4, or >= 3 and would recommend  +4
--   review rating <= 2                                -3
--   other review                                      +1
--   favourite added +3, removed -2
--   passport dish_tried                               +3
--   dish_like +2, dish/food button click +1 (applied events only)
--   dismissed ("Not for me") -4 and hidden for 30 days
-- Saves/unsaves and ratings in taste_interaction_events are skipped because the
-- favourites and reviews triggers already count them.

create table if not exists public.user_dish_affinities (
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  dish_id text not null references public.dishes(id) on delete cascade,
  evidence numeric(10, 4) not null default 0,
  abs_evidence numeric(10, 4) not null default 0,
  evidence_count integer not null default 0,
  first_event_at timestamptz not null default now(),
  last_event_at timestamptz not null default now(),
  dismissed_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, dish_id)
);

create index if not exists user_dish_affinities_user_last_idx
  on public.user_dish_affinities (user_id, last_event_at desc);
create index if not exists user_dish_affinities_dish_idx
  on public.user_dish_affinities (dish_id);

alter table public.user_dish_affinities enable row level security;
revoke all on public.user_dish_affinities from public, anon, authenticated;
grant select, delete on public.user_dish_affinities to authenticated;

drop policy if exists "user_dish_affinities_select_own" on public.user_dish_affinities;
create policy "user_dish_affinities_select_own"
on public.user_dish_affinities for select to authenticated
using ((select auth.uid()) = user_id);

-- Delete-own backs "Reset food history" in Settings. No insert/update policy:
-- rows are written only by apply_affinity_event.
drop policy if exists "user_dish_affinities_delete_own" on public.user_dish_affinities;
create policy "user_dish_affinities_delete_own"
on public.user_dish_affinities for delete to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.apply_affinity_event(
  p_user uuid,
  p_dish text,
  p_weight numeric,
  p_at timestamptz default now(),
  p_dismiss boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user is null or p_dish is null or p_weight is null or p_weight = 0 then
    return;
  end if;
  if not exists (select 1 from public.user_profiles where id = p_user)
     or not exists (select 1 from public.dishes where id = p_dish) then
    return;
  end if;

  insert into public.user_dish_affinities as a (
    user_id, dish_id, evidence, abs_evidence, evidence_count,
    first_event_at, last_event_at, dismissed_until, updated_at
  )
  values (
    p_user, p_dish, p_weight, abs(p_weight), 1,
    p_at, p_at, case when p_dismiss then p_at + interval '30 days' end, now()
  )
  on conflict (user_id, dish_id) do update
  set evidence = a.evidence * power(2::numeric, -greatest(0, extract(epoch from (p_at - a.last_event_at))) / (90 * 86400)) + p_weight,
      abs_evidence = a.abs_evidence * power(2::numeric, -greatest(0, extract(epoch from (p_at - a.last_event_at))) / (90 * 86400)) + abs(p_weight),
      evidence_count = a.evidence_count + 1,
      last_event_at = greatest(a.last_event_at, p_at),
      dismissed_until = case when p_dismiss then p_at + interval '30 days' else a.dismissed_until end,
      updated_at = now();
end;
$$;

revoke all on function public.apply_affinity_event(uuid, text, numeric, timestamptz, boolean)
  from public, anon, authenticated;

create or replace function app_private.review_affinity_weight(p_rating numeric, p_would_recommend boolean)
returns numeric
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_rating >= 4 or (p_rating >= 3 and coalesce(p_would_recommend, false)) then 4
    when p_rating <= 2 then -3
    else 1
  end::numeric;
$$;

revoke all on function app_private.review_affinity_weight(numeric, boolean) from public, anon, authenticated;

create or replace function app_private.taste_event_affinity_weight(p_type text, p_applied boolean)
returns numeric
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_type = 'dismissed' then -4
    when p_type = 'dish_like' and p_applied then 2
    when p_type in ('dish_result_click', 'food_button_click') and p_applied then 1
    else 0
  end::numeric;
$$;

revoke all on function app_private.taste_event_affinity_weight(text, boolean) from public, anon, authenticated;

create or replace function app_private.user_dish_affinities_from_taste_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.apply_affinity_event(
    new.user_id,
    new.dish_id,
    app_private.taste_event_affinity_weight(new.type, new.applied),
    new.created_at,
    new.type = 'dismissed'
  );
  return new;
end;
$$;

create or replace function app_private.user_dish_affinities_from_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.apply_affinity_event(
    new.user_id,
    new.dish_id,
    app_private.review_affinity_weight(new.rating, new.would_recommend),
    new.created_at
  );
  return new;
end;
$$;

create or replace function app_private.user_dish_affinities_from_favourite()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform public.apply_affinity_event(new.user_id, new.dish_id, 3, new.created_at);
    return new;
  end if;
  perform public.apply_affinity_event(old.user_id, old.dish_id, -2, now());
  return old;
end;
$$;

create or replace function app_private.user_dish_affinities_from_passport()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.event_type = 'dish_tried' then
    perform public.apply_affinity_event(new.user_id, new.reference_id, 3, new.created_at);
  end if;
  return new;
end;
$$;

revoke all on function app_private.user_dish_affinities_from_taste_event() from public, anon, authenticated;
revoke all on function app_private.user_dish_affinities_from_review() from public, anon, authenticated;
revoke all on function app_private.user_dish_affinities_from_favourite() from public, anon, authenticated;
revoke all on function app_private.user_dish_affinities_from_passport() from public, anon, authenticated;

drop trigger if exists user_dish_affinities_from_taste_event on public.taste_interaction_events;
create trigger user_dish_affinities_from_taste_event
after insert on public.taste_interaction_events
for each row when (new.dish_id is not null)
execute function app_private.user_dish_affinities_from_taste_event();

drop trigger if exists user_dish_affinities_from_review on public.reviews;
create trigger user_dish_affinities_from_review
after insert on public.reviews
for each row when (new.user_id is not null)
execute function app_private.user_dish_affinities_from_review();

drop trigger if exists user_dish_affinities_from_favourite on public.user_favourite_dishes;
create trigger user_dish_affinities_from_favourite
after insert or delete on public.user_favourite_dishes
for each row
execute function app_private.user_dish_affinities_from_favourite();

drop trigger if exists user_dish_affinities_from_passport on public.passport_progress_events;
create trigger user_dish_affinities_from_passport
after insert on public.passport_progress_events
for each row when (new.reference_id is not null)
execute function app_private.user_dish_affinities_from_passport();

create or replace function public.get_my_food_history(p_limit integer default 300)
returns table (
  dish_id text,
  food_type text,
  venue_id text,
  evidence numeric,
  abs_evidence numeric,
  last_event_at timestamptz,
  dismissed_until timestamptz
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select a.dish_id, d.food_type, d.venue_id, a.evidence, a.abs_evidence, a.last_event_at, a.dismissed_until
  from public.user_dish_affinities a
  join public.dishes d on d.id = a.dish_id
  where a.user_id = (select auth.uid())
  order by a.last_event_at desc
  limit least(greatest(coalesce(p_limit, 300), 1), 500);
$$;

revoke all on function public.get_my_food_history(integer) from public, anon;
grant execute on function public.get_my_food_history(integer) to authenticated;

-- Which bucket (repeat / same_type / similar / new) each shown dish came from.
alter table public.recommendation_impressions
  add column if not exists buckets jsonb not null default '{}'::jsonb;

-- Backfill from existing signals, oldest first (pre-launch, small tables).
do $$
declare
  r record;
begin
  for r in
    select * from (
      select user_id, dish_id, app_private.review_affinity_weight(rating, would_recommend) as weight,
             created_at, false as dismiss
      from public.reviews where user_id is not null
      union all
      select user_id, dish_id, 3, created_at, false from public.user_favourite_dishes
      union all
      select user_id, reference_id, 3, created_at, false
      from public.passport_progress_events where event_type = 'dish_tried' and reference_id is not null
      union all
      select user_id, dish_id, app_private.taste_event_affinity_weight(type, applied), created_at, type = 'dismissed'
      from public.taste_interaction_events where dish_id is not null
    ) events
    order by created_at
  loop
    perform public.apply_affinity_event(r.user_id, r.dish_id, r.weight, r.created_at, r.dismiss);
  end loop;
end $$;

-- PDPA export gains foodHistory. Body is 20261019200500_export_activity_days.sql
-- with one new category; the public SECURITY INVOKER wrapper and grants are unchanged.
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
      coalesce((select jsonb_agg(to_jsonb(t)) from public.account_deletion_requests t where t.user_id = v_user), '[]'::jsonb)
  );

  return jsonb_build_object(
    'exportVersion', 2,
    'generatedAt', now(),
    'categories', (select jsonb_agg(k order by k) from jsonb_object_keys(v_data) as k),
    'notIncluded', jsonb_build_array(
      'Push notification tokens (device identifiers that are only used to deliver alerts).',
      'Security, moderation and legal records. Email support to request these.'
    ),
    'data', v_data
  );
end;
$$;
