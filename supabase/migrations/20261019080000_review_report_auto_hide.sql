-- Auto-hide reviews after repeated reports, the same way posts and comments are.
--
-- report_post and report_content move a post or post comment to the 'hidden'
-- moderation state once 3 distinct reporters have open reports on it. Reviews
-- only recorded the report, so a review stayed visible to everyone except the
-- people who reported it (20261019041100 per-reporter hiding).
--
-- 1. review_moderation_states (same shape as post_comment_moderation_states),
--    and moderation_actions accepts target_type 'review'.
-- 2. report_content hides a review at 3 distinct open reporters (fewer marks it
--    'under_review'). An ops 'removed' state is never downgraded to 'hidden'.
-- 3. Hidden or removed reviews are readable only by their author. Hidden posts
--    have no merchant exemption, so the venue's merchant does not see them
--    either. Active popular-visitor pins of a hidden review leave public reads
--    (the venue's merchant still sees the pin so it can be unpinned).
-- 4. Hidden or removed reviews drop out of dishes.review_count / rating_avg,
--    which feed search, discovery and dish/stall rating totals.
-- 5. set_review_moderation_state(review, state, reason, metadata): service_role
--    or an ops admin hides, removes or restores a review. Restoring to
--    'visible' dismisses the open reports, so one new report does not re-hide
--    it. Each reporter's own hiding of a review they reported is unchanged.
-- 6. Reviews that already have 3+ distinct open reporters are hidden now.
--
-- Bodies live in app_private (SECURITY DEFINER); public names are SECURITY
-- INVOKER wrappers.

create schema if not exists app_private;
grant usage on schema app_private to anon, authenticated, service_role;

-- 1. Moderation state ------------------------------------------------------
create table if not exists public.review_moderation_states (
  review_id uuid primary key references public.reviews(id) on delete cascade,
  state text not null default 'visible'
    check (state in ('visible', 'under_review', 'hidden', 'removed')),
  reason_code text,
  latest_action_id uuid references public.moderation_actions(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_review_moderation_states_state_updated
  on public.review_moderation_states(state, updated_at desc);

alter table public.review_moderation_states enable row level security;

drop policy if exists "review_moderation_states_service_role_all"
on public.review_moderation_states;
create policy "review_moderation_states_service_role_all"
on public.review_moderation_states for all to service_role
using (true)
with check (true);

revoke all on table public.review_moderation_states from anon, authenticated;
grant all on table public.review_moderation_states to service_role;

alter table public.moderation_actions
  drop constraint if exists moderation_actions_target_type_check;
alter table public.moderation_actions
  add constraint moderation_actions_target_type_check
  check (target_type in ('post', 'post_comment', 'review'));

create or replace function app_private.review_is_moderation_hidden(p_review_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.review_moderation_states rms
    where rms.review_id = p_review_id
      and rms.state in ('hidden', 'removed')
  );
$$;

revoke all on function app_private.review_is_moderation_hidden(uuid) from public, anon, authenticated;
grant execute on function app_private.review_is_moderation_hidden(uuid)
to anon, authenticated, service_role;

-- 4. Dish totals skip hidden reviews ---------------------------------------
create or replace function app_private.dish_review_stats(p_dish_id text)
returns table (review_count integer, rating_avg numeric)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    count(*)::int,
    coalesce(round(avg(r.rating)::numeric, 2), 0)
  from public.reviews r
  where r.dish_id = p_dish_id
    and not app_private.review_is_moderation_hidden(r.id);
$$;

revoke all on function app_private.dish_review_stats(text) from public, anon, authenticated;
grant execute on function app_private.dish_review_stats(text) to authenticated, service_role;

create or replace function app_private.refresh_dish_review_stats(p_dish_id text)
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update public.dishes d
  set
    review_count = s.review_count,
    rating_avg = s.rating_avg
  from app_private.dish_review_stats(p_dish_id) s
  where d.id = p_dish_id;
$$;

revoke all on function app_private.refresh_dish_review_stats(text) from public, anon, authenticated;
grant execute on function app_private.refresh_dish_review_stats(text) to service_role;

-- 2. Reports hide a review at 3 distinct reporters --------------------------
create or replace function app_private.report_content(
  p_target_type text,
  p_target_id text,
  p_reason text,
  p_target_author_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  report_id uuid;
  action_id uuid;
  current_user_id uuid := auth.uid();
  normalized_target_type text := lower(nullif(trim(coalesce(p_target_type, '')), ''));
  normalized_reason text := lower(nullif(trim(coalesce(p_reason, '')), ''));
  target_uuid uuid;
  report_count integer;
  review_dish_id text;
  review_state text;
begin
  if current_user_id is null then
    raise exception 'Authentication required to report content.';
  end if;

  if normalized_target_type = 'post' then
    return public.report_post(p_target_id::uuid, coalesce(normalized_reason, 'other'), null);
  end if;

  if normalized_target_type not in (
    'review',
    'bite',
    'reply',
    'profile',
    'post_comment',
    'story',
    'message'
  ) then
    raise exception 'Unsupported report target type: %', p_target_type;
  end if;

  if normalized_reason is null then
    normalized_reason := 'other';
  end if;

  if normalized_target_type = 'post_comment' then
    target_uuid := p_target_id::uuid;
    if not exists (
      select 1
      from post_comments pc
      where pc.id = target_uuid
        and pc.deleted_at is null
        and public.can_read_post(pc.post_id)
    ) then
      raise exception 'Comment is not visible to the current user.';
    end if;
  end if;

  -- Review ids are uuids; anything else is recorded without moderation.
  if normalized_target_type = 'review'
    and btrim(coalesce(p_target_id, ''))
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select r.id, r.dish_id
      into target_uuid, review_dish_id
    from reviews r
    where r.id = btrim(p_target_id)::uuid;
  end if;

  insert into content_reports (
    reporter_id,
    target_type,
    target_id,
    target_author_key,
    reason,
    status,
    created_at
  )
  values (
    current_user_id,
    normalized_target_type,
    p_target_id,
    nullif(trim(coalesce(p_target_author_key, '')), ''),
    normalized_reason,
    'open',
    now()
  )
  returning id into report_id;

  if normalized_target_type = 'post_comment' then
    select count(distinct reporter_id)
    into report_count
    from content_reports
    where target_type = 'post_comment'
      and target_id = p_target_id
      and status in ('open', 'reviewing');

    if report_count >= 3 then
      insert into moderation_actions (
        target_type,
        target_id,
        actor_id,
        action,
        reason_code,
        metadata
      )
      values (
        'post_comment',
        target_uuid,
        current_user_id,
        'hide',
        normalized_reason,
        jsonb_build_object('source', 'auto_report_threshold', 'report_count', report_count)
      )
      returning id into action_id;

      insert into post_comment_moderation_states (
        comment_id,
        state,
        reason_code,
        latest_action_id,
        updated_at
      )
      values (target_uuid, 'hidden', normalized_reason, action_id, now())
      on conflict (comment_id) do update
      set
        state = 'hidden',
        reason_code = excluded.reason_code,
        latest_action_id = excluded.latest_action_id,
        updated_at = now();
    else
      insert into post_comment_moderation_states (comment_id, state, reason_code, updated_at)
      values (target_uuid, 'under_review', normalized_reason, now())
      on conflict (comment_id) do update
      set
        state = case
          when post_comment_moderation_states.state in ('hidden', 'removed')
            then post_comment_moderation_states.state
          else 'under_review'
        end,
        reason_code = coalesce(post_comment_moderation_states.reason_code, excluded.reason_code),
        updated_at = now();
    end if;
  end if;

  if normalized_target_type = 'review' and target_uuid is not null then
    select count(distinct reporter_id)
    into report_count
    from content_reports
    where target_type = 'review'
      and lower(btrim(target_id)) = target_uuid::text
      and status in ('open', 'reviewing');

    select rms.state
    into review_state
    from review_moderation_states rms
    where rms.review_id = target_uuid;

    if report_count >= 3 and coalesce(review_state, 'visible') not in ('hidden', 'removed') then
      insert into moderation_actions (
        target_type,
        target_id,
        actor_id,
        action,
        reason_code,
        metadata
      )
      values (
        'review',
        target_uuid,
        current_user_id,
        'hide',
        normalized_reason,
        jsonb_build_object('source', 'auto_report_threshold', 'report_count', report_count)
      )
      returning id into action_id;

      insert into review_moderation_states (
        review_id,
        state,
        reason_code,
        latest_action_id,
        updated_at
      )
      values (target_uuid, 'hidden', normalized_reason, action_id, now())
      on conflict (review_id) do update
      set
        state = 'hidden',
        reason_code = excluded.reason_code,
        latest_action_id = excluded.latest_action_id,
        updated_at = now();

      perform app_private.refresh_dish_review_stats(review_dish_id);
    elsif coalesce(review_state, 'visible') not in ('hidden', 'removed') then
      insert into review_moderation_states (review_id, state, reason_code, updated_at)
      values (target_uuid, 'under_review', normalized_reason, now())
      on conflict (review_id) do update
      set
        state = 'under_review',
        reason_code = coalesce(review_moderation_states.reason_code, excluded.reason_code),
        updated_at = now();
    end if;
  end if;

  return report_id;
end;
$$;

revoke all on function app_private.report_content(text, text, text, text)
  from public, anon, authenticated;
grant execute on function app_private.report_content(text, text, text, text)
  to authenticated, service_role;

-- 3. Read paths ------------------------------------------------------------
-- Every review read (review feed, dish reviews, profile history, the
-- security-invoker get_dish_detail RPC, merchant candidate lists) goes
-- through this policy.
drop policy if exists reviews_select_hide_moderated on public.reviews;
create policy reviews_select_hide_moderated
on public.reviews
as restrictive
for select
to anon, authenticated
using (
  user_id = (select auth.uid())
  or not app_private.review_is_moderation_hidden(id)
);

drop policy if exists popular_visitor_pins_anon_hide_moderated_reviews
  on public.merchant_popular_visitor_pins;
create policy popular_visitor_pins_anon_hide_moderated_reviews
on public.merchant_popular_visitor_pins
as restrictive
for select
to anon
using (not app_private.review_is_moderation_hidden(review_id));

drop policy if exists popular_visitor_pins_hide_moderated_reviews
  on public.merchant_popular_visitor_pins;
create policy popular_visitor_pins_hide_moderated_reviews
on public.merchant_popular_visitor_pins
as restrictive
for select
to authenticated
using (
  not app_private.review_is_moderation_hidden(review_id)
  or public.merchant_can_manage_outlet_v2(outlet_id)
);

-- 5. Ops hide / remove / restore -------------------------------------------
create or replace function app_private.set_review_moderation_state(
  p_review_id uuid,
  p_state text,
  p_reason_code text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  action_id uuid;
  normalized_state text := lower(nullif(trim(coalesce(p_state, '')), ''));
  normalized_reason text := nullif(trim(coalesce(p_reason_code, '')), '');
  review_dish_id text;
  actor_profile_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and not public.app_is_current_user_ops_admin() then
    raise exception 'Ops admin access required.' using errcode = '42501';
  end if;

  if normalized_state is null
    or normalized_state not in ('visible', 'under_review', 'hidden', 'removed') then
    raise exception 'Unsupported review moderation state: %', p_state;
  end if;

  select r.dish_id
    into review_dish_id
  from reviews r
  where r.id = p_review_id;

  if not found then
    raise exception 'Review not found.' using errcode = 'P0002';
  end if;

  select up.id
    into actor_profile_id
  from user_profiles up
  where up.id = auth.uid();

  insert into moderation_actions (
    target_type,
    target_id,
    actor_id,
    action,
    reason_code,
    metadata
  )
  values (
    'review',
    p_review_id,
    actor_profile_id,
    case normalized_state
      when 'visible' then 'restore'
      when 'hidden' then 'hide'
      when 'removed' then 'remove'
      else 'set_state'
    end,
    normalized_reason,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('state', normalized_state)
  )
  returning id into action_id;

  insert into review_moderation_states (
    review_id,
    state,
    reason_code,
    latest_action_id,
    updated_at
  )
  values (p_review_id, normalized_state, normalized_reason, action_id, now())
  on conflict (review_id) do update
  set
    state = excluded.state,
    reason_code = excluded.reason_code,
    latest_action_id = excluded.latest_action_id,
    updated_at = now();

  if normalized_state = 'visible' then
    update content_reports
    set status = 'dismissed'
    where target_type = 'review'
      and lower(btrim(target_id)) = p_review_id::text
      and status in ('open', 'reviewing');
  end if;

  perform app_private.refresh_dish_review_stats(review_dish_id);

  return action_id;
end;
$$;

revoke all on function app_private.set_review_moderation_state(uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function app_private.set_review_moderation_state(uuid, text, text, jsonb)
  to authenticated, service_role;

create or replace function public.set_review_moderation_state(
  p_review_id uuid,
  p_state text,
  p_reason_code text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language sql
volatile
security invoker
set search_path = public, app_private
as $$
  select app_private.set_review_moderation_state(p_review_id, p_state, p_reason_code, p_metadata);
$$;

revoke all on function public.set_review_moderation_state(uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.set_review_moderation_state(uuid, text, text, jsonb)
  to authenticated, service_role;

-- 6. Hide reviews already past the threshold -------------------------------
do $$
declare
  v_review record;
  v_action_id uuid;
begin
  for v_review in
    select r.id, r.dish_id, count(distinct cr.reporter_id)::int as report_count
    from public.content_reports cr
    join public.reviews r on r.id::text = lower(btrim(cr.target_id))
    where cr.target_type = 'review'
      and cr.status in ('open', 'reviewing')
      and not app_private.review_is_moderation_hidden(r.id)
    group by r.id, r.dish_id
    having count(distinct cr.reporter_id) >= 3
  loop
    insert into public.moderation_actions (
      target_type,
      target_id,
      actor_id,
      action,
      reason_code,
      metadata
    )
    values (
      'review',
      v_review.id,
      null,
      'hide',
      'auto_report_threshold',
      jsonb_build_object(
        'source', 'auto_report_threshold_backfill',
        'report_count', v_review.report_count
      )
    )
    returning id into v_action_id;

    insert into public.review_moderation_states (
      review_id,
      state,
      reason_code,
      latest_action_id,
      updated_at
    )
    values (v_review.id, 'hidden', 'auto_report_threshold', v_action_id, now())
    on conflict (review_id) do update
    set
      state = 'hidden',
      reason_code = excluded.reason_code,
      latest_action_id = excluded.latest_action_id,
      updated_at = now();

    perform app_private.refresh_dish_review_stats(v_review.dish_id);
  end loop;
end;
$$;

comment on table public.review_moderation_states is
  'Current moderation state for reviews; hidden and removed reviews are readable only by their author and excluded from dish rating totals.';

comment on function public.set_review_moderation_state(uuid, text, text, jsonb) is
  'Service-role or ops-admin review moderation: hide, remove, or restore (visible dismisses open reports).';
