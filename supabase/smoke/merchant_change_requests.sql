-- Smoke checks for DB-P0-07 merchant change requests.
-- Each check should return zero rows except the final pass marker.

with expected(table_name) as (
  values
    ('merchant_change_requests'),
    ('merchant_change_request_events')
),
actual as (
  select tablename::text as table_name
  from pg_tables
  where schemaname = 'public'
)
select 'missing_table' as check_name, expected.table_name as detail
from expected
except
select 'missing_table', actual.table_name
from actual;

with expected(function_name) as (
  values
    ('is_platform_operator'),
    ('merchant_org_owns_venue'),
    ('submit_merchant_change_request'),
    ('list_merchant_change_requests'),
    ('get_merchant_change_request_detail'),
    ('cancel_merchant_change_request'),
    ('review_merchant_change_request')
),
actual as (
  select proname::text as function_name
  from pg_proc
  join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
  where pg_namespace.nspname = 'public'
)
select 'missing_function' as check_name, expected.function_name as detail
from expected
except
select 'missing_function', actual.function_name
from actual;

with expected(table_name) as (
  values
    ('merchant_change_requests'),
    ('merchant_change_request_events')
)
select 'rls_not_enabled' as check_name, expected.table_name as detail
from expected
join pg_class on pg_class.relname = expected.table_name
join pg_namespace on pg_namespace.oid = pg_class.relnamespace
where pg_namespace.nspname = 'public'
  and pg_class.relrowsecurity is distinct from true;

select 'missing_helper_security_definer' as check_name, proname::text as detail
from pg_proc
join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
where pg_namespace.nspname = 'public'
  and proname in (
    'is_platform_operator',
    'merchant_org_owns_venue',
    'submit_merchant_change_request',
    'list_merchant_change_requests',
    'get_merchant_change_request_detail',
    'cancel_merchant_change_request',
    'review_merchant_change_request'
  )
  and prosecdef is distinct from true;

with expected(indexname) as (
  values
    ('idx_merchant_change_requests_org_status_cursor'),
    ('idx_merchant_change_requests_venue_status_cursor'),
    ('idx_merchant_change_requests_requester_cursor'),
    ('idx_merchant_change_requests_target'),
    ('idx_merchant_change_request_events_request_created'),
    ('idx_merchant_change_request_events_actor_created')
),
actual as (
  select indexname::text
  from pg_indexes
  where schemaname = 'public'
)
select 'missing_index' as check_name, expected.indexname as detail
from expected
except
select 'missing_index', actual.indexname
from actual;

with expected(policyname, tablename) as (
  values
    ('merchant_change_requests_service_role_all', 'merchant_change_requests'),
    ('merchant_change_request_events_service_role_all', 'merchant_change_request_events')
),
actual as (
  select policyname::text, tablename::text
  from pg_policies
  where schemaname = 'public'
    and 'service_role'::name = any(roles)
)
select 'missing_service_role_policy' as check_name, expected.tablename || '.' || expected.policyname as detail
from expected
except
select 'missing_service_role_policy', actual.tablename || '.' || actual.policyname
from actual;

with expected(policyname, tablename) as (
  values
    ('merchant_change_requests_select_member', 'merchant_change_requests'),
    ('merchant_change_request_events_select_member', 'merchant_change_request_events')
),
actual as (
  select policyname::text, tablename::text
  from pg_policies
  where schemaname = 'public'
    and 'authenticated'::name = any(roles)
)
select 'missing_authenticated_policy' as check_name, expected.tablename || '.' || expected.policyname as detail
from expected
except
select 'missing_authenticated_policy', actual.tablename || '.' || actual.policyname
from actual;

select 'unexpected_anon_policy' as check_name, tablename || '.' || policyname as detail
from pg_policies
where schemaname = 'public'
  and tablename in (
    'merchant_change_requests',
    'merchant_change_request_events'
  )
  and 'anon'::name = any(roles);

select 'unexpected_anon_table_grant' as check_name, table_name || '.' || privilege_type as detail
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'merchant_change_requests',
    'merchant_change_request_events'
  )
  and grantee = 'anon';

select 'unexpected_authenticated_table_write_grant' as check_name, table_name || '.' || privilege_type as detail
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'merchant_change_requests',
    'merchant_change_request_events'
  )
  and grantee = 'authenticated'
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER');

select 'unexpected_anon_function_grant' as check_name, routine_name as detail
from information_schema.role_routine_grants
where routine_schema = 'public'
  and routine_name in (
    'is_platform_operator',
    'merchant_org_owns_venue',
    'submit_merchant_change_request',
    'list_merchant_change_requests',
    'get_merchant_change_request_detail',
    'cancel_merchant_change_request',
    'review_merchant_change_request'
  )
  and grantee = 'anon';

select 'unexpected_authenticated_internal_function_grant' as check_name, 'merchant_org_owns_venue' as detail
where has_function_privilege(
  'authenticated',
  'public.merchant_org_owns_venue(uuid,text)',
  'execute'
);

begin;

insert into buildings (
  id,
  slug,
  name,
  building_type,
  latitude,
  longitude,
  floors
)
values (
  'db-p0-07-building',
  'db-p0-07-building',
  'DB P0 07 Smoke Building',
  'hawker_centre',
  1.3521,
  103.8198,
  array['01']
);

insert into venues (
  id,
  building_id,
  name,
  unit_number,
  floor,
  operating_hours
)
values (
  'db-p0-07-venue',
  'db-p0-07-building',
  'DB P0 07 Smoke Venue',
  '#01-07',
  '01',
  '09:00-21:00'
);

insert into merchant_accounts (
  id,
  user_id,
  display_name,
  email
)
values (
  '00000000-0000-0036-a000-000000000001',
  '00000000-0000-0036-b000-000000000001',
  'DB P0 07 Smoke Merchant',
  'owner-db-p0-07@example.test'
);

insert into merchant_outlets (
  id,
  merchant_account_id,
  venue_id,
  name,
  business_type
)
values (
  '00000000-0000-0036-d000-000000000001',
  '00000000-0000-0036-a000-000000000001',
  'db-p0-07-venue',
  'DB P0 07 Smoke Outlet',
  'hawker_stall'
);

insert into merchant_organizations (
  id,
  legacy_merchant_account_id,
  display_name,
  created_by
)
values (
  '00000000-0000-0036-c000-000000000001',
  '00000000-0000-0036-a000-000000000001',
  'DB P0 07 Smoke Org',
  '00000000-0000-0036-b000-000000000001'
);

insert into merchant_members (
  organization_id,
  user_id,
  email,
  display_name,
  role,
  status,
  accepted_at
)
values (
  '00000000-0000-0036-c000-000000000001',
  '00000000-0000-0036-b000-000000000001',
  'owner-db-p0-07@example.test',
  'DB P0 07 Owner',
  'owner',
  'active',
  now()
);

insert into merchant_organization_outlets (
  organization_id,
  outlet_id,
  source
)
values (
  '00000000-0000-0036-c000-000000000001',
  '00000000-0000-0036-d000-000000000001',
  'manual'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0036-b000-000000000001', true);
select set_config('request.jwt.claim.email', 'owner-db-p0-07@example.test', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0036-b000-000000000001","email":"owner-db-p0-07@example.test","role":"authenticated"}',
  true
);
set local role authenticated;

select public.submit_merchant_change_request(
  '00000000-0000-0036-c000-000000000001',
  'db-p0-07-venue',
  'venue',
  'update',
  '{"name":"DB P0 07 Smoke Venue Updated"}'::jsonb,
  '00000000-0000-0036-d000-000000000001',
  'db-p0-07-venue',
  'review_required'
);

select public.submit_merchant_change_request(
  '00000000-0000-0036-c000-000000000001',
  'db-p0-07-venue',
  'hours',
  'hours',
  '{"operating_hours":"10:00-20:00"}'::jsonb,
  '00000000-0000-0036-d000-000000000001',
  'db-p0-07-venue',
  'low'
);

select 'behavior_submit_failed' as check_name, 'owner submit did not create pending request' as detail
where (
  select count(*)
  from merchant_change_requests
  where organization_id = '00000000-0000-0036-c000-000000000001'
    and status = 'pending'
) <> 2;

select 'behavior_event_missing' as check_name, 'submit event missing' as detail
where not exists (
  select 1
  from merchant_change_request_events
  join merchant_change_requests
    on merchant_change_requests.id = merchant_change_request_events.change_request_id
  where merchant_change_requests.organization_id = '00000000-0000-0036-c000-000000000001'
    and merchant_change_request_events.event_type = 'submitted'
);

select 'behavior_list_failed' as check_name, 'owner cannot list org requests' as detail
where (
  select count(*)
  from public.list_merchant_change_requests(
    '00000000-0000-0036-c000-000000000001',
    'pending',
    null,
    null,
    10
  )
) <> 2;

with first_page as (
  select id, created_at
  from public.list_merchant_change_requests(
    '00000000-0000-0036-c000-000000000001',
    'pending',
    null,
    null,
    1
  )
),
second_page as (
  select id
  from public.list_merchant_change_requests(
    '00000000-0000-0036-c000-000000000001',
    'pending',
    (select created_at from first_page),
    (select id from first_page),
    1
  )
)
select 'behavior_cursor_duplicate' as check_name, 'cursor page repeated first row' as detail
where exists (
  select 1
  from first_page
  join second_page using (id)
);

select public.cancel_merchant_change_request(
  (
    select id
    from merchant_change_requests
    where organization_id = '00000000-0000-0036-c000-000000000001'
      and target_type = 'hours'
    limit 1
  )
);

select 'behavior_cancel_failed' as check_name, 'requester could not cancel pending request' as detail
where not exists (
  select 1
  from merchant_change_requests
  where organization_id = '00000000-0000-0036-c000-000000000001'
    and target_type = 'hours'
    and status = 'cancelled'
);

do $$
begin
  begin
    insert into merchant_change_requests (
      organization_id,
      venue_id,
      requested_by,
      target_type,
      change_type,
      payload
    )
    values (
      '00000000-0000-0036-c000-000000000001',
      'db-p0-07-venue',
      '00000000-0000-0036-b000-000000000001',
      'venue',
      'update',
      '{}'::jsonb
    );

    raise exception 'behavior_direct_insert_allowed';
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

do $$
begin
  begin
    perform public.review_merchant_change_request(
      (
        select id
        from merchant_change_requests
        where organization_id = '00000000-0000-0036-c000-000000000001'
          and status = 'pending'
        limit 1
      ),
      'approved',
      'non-platform review should fail'
    );

    raise exception 'behavior_member_review_allowed';
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0036-b000-000000000002', true);
select set_config('request.jwt.claim.email', 'nonmember-db-p0-07@example.test', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0036-b000-000000000002","email":"nonmember-db-p0-07@example.test","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
begin
  begin
    perform public.submit_merchant_change_request(
      '00000000-0000-0036-c000-000000000001',
      'db-p0-07-venue',
      'venue',
      'update',
      '{}'::jsonb
    );

    raise exception 'behavior_non_member_submit_allowed';
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

select 'behavior_non_member_list_leaked' as check_name, 'non-member can list org requests' as detail
where exists (
  select 1
  from public.list_merchant_change_requests(
    '00000000-0000-0036-c000-000000000001',
    null,
    null,
    null,
    10
  )
);

reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0036-b000-000000000003', true);
select set_config('request.jwt.claim.email', 'ops-db-p0-07@example.test', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0036-b000-000000000003","email":"ops-db-p0-07@example.test","role":"authenticated","app_metadata":{"role":"platform_admin"}}',
  true
);
set local role authenticated;

select public.review_merchant_change_request(
  (
    select id
    from merchant_change_requests
    where organization_id = '00000000-0000-0036-c000-000000000001'
      and status = 'pending'
    limit 1
  ),
  'approved',
  'smoke approval'
);

select 'behavior_platform_review_failed' as check_name, 'platform operator did not approve request' as detail
where not exists (
  select 1
  from merchant_change_requests
  where organization_id = '00000000-0000-0036-c000-000000000001'
    and status = 'approved'
    and reviewed_at is not null
);

select 'behavior_review_event_missing' as check_name, 'review event missing' as detail
where not exists (
  select 1
  from merchant_change_request_events
  join merchant_change_requests
    on merchant_change_requests.id = merchant_change_request_events.change_request_id
  where merchant_change_requests.organization_id = '00000000-0000-0036-c000-000000000001'
    and merchant_change_request_events.event_type = 'reviewed'
    and merchant_change_request_events.to_status = 'approved'
);

rollback;

select 'merchant_change_requests_smoke_passed' as status;
