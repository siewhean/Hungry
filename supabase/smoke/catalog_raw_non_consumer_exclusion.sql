select set_config('request.jwt.claim.sub', 'ec8f3702-bf39-4f40-a978-65e490c7c3bd', false);

with returned_items as (
  select jsonb_array_elements(
    public.catalog_raw_map_view(1.15, 103.55, 1.50, 104.10, 16, null, null, null, null, '{}', '{}', false, null)->'items'
  ) as item
)
select count(*) filter (
  where exists (
    select 1
    from public.catalog_raw_excluded_venues excluded
    where excluded.venue_id = returned_items.item->>'id'
  )
) as excluded_map_markers,
count(*) as returned_map_markers
from returned_items;

with returned_items as (
  select jsonb_array_elements(
    public.catalog_raw_dishes_page(null, 1.35, 103.82, 3000, '{}', '{}', null, false, 'nearby', null, null, 24, null, '{}')->'items'
  ) as item
)
select count(*) filter (
  where exists (
    select 1
    from public.catalog_raw_excluded_venues excluded
    where excluded.venue_id = returned_items.item->>'venue_id'
  )
) as excluded_dish_cards,
count(*) as returned_dish_cards
from returned_items;
