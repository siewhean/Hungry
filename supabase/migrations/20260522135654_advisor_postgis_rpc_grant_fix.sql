-- Remove client RPC access to PostGIS extent-estimation SECURITY DEFINER
-- overloads. These are extension-owned helper functions and are not app entry
-- points, so anon/authenticated callers should not execute them via PostgREST.

do $$
begin
  if to_regprocedure('public.st_estimatedextent(text, text)') is not null then
    revoke execute on function public.st_estimatedextent(text, text)
    from public, anon, authenticated;
  end if;

  if to_regprocedure('public.st_estimatedextent(text, text, text)') is not null then
    revoke execute on function public.st_estimatedextent(text, text, text)
    from public, anon, authenticated;
  end if;

  if to_regprocedure('public.st_estimatedextent(text, text, text, boolean)') is not null then
    revoke execute on function public.st_estimatedextent(text, text, text, boolean)
    from public, anon, authenticated;
  end if;
end
$$;
