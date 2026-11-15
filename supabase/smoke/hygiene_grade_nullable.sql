-- Smoke for 20261114160000_hygiene_grade_nullable. Read-only. Raises on any problem.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'venues' and column_name = 'hygiene_grade'
      and is_nullable = 'YES' and column_default is null
  ) then
    raise exception 'hygiene_grade_nullable smoke: venues.hygiene_grade must be nullable with no default';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'venues_hygiene_grade_check' and conrelid = 'public.venues'::regclass
  ) then
    raise exception 'hygiene_grade_nullable smoke: venues_hygiene_grade_check was dropped (it must stay)';
  end if;

  if to_regclass('public.venues_hygiene_grade_backup_20261112') is null then
    raise exception 'hygiene_grade_nullable smoke: backup table is missing';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.venues_hygiene_grade_backup_20261112'::regclass) then
    raise exception 'hygiene_grade_nullable smoke: backup table must have RLS enabled';
  end if;

  if exists (select 1 from pg_roles where rolname in ('anon', 'authenticated')
             and (has_table_privilege(rolname, 'public.venues_hygiene_grade_backup_20261112', 'select')
                  or has_table_privilege(rolname, 'public.venues_hygiene_grade_backup_20261112', 'insert'))) then
    raise exception 'hygiene_grade_nullable smoke: anon/authenticated must have no access to the backup table';
  end if;
end $$;
