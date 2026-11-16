-- Smoke for 20261114170000_clear_hygiene_grade. Read-only. Raises on any problem.
-- Every grade must now be NULL, and every backed-up grade must be a valid one.
do $$
declare
  v_left bigint;
begin
  select count(*) into v_left from public.venues where hygiene_grade is not null;
  if v_left > 0 then
    raise exception 'hygiene_grade_cleared smoke: % venue(s) still have a hygiene_grade', v_left;
  end if;

  if exists (select 1 from public.venues_hygiene_grade_backup_20261112 where hygiene_grade not in ('A','B','C','D')) then
    raise exception 'hygiene_grade_cleared smoke: the backup holds an invalid grade';
  end if;
end $$;
