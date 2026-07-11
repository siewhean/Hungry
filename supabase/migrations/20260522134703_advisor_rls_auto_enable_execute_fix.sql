-- Remove direct authenticated RPC access from the RLS auto-enable event
-- trigger helper when it exists on a linked project. This function is meant to
-- run from DDL event triggers, not from /rest/v1/rpc/rls_auto_enable.

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from authenticated;
    revoke execute on function public.rls_auto_enable() from anon;
    revoke execute on function public.rls_auto_enable() from public;
  end if;
end
$$;
