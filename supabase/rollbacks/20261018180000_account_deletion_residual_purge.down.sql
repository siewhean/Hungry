-- Down for 20261018180000_account_deletion_residual_purge.sql.
-- Drops the residual-purge RPC and puts claim_account_deletion_requests back to the
-- 20261017120000_account_deletion_grace_period version (no 10-attempt cap, oldest
-- scheduled first). No data is touched. The process-account-deletions worker calls the
-- purge RPC, so deletions fail while this is rolled back; roll the worker back too.

drop function if exists public.purge_account_deletion_residual_data(uuid, uuid);

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
