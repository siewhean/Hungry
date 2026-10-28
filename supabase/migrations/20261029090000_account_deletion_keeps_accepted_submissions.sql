-- smoke: supabase/smoke/account_deletion_keeps_accepted_submissions.sql
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
