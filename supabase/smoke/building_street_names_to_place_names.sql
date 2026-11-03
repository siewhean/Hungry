-- Smoke checks for 20261103120000_building_street_names_to_place_names.sql.
-- Runs in a transaction and rolls back. It builds its own buildings: a street-named one and a
-- named one at one address, and checks the street-named one is the only thing renamed.

begin;

insert into public.buildings (id, slug, name, building_type, latitude, longitude, address, postal_code)
values
  ('smoke-bld-street', 'smoke-bld-street', '9 Smoke Test Road', 'other', 1.3, 103.8, '9 Smoke Test Road, Singapore 999991', '999991'),
  ('smoke-bld-named', 'smoke-bld-named', 'Smoke Test Hawker Centre', 'other', 1.3, 103.8, '9 Smoke Test Road, Singapore 999991', '999991'),
  ('smoke-bld-own', 'smoke-bld-own', '888 Plaza', 'other', 1.4, 103.9, '12 Elsewhere Road, Singapore 999992', '999992');

insert into public.venues (id, building_id, name, unit_number, floor, is_open, top_dish_id)
select 'smoke-v-' || n, case when n <= 2 then 'smoke-bld-named' else 'smoke-bld-street' end, 'Smoke stall ' || n, '', '', true, ''
from generate_series(1, 4) n;

-- The same statement the migration runs, on these rows.
do $$
declare
  v_street text;
  v_own text;
begin
  update public.buildings bl
  set name = c.canon_name
  from (
    select b.id,
           (select n.name from public.buildings n
             where n.postal_code = b.postal_code and n.address = b.address
               and lower(split_part(n.address, ',', 1)) <> lower(n.name)
               and n.name !~ '^[0-9]'
               and (select count(*) from public.venues v where v.building_id = n.id) >= 2
             order by (select count(*) from public.venues v where v.building_id = n.id) desc, n.id
             limit 1) as canon_name
    from public.buildings b
    where b.id = 'smoke-bld-street'
  ) c
  where bl.id = c.id and c.canon_name is not null;

  select name into v_street from public.buildings where id = 'smoke-bld-street';
  select name into v_own from public.buildings where id = 'smoke-bld-own';
  if v_street is distinct from 'Smoke Test Hawker Centre' then
    raise exception 'the street-named building was not renamed to the place name: %', v_street;
  end if;
  if v_own is distinct from '888 Plaza' then
    raise exception 'a building with its own name was renamed: %', v_own;
  end if;
  if (select count(*) from public.venues where building_id = 'smoke-bld-street') <> 2 then
    raise exception 'stalls moved';
  end if;
end $$;

-- The backup table exists, holds only what the migration renamed, and is closed to the app roles.
do $$
begin
  if to_regclass('app_private.building_name_backup_20261103') is null then
    raise exception 'the backup table is missing';
  end if;
  if has_table_privilege('anon', 'app_private.building_name_backup_20261103', 'select')
     or has_table_privilege('authenticated', 'app_private.building_name_backup_20261103', 'select') then
    raise exception 'the backup table is readable by the app roles';
  end if;
  if exists (
    select 1 from app_private.building_name_backup_20261103 k
    join public.buildings bl on bl.id = k.building_id
    where lower(split_part(bl.address, ',', 1)) = lower(k.new_name)
  ) then
    raise exception 'a backup row renames a building to a street address';
  end if;
end $$;

rollback;
