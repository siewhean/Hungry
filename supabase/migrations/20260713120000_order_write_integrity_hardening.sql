-- Close direct customer writes to the prototype orders table.
--
-- The production app has no source-backed ordering flow yet. Trusted prices and
-- merchant-managed lifecycle transitions therefore remain service-only until a
-- dedicated, authorization-checked ordering RPC is introduced.

begin;

drop policy if exists "orders_insert_own" on public.orders;
drop policy if exists "orders_update_own" on public.orders;

revoke insert, update, delete on table public.orders from public, anon, authenticated;

comment on table public.orders is
  'Prototype order records. Customer roles have read-only owner access; writes require a trusted service path.';

commit;
