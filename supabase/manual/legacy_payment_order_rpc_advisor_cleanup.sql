-- Legacy payment/order RPC Security Advisor cleanup.
--
-- Scope:
-- - public.release_reserved_order(text, text, text, text)
-- - public.release_reserved_order(text, text)
-- - public.submit_payment_proof(text, text, text)
--
-- These functions are currently linked-project drift outside the Hungry MVP
-- repo source. Do not run this file as an app migration. Run it only from an
-- owner-approved Supabase SQL session after confirming the legacy order/payment
-- flow is retired or has a separate replacement.
--
-- Expected Advisor effect:
-- - Clear anon/authenticated SECURITY DEFINER executable findings for the three
--   legacy functions.
-- - Preserve the functions for service-role/manual recovery use.
--
-- Rollback, if the legacy flow must be restored:
--   grant execute on function public.release_reserved_order(text, text, text, text) to authenticated;
--   grant execute on function public.release_reserved_order(text, text) to authenticated;
--   grant execute on function public.submit_payment_proof(text, text, text) to authenticated;
--
-- Do not restore anon grants without a separate product/security approval.

begin;

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  p.prosecdef as security_definer,
  p.proacl as acl_before
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    (p.proname = 'release_reserved_order'
      and pg_get_function_identity_arguments(p.oid) in (
        'p_order_ref text, p_order_status text, p_payment_status text, p_reason text',
        'p_order_ref text, p_reason text'
      ))
    or
    (p.proname = 'submit_payment_proof'
      and pg_get_function_identity_arguments(p.oid)
        = 'p_order_ref text, p_proof_storage_path text, p_original_filename text')
  )
order by function_name, identity_arguments;

revoke all on function public.release_reserved_order(text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.release_reserved_order(text, text)
  from public, anon, authenticated;
revoke all on function public.submit_payment_proof(text, text, text)
  from public, anon, authenticated;

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  p.prosecdef as security_definer,
  has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute,
  p.proacl as acl_after
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    (p.proname = 'release_reserved_order'
      and pg_get_function_identity_arguments(p.oid) in (
        'p_order_ref text, p_order_status text, p_payment_status text, p_reason text',
        'p_order_ref text, p_reason text'
      ))
    or
    (p.proname = 'submit_payment_proof'
      and pg_get_function_identity_arguments(p.oid)
        = 'p_order_ref text, p_proof_storage_path text, p_original_filename text')
  )
order by function_name, identity_arguments;

commit;
