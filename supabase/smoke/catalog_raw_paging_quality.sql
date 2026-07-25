-- Authenticated smoke for the active release. It records three raw pages for
-- dishes and venues, then fails if a quality-gated projection leaks a mock ID,
-- repeated stable ID, or unsafe display media. Run only after the quota and
-- migration-history blockers have been resolved.
select set_config('request.jwt.claim.sub', 'ec8f3702-bf39-4f40-a978-65e490c7c3bd', false);

create temporary table catalog_raw_page_quality_results (
  surface text primary key,
  release_id uuid,
  page_one_ids text[] not null,
  page_two_ids text[] not null,
  page_three_ids text[] not null,
  mock_or_test_rows integer not null,
  duplicate_stable_ids integer not null,
  unsafe_media_rows integer not null
) on commit drop;

with page_one as (
  select public.catalog_raw_dishes_page(null, null, null, null, '{}', '{}', null, false, 'quality', null, null, 24, null, '{}') as value
), page_two as (
  select public.catalog_raw_dishes_page(null, null, null, null, '{}', '{}', null, false, 'quality', value->>'next_cursor', value->>'release_id', 24, null, '{}') as value
  from page_one
), page_three as (
  select public.catalog_raw_dishes_page(null, null, null, null, '{}', '{}', null, false, 'quality', value->>'next_cursor', value->>'release_id', 24, null, '{}') as value
  from page_two
), items as (
  select page.value->>'release_id' as release_id, element.item
  from page_one page cross join lateral jsonb_array_elements(page.value->'items') as element(item)
  union all
  select page.value->>'release_id', element.item
  from page_two page cross join lateral jsonb_array_elements(page.value->'items') as element(item)
  union all
  select page.value->>'release_id', element.item
  from page_three page cross join lateral jsonb_array_elements(page.value->'items') as element(item)
)
insert into catalog_raw_page_quality_results
select
  'dishes',
  (select (value->>'release_id')::uuid from page_one),
  (select array_agg(element.item->>'id') from jsonb_array_elements((select value->'items' from page_one)) as element(item)),
  (select array_agg(element.item->>'id') from jsonb_array_elements((select value->'items' from page_two)) as element(item)),
  (select array_agg(element.item->>'id') from jsonb_array_elements((select value->'items' from page_three)) as element(item)),
  count(*) filter (where item->>'id' ~* '(^|[-_:])(mock|test|fixture|demo|sample)([-_:]|$)'),
  count(*) - count(distinct item->>'id'),
  count(*) filter (where nullif(item->>'image_url', '') is not null and (
    coalesce((item->>'media_approved_for_display')::boolean, false) = false
    or public.catalog_display_image_url(item->>'image_url', true, item->>'media_rights_status', item->>'media_source_url') is null
  ))
from items;

with page_one as (
  select public.catalog_raw_venues_page(null, null, null, null, '{}', '{}', null, false, 'quality', null, null, 24, '{}') as value
), page_two as (
  select public.catalog_raw_venues_page(null, null, null, null, '{}', '{}', null, false, 'quality', value->>'next_cursor', value->>'release_id', 24, '{}') as value
  from page_one
), page_three as (
  select public.catalog_raw_venues_page(null, null, null, null, '{}', '{}', null, false, 'quality', value->>'next_cursor', value->>'release_id', 24, '{}') as value
  from page_two
), items as (
  select page.value->>'release_id' as release_id, element.item
  from page_one page cross join lateral jsonb_array_elements(page.value->'items') as element(item)
  union all
  select page.value->>'release_id', element.item
  from page_two page cross join lateral jsonb_array_elements(page.value->'items') as element(item)
  union all
  select page.value->>'release_id', element.item
  from page_three page cross join lateral jsonb_array_elements(page.value->'items') as element(item)
)
insert into catalog_raw_page_quality_results
select
  'venues',
  (select (value->>'release_id')::uuid from page_one),
  (select array_agg(element.item->>'id') from jsonb_array_elements((select value->'items' from page_one)) as element(item)),
  (select array_agg(element.item->>'id') from jsonb_array_elements((select value->'items' from page_two)) as element(item)),
  (select array_agg(element.item->>'id') from jsonb_array_elements((select value->'items' from page_three)) as element(item)),
  count(*) filter (where item->>'id' ~* '(^|[-_:])(mock|test|fixture|demo|sample)([-_:]|$)'),
  count(*) - count(distinct item->>'id'),
  count(*) filter (where nullif(item->>'image_url', '') is not null and (
    coalesce((item->>'media_approved_for_display')::boolean, false) = false
    or public.catalog_display_image_url(item->>'image_url', true, item->>'media_rights_status', item->>'media_source_url') is null
  ))
from items;

do $$
begin
  if exists (
    select 1 from catalog_raw_page_quality_results
    where cardinality(page_one_ids) = 0
      or cardinality(page_two_ids) = 0
      or cardinality(page_three_ids) = 0
      or mock_or_test_rows <> 0
      or duplicate_stable_ids <> 0
      or unsafe_media_rows <> 0
  ) then
    raise exception 'catalog raw paging quality smoke failed';
  end if;
end;
$$;

select * from catalog_raw_page_quality_results order by surface;
