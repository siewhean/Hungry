select 'buildings' t, count(*) n from public.buildings where import_batch_id = :'batch'::uuid
union all select 'venues', count(*) from public.venues where import_batch_id = :'batch'::uuid
union all select 'dishes', count(*) from public.dishes where import_batch_id = :'batch'::uuid
union all select 'dish_taste_vectors', count(*) from public.dish_taste_vectors where import_batch_id = :'batch'::uuid
union all select 'dish_dietary_flags', count(*) from public.dish_dietary_flags where import_batch_id = :'batch'::uuid
union all select 'venues_hygiene_set', count(*) from public.venues where import_batch_id = :'batch'::uuid and hygiene_grade is not null
union all select 'dishes_delivery_price', count(*) from public.dishes where import_batch_id = :'batch'::uuid and price_confidence = 'delivery_price'
union all select 'dishes_counter_price', count(*) from public.dishes where import_batch_id = :'batch'::uuid and price_confidence = 'counter_price'
union all select 'dishes_discovery_visible', count(*) from public.dishes where import_batch_id = :'batch'::uuid and price > 0
  and public.catalog_menu_is_displayable(menu_approved_for_display, menu_rights_status, menu_source_url)
union all select 'venues_without_planning_area', count(*) from public.venues where import_batch_id = :'batch'::uuid and planning_area is null
order by 1;
