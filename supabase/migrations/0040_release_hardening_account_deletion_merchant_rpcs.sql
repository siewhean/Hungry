-- Release hardening: account deletion processing and merchant RPC-only writes.
-- Additive follow-up to 0017 and 0039. No production data is changed until the
-- worker or service RPCs are invoked.

alter table account_deletion_requests
  add column if not exists processing_started_at timestamptz,
  add column if not exists processing_attempts integer not null default 0
    check (processing_attempts >= 0),
  add column if not exists processed_by text,
  add column if not exists worker_lock_id uuid,
  add column if not exists worker_locked_at timestamptz,
  add column if not exists anonymized_at timestamptz,
  add column if not exists auth_deleted_at timestamptz,
  add column if not exists legal_hold boolean not null default false,
  add column if not exists retention_reason text,
  add column if not exists last_error text;

create index if not exists idx_account_deletion_requests_worker_queue
  on account_deletion_requests(status, legal_hold, created_at)
  where completed_at is null;
create unique index if not exists uniq_account_deletion_requests_active_user
  on account_deletion_requests(user_id)
  where status in ('requested', 'processing');

drop policy if exists "account_deletion_service_role_all" on account_deletion_requests;
create policy "account_deletion_service_role_all"
on account_deletion_requests for all to service_role
using (true)
with check (true);

revoke update, delete on table account_deletion_requests from anon, authenticated;
grant select, insert on table account_deletion_requests to authenticated;
grant all on table account_deletion_requests to service_role;

create table if not exists account_deletion_processing_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid,
  user_id uuid,
  event_type text not null
    check (event_type in ('claimed', 'anonymization_started', 'anonymized', 'auth_deleted', 'completed', 'failed', 'legal_hold')),
  actor text not null default 'account-deletion-worker',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_account_deletion_processing_events_request
  on account_deletion_processing_events(request_id, created_at desc);
create index if not exists idx_account_deletion_processing_events_user
  on account_deletion_processing_events(user_id, created_at desc);

alter table account_deletion_processing_events enable row level security;

drop policy if exists "account_deletion_processing_events_service_role_all"
  on account_deletion_processing_events;
create policy "account_deletion_processing_events_service_role_all"
on account_deletion_processing_events for all to service_role
using (true)
with check (true);

revoke all on table account_deletion_processing_events from public, anon, authenticated;
grant all on table account_deletion_processing_events to service_role;

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
      and (
        worker_locked_at is null
        or worker_locked_at < now() - interval '15 minutes'
      )
    order by created_at asc
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

create or replace function public.anonymize_account_deletion_request(
  p_request_id uuid,
  p_worker_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request account_deletion_requests%rowtype;
  v_user_id uuid;
begin
  select *
  into v_request
  from account_deletion_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'account deletion request not found' using errcode = 'P0002';
  end if;

  v_user_id := v_request.user_id;

  if v_request.legal_hold then
    insert into account_deletion_processing_events (request_id, user_id, event_type, metadata)
    values (
      p_request_id,
      v_user_id,
      'legal_hold',
      jsonb_build_object('retention_reason', v_request.retention_reason)
    );
    raise exception 'account deletion request is on legal hold' using errcode = '42501';
  end if;

  insert into account_deletion_processing_events (request_id, user_id, event_type, metadata)
  values (
    p_request_id,
    v_user_id,
    'anonymization_started',
    jsonb_build_object('worker_id', p_worker_id)
  );

  delete from user_blocks
  where blocker_id = v_user_id
     or blocked_user_key = v_user_id::text;

  delete from user_favourite_dishes
  where user_id = v_user_id;

  delete from bite_reactions
  where user_id = v_user_id;

  delete from taste_interaction_events
  where user_id = v_user_id;

  delete from quiz_responses
  where user_id = v_user_id;

  delete from app_user_rate_limits
  where actor_user_id = v_user_id;

  update reviews
  set
    user_id = null,
    author_name = 'Deleted user',
    text = '[deleted]',
    tags = '{}'::text[]
  where user_id = v_user_id;

  update bites
  set
    author_id = null,
    author_name = 'Deleted user',
    author_avatar = null,
    caption = ''
  where author_id = v_user_id;

  update posts
  set
    status = 'deleted',
    visibility = 'private',
    caption = '',
    generated_content = '{}'::jsonb,
    deleted_at = coalesce(deleted_at, now()),
    updated_at = now()
  where author_id = v_user_id;

  update post_comments
  set
    body = '[deleted]',
    deleted_at = coalesce(deleted_at, now()),
    updated_at = now()
  where user_id = v_user_id;

  delete from post_likes
  where user_id = v_user_id;

  delete from post_saves
  where user_id = v_user_id;

  delete from post_shares
  where user_id = v_user_id;

  update post_shares
  set target_user_id = null
  where target_user_id = v_user_id;

  delete from hidden_posts
  where viewer_id = v_user_id;

  delete from follows
  where follower_id = v_user_id
     or followee_id = v_user_id;

  delete from privacy_settings
  where user_id = v_user_id;

  delete from conversation_participants
  where participant_user_id = v_user_id;

  update conversations
  set created_by_user_id = null
  where created_by_user_id = v_user_id;

  update messages
  set
    body = '[deleted]',
    deleted_at = coalesce(deleted_at, now()),
    edited_at = coalesce(edited_at, now())
  where sender_user_id = v_user_id;

  delete from read_receipts
  where reader_user_id = v_user_id;

  update chat_messages
  set body = '[deleted]'
  where sender_user_id = v_user_id;

  update merchant_accounts
  set
    display_name = 'Deleted merchant',
    email = 'deleted+' || id::text || '@deleted.hungry.local',
    updated_at = now()
  where user_id = v_user_id;

  delete from merchant_roles
  where user_id = v_user_id;

  update merchant_dish_view_events
  set user_id = null
  where user_id = v_user_id;

  update merchant_notifications
  set recipient_user_id = null
  where recipient_user_id = v_user_id;

  update user_profiles
  set
    display_name = 'Deleted user',
    email = null,
    dietary_preferences = '{}'::text[],
    favourite_dish_ids = '{}'::text[],
    reviewed_dish_ids = '{}'::text[],
    taste_profile = null,
    dishes_reviewed = 0,
    stalls_visited = 0,
    favourites_count = 0,
    sweet = null,
    spicy = null,
    sour = null,
    salty = null,
    rich = null,
    aromatic = null,
    updated_at = now()
  where id = v_user_id;

  update account_deletion_requests
  set
    status = 'processing',
    anonymized_at = coalesce(anonymized_at, now()),
    worker_locked_at = now(),
    worker_lock_id = coalesce(p_worker_id, worker_lock_id),
    last_error = null
  where id = p_request_id;

  insert into account_deletion_processing_events (request_id, user_id, event_type, metadata)
  values (
    p_request_id,
    v_user_id,
    'anonymized',
    jsonb_build_object(
      'worker_id',
      p_worker_id,
      'preserved_tables',
      array[
        'account_deletion_requests',
        'account_deletion_processing_events',
        'content_reports',
        'post_reports',
        'moderation_actions',
        'app_ops_audit_events'
      ]
    )
  );

  return v_user_id;
exception
  when others then
    update account_deletion_requests
    set
      last_error = sqlerrm,
      worker_locked_at = null
    where id = p_request_id;

    insert into account_deletion_processing_events (
      request_id,
      user_id,
      event_type,
      metadata
    )
    values (
      p_request_id,
      v_user_id,
      'failed',
      jsonb_build_object('worker_id', p_worker_id, 'error', sqlerrm)
    );

    raise;
end;
$$;

revoke all on function public.anonymize_account_deletion_request(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.anonymize_account_deletion_request(uuid, uuid) to service_role;

create or replace function public.complete_account_deletion_request(
  p_request_id uuid,
  p_worker_id uuid default null,
  p_auth_deleted boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  update account_deletion_requests
  set
    status = 'completed',
    completed_at = coalesce(completed_at, now()),
    auth_deleted_at = case when p_auth_deleted then coalesce(auth_deleted_at, now()) else auth_deleted_at end,
    worker_lock_id = null,
    worker_locked_at = null,
    last_error = null
  where id = p_request_id
  returning user_id into v_user_id;

  if v_user_id is null then
    raise exception 'account deletion request not found' using errcode = 'P0002';
  end if;

  insert into account_deletion_processing_events (request_id, user_id, event_type, metadata)
  values (
    p_request_id,
    v_user_id,
    case when p_auth_deleted then 'auth_deleted' else 'completed' end,
    jsonb_build_object('worker_id', p_worker_id)
  );
end;
$$;

revoke all on function public.complete_account_deletion_request(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.complete_account_deletion_request(uuid, uuid, boolean)
  to service_role;

drop policy if exists "merchant_dish_views_public_insert" on merchant_dish_view_events;
drop policy if exists "merchant_email_outbox_owner_manager_insert" on merchant_email_outbox;

revoke insert, update, delete on table merchant_dish_view_events from anon, authenticated;
revoke insert, update, delete on table merchant_email_outbox from anon, authenticated;
grant select on table merchant_dish_view_events to authenticated;
grant select on table merchant_email_outbox to authenticated;
grant all on table merchant_dish_view_events to service_role;
grant all on table merchant_email_outbox to service_role;

create or replace function public.record_merchant_dish_view(
  p_dish_id text,
  p_session_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dish record;
  v_outlet record;
  v_user_id uuid := auth.uid();
  v_session_id text := nullif(trim(coalesce(p_session_id, '')), '');
  v_dedupe_key text;
  v_event_id uuid;
begin
  if nullif(trim(coalesce(p_dish_id, '')), '') is null then
    raise exception 'dish id is required' using errcode = '22023';
  end if;

  select id, venue_id
  into v_dish
  from dishes
  where id = p_dish_id;

  if not found or v_dish.venue_id is null then
    return null;
  end if;

  select id, merchant_account_id, venue_id
  into v_outlet
  from merchant_outlets
  where venue_id = v_dish.venue_id
  order by created_at asc
  limit 1;

  if not found then
    return null;
  end if;

  v_session_id := coalesce(v_session_id, v_user_id::text);

  if v_session_id is null then
    raise exception 'anonymous dish views require a bounded session id' using errcode = '22023';
  end if;

  if char_length(v_session_id) > 128 or v_session_id !~ '^[A-Za-z0-9:_-]{4,128}$' then
    raise exception 'session id format is invalid' using errcode = '22023';
  end if;

  if v_user_id is null and exists (
    select 1
    from merchant_dish_view_events
    where session_id = v_session_id
      and viewed_at >= now() - interval '1 hour'
    group by session_id
    having count(*) >= 120
  ) then
    raise exception 'dish view rate limit exceeded' using errcode = 'P0001';
  end if;

  v_dedupe_key := p_dish_id || ':' || v_session_id || ':' || to_char(now(), 'YYYY-MM-DD"T"HH24');

  insert into merchant_dish_view_events (
    merchant_account_id,
    outlet_id,
    venue_id,
    dish_id,
    user_id,
    session_id,
    dedupe_key,
    viewed_at
  )
  values (
    v_outlet.merchant_account_id,
    v_outlet.id,
    v_outlet.venue_id,
    v_dish.id,
    v_user_id,
    v_session_id,
    v_dedupe_key,
    now()
  )
  on conflict (dedupe_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select id
    into v_event_id
    from merchant_dish_view_events
    where dedupe_key = v_dedupe_key;
  end if;

  return v_event_id;
end;
$$;

revoke all on function public.record_merchant_dish_view(text, text)
  from public, anon, authenticated;
grant execute on function public.record_merchant_dish_view(text, text)
  to anon, authenticated;

create or replace function public.get_merchant_dish_view_counts(
  p_outlet_id uuid,
  p_since timestamptz default null,
  p_until timestamptz default null
)
returns table (
  dish_id text,
  view_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select mdve.dish_id, count(*)::bigint as view_count
  from merchant_dish_view_events mdve
  where mdve.outlet_id = p_outlet_id
    and (p_since is null or mdve.viewed_at >= p_since)
    and (p_until is null or mdve.viewed_at < p_until)
    and exists (
      select 1
      from merchant_accounts ma
      left join merchant_roles mr on mr.merchant_account_id = ma.id
      where ma.id = mdve.merchant_account_id
        and (
          ma.user_id = auth.uid()
          or mr.user_id = auth.uid()
        )
    )
  group by mdve.dish_id;
$$;

revoke all on function public.get_merchant_dish_view_counts(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_merchant_dish_view_counts(uuid, timestamptz, timestamptz)
  to authenticated;

create or replace function public.app_enqueue_merchant_email(
  p_merchant_account_id uuid,
  p_outlet_id uuid,
  p_recipient_email text,
  p_template text,
  p_subject text,
  p_body text,
  p_dedupe_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email_id uuid;
  v_recipient_email text := lower(trim(coalesce(p_recipient_email, '')));
  v_template text := lower(trim(coalesce(p_template, '')));
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if v_template not in ('team_invite', 'weekly_summary', 'low_rating') then
    raise exception 'unsupported email template' using errcode = '22023';
  end if;

  if v_recipient_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then
    raise exception 'valid recipient email is required' using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_dedupe_key, '')), '') is null then
    raise exception 'dedupe key is required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from merchant_accounts ma
    left join merchant_roles mr on mr.merchant_account_id = ma.id
    where ma.id = p_merchant_account_id
      and (
        ma.user_id = auth.uid()
        or (mr.user_id = auth.uid() and mr.role in ('owner', 'manager'))
      )
  ) then
    raise exception 'merchant owner or manager access required' using errcode = '42501';
  end if;

  if p_outlet_id is not null and not exists (
    select 1
    from merchant_outlets mo
    where mo.id = p_outlet_id
      and mo.merchant_account_id = p_merchant_account_id
  ) then
    raise exception 'outlet does not belong to merchant account' using errcode = '42501';
  end if;

  insert into merchant_email_outbox (
    merchant_account_id,
    outlet_id,
    recipient_email,
    template,
    subject,
    body,
    status,
    dedupe_key,
    metadata
  )
  values (
    p_merchant_account_id,
    p_outlet_id,
    v_recipient_email,
    v_template,
    left(trim(coalesce(p_subject, '')), 160),
    left(trim(coalesce(p_body, '')), 4000),
    'queued',
    trim(p_dedupe_key),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (dedupe_key) do update
  set
    recipient_email = excluded.recipient_email,
    subject = excluded.subject,
    body = excluded.body,
    metadata = excluded.metadata,
    status = case
      when merchant_email_outbox.status = 'failed' then 'queued'
      else merchant_email_outbox.status
    end
  returning id into v_email_id;

  return v_email_id;
end;
$$;

revoke all on function public.app_enqueue_merchant_email(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb
) from public, anon, authenticated;

create or replace function public.enqueue_merchant_team_invite_email(
  p_merchant_account_id uuid,
  p_recipient_email text,
  p_member_id uuid,
  p_role text,
  p_invitee_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := nullif(trim(coalesce(p_invitee_name, '')), '');
begin
  return public.app_enqueue_merchant_email(
    p_merchant_account_id,
    null,
    p_recipient_email,
    'team_invite',
    'You have been invited to manage a Hungry stall',
    coalesce(v_name, 'A teammate') || ', install or open Hungry to accept your merchant team invite.',
    'email:team-invite:' || p_merchant_account_id::text || ':' || lower(trim(p_recipient_email)),
    jsonb_build_object('memberId', p_member_id, 'role', p_role, 'delivery', 'email')
  );
end;
$$;

revoke all on function public.enqueue_merchant_team_invite_email(uuid, text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.enqueue_merchant_team_invite_email(uuid, text, uuid, text, text)
  to authenticated;

create or replace function public.enqueue_merchant_weekly_summary_email(
  p_merchant_account_id uuid,
  p_outlet_id uuid,
  p_recipient_email text,
  p_summary_id text,
  p_member_id text,
  p_subject text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.app_enqueue_merchant_email(
    p_merchant_account_id,
    p_outlet_id,
    p_recipient_email,
    'weekly_summary',
    p_subject,
    p_body,
    'email:weekly-summary:' || p_summary_id || ':' || p_member_id,
    jsonb_build_object('summaryId', p_summary_id)
  );
end;
$$;

revoke all on function public.enqueue_merchant_weekly_summary_email(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.enqueue_merchant_weekly_summary_email(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text
) to authenticated;
