-- smoke: supabase/smoke/hygiene_grade_cleared.sql
-- Data half of removing the hygiene grade (owner decision 2026-11-12): copy every non-null grade
-- to the backup table, then set venues.hygiene_grade to NULL. Needs 20261114160000_hygiene_grade_nullable.
-- Idempotent: a re-run never overwrites a backup row (the first copy is the original value).
-- Backout: supabase/rollbacks/20261114170000_clear_hygiene_grade.down.sql restores ONLY the
-- backed-up rows, so venues imported after the clear keep their NULL.
--
-- trg_venues_updated_at is switched off for the clear so updated_at is not touched by a change that
-- is not a content edit (the same is done in the down). The catalog refresh constraint triggers stay on.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'venues' and column_name = 'hygiene_grade' and is_nullable = 'NO'
  ) then
    raise exception 'venues.hygiene_grade is still NOT NULL: apply 20261114160000_hygiene_grade_nullable first';
  end if;
end $$;

insert into public.venues_hygiene_grade_backup_20261112 (venue_id, hygiene_grade)
select id, hygiene_grade from public.venues where hygiene_grade is not null
on conflict (venue_id) do nothing;

do $$
begin
  if exists (select 1 from pg_trigger where tgrelid = 'public.venues'::regclass and tgname = 'trg_venues_updated_at') then
    alter table public.venues disable trigger trg_venues_updated_at;
  end if;
end $$;

update public.venues set hygiene_grade = null where hygiene_grade is not null;

-- Run the deferred catalog refresh triggers now: ALTER TABLE below fails with "pending trigger events" otherwise.
set constraints all immediate;

do $$
begin
  if exists (select 1 from pg_trigger where tgrelid = 'public.venues'::regclass and tgname = 'trg_venues_updated_at') then
    alter table public.venues enable trigger trg_venues_updated_at;
  end if;
end $$;

comment on column public.venues.hygiene_grade is 'DEPRECATED 2026-11-12: always NULL. Original values: public.venues_hygiene_grade_backup_20261112.';
