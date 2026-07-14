select set_config('request.jwt.claim.sub', 'ec8f3702-bf39-4f40-a978-65e490c7c3bd', false);

with active as (
  select id from public.catalog_releases where status = 'active'
), first_rotation as (
  select public.catalog_raw_discover_sections(1.35, 103.82, 3000, 'discover-smoke-a', null, 8, '{}', '{}', null) as payload
), second_rotation as (
  select public.catalog_raw_discover_sections(1.35, 103.82, 3000, 'discover-smoke-b', null, 8, '{}', '{}', null) as payload
)
select
  (select count(*) from public.catalog_raw_dish_cards c where c.release_id = active.id and not exists (
    select 1 from public.catalog_raw_excluded_venues excluded where excluded.venue_id = c.venue_id
  ) and not exists (
    select 1 from public.catalog_raw_dish_section_tags tags where tags.release_id = c.release_id and tags.dish_id = c.id
  )) as untagged_dishes,
  (select count(*) from public.catalog_raw_dish_section_tags tags join public.catalog_raw_dish_cards c on c.release_id = tags.release_id and c.id = tags.dish_id where tags.release_id = active.id and tags.section_id = 'budget' and (c.price is null or c.price > 8)) as invalid_budget_tags,
  (select count(*) from public.catalog_raw_dish_section_tags tags join public.catalog_raw_venue_cards venue on venue.release_id = tags.release_id and venue.id = (select c.venue_id from public.catalog_raw_dish_cards c where c.release_id = tags.release_id and c.id = tags.dish_id) where tags.release_id = active.id and tags.section_id = 'late_night' and venue.operating_hours !~* '(24[[:space:]]*hours?|midnight|[-–][[:space:]]*((2[2-3]|0[0-5]):[0-5][0-9]|(0?[1-9]|1[0-1]|12)(:[0-5][0-9])?[[:space:]]*(am|pm)))') as invalid_late_night_tags,
  (select count(*) from public.catalog_raw_dish_section_tags tags join public.dishes d on d.id = tags.dish_id where tags.release_id = active.id and tags.section_id = 'editors_choice' and d.is_featured is false) as invalid_editors_choice_tags,
  jsonb_array_length(first_rotation.payload->'sections'->'nearby') as first_nearby_count,
  jsonb_array_length(second_rotation.payload->'sections'->'nearby') as second_nearby_count,
  (first_rotation.payload->'sections'->'nearby') <> (second_rotation.payload->'sections'->'nearby') as rotation_changes_selection
from active, first_rotation, second_rotation;
