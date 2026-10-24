-- smoke: supabase/smoke/account_deletion_residual_purge.sql
-- ACCDEL-01: purge personal data that 0040's anonymize_account_deletion_request
-- does not cover (tables added after 0040, plus user_profiles.avatar_url, which
-- otherwise keeps syncing into public_profiles after deletion).
-- Additive only: new service-role RPC called by the process-account-deletions
-- worker after anonymization and before auth deletion. Idempotent; every table is
-- guarded with to_regclass so environments missing optional tables still succeed.
-- Re-timestamped (originally 20261015120000) so it applies after main's newest
-- migration (20261018150000), including 20261017120000_account_deletion_grace_period;
-- the claim RPC below keeps that migration's scheduled_for grace-period gate. Menu photo submissions are kept
-- (the worker clears submitted_by) so stall pages keep their photos.

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

-- Poison-request guard: claims had unlimited retries, so a few permanently failing
-- requests could occupy every batch slot and stall the queue. Same function body as
-- 20261017120000 (grace period: only requests whose scheduled_for has passed are
-- claimed), plus: fresh requests are claimed before retried ones, and
-- requests that failed 10 times stop being auto-claimed (last_error + failed events
-- remain for manual follow-up; reset processing_attempts to retry).
create or replace function public.claim_account_deletion_requests(
  p_limit integer default 5,
  p_worker_id uuid default gen_random_uuid()
)
returns table (
  request_id uuid,
  user_id uuid,
  worker_id uuid,
  processing_attempts integer
)
language sql
security definer
set search_path = public
as $$
  with candidates as (
    select id
    from account_deletion_requests
    where status in ('requested', 'processing')
      and completed_at is null
      and not legal_hold
      and scheduled_for <= now()
      and processing_attempts < 10
      and (
        worker_locked_at is null
        or worker_locked_at < now() - interval '15 minutes'
      )
    order by processing_attempts asc, scheduled_for asc, created_at asc
    for update skip locked
    limit least(greatest(coalesce(p_limit, 5), 1), 25)
  ),
  claimed as (
    update account_deletion_requests adr
    set
      status = 'processing',
      processing_started_at = coalesce(adr.processing_started_at, now()),
      processing_attempts = adr.processing_attempts + 1,
      processed_by = 'account-deletion-worker',
      worker_lock_id = p_worker_id,
      worker_locked_at = now(),
      last_error = null
    from candidates c
    where adr.id = c.id
    returning adr.id, adr.user_id, adr.processing_attempts
  ),
  audit as (
    insert into account_deletion_processing_events (
      request_id,
      user_id,
      event_type,
      metadata
    )
    select
      claimed.id,
      claimed.user_id,
      'claimed',
      jsonb_build_object('worker_id', p_worker_id, 'attempt', claimed.processing_attempts)
    from claimed
  )
  select claimed.id, claimed.user_id, p_worker_id, claimed.processing_attempts
  from claimed;
$$;

revoke all on function public.claim_account_deletion_requests(integer, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_account_deletion_requests(integer, uuid) to service_role;
