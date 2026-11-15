-- Undo 20261114160000_hygiene_grade_nullable: puts NOT NULL and the 'A' default back and drops the
-- backup table. Deliberately does NOT invent grades: if any venue still has a NULL grade the
-- script stops (the whole transaction rolls back). Undo 20261114170000_clear_hygiene_grade first
-- (it restores the backed-up grades); venues that never had a grade (for example imported after
-- the clear) must be given a grade by hand before this can run.
-- The backup table is copied to rollback_archive before it is dropped.

-- Fire any deferred constraint triggers now: ALTER TABLE fails with "pending trigger events"
-- if an earlier statement in the same transaction updated venues.
set constraints all immediate;

do $$
declare
  v_nulls bigint;
begin
  select count(*) into v_nulls from public.venues where hygiene_grade is null;
  if v_nulls > 0 then
    raise exception '% venue(s) have a NULL hygiene_grade. Undo 20261114170000_clear_hygiene_grade first, and give venues that never had a grade a value, then retry.', v_nulls;
  end if;
end $$;

alter table public.venues alter column hygiene_grade set default 'A';
alter table public.venues alter column hygiene_grade set not null;

create schema if not exists rollback_archive;
drop table if exists rollback_archive.venues_hygiene_grade_backup_20261114160000;
do $$
begin
  if to_regclass('public.venues_hygiene_grade_backup_20261112') is not null then
    execute 'create table rollback_archive.venues_hygiene_grade_backup_20261114160000 as select * from public.venues_hygiene_grade_backup_20261112';
  end if;
end $$;
drop table if exists public.venues_hygiene_grade_backup_20261112;
