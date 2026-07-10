-- Merchant change request queue.
-- This slice captures merchant-submitted venue/menu/profile changes for review.
-- It intentionally does not mutate canonical venues, dishes, menu, or media rows.

create table if not exists merchant_change_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references merchant_organizations(id) on delete cascade,
  venue_id text not null references venues(id) on delete cascade,
  outlet_id uuid references merchant_outlets(id) on delete set null,
  requested_by uuid not null,
  target_type text not null
    check (target_type in ('venue', 'dish', 'menu_item', 'outlet', 'promotion', 'profile', 'hours', 'media')),
  target_id text,
  change_type text not null
    check (change_type in ('create', 'update', 'delete', 'availability', 'price', 'hours', 'media', 'ownership', 'metadata')),
  risk_level text not null default 'review_required'
    check (risk_level in ('low', 'review_required', 'high')),
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending'
    check (status in ('pending', 'cancelled', 'approved', 'rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status in ('pending', 'cancelled') and reviewed_at is null)
    or (status in ('approved', 'rejected') and reviewed_at is not null)
  )
);

create table if not exists merchant_change_request_events (
  id uuid primary key default gen_random_uuid(),
  change_request_id uuid not null references merchant_change_requests(id) on delete cascade,
  actor_user_id uuid,
  event_type text not null
    check (event_type in ('submitted', 'cancelled', 'reviewed', 'status_changed')),
  from_status text,
  to_status text,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists idx_merchant_change_requests_org_status_cursor
  on merchant_change_requests(organization_id, status, created_at desc, id desc);
create index if not exists idx_merchant_change_requests_venue_status_cursor
  on merchant_change_requests(venue_id, status, created_at desc, id desc);
create index if not exists idx_merchant_change_requests_requester_cursor
  on merchant_change_requests(requested_by, created_at desc, id desc);
create index if not exists idx_merchant_change_requests_target
  on merchant_change_requests(target_type, target_id)
  where target_id is not null;
create index if not exists idx_merchant_change_request_events_request_created
  on merchant_change_request_events(change_request_id, created_at desc, id desc);
create index if not exists idx_merchant_change_request_events_actor_created
  on merchant_change_request_events(actor_user_id, created_at desc)
  where actor_user_id is not null;

drop trigger if exists trg_merchant_change_requests_updated_at on merchant_change_requests;
create trigger trg_merchant_change_requests_updated_at
  before update on merchant_change_requests
  for each row execute function public.set_updated_at();

create or replace function public.is_platform_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.role(), '') = 'service_role'
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in (
      'admin',
      'platform_admin',
      'ops',
      'support'
    );
$$;

create or replace function public.merchant_org_owns_venue(
  p_organization_id uuid,
  p_venue_id text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from merchant_organization_outlets
    join merchant_outlets
      on merchant_outlets.id = merchant_organization_outlets.outlet_id
    where merchant_organization_outlets.organization_id = p_organization_id
      and merchant_outlets.venue_id = p_venue_id
  );
$$;

create or replace function public.submit_merchant_change_request(
  p_organization_id uuid,
  p_venue_id text,
  p_target_type text,
  p_change_type text,
  p_payload jsonb default '{}'::jsonb,
  p_outlet_id uuid default null,
  p_target_id text default null,
  p_risk_level text default 'review_required'
)
returns merchant_change_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request merchant_change_requests;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object' then
    raise exception 'Merchant change payload must be a JSON object'
      using errcode = '22023';
  end if;

  if not public.merchant_can_view_organization(p_organization_id) then
    raise exception 'Merchant organization access denied'
      using errcode = '42501';
  end if;

  if not public.merchant_org_owns_venue(p_organization_id, p_venue_id) then
    raise exception 'Venue is not linked to this merchant organization'
      using errcode = '42501';
  end if;

  if p_outlet_id is not null and not exists (
    select 1
    from merchant_organization_outlets
    join merchant_outlets
      on merchant_outlets.id = merchant_organization_outlets.outlet_id
    where merchant_organization_outlets.organization_id = p_organization_id
      and merchant_outlets.id = p_outlet_id
      and merchant_outlets.venue_id = p_venue_id
  ) then
    raise exception 'Outlet is not linked to this merchant organization and venue'
      using errcode = '42501';
  end if;

  insert into merchant_change_requests (
    organization_id,
    venue_id,
    outlet_id,
    requested_by,
    target_type,
    target_id,
    change_type,
    risk_level,
    payload
  )
  values (
    p_organization_id,
    p_venue_id,
    p_outlet_id,
    auth.uid(),
    p_target_type,
    nullif(btrim(p_target_id), ''),
    p_change_type,
    p_risk_level,
    coalesce(p_payload, '{}'::jsonb)
  )
  returning * into v_request;

  insert into merchant_change_request_events (
    change_request_id,
    actor_user_id,
    event_type,
    to_status,
    metadata
  )
  values (
    v_request.id,
    auth.uid(),
    'submitted',
    v_request.status,
    jsonb_build_object(
      'target_type', v_request.target_type,
      'change_type', v_request.change_type,
      'risk_level', v_request.risk_level
    )
  );

  return v_request;
end;
$$;

create or replace function public.list_merchant_change_requests(
  p_organization_id uuid,
  p_status text default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 25
)
returns setof merchant_change_requests
language sql
stable
security definer
set search_path = public
as $$
  select merchant_change_requests.*
  from merchant_change_requests
  where merchant_change_requests.organization_id = p_organization_id
    and (
      public.merchant_can_view_organization(p_organization_id)
      or public.is_platform_operator()
    )
    and (p_status is null or merchant_change_requests.status = p_status)
    and (
      p_cursor_created_at is null
      or p_cursor_id is null
      or (merchant_change_requests.created_at, merchant_change_requests.id)
        < (p_cursor_created_at, p_cursor_id)
    )
  order by merchant_change_requests.created_at desc, merchant_change_requests.id desc
  limit least(greatest(coalesce(p_limit, 25), 1), 50);
$$;

create or replace function public.get_merchant_change_request_detail(
  p_change_request_id uuid
)
returns merchant_change_requests
language sql
stable
security definer
set search_path = public
as $$
  select merchant_change_requests.*
  from merchant_change_requests
  where merchant_change_requests.id = p_change_request_id
    and (
      public.merchant_can_view_organization(merchant_change_requests.organization_id)
      or public.is_platform_operator()
    );
$$;

create or replace function public.cancel_merchant_change_request(
  p_change_request_id uuid
)
returns merchant_change_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before merchant_change_requests;
  v_after merchant_change_requests;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select *
  into v_before
  from merchant_change_requests
  where id = p_change_request_id
  for update;

  if not found then
    raise exception 'Merchant change request not found'
      using errcode = 'P0002';
  end if;

  if v_before.status <> 'pending' then
    raise exception 'Only pending merchant change requests can be cancelled'
      using errcode = '23514';
  end if;

  if not (
    v_before.requested_by = auth.uid()
    or public.merchant_can_manage_organization(v_before.organization_id)
    or public.is_platform_operator()
  ) then
    raise exception 'Merchant change request cancel denied'
      using errcode = '42501';
  end if;

  update merchant_change_requests
  set status = 'cancelled'
  where id = p_change_request_id
  returning * into v_after;

  insert into merchant_change_request_events (
    change_request_id,
    actor_user_id,
    event_type,
    from_status,
    to_status
  )
  values (
    v_after.id,
    auth.uid(),
    'cancelled',
    v_before.status,
    v_after.status
  );

  return v_after;
end;
$$;

create or replace function public.review_merchant_change_request(
  p_change_request_id uuid,
  p_status text,
  p_review_note text default null
)
returns merchant_change_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before merchant_change_requests;
  v_after merchant_change_requests;
begin
  if not public.is_platform_operator() then
    raise exception 'Platform operator access required'
      using errcode = '42501';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Review status must be approved or rejected'
      using errcode = '22023';
  end if;

  select *
  into v_before
  from merchant_change_requests
  where id = p_change_request_id
  for update;

  if not found then
    raise exception 'Merchant change request not found'
      using errcode = 'P0002';
  end if;

  if v_before.status <> 'pending' then
    raise exception 'Only pending merchant change requests can be reviewed'
      using errcode = '23514';
  end if;

  update merchant_change_requests
  set
    status = p_status,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_note = nullif(btrim(p_review_note), '')
  where id = p_change_request_id
  returning * into v_after;

  insert into merchant_change_request_events (
    change_request_id,
    actor_user_id,
    event_type,
    from_status,
    to_status,
    metadata
  )
  values (
    v_after.id,
    auth.uid(),
    'reviewed',
    v_before.status,
    v_after.status,
    jsonb_build_object('review_note_present', v_after.review_note is not null)
  );

  return v_after;
end;
$$;

alter table merchant_change_requests enable row level security;
alter table merchant_change_request_events enable row level security;

drop policy if exists "merchant_change_requests_service_role_all" on merchant_change_requests;
create policy "merchant_change_requests_service_role_all"
on merchant_change_requests for all to service_role
using (true)
with check (true);

drop policy if exists "merchant_change_request_events_service_role_all" on merchant_change_request_events;
create policy "merchant_change_request_events_service_role_all"
on merchant_change_request_events for all to service_role
using (true)
with check (true);

drop policy if exists "merchant_change_requests_select_member" on merchant_change_requests;
create policy "merchant_change_requests_select_member"
on merchant_change_requests for select to authenticated
using (
  public.merchant_can_view_organization(organization_id)
  or public.is_platform_operator()
);

drop policy if exists "merchant_change_request_events_select_member" on merchant_change_request_events;
create policy "merchant_change_request_events_select_member"
on merchant_change_request_events for select to authenticated
using (
  exists (
    select 1
    from merchant_change_requests
    where merchant_change_requests.id = merchant_change_request_events.change_request_id
      and (
        public.merchant_can_view_organization(merchant_change_requests.organization_id)
        or public.is_platform_operator()
      )
  )
);

revoke all on table merchant_change_requests from anon, authenticated;
revoke all on table merchant_change_request_events from anon, authenticated;
grant select on table merchant_change_requests to authenticated;
grant select on table merchant_change_request_events to authenticated;
grant all on table merchant_change_requests to service_role;
grant all on table merchant_change_request_events to service_role;

revoke execute on function public.is_platform_operator() from public;
revoke execute on function public.merchant_org_owns_venue(uuid, text) from public;
revoke execute on function public.submit_merchant_change_request(uuid, text, text, text, jsonb, uuid, text, text) from public;
revoke execute on function public.list_merchant_change_requests(uuid, text, timestamptz, uuid, integer) from public;
revoke execute on function public.get_merchant_change_request_detail(uuid) from public;
revoke execute on function public.cancel_merchant_change_request(uuid) from public;
revoke execute on function public.review_merchant_change_request(uuid, text, text) from public;
grant execute on function public.is_platform_operator() to authenticated, service_role;
grant execute on function public.merchant_org_owns_venue(uuid, text) to authenticated, service_role;
grant execute on function public.submit_merchant_change_request(uuid, text, text, text, jsonb, uuid, text, text) to authenticated, service_role;
grant execute on function public.list_merchant_change_requests(uuid, text, timestamptz, uuid, integer) to authenticated, service_role;
grant execute on function public.get_merchant_change_request_detail(uuid) to authenticated, service_role;
grant execute on function public.cancel_merchant_change_request(uuid) to authenticated, service_role;
grant execute on function public.review_merchant_change_request(uuid, text, text) to authenticated, service_role;

comment on table merchant_change_requests is
  'Merchant-submitted change queue for reviewed venue/menu/profile edits. This table does not mutate canonical venue, dish, menu, or media records.';
comment on table merchant_change_request_events is
  'Append-only status/event history for merchant change requests.';
comment on function public.submit_merchant_change_request(uuid, text, text, text, jsonb, uuid, text, text) is
  'RPC-only merchant change submission path; validates organization and venue linkage before inserting a pending reviewed request.';
comment on function public.review_merchant_change_request(uuid, text, text) is
  'Platform-operator review path for merchant change requests; intentionally does not apply canonical data mutations.';
