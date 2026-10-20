-- Smoke: count_venues_in_planning_area counts case- and space-insensitively and uses
-- the normalised planning-area index. Run after 20261020020100. Rolled back.

begin;

do $$
declare
  area_count integer;
  plan_text text := '';
  plan_line text;
begin
  if (select p.prosecdef from pg_proc p
      where p.oid = 'public.count_venues_in_planning_area(text)'::regprocedure) then
    raise exception 'count_venues_in_planning_area must be security invoker';
  end if;
  if not has_function_privilege('anon', 'public.count_venues_in_planning_area(text)', 'execute') then
    raise exception 'anon must be able to execute count_venues_in_planning_area';
  end if;

  insert into buildings (id, slug, name, building_type, latitude, longitude, floors)
  values ('area-count-smoke-building', 'area-count-smoke-building', 'Area Count Smoke',
          'hawker_centre', 1.3, 103.8, array['01'])
  on conflict (id) do nothing;

  insert into venues (id, building_id, name, unit_number, floor, planning_area)
  values
    ('area-count-smoke-a', 'area-count-smoke-building', 'A', '#01-01', '01', 'Smoke Area Zzq'),
    ('area-count-smoke-b', 'area-count-smoke-building', 'B', '#01-02', '01', ' smoke area zzq '),
    ('area-count-smoke-c', 'area-count-smoke-building', 'C', '#01-03', '01', 'Smoke Area Zzq North')
  on conflict (id) do nothing;

  select public.count_venues_in_planning_area('SMOKE AREA ZZQ') into area_count;
  if area_count is distinct from 2 then
    raise exception 'expected 2 venues in the smoke area, got %', area_count;
  end if;

  select public.count_venues_in_planning_area('no such smoke area') into area_count;
  if area_count is distinct from 0 then
    raise exception 'expected 0 venues for an unknown area, got %', area_count;
  end if;

  set local enable_seqscan = off;
  for plan_line in
    explain select count(*) from public.venues v
    where v.planning_area is not null
      and lower(trim(v.planning_area)) = lower(trim('Smoke Area Zzq'))
  loop
    plan_text := plan_text || plan_line || E'\n';
  end loop;
  if plan_text not like '%idx_venues_planning_area_norm%' then
    raise exception 'area count should use idx_venues_planning_area_norm, plan: %', plan_text;
  end if;
end $$;

rollback;
