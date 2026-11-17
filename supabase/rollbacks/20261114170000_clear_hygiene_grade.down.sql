-- expect-row-loss: public.venues_hygiene_grade_backup_20261112
-- Undo 20261114170000_clear_hygiene_grade: puts back ONLY the grades that were backed up, and only
-- on venues that are still NULL (a venue given a grade since keeps it; a venue that never had a
-- grade, for example imported after the clear, stays NULL and is not given 'A').
-- The backup rows are copied to rollback_archive and removed, so the up can be re-applied cleanly.
-- Runs in one transaction: SET CONSTRAINTS ALL IMMEDIATE fires the deferred catalog refresh
-- triggers before the table is altered, which otherwise fails with "pending trigger events".

do $$
begin
  if exists (select 1 from pg_trigger where tgrelid = 'public.venues'::regclass and tgname = 'trg_venues_updated_at') then
    alter table public.venues disable trigger trg_venues_updated_at;
  end if;
end $$;

update public.venues v
set hygiene_grade = b.hygiene_grade
from public.venues_hygiene_grade_backup_20261112 b
where b.venue_id = v.id and v.hygiene_grade is null;

set constraints all immediate;

do $$
begin
  if exists (select 1 from pg_trigger where tgrelid = 'public.venues'::regclass and tgname = 'trg_venues_updated_at') then
    alter table public.venues enable trigger trg_venues_updated_at;
  end if;
end $$;

create schema if not exists rollback_archive;
drop table if exists rollback_archive.venues_hygiene_grade_backup_20261114170000;
create table rollback_archive.venues_hygiene_grade_backup_20261114170000 as
  select * from public.venues_hygiene_grade_backup_20261112;

delete from public.venues_hygiene_grade_backup_20261112;

comment on column public.venues.hygiene_grade is null;
