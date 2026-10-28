-- Down for 20261029090000_account_deletion_keeps_accepted_submissions.
-- Puts the purge function back to the 20261018180000 body, drops the profile-delete trigger and
-- makes user_stall_submissions.user_id NOT NULL again. Detached accepted submissions (user_id
-- null) cannot satisfy NOT NULL, so they are copied to rollback_archive first and then removed.
-- Their photos stay in storage; restore the rows from the archive table if the migration is
-- re-applied.

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
drop table if exists rollback_archive.user_stall_submissions_20261029090000;
create table rollback_archive.user_stall_submissions_20261029090000 as
select * from public.user_stall_submissions where user_id is null;

delete from public.user_stall_submissions where user_id is null;

alter table public.user_stall_submissions
  alter column user_id set not null;
