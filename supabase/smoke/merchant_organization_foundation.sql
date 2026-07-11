-- Smoke checks for DB-P0-06 merchant organization compatibility foundation.
-- Each check should return zero rows except the final pass marker.

with expected(table_name) as (
  values
    ('merchant_organizations'),
    ('merchant_members'),
    ('merchant_organization_outlets')
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
    ('merchant_is_org_member'),
    ('merchant_can_view_organization'),
    ('merchant_can_manage_organization'),
    ('merchant_can_manage_legacy_outlet'),
    ('merchant_can_manage_outlet_v2')
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
    ('merchant_organizations'),
    ('merchant_members'),
    ('merchant_organization_outlets')
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
    'merchant_is_org_member',
    'merchant_can_view_organization',
    'merchant_can_manage_organization',
    'merchant_can_manage_legacy_outlet',
    'merchant_can_manage_outlet_v2'
  )
  and prosecdef is distinct from true;

with expected(indexname) as (
  values
    ('idx_merchant_organizations_legacy_account'),
    ('idx_merchant_organizations_status_created'),
    ('merchant_members_org_user_unique'),
    ('merchant_members_org_email_unique'),
    ('idx_merchant_members_org_role_status'),
    ('idx_merchant_members_user_status'),
    ('idx_merchant_members_email_status'),
    ('idx_merchant_organization_outlets_outlet'),
    ('idx_merchant_organization_outlets_org_source')
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
    ('merchant_organizations_service_role_all', 'merchant_organizations'),
    ('merchant_members_service_role_all', 'merchant_members'),
    ('merchant_organization_outlets_service_role_all', 'merchant_organization_outlets')
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
    ('merchant_organizations_select_member', 'merchant_organizations'),
    ('merchant_members_select_org_member', 'merchant_members'),
    ('merchant_members_insert_manager', 'merchant_members'),
    ('merchant_members_update_manager', 'merchant_members'),
    ('merchant_members_delete_manager', 'merchant_members'),
    ('merchant_organization_outlets_select_member', 'merchant_organization_outlets'),
    ('merchant_organization_outlets_insert_manager', 'merchant_organization_outlets'),
    ('merchant_organization_outlets_delete_manager', 'merchant_organization_outlets')
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
    'merchant_organizations',
    'merchant_members',
    'merchant_organization_outlets'
  )
  and 'anon'::name = any(roles);

select 'unexpected_anon_table_grant' as check_name, table_name || '.' || privilege_type as detail
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'merchant_organizations',
    'merchant_members',
    'merchant_organization_outlets'
  )
  and grantee = 'anon';

select 'missing_legacy_org_backfill' as check_name, merchant_accounts.id::text as detail
from merchant_accounts
where not exists (
  select 1
  from merchant_organizations
  where merchant_organizations.legacy_merchant_account_id = merchant_accounts.id
);

select 'missing_owner_member_backfill' as check_name, merchant_accounts.id::text as detail
from merchant_accounts
where merchant_accounts.user_id is not null
  and not exists (
    select 1
    from merchant_organizations
    join merchant_members
      on merchant_members.organization_id = merchant_organizations.id
    where merchant_organizations.legacy_merchant_account_id = merchant_accounts.id
      and merchant_members.user_id = merchant_accounts.user_id
      and merchant_members.role = 'owner'
      and merchant_members.status = 'active'
  );

select 'missing_outlet_bridge_backfill' as check_name, merchant_outlets.id::text as detail
from merchant_outlets
where not exists (
  select 1
  from merchant_organizations
  join merchant_organization_outlets
    on merchant_organization_outlets.organization_id = merchant_organizations.id
  where merchant_organizations.legacy_merchant_account_id = merchant_outlets.merchant_account_id
    and merchant_organization_outlets.outlet_id = merchant_outlets.id
);

select 'legacy_manage_venue_replaced_unexpectedly' as check_name, 'merchant_can_manage_venue' as detail
where not exists (
  select 1
  from pg_proc
  join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
  where pg_namespace.nspname = 'public'
    and proname = 'merchant_can_manage_venue'
    and prosecdef is distinct from true
);

begin;

insert into merchant_accounts (
  id,
  user_id,
  display_name,
  email
)
values (
  '00000000-0000-0035-a000-000000000001',
  '00000000-0000-0035-b000-000000000001',
  'DB P0 06 Smoke Merchant',
  'owner-db-p0-06@example.test'
);

insert into merchant_outlets (
  id,
  merchant_account_id,
  name,
  business_type
)
values (
  '00000000-0000-0035-d000-000000000001',
  '00000000-0000-0035-a000-000000000001',
  'DB P0 06 Smoke Outlet',
  'hawker_stall'
);

insert into merchant_organizations (
  id,
  legacy_merchant_account_id,
  display_name,
  created_by
)
values (
  '00000000-0000-0035-c000-000000000001',
  '00000000-0000-0035-a000-000000000001',
  'DB P0 06 Smoke Org',
  '00000000-0000-0035-b000-000000000001'
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
values
  (
    '00000000-0000-0035-c000-000000000001',
    '00000000-0000-0035-b000-000000000001',
    'owner-db-p0-06@example.test',
    'DB P0 06 Owner',
    'owner',
    'active',
    now()
  ),
  (
    '00000000-0000-0035-c000-000000000001',
    '00000000-0000-0035-b000-000000000002',
    'manager-db-p0-06@example.test',
    'DB P0 06 Manager',
    'manager',
    'active',
    now()
  );

insert into merchant_organization_outlets (
  organization_id,
  outlet_id,
  source
)
values (
  '00000000-0000-0035-c000-000000000001',
  '00000000-0000-0035-d000-000000000001',
  'manual'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0035-b000-000000000002', true);
select set_config('request.jwt.claim.email', 'manager-db-p0-06@example.test', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0035-b000-000000000002","email":"manager-db-p0-06@example.test"}',
  true
);
set local role authenticated;

select 'behavior_manager_org_select_failed' as check_name, 'manager cannot select org' as detail
where not exists (
  select 1
  from merchant_organizations
  where id = '00000000-0000-0035-c000-000000000001'
);

select 'behavior_manager_member_select_failed' as check_name, 'manager cannot select members' as detail
where not exists (
  select 1
  from merchant_members
  where organization_id = '00000000-0000-0035-c000-000000000001'
    and user_id = '00000000-0000-0035-b000-000000000001'
);

select 'behavior_manager_outlet_bridge_select_failed' as check_name, 'manager cannot select outlet bridge' as detail
where not exists (
  select 1
  from merchant_organization_outlets
  where organization_id = '00000000-0000-0035-c000-000000000001'
    and outlet_id = '00000000-0000-0035-d000-000000000001'
);

insert into merchant_members (
  organization_id,
  email,
  display_name,
  role,
  status
)
values (
  '00000000-0000-0035-c000-000000000001',
  'staff-db-p0-06@example.test',
  'DB P0 06 Staff',
  'staff',
  'invited'
);

update merchant_members
set role = 'viewer'
where organization_id = '00000000-0000-0035-c000-000000000001'
  and email = 'staff-db-p0-06@example.test';

select 'behavior_manager_member_update_failed' as check_name, 'manager cannot update non-owner member' as detail
where not exists (
  select 1
  from merchant_members
  where organization_id = '00000000-0000-0035-c000-000000000001'
    and email = 'staff-db-p0-06@example.test'
    and role = 'viewer'
);

delete from merchant_members
where organization_id = '00000000-0000-0035-c000-000000000001'
  and email = 'staff-db-p0-06@example.test';

select 'behavior_manager_member_delete_failed' as check_name, 'manager cannot delete non-owner member' as detail
where exists (
  select 1
  from merchant_members
  where organization_id = '00000000-0000-0035-c000-000000000001'
    and email = 'staff-db-p0-06@example.test'
);

do $$
begin
  begin
    insert into merchant_members (
      organization_id,
      email,
      display_name,
      role,
      status
    )
    values (
      '00000000-0000-0035-c000-000000000001',
      'owner-escalation-db-p0-06@example.test',
      'DB P0 06 Owner Escalation',
      'owner',
      'invited'
    );

    raise exception 'behavior_manager_owner_insert_allowed';
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0035-b000-000000000003', true);
select set_config('request.jwt.claim.email', 'nonmember-db-p0-06@example.test', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0035-b000-000000000003","email":"nonmember-db-p0-06@example.test"}',
  true
);
set local role authenticated;

select 'behavior_non_member_org_select_leaked' as check_name, 'non-member can select org' as detail
where exists (
  select 1
  from merchant_organizations
  where id = '00000000-0000-0035-c000-000000000001'
);

do $$
begin
  begin
    insert into merchant_members (
      organization_id,
      email,
      display_name,
      role,
      status
    )
    values (
      '00000000-0000-0035-c000-000000000001',
      'nonmember-insert-db-p0-06@example.test',
      'DB P0 06 Non Member Insert',
      'staff',
      'invited'
    );

    raise exception 'behavior_non_member_insert_allowed';
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

reset role;

select 'behavior_anon_table_grant_leaked' as check_name, 'anon has table access' as detail
where has_table_privilege('anon', 'public.merchant_organizations', 'select')
  or has_table_privilege('anon', 'public.merchant_members', 'select')
  or has_table_privilege('anon', 'public.merchant_organization_outlets', 'select');

rollback;

select 'merchant_organization_foundation_smoke_passed' as status;
