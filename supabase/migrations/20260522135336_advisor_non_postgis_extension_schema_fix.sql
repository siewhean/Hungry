-- Move relocatable, non-PostGIS extensions out of public to reduce
-- Supabase Security Advisor "Extension in Public" findings. PostGIS remains
-- excluded because current Supabase docs require backup/drop/recreate or
-- support-assisted relocation for non-relocatable PostGIS installs.

create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;

do $$
declare
  target_extension text;
begin
  foreach target_extension in array array['vector', 'pg_trgm', 'btree_gist', 'citext']
  loop
    if exists (
      select 1
      from pg_extension e
      join pg_namespace n on n.oid = e.extnamespace
      where e.extname = target_extension
        and n.nspname = 'public'
        and e.extrelocatable = true
    ) then
      execute format('alter extension %I set schema extensions', target_extension);
    end if;
  end loop;
end
$$;
