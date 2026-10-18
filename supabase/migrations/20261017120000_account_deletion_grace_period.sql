-- ACCDEL-01: 30-day grace period before an account deletion request is processed.
-- Requests stay cancellable by their owner until scheduled_for; the worker only
-- claims requests whose grace period has ended.

alter table account_deletion_requests
  add column if not exists scheduled_for timestamptz not null default (now() + interval '30 days'),
  add column if not exists cancelled_at timestamptz;

alter table account_deletion_requests
  drop constraint if exists account_deletion_requests_status_check;
alter table account_deletion_requests
  add constraint account_deletion_requests_status_check
  check (status in ('requested', 'processing', 'completed', 'rejected', 'cancelled'));

alter table account_deletion_processing_events
  drop constraint if exists account_deletion_processing_events_event_type_check;
alter table account_deletion_processing_events
  add constraint account_deletion_processing_events_event_type_check
  check (event_type in ('claimed', 'anonymization_started', 'anonymized', 'auth_deleted', 'completed', 'failed', 'legal_hold', 'cancelled'));

create index if not exists idx_account_deletion_requests_scheduled
  on account_deletion_requests(scheduled_for)
  where status = 'requested';

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
      and (
        worker_locked_at is null
        or worker_locked_at < now() - interval '15 minutes'
      )
    order by scheduled_for asc, created_at asc
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

-- Owner cancels their own pending request during the grace period.
create or replace function public.cancel_my_account_deletion()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  update account_deletion_requests
  set status = 'cancelled', cancelled_at = now()
  where user_id = v_user_id
    and status = 'requested'
    and completed_at is null
  returning id into v_request_id;

  if v_request_id is null then
    return false;
  end if;

  insert into account_deletion_processing_events (request_id, user_id, event_type, actor, metadata)
  values (v_request_id, v_user_id, 'cancelled', 'account-owner', '{}'::jsonb);

  return true;
end;
$$;

revoke all on function public.cancel_my_account_deletion() from public, anon;
grant execute on function public.cancel_my_account_deletion() to authenticated;
