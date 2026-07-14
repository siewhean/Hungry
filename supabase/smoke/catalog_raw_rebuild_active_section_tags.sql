select public.catalog_raw_rebuild_dish_section_tags(id)
from public.catalog_releases
where status = 'active';
