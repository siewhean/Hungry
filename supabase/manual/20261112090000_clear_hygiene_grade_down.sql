-- Down script for 20261112090000_clear_hygiene_grade.sql. STAGING ONLY. Not auto-run.
-- 1) restore every backed-up grade; 2) restore the original default 'A'; 3) give any row that
-- never had a grade (e.g. imported after the clear) the original default 'A' so NOT NULL can be restored;
-- 4) restore NOT NULL. The backup table is kept (drop it manually once the rollback is confirmed).
update public.venues v
set hygiene_grade = b.hygiene_grade
from public.venues_hygiene_grade_backup_20261112 b
where b.venue_id = v.id and v.hygiene_grade is null;

alter table public.venues alter column hygiene_grade set default 'A';

update public.venues set hygiene_grade = 'A' where hygiene_grade is null;

alter table public.venues alter column hygiene_grade set not null;

comment on column public.venues.hygiene_grade is null;
