-- App security hardening for ops/admin controls, merchant verification integrity,
-- public profile privacy, and immutable social/chat linkage fields.

create table if not exists app_ops_admins (
  user_id uuid primary key references user_profiles(id) on delete cascade,
  role text not null default 'operator' check (role in ('operator', 'admin')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_ops_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references user_profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  origin text,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists app_ops_rate_limits (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references user_profiles(id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  unique (actor_user_id, action, window_start)
);

create table if not exists app_user_rate_limits (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references user_profiles(id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  unique (actor_user_id, action, window_start)
);

alter table app_ops_admins enable row level security;
alter table app_ops_audit_events enable row level security;
alter table app_ops_rate_limits enable row level security;
alter table app_user_rate_limits enable row level security;

create or replace function public.app_is_current_user_ops_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from app_ops_admins a
    where a.user_id = auth.uid()
      and a.enabled
      and a.role in ('operator', 'admin')
  );
$$;

revoke all on function public.app_is_current_user_ops_admin() from public, anon, authenticated;
grant execute on function public.app_is_current_user_ops_admin() to authenticated, service_role;

create or replace function public.app_can_make_ops_request(
  p_actor_user_id uuid,
  p_action text,
  p_limit integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz := date_trunc('minute', now());
  v_count integer;
begin
  insert into app_ops_rate_limits (actor_user_id, action, window_start, count)
  values (p_actor_user_id, p_action, v_window_start, 1)
  on conflict (actor_user_id, action, window_start)
  do update set
    count = app_ops_rate_limits.count + 1,
    updated_at = now()
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.app_can_make_ops_request(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.app_can_make_ops_request(uuid, text, integer) to service_role;

create or replace function public.app_can_make_user_request(
  p_actor_user_id uuid,
  p_action text,
  p_limit integer default 10
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz := date_trunc('minute', now());
  v_count integer;
begin
  insert into app_user_rate_limits (actor_user_id, action, window_start, count)
  values (p_actor_user_id, p_action, v_window_start, 1)
  on conflict (actor_user_id, action, window_start)
  do update set
    count = app_user_rate_limits.count + 1,
    updated_at = now()
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.app_can_make_user_request(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.app_can_make_user_request(uuid, text, integer) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'merchant-verification-evidence',
  'merchant-verification-evidence',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'video/mp4', 'video/quicktime']
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table merchant_verification_evidence
  add column if not exists storage_bucket text not null default 'merchant-verification-evidence',
  add column if not exists storage_path text;

drop policy if exists "merchant_verification_evidence_storage_insert_own_prefix" on storage.objects;
create policy "merchant_verification_evidence_storage_insert_own_prefix"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'merchant-verification-evidence'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "merchant_verification_evidence_storage_select_own_prefix" on storage.objects;
create policy "merchant_verification_evidence_storage_select_own_prefix"
on storage.objects for select to authenticated
using (
  bucket_id = 'merchant-verification-evidence'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.app_is_current_user_ops_admin()
  )
);

drop policy if exists "merchant_verification_evidence_storage_service_select" on storage.objects;
create policy "merchant_verification_evidence_storage_service_select"
on storage.objects for select to service_role
using (bucket_id = 'merchant-verification-evidence');

create or replace function public.enforce_merchant_verification_decision_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or public.app_is_current_user_ops_admin() then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if new.status not in ('not_started', 'draft', 'submitted') then
    raise exception 'merchant verification decisions are admin-only' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.verified_at is not null
      or new.rejected_at is not null
      or new.rejection_reason is not null
      or new.expires_at is not null then
      raise exception 'merchant verification decision fields are admin-only' using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if old.verified_at is distinct from new.verified_at
      or old.rejected_at is distinct from new.rejected_at
      or old.rejection_reason is distinct from new.rejection_reason
      or old.expires_at is distinct from new.expires_at then
      raise exception 'merchant verification decision fields are immutable to merchants' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_merchant_verification_decision_guard on merchant_verifications;
create trigger trg_enforce_merchant_verification_decision_guard
before insert or update on merchant_verifications
for each row
execute function public.enforce_merchant_verification_decision_guard();

create or replace function public.enforce_merchant_verification_evidence_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or public.app_is_current_user_ops_admin() then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if new.uploaded_by is distinct from auth.uid() then
    raise exception 'verification evidence uploader must match caller' using errcode = '42501';
  end if;

  if new.storage_bucket is distinct from 'merchant-verification-evidence'
    or new.storage_path is null
    or new.storage_path = ''
    or new.storage_path not like auth.uid()::text || '/%' then
    raise exception 'verification evidence must use private caller-owned storage' using errcode = '42501';
  end if;

  if new.file_url is null
    or new.file_url is distinct from ('supabase://merchant-verification-evidence/' || new.storage_path) then
    raise exception 'verification evidence file_url must be derived from storage metadata' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_merchant_verification_evidence_guard on merchant_verification_evidence;
create trigger trg_enforce_merchant_verification_evidence_guard
before insert or update on merchant_verification_evidence
for each row
execute function public.enforce_merchant_verification_evidence_guard();

create or replace function public.enforce_follow_update_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.follower_id is distinct from old.follower_id
    or new.followee_id is distinct from old.followee_id
    or new.requested_at is distinct from old.requested_at then
    raise exception 'follow identity fields are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_follow_update_guard on follows;
create trigger trg_enforce_follow_update_guard
before update on follows
for each row
execute function public.enforce_follow_update_guard();

create or replace function public.enforce_conversation_participant_update_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.id is distinct from old.id
    or new.conversation_id is distinct from old.conversation_id
    or new.participant_kind is distinct from old.participant_kind
    or new.participant_user_id is distinct from old.participant_user_id
    or new.participant_merchant_account_id is distinct from old.participant_merchant_account_id
    or new.joined_at is distinct from old.joined_at then
    raise exception 'conversation participant identity fields are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_conversation_participant_update_guard on conversation_participants;
create trigger trg_enforce_conversation_participant_update_guard
before update on conversation_participants
for each row
execute function public.enforce_conversation_participant_update_guard();

create or replace function public.enforce_message_update_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.id is distinct from old.id
    or new.conversation_id is distinct from old.conversation_id
    or new.sender_user_id is distinct from old.sender_user_id
    or new.sender_merchant_account_id is distinct from old.sender_merchant_account_id
    or new.client_nonce is distinct from old.client_nonce
    or new.created_at is distinct from old.created_at then
    raise exception 'message identity fields are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_message_update_guard on messages;
create trigger trg_enforce_message_update_guard
before update on messages
for each row
execute function public.enforce_message_update_guard();

create or replace function public.enforce_read_receipt_update_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.message_id is distinct from old.message_id
    or new.conversation_id is distinct from old.conversation_id
    or new.reader_user_id is distinct from old.reader_user_id
    or new.reader_merchant_account_id is distinct from old.reader_merchant_account_id then
    raise exception 'read receipt identity fields are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_read_receipt_update_guard on read_receipts;
create trigger trg_enforce_read_receipt_update_guard
before update on read_receipts
for each row
execute function public.enforce_read_receipt_update_guard();

drop policy if exists "profile_select_public_or_followed" on user_profiles;
drop policy if exists "users_select_own" on user_profiles;
create policy "users_select_own"
on user_profiles for select to authenticated
using (auth.uid() = id);

create or replace view public.public_profiles
with (security_barrier = true)
as
select
  up.id,
  up.display_name,
  up.avatar_url,
  up.dishes_reviewed,
  up.stalls_visited,
  up.favourites_count,
  up.created_at
from user_profiles up
where public.can_read_author_content(up.id);

grant select on public.public_profiles to anon, authenticated;
