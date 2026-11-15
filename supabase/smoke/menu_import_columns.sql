-- Smoke for 20261114150000_menu_import_columns. Read-only. Raises (non-zero exit) on any missing piece.
do $$
declare
  v_missing text;
begin
  select string_agg(r.t || '.' || r.c, ', ') into v_missing
  from (values ('buildings','import_batch_id'),('venues','import_batch_id'),('venues','is_generic_cuisine'),
    ('venues','secondary_menu_url'),('dishes','import_batch_id'),('dishes','price_confidence'),
    ('dishes','is_generic_cuisine'),('dishes','secondary_menu_url'),('dishes','dietary_status'),
    ('dish_taste_vectors','import_batch_id'),('dish_dietary_flags','import_batch_id')) as r(t, c)
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = r.t and c.column_name = r.c);
  if v_missing is not null then
    raise exception 'menu_import_columns smoke: missing columns: %', v_missing;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'dishes_price_confidence_check' and conrelid = 'public.dishes'::regclass
      and pg_get_constraintdef(oid) like '%counter_price%'
      and pg_get_constraintdef(oid) like '%delivery_price%'
      and pg_get_constraintdef(oid) like '%listed_price%'
  ) then
    raise exception 'menu_import_columns smoke: dishes_price_confidence_check is missing or has the wrong values';
  end if;

  select string_agg(i, ', ') into v_missing
  from unnest(array['idx_buildings_import_batch','idx_venues_import_batch','idx_dishes_import_batch',
    'idx_dish_taste_vectors_import_batch','idx_dish_dietary_flags_import_batch']) as i
  where to_regclass('public.' || i) is null;
  if v_missing is not null then
    raise exception 'menu_import_columns smoke: missing indexes: %', v_missing;
  end if;

  if to_regclass('rollback_archive.menu_import_created_columns_20261114150000') is null then
    raise exception 'menu_import_columns smoke: ownership marker table rollback_archive.menu_import_created_columns_20261114150000 is missing';
  end if;
  if exists (select 1 from rollback_archive.menu_import_created_columns_20261114150000
             where column_name not in ('price_confidence', 'dietary_status')) then
    raise exception 'menu_import_columns smoke: ownership marker lists an unknown column';
  end if;

  if exists (select 1 from public.dishes where price_confidence is not null
             and price_confidence not in ('counter_price','delivery_price','listed_price')) then
    raise exception 'menu_import_columns smoke: a dish has an unknown price_confidence';
  end if;
end $$;
