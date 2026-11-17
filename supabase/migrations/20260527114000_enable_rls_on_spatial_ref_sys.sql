-- Resolve Supabase Advisor: RLS Disabled in Public for PostGIS spatial_ref_sys.
--
-- `public.spatial_ref_sys` is a PostGIS lookup table containing coordinate
-- reference system metadata. The data itself is not sensitive, but because the
-- table lives in the exposed `public` schema, Supabase Advisor requires row
-- level security to be enabled.
--
-- Keep read access available for anon/authenticated PostGIS lookups while
-- enabling RLS so the table is no longer reported as unprotected.

do $$
begin
  if to_regclass('public.spatial_ref_sys') is null then
    raise notice 'public.spatial_ref_sys does not exist; skipping RLS hardening.';
    return;
  end if;

  begin
    execute 'alter table public.spatial_ref_sys enable row level security';

    execute 'drop policy if exists spatial_ref_sys_read_all on public.spatial_ref_sys';
    execute 'drop policy if exists spatial_ref_sys_read_lookup on public.spatial_ref_sys';

    execute '
      create policy spatial_ref_sys_read_lookup
      on public.spatial_ref_sys
      for select
      to anon, authenticated
      using (true)
    ';

    execute 'grant select on table public.spatial_ref_sys to anon, authenticated';
  exception
    when insufficient_privilege then
      raise notice 'Skipping spatial_ref_sys RLS hardening because the migration role is not the table owner (requires supabase_admin).';
    when undefined_table then
      raise notice 'public.spatial_ref_sys was unavailable during migration; skipping.';
    when object_not_in_prerequisite_state then
      raise notice 'Spatial RLS hardening was not applied because the table was in an unsupported state.';
  end;
end
$$;
