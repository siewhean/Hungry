-- Read-only order write-integrity smoke.
-- Any row before the pass marker is a release finding.

select
  'orders_owner_select_policy_missing' as check_name,
  'authenticated owners cannot read their own orders' as detail
where not exists (
  select 1
  from pg_policies
  where schemaname = 'public'
    and tablename = 'orders'
    and policyname = 'orders_select_own'
    and cmd = 'SELECT'
    and 'authenticated'::name = any (roles)
    and coalesce(qual, '') ~* 'auth\.uid\(\).*user_id'
);

select
  'orders_customer_write_policy_leaked' as check_name,
  policyname || ' still permits customer-role writes' as detail
from pg_policies
where schemaname = 'public'
  and tablename = 'orders'
  and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  and roles && array['anon'::name, 'authenticated'::name, 'public'::name];

select
  'orders_anon_write_privilege_leaked' as check_name,
  'anon retains INSERT, UPDATE, or DELETE on public.orders' as detail
where has_table_privilege('anon', 'public.orders', 'insert')
   or has_table_privilege('anon', 'public.orders', 'update')
   or has_table_privilege('anon', 'public.orders', 'delete');

select
  'orders_authenticated_write_privilege_leaked' as check_name,
  'authenticated retains INSERT, UPDATE, or DELETE on public.orders' as detail
where has_table_privilege('authenticated', 'public.orders', 'insert')
   or has_table_privilege('authenticated', 'public.orders', 'update')
   or has_table_privilege('authenticated', 'public.orders', 'delete');

select 'order_write_integrity_smoke_passed' as status;
