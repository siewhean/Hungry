-- Harden internal merchant change request helper grants.
-- 0036 exposed merchant_org_owns_venue to authenticated clients for contract
-- convenience, but the helper is only needed inside security-definer RPCs.

revoke execute on function public.merchant_org_owns_venue(uuid, text) from public;
revoke execute on function public.merchant_org_owns_venue(uuid, text) from anon;
revoke execute on function public.merchant_org_owns_venue(uuid, text) from authenticated;
grant execute on function public.merchant_org_owns_venue(uuid, text) to service_role;

comment on function public.merchant_org_owns_venue(uuid, text) is
  'Internal helper used by security-definer merchant change request RPCs; not callable by app clients.';
