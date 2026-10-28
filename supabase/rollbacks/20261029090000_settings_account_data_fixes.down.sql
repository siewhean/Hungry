-- expect-row-loss: public.user_stall_submissions
-- Down for 20261029090000_settings_account_data_fixes. Undoes the three parts newest first:
-- export_my_data back to 20261028100000, get_profile_card back to 20261021132000, then the
-- account-deletion change (see part 1 for what happens to detached submissions).

-- 3. SET-2
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

notify pgrst, 'reload schema';

-- 2. SET-X3
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
    );
$$;

revoke all on function app_private.get_profile_card(uuid) from public, anon, authenticated;
grant execute on function app_private.get_profile_card(uuid) to anon, authenticated, service_role;

-- 1. SET-1 + X4
drop trigger if exists trg_user_profiles_detach_accepted_submissions on public.user_profiles;
drop function if exists app_private.detach_accepted_stall_submissions();

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

  -- Stall submissions: unreviewed/rejected submissions are personal contributions
  -- and are deleted. Accepted submissions may back live venue data, so they are
  -- kept with free-text notes cleared, and their images are reported back so the
  -- worker does not delete storage objects that live listings still reference.
  if to_regclass('public.user_stall_submissions') is not null then
    delete from public.user_stall_submissions
    where user_id = v_user_id
      and status <> 'accepted';

    update public.user_stall_submissions
    set notes = null
    where user_id = v_user_id
      and status = 'accepted';

    select coalesce(
      jsonb_agg(jsonb_build_object('bucket', image_storage_bucket, 'path', image_storage_path)),
      '[]'::jsonb
    )
    into v_retained
    from public.user_stall_submissions
    where user_id = v_user_id
      and status = 'accepted'
      and image_storage_bucket is not null
      and image_storage_path is not null;
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

create schema if not exists rollback_archive;
create table if not exists rollback_archive.user_stall_submissions_20261029090000 as
select * from public.user_stall_submissions where false;
insert into rollback_archive.user_stall_submissions_20261029090000
select * from public.user_stall_submissions where user_id is null;

delete from public.user_stall_submissions where user_id is null;

alter table public.user_stall_submissions
  alter column user_id set not null;
