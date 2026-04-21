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

-- 3) No public policies exist yet (dev gate)
select
  tablename,
  count(*) as policy_count
from pg_policies
where schemaname = 'public'
  and tablename in ('menu_photo_submissions', 'dishes_draft', 'merchant_claim_interests')
group by tablename
order by tablename;

-- 4) RPCs exist (for future CLM-03/CLM-06 wiring)
select
  proname as rpc_name
from pg_proc
where proname in ('submit_menu_photo', 'submit_merchant_claim_interest')
order by proname;
