-- Acceptance is distinct from provider receipt confirmation; neither proves device delivery.
begin;
alter table public.notification_jobs drop constraint if exists notification_jobs_status_check;
alter table public.notification_jobs add constraint notification_jobs_status_check check
  (status in ('pending','sending','sent','skipped','failed','accepted','delivery_unknown'));
create table if not exists public.notification_receipts (
  ticket_id text primary key,
  job_id uuid not null references public.notification_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  status text not null default 'pending' check (status in ('pending','ok','error','expired')),
  error_code text,
  created_at timestamptz not null default now(),
  next_check_at timestamptz not null default now() + interval '15 minutes',
  checked_at timestamptz
);
alter table public.notification_receipts enable row level security;
revoke all on public.notification_receipts from public, anon, authenticated;
grant all on public.notification_receipts to service_role;
create index if not exists notification_receipts_due_idx on public.notification_receipts(next_check_at) where status = 'pending';
create index if not exists notification_receipts_job_idx on public.notification_receipts(job_id);

create or replace function public.record_notification_tickets(p_job_id uuid, p_tickets jsonb)
returns void language plpgsql set search_path = '' as $$
declare v_user uuid;
begin
  select user_id into strict v_user from public.notification_jobs where id = p_job_id for update;
  if jsonb_typeof(p_tickets) <> 'array' or jsonb_array_length(p_tickets) > 100 then
    raise exception 'invalid_ticket_batch';
  end if;
  if exists(select 1 from jsonb_array_elements(p_tickets) item
    where nullif(item->>'ticket_id','') is null or nullif(item->>'token','') is null) then
    raise exception 'invalid_ticket';
  end if;
  if exists(select 1 from public.notification_receipts r join jsonb_array_elements(p_tickets) item
    on r.ticket_id=item->>'ticket_id' where r.job_id<>p_job_id or r.token<>item->>'token') then
    raise exception 'ticket_identity_conflict';
  end if;
  insert into public.notification_receipts(ticket_id,job_id,user_id,token)
  select item->>'ticket_id',p_job_id,v_user,item->>'token'
  from jsonb_array_elements(p_tickets) item
  where nullif(item->>'ticket_id','') is not null and nullif(item->>'token','') is not null
  on conflict (ticket_id) do nothing;
end;
$$;
create or replace function public.claim_notification_receipts(p_limit integer default 1000)
returns setof public.notification_receipts language plpgsql set search_path = '' as $$
begin
  -- Expire locally even if Expo is unavailable; never retain an unpollable
  -- receipt as an endlessly retrying pending row after the provider TTL.
  update public.notification_receipts set status='expired',error_code='receipt_expired',checked_at=now()
    where status='pending' and created_at < now()-interval '23 hours';
  update public.notification_jobs j set status=case when exists(
      select 1 from public.notification_receipts r where r.job_id=j.id and r.status='ok') then 'sent' else 'delivery_unknown' end,
    skip_reason='receipt_expired',locked_at=null
    where j.status='accepted' and exists(select 1 from public.notification_receipts r where r.job_id=j.id and r.status='expired')
      and not exists(select 1 from public.notification_receipts r where r.job_id=j.id and r.status='pending');
  return query update public.notification_receipts r set next_check_at = now() + interval '10 minutes'
  where ticket_id in (
    select ticket_id from public.notification_receipts
    where status = 'pending' and next_check_at <= now()
    order by next_check_at,ticket_id limit least(greatest(coalesce(p_limit,1000),1),1000)
    for update skip locked
  ) returning r.*;
end;
$$;
create or replace function public.settle_notification_receipts(p_results jsonb)
returns void language plpgsql set search_path = '' as $$
declare v_item jsonb; v_row public.notification_receipts; v_job uuid; v_status text;
begin
  if jsonb_typeof(p_results) <> 'array' or jsonb_array_length(p_results) > 1000 then
    raise exception 'invalid_receipt_batch';
  end if;
  for v_item in select * from jsonb_array_elements(p_results) loop
    select * into v_row from public.notification_receipts where ticket_id = v_item->>'ticket_id' for update;
    if not found or v_row.status <> 'pending' then continue; end if;
    v_status := case when v_item->>'status' in ('ok','error') then v_item->>'status'
      when v_row.created_at < now() - interval '23 hours' then 'expired' else 'pending' end;
    update public.notification_receipts set status = v_status, checked_at = now(),
      error_code = case when v_status = 'expired' then 'receipt_expired' else v_item->>'error_code' end,
      next_check_at = now() + interval '10 minutes' where ticket_id = v_row.ticket_id;
    if v_status = 'error' and v_item->>'error_code' = 'DeviceNotRegistered' then
      delete from public.user_push_tokens where user_id = v_row.user_id and token = v_row.token;
    end if;
  end loop;
  for v_job in select distinct job_id from public.notification_receipts
    where ticket_id in (select item->>'ticket_id' from jsonb_array_elements(p_results) item)
  loop
    if exists(select 1 from public.notification_receipts where job_id = v_job and status = 'pending') then continue; end if;
    update public.notification_jobs set
      status = case when exists(select 1 from public.notification_receipts where job_id=v_job and status='ok') then 'sent'
        when exists(select 1 from public.notification_receipts where job_id=v_job and status='expired') then 'delivery_unknown' else 'failed' end,
      skip_reason = case when exists(select 1 from public.notification_receipts where job_id=v_job and status='ok') then null else 'receipt_error' end,
      locked_at = null
    where id = v_job and status = 'accepted';
  end loop;
end;
$$;
revoke all on function public.record_notification_tickets(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.claim_notification_receipts(integer) from public,anon,authenticated;
revoke all on function public.settle_notification_receipts(jsonb) from public,anon,authenticated;
grant execute on function public.record_notification_tickets(uuid,jsonb) to service_role;
grant execute on function public.claim_notification_receipts(integer) to service_role;
grant execute on function public.settle_notification_receipts(jsonb) to service_role;

-- Reuse the existing authenticated ten-minute worker cron; wake for due receipts
-- even when there are no jobs to send. No new feature is enabled by this change.
create or replace function public.invoke_notification_worker()
returns void language plpgsql security definer set search_path = '' as $$
declare v_url text; v_token text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name='notification_worker_url';
  select decrypted_secret into v_token from vault.decrypted_secrets where name='notification_worker_token';
  if v_url is null or v_token is null then return; end if;
  if not exists(select 1 from public.notification_jobs where status in ('pending','sending'))
    and not exists(select 1 from public.notification_receipts where status='pending' and next_check_at<=now()) then return; end if;
  perform net.http_post(url:=v_url,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_token),body:=jsonb_build_object('limit',100));
end;
$$;
revoke all on function public.invoke_notification_worker() from public,anon,authenticated;
commit;
