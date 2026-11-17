-- CLM-02 smoke checks for Sprint 10 supply priming migration.
-- Run after `supabase db push` on the linked project.

-- 1) Tables exist
select
  tablename
from pg_tables
where schemaname = 'public'
  and tablename in ('menu_photo_submissions', 'dishes_draft', 'merchant_claim_interests')
order by tablename;

-- 2) RLS is enabled
select
  relname as table_name,
  relrowsecurity as rls_enabled
from pg_class
where relname in ('menu_photo_submissions', 'dishes_draft', 'merchant_claim_interests')
order by relname;

-- 3) No direct anon/authenticated table policies exist on service-role-only tables
select
  tablename,
  count(*) as policy_count
from pg_policies
where schemaname = 'public'
  and tablename in ('menu_photo_submissions', 'dishes_draft', 'merchant_claim_interests')
  and (
    roles && array['anon'::name, 'authenticated'::name]
    or (permissive = 'PERMISSIVE' and roles = array['public'::name])
  )
group by tablename
order by tablename;

-- 4) RPCs exist and security-definer functions pin search_path
select
  proname as rpc_name,
  prosecdef as security_definer,
  proconfig
from pg_proc
where proname in ('submit_menu_photo', 'submit_merchant_claim_interest')
order by proname;

-- 5) submit_menu_photo is granted to authenticated only
select
  has_function_privilege('authenticated', 'submit_menu_photo(text, text, text, integer)', 'execute')
    as authenticated_can_execute,
  has_function_privilege('anon', 'submit_menu_photo(text, text, text, integer)', 'execute')
    as anon_can_execute;
