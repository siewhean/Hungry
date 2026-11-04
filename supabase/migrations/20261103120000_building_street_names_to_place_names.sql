-- smoke: supabase/smoke/building_street_names_to_place_names.sql
-- One place, one name. The catalog holds many places as two or more building rows at the same
-- address: one named by its street address ("50 Jurong West Street 61") and another by the place
-- ("Jurong West Hawker Centre"), so Home shows the same place under two names. This renames each
-- building whose name IS its street address to the place's name, taken from the best-stocked named
-- building at that same address (same postal code and address, at least 2 stalls, not a fragment
-- like "Part Of" or "Level 1 & 2"). Only the name changes: no building or stall moves, no row is
-- removed, and buildings that are already named, or whose name is not their street address
-- ("888 Plaza", "111 Somerset"), are left alone.
-- The old names are kept in app_private.building_name_backup_20261103 so the down migration can put
-- them back. Re-running does nothing: a renamed building no longer matches its street address.
-- Rollback: supabase/rollbacks/20261103120000_building_street_names_to_place_names.down.sql.

create table if not exists app_private.building_name_backup_20261103 (
  building_id text primary key,
  old_name text not null,
  new_name text not null,
  renamed_at timestamptz not null default now()
);
alter table app_private.building_name_backup_20261103 enable row level security;
revoke all on table app_private.building_name_backup_20261103 from public, anon, authenticated;

with b as (
  select
    bl.id,
    bl.name,
    bl.postal_code,
    bl.address,
    (select count(*) from public.venues v where v.building_id = bl.id) as stalls,
    lower(split_part(bl.address, ',', 1)) = lower(bl.name) as is_street
  from public.buildings bl
  where coalesce(bl.postal_code, '') <> ''
    and coalesce(bl.address, '') <> ''
),
canon as (
  select distinct on (postal_code, address)
    postal_code, address, id as canon_id, name as canon_name
  from b
  where not is_street
    and name !~ '^[0-9]'
    and name !~* '^(blk|block|singapore) '
    and name !~* '(^|\s)(part of|level|basement|unit|f ?& ?b|pte|ltd|^\(|#)'
    and length(name) >= 5
    and stalls >= 2
  order by postal_code, address, stalls desc, length(name), id
)
insert into app_private.building_name_backup_20261103 (building_id, old_name, new_name)
select b.id, b.name, c.canon_name
from b
join canon c using (postal_code, address)
where b.is_street
  and b.id <> c.canon_id
on conflict (building_id) do nothing;

update public.buildings bl
set name = k.new_name
from app_private.building_name_backup_20261103 k
where k.building_id = bl.id
  and bl.name = k.old_name;
