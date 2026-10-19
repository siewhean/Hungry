-- Private-account follow requests.
--
-- follow_user (20261019060000) writes a 'pending' follow for private accounts,
-- but nothing let the target act on it, so requests stayed pending forever,
-- and trg_activity_on_follow sent "new_follower" even for pending requests.
--
-- 1. activity_events accepts 'follow_request'.
-- 2. trg_activity_on_follow sends 'follow_request' when a follow becomes
--    pending and 'new_follower' only when it becomes approved (insert of an
--    approved follow, or a pending/rejected follow approved later).
-- 3. list_incoming_follow_requests(limit, offset) / count_incoming_follow_requests():
--    the caller's pending requests, minus users blocked either way.
-- 4. approve_follow_request(requester) / decline_follow_request(requester):
--    the target answers a request. Approving a blocked pair is refused.
-- 5. cancel_follow_request(target): the requester withdraws a pending request.
--
-- Resolving a request removes its 'follow_request' activity item. Bodies live
-- in app_private (SECURITY DEFINER); public names are SECURITY INVOKER wrappers.

create schema if not exists app_private;
grant usage on schema app_private to anon, authenticated, service_role;

-- 1. Activity event type ---------------------------------------------------
do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.activity_events'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%event_type%'
  loop
    execute format('alter table public.activity_events drop constraint %I', v_constraint.conname);
  end loop;
end $$;

alter table public.activity_events
  add constraint activity_events_event_type_check
  check (event_type in (
    'new_like',
    'new_comment',
    'new_reply',
    'new_follower',
    'follow_request'
  ));

-- 2. Follow activity trigger -----------------------------------------------
create or replace function public.trg_activity_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if NEW.status = 'approved'
    and (TG_OP = 'INSERT' or OLD.status is distinct from 'approved') then
    insert into activity_events (recipient_id, actor_id, event_type, target_type, target_id)
    values (NEW.followee_id, NEW.follower_id, 'new_follower', 'profile', NEW.followee_id);
  elsif NEW.status = 'pending'
    and (TG_OP = 'INSERT' or OLD.status is distinct from 'pending') then
    insert into activity_events (recipient_id, actor_id, event_type, target_type, target_id)
    values (NEW.followee_id, NEW.follower_id, 'follow_request', 'profile', NEW.followee_id);
  end if;
  return NEW;
end;
$$;

revoke execute on function public.trg_activity_on_follow()
  from public, anon, authenticated;

drop trigger if exists trg_activity_on_follow on public.follows;
create trigger trg_activity_on_follow
  after insert or update of status on public.follows
  for each row execute function public.trg_activity_on_follow();

-- Removes the follow_request activity item once a request is resolved.
create or replace function app_private.clear_follow_request_activity(
  p_requester_id uuid,
  p_target_id uuid
)
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  delete from public.activity_events ae
  where ae.recipient_id = p_target_id
    and ae.actor_id = p_requester_id
    and ae.event_type = 'follow_request';
$$;

revoke all on function app_private.clear_follow_request_activity(uuid, uuid)
  from public, anon, authenticated;

-- 3. Incoming requests -----------------------------------------------------
create or replace function app_private.list_incoming_follow_requests(
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (user_id uuid, display_name text, avatar_url text, requested_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select up.id, up.display_name, up.avatar_url, f.requested_at
  from public.follows f
  join public.user_profiles up on up.id = f.follower_id
  where auth.uid() is not null
    and f.followee_id = auth.uid()
    and f.status = 'pending'
    and not app_private.app_user_block_exists(auth.uid(), f.follower_id)
  order by f.requested_at desc, up.id
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function app_private.count_incoming_follow_requests()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer
  from public.follows f
  where auth.uid() is not null
    and f.followee_id = auth.uid()
    and f.status = 'pending'
    and not app_private.app_user_block_exists(auth.uid(), f.follower_id);
$$;

-- 4. Approve / decline -----------------------------------------------------
create or replace function app_private.approve_follow_request(p_requester_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_viewer uuid := auth.uid();
begin
  if v_viewer is null then
    raise exception 'You must be signed in to answer follow requests.' using errcode = '28000';
  end if;

  perform 1
  from public.follows f
  where f.follower_id = p_requester_id
    and f.followee_id = v_viewer
    and f.status = 'pending'
  for update;

  if not found then
    raise exception 'Follow request not found.' using errcode = 'P0002';
  end if;

  if app_private.app_user_block_exists(v_viewer, p_requester_id) then
    raise exception 'You cannot approve this follow request.' using errcode = '42501';
  end if;

  update public.follows
  set status = 'approved',
      approved_at = now(),
      updated_at = now()
  where follower_id = p_requester_id
    and followee_id = v_viewer;

  perform app_private.clear_follow_request_activity(p_requester_id, v_viewer);
  return 'approved';
end;
$$;

create or replace function app_private.decline_follow_request(p_requester_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_viewer uuid := auth.uid();
begin
  if v_viewer is null then
    raise exception 'You must be signed in to answer follow requests.' using errcode = '28000';
  end if;

  delete from public.follows f
  where f.follower_id = p_requester_id
    and f.followee_id = v_viewer
    and f.status = 'pending';

  if not found then
    raise exception 'Follow request not found.' using errcode = 'P0002';
  end if;

  perform app_private.clear_follow_request_activity(p_requester_id, v_viewer);
end;
$$;

-- 5. Cancel (requester) ----------------------------------------------------
-- Idempotent: cancelling a request that is already gone is not an error.
create or replace function app_private.cancel_follow_request(p_target_user_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_viewer uuid := auth.uid();
begin
  if v_viewer is null then
    raise exception 'You must be signed in to cancel follow requests.' using errcode = '28000';
  end if;

  delete from public.follows f
  where f.follower_id = v_viewer
    and f.followee_id = p_target_user_id
    and f.status = 'pending';

  perform app_private.clear_follow_request_activity(v_viewer, p_target_user_id);
end;
$$;

revoke all on function app_private.list_incoming_follow_requests(integer, integer)
  from public, anon, authenticated;
revoke all on function app_private.count_incoming_follow_requests()
  from public, anon, authenticated;
revoke all on function app_private.approve_follow_request(uuid) from public, anon, authenticated;
revoke all on function app_private.decline_follow_request(uuid) from public, anon, authenticated;
revoke all on function app_private.cancel_follow_request(uuid) from public, anon, authenticated;
grant execute on function app_private.list_incoming_follow_requests(integer, integer)
  to authenticated, service_role;
grant execute on function app_private.count_incoming_follow_requests()
  to authenticated, service_role;
grant execute on function app_private.approve_follow_request(uuid) to authenticated, service_role;
grant execute on function app_private.decline_follow_request(uuid) to authenticated, service_role;
grant execute on function app_private.cancel_follow_request(uuid) to authenticated, service_role;

-- Public wrappers ----------------------------------------------------------
create or replace function public.list_incoming_follow_requests(
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (user_id uuid, display_name text, avatar_url text, requested_at timestamptz)
language sql
stable
security invoker
set search_path = public, app_private
as $$
  select * from app_private.list_incoming_follow_requests(p_limit, p_offset);
$$;

create or replace function public.count_incoming_follow_requests()
returns integer
language sql
stable
security invoker
set search_path = public, app_private
as $$
  select app_private.count_incoming_follow_requests();
$$;

create or replace function public.approve_follow_request(p_requester_id uuid)
returns text
language sql
volatile
security invoker
set search_path = public, app_private
as $$
  select app_private.approve_follow_request(p_requester_id);
$$;

create or replace function public.decline_follow_request(p_requester_id uuid)
returns void
language sql
volatile
security invoker
set search_path = public, app_private
as $$
  select app_private.decline_follow_request(p_requester_id);
$$;

create or replace function public.cancel_follow_request(p_target_user_id uuid)
returns void
language sql
volatile
security invoker
set search_path = public, app_private
as $$
  select app_private.cancel_follow_request(p_target_user_id);
$$;

revoke all on function public.list_incoming_follow_requests(integer, integer) from public, anon;
revoke all on function public.count_incoming_follow_requests() from public, anon;
revoke all on function public.approve_follow_request(uuid) from public, anon;
revoke all on function public.decline_follow_request(uuid) from public, anon;
revoke all on function public.cancel_follow_request(uuid) from public, anon;
grant execute on function public.list_incoming_follow_requests(integer, integer)
  to authenticated, service_role;
grant execute on function public.count_incoming_follow_requests() to authenticated, service_role;
grant execute on function public.approve_follow_request(uuid) to authenticated, service_role;
grant execute on function public.decline_follow_request(uuid) to authenticated, service_role;
grant execute on function public.cancel_follow_request(uuid) to authenticated, service_role;
