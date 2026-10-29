-- smoke: supabase/smoke/account_deletion_keeps_accepted_submissions.sql
-- smoke: supabase/smoke/profile_card_hides_deactivated.sql
-- smoke: supabase/smoke/export_my_data_complete.sql
-- Settings round four, database half. Three independent fixes in one migration so they rehearse and
-- ship together (the rehearsal script cannot chain separate migrations that are not on prod yet):
--   1. SET-1 + X4: account deletion keeps accepted stall submissions and their photos.
--   2. SET-X3: a pending-deletion profile card is hidden from other viewers.
--   3. SET-2: export_my_data includes tasteRatings, catalogCorrections and notificationJobs.

-- ============================================================================================
-- 1. SET-1 + X4
-- ============================================================================================
-- SET-1 + SET-X4: deleting an account must keep accepted stall submissions and every photo they
-- use. Until now anonymize_account_deletion_request deleted the user_profiles row, the
-- user_id foreign key cascaded, and the accepted rows (which can back live venue data) went
-- with it. The purge function then found nothing to retain, so the worker also removed the
-- cover photo and all gallery photos from storage.
--
-- Now: user_id may be null, a BEFORE DELETE trigger on user_profiles detaches the user's
-- accepted submissions (user_id and free-text notes cleared) before the cascade runs, and the
-- purge function reports every cover and gallery object of those rows (matched by the user's
-- storage folder, since user_id is already null) so the worker keeps the files.
-- Unreviewed and rejected submissions are still deleted with the profile.

alter table public.user_stall_submissions
  alter column user_id drop not null;

create or replace function app_private.detach_accepted_stall_submissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- One statement, so a submission accepted while the profile is being deleted is either
  -- detached here or deleted by the cascade, never half of each.
  update public.user_stall_submissions
  set user_id = null, notes = null
  where user_id = old.id
    and status = 'accepted';
  return old;
end;
$$;

revoke all on function app_private.detach_accepted_stall_submissions()
  from public, anon, authenticated;

drop trigger if exists trg_user_profiles_detach_accepted_submissions on public.user_profiles;
create trigger trg_user_profiles_detach_accepted_submissions
  before delete on public.user_profiles
  for each row execute function app_private.detach_accepted_stall_submissions();

create or replace function public.purge_account_deletion_residual_data(
  p_request_id uuid,
  p_worker_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request account_deletion_requests%rowtype;
  v_user_id uuid;
  v_retained jsonb := '[]'::jsonb;
  v_target record;
begin
  select *
  into v_request
  from account_deletion_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'account deletion request not found' using errcode = 'P0002';
  end if;

  if v_request.legal_hold then
    raise exception 'account deletion request is on legal hold' using errcode = '42501';
  end if;

  if v_request.anonymized_at is null then
    raise exception 'account deletion request has not been anonymized' using errcode = '55000';
  end if;

  v_user_id := v_request.user_id;

  -- Clears the avatar on user_profiles; trg_sync_public_profiles propagates the
  -- null to public_profiles so the public avatar URL stops being served.
  update user_profiles
  set avatar_url = null, updated_at = now()
  where id = v_user_id
    and avatar_url is not null;

  -- Direct user-owned rows. Portfolios cascade to their collaborators/follows/flags;
  -- checklists cascade to checklist_items.
  for v_target in
    select *
    from (
      values
        ('checklists', 'user_id'),
        ('portfolios', 'owner_id'),
        ('portfolio_collaborators', 'user_id'),
        ('portfolio_follows', 'user_id'),
        ('passport_stamps', 'user_id'),
        ('passport_progress_events', 'user_id'),
        ('user_settings', 'user_id'),
        ('activity_events', 'recipient_id'),
        ('activity_events', 'actor_id'),
        ('user_food_cred', 'user_id'),
        ('food_cred_events', 'user_id'),
        ('user_stall_interactions', 'user_id'),
        ('recommendation_impressions', 'user_id'),
        ('user_mission_progress', 'user_id'),
        ('app_ops_rate_limits', 'actor_user_id')
    ) as t(table_name, column_name)
  loop
    if to_regclass('public.' || v_target.table_name) is not null then
      execute format('delete from public.%I where %I = $1', v_target.table_name, v_target.column_name)
      using v_user_id;
    end if;
  end loop;

  -- Stall submissions: unreviewed/rejected ones are personal contributions and are deleted;
  -- accepted ones may back live venue data, so they stay with the owner link and notes
  -- cleared (normally already done by the profile-delete trigger, repeated here so a retry
  -- of a half-finished run is safe).
  if to_regclass('public.user_stall_submissions') is not null then
    delete from public.user_stall_submissions
    where user_id = v_user_id
      and status <> 'accepted';

    update public.user_stall_submissions
    set user_id = null, notes = null
    where user_id = v_user_id
      and status = 'accepted';

    -- Every cover and gallery object of the detached rows. user_id is already null, so the
    -- rows are found by the user's storage folder (uploads are policy-limited to it).
    select coalesce(jsonb_agg(distinct jsonb_build_object('bucket', obj.bucket, 'path', obj.path)), '[]'::jsonb)
    into v_retained
    from (
      select s.image_storage_bucket as bucket, s.image_storage_path as path
      from public.user_stall_submissions s
      where s.user_id is null
        and s.status = 'accepted'
        and s.image_storage_path like v_user_id::text || '/%'
      union
      select coalesce(g.item ->> 'bucket', g.item ->> 'storageBucket'),
             coalesce(g.item ->> 'path', g.item ->> 'storagePath')
      from public.user_stall_submissions s
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(s.gallery_images) = 'array' then s.gallery_images else '[]'::jsonb end
      ) as g(item)
      where s.user_id is null
        and s.status = 'accepted'
        and coalesce(g.item ->> 'path', g.item ->> 'storagePath') like v_user_id::text || '/%'
    ) obj
    where obj.bucket is not null
      and obj.path is not null;
  end if;

  insert into account_deletion_processing_events (request_id, user_id, event_type, metadata)
  values (
    p_request_id,
    v_user_id,
    'anonymized',
    jsonb_build_object(
      'phase', 'residual_purge',
      'worker_id', p_worker_id,
      'retained_storage_objects', jsonb_array_length(v_retained)
    )
  );

  return jsonb_build_object('user_id', v_user_id, 'retained_storage_objects', v_retained);
end;
$$;

revoke all on function public.purge_account_deletion_residual_data(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.purge_account_deletion_residual_data(uuid, uuid) to service_role;

-- ============================================================================================
-- 2. SET-X3
-- ============================================================================================
-- SET-X3: while an account has a pending deletion request (deactivated), other viewers must not
-- see its name or avatar on a profile header. Reviews, posts and portfolios already hide
-- (20261022100000); get_profile_card was missed. The owner still gets their own card.
-- Same body as 20261021132000 plus the deactivation check.

create or replace function app_private.get_profile_card(p_user_id uuid)
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  is_private boolean,
  can_view_content boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    up.id,
    up.display_name,
    up.avatar_url,
    coalesce(ps.account_visibility = 'private', false) as is_private,
    app_private.can_read_author_content(up.id) as can_view_content
  from public.user_profiles up
  left join public.privacy_settings ps on ps.user_id = up.id
  where up.id = p_user_id
    and (
      auth.uid() is null
      or up.id = auth.uid()
      or not app_private.app_user_block_exists(auth.uid(), up.id)
    )
    and (
      up.id = auth.uid()
      or not app_private.account_is_deactivated(up.id)
    );
$$;

revoke all on function app_private.get_profile_card(uuid) from public, anon, authenticated;
grant execute on function app_private.get_profile_card(uuid) to anon, authenticated, service_role;

-- ============================================================================================
-- 3. SET-2
-- ============================================================================================
-- SET-2: the PDPA export missed three stores that hold the user's own data: dish_taste_ratings
-- (live on prod since 2026-10-25), catalog_corrections (reports they filed) and notification_jobs
-- (the push copy sent to them). Body is 20261028100000's app_private.export_my_data plus the
-- 'tasteRatings', 'catalogCorrections' and 'notificationJobs' categories; the public SECURITY
-- INVOKER wrapper and its grants are unchanged. The data object is built in two halves because
-- jsonb_build_object takes at most 100 arguments (50 categories). A contract test now fails CI when a table that
-- keys on a user is in neither the export nor supabase/export-allowlist.json.

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
