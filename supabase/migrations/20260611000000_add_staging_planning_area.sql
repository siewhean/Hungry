-- Migration to add planning_area to staging_food_businesses and update promote_staging_to_production

alter table staging_food_businesses
  add column if not exists planning_area text;

comment on column staging_food_businesses.planning_area is 'The Singapore planning area the food business belongs to (e.g. Jurong West, Chinatown).';

-- Update promote_staging_to_production to map and prioritize the staged planning_area.
create or replace function public.promote_staging_to_production(p_import_run_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, extensions
as $$
begin
  -- 4.1. Deduplicate and insert buildings.
  with unique_buildings as (
    select distinct on (lower(trim(coalesce(building_name, 'Standalone'))), lower(trim(coalesce(postal_code, ''))))
      'bld-' || md5(lower(trim(coalesce(building_name, 'Standalone'))) || ':' || lower(trim(coalesce(postal_code, '')))) as id,
      coalesce(nullif(trim(building_name), ''), 'Standalone') as name,
      coalesce(latitude, 1.3521) as latitude,
      coalesce(longitude, 103.8198) as longitude,
      coalesce(address, '') as address,
      coalesce(postal_code, '') as postal_code,
      coalesce(region, '') as region,
      coalesce(confidence, 0.850) as source_confidence,
      image_url,
      planning_area
    from staging_food_businesses
    where import_run_id = p_import_run_id
      and validation_status = 'valid'
  )
  insert into buildings (
    id,
    name,
    building_type,
    latitude,
    longitude,
    address,
    postal_code,
    region,
    planning_area,
    business_id,
    licence_no,
    source_type,
    source_confidence,
    image_url
  )
  select
    id,
    name,
    case
      when lower(name) like '%hawker%' or lower(name) like '%food centre%' or lower(name) like '%market%' then 'hawker_centre'::text
      when lower(name) like '%food court%' or lower(name) like '%kopitiam%' or lower(name) like '%foodare%' or lower(name) like '%food junction%' or lower(name) like '%koufu%' then 'food_court'::text
      when lower(name) like '%open-air%' or lower(name) like '%street food%' then 'hawker_centre'::text
      when lower(name) like '%mall%' or lower(name) like '%plaza%' or lower(name) like '%square%' or lower(name) like '%point%' or lower(name) like '%shopping%' or lower(name) like '%hub%' or lower(name) like '%atria%' then 'mall'::text
      when name = 'Standalone' then 'standalone'::text
      else 'other'::text
    end as building_type,
    latitude,
    longitude,
    address,
    postal_code,
    region,
    coalesce(
      nullif(trim(planning_area), ''),
      (
        select name
        from areas a
        order by a.center_location <-> st_setsrid(st_makepoint(longitude, latitude), 4326)::geography
        limit 1
      ),
      ''
    ) as planning_area,
    null::text as business_id,
    null::text as licence_no,
    'spreadsheet' as source_type,
    source_confidence,
    image_url
  from unique_buildings
  on conflict (id) do update set
    name = coalesce(buildings.name, excluded.name),
    building_type = coalesce(buildings.building_type, excluded.building_type),
    latitude = coalesce(buildings.latitude, excluded.latitude),
    longitude = coalesce(buildings.longitude, excluded.longitude),
    address = coalesce(buildings.address, excluded.address),
    postal_code = coalesce(buildings.postal_code, excluded.postal_code),
    region = coalesce(buildings.region, excluded.region),
    planning_area = coalesce(buildings.planning_area, excluded.planning_area),
    image_url = coalesce(buildings.image_url, excluded.image_url),
    updated_at = now();

  -- 4.2. Insert venues.
  insert into venues (
    id,
    building_id,
    name,
    unit_number,
    floor,
    hygiene_grade,
    is_open,
    operating_hours,
    business_id,
    stall_id,
    licence_no,
    cuisine_tags,
    dietary_tags,
    image_url,
    latitude,
    longitude,
    address,
    postal_code,
    planning_area,
    google_place_id,
    google_rating,
    google_review_count,
    source_type,
    source_confidence,
    last_verified_at
  )
  select distinct on (s.business_id)
    'ven-' || s.business_id as id,
    'bld-' || md5(lower(trim(coalesce(s.building_name, 'Standalone'))) || ':' || lower(trim(coalesce(s.postal_code, '')))) as building_id,
    s.business_name as name,
    coalesce(s.unit_number, '') as unit_number,
    case
      when s.unit_number ~ '^#[0-9]+-' then
        'L' || cast(cast(regexp_replace(s.unit_number, '^#([0-9]+)-.*$', '\1') as integer) as text)
      when s.unit_number ~* '^#B([0-9]+)-' then
        'B' || regexp_replace(s.unit_number, '^#B([0-9]+)-.*$', '\1', 'i')
      when s.unit_number ~* '^#L([0-9]+)-' then
        'L' || regexp_replace(s.unit_number, '^#L([0-9]+)-.*$', '\1', 'i')
      else 'L1'
    end as floor,
    coalesce(nullif(upper(s.hygiene_grade), ''), 'A') as hygiene_grade,
    case when s.coverage_status = 'Closed' or s.coverage_status = 'Permanently Closed' or s.notes ~* 'permanently closed' then false else true end as is_open,
    coalesce(s.opening_hours_text, '') as operating_hours,
    s.business_id,
    s.stall_id,
    s.licence_no,
    case when s.cuisine is not null and trim(s.cuisine) <> '' then string_to_array(s.cuisine, ',') else '{}'::text[] end as cuisine_tags,
    coalesce(s.dietary_options, '{}'::text[]) as dietary_tags,
    s.image_url,
    coalesce(s.latitude, s.google_latitude) as latitude,
    coalesce(s.longitude, s.google_longitude) as longitude,
    coalesce(s.address, '') as address,
    coalesce(s.postal_code, '') as postal_code,
    coalesce(
      nullif(trim(s.planning_area), ''),
      (
        select planning_area
        from buildings b
        where b.id = 'bld-' || md5(lower(trim(coalesce(s.building_name, 'Standalone'))) || ':' || lower(trim(coalesce(s.postal_code, ''))))
      ),
      ''
    ) as planning_area,
    s.google_place_id,
    s.google_rating,
    s.google_review_count,
    'spreadsheet' as source_type,
    coalesce(s.confidence, 0.850) as source_confidence,
    coalesce(s.last_verified_date, now()::date) as last_verified_at
  from staging_food_businesses s
  where s.import_run_id = p_import_run_id
    and s.validation_status = 'valid'
  order by s.business_id, s.confidence desc, s.last_verified_date desc nulls last
  on conflict (id) do update set
    building_id = excluded.building_id,
    name = excluded.name,
    unit_number = excluded.unit_number,
    floor = excluded.floor,
    hygiene_grade = excluded.hygiene_grade,
    is_open = excluded.is_open,
    operating_hours = excluded.operating_hours,
    cuisine_tags = excluded.cuisine_tags,
    dietary_tags = excluded.dietary_tags,
    image_url = excluded.image_url,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    address = excluded.address,
    postal_code = excluded.postal_code,
    planning_area = excluded.planning_area,
    google_place_id = excluded.google_place_id,
    google_rating = excluded.google_rating,
    google_review_count = excluded.google_review_count,
    source_confidence = excluded.source_confidence,
    last_verified_at = excluded.last_verified_at,
    updated_at = now();

  -- 4.3. Insert dishes (signature dish mapping dishes_image_url as image_url).
  insert into dishes (
    id,
    venue_id,
    building_id,
    name,
    image_url,
    price,
    price_range,
    cuisine_tags,
    is_featured,
    must_order,
    source_type,
    source_confidence
  )
  select distinct on (business_id, signature_dish)
    'dsh-' || md5(business_id || ':' || coalesce(signature_dish, 'Signature')) as id,
    'ven-' || business_id as venue_id,
    'bld-' || md5(lower(trim(coalesce(building_name, 'Standalone'))) || ':' || lower(trim(coalesce(postal_code, '')))) as building_id,
    coalesce(signature_dish, 'Signature Dish') as name,
    nullif(dishes_image_url, '') as image_url,
    coalesce(price_min_sgd, 0.00) as price,
    coalesce(price_text, '') as price_range,
    case when cuisine is not null and trim(cuisine) <> '' then string_to_array(cuisine, ',') else '{}'::text[] end as cuisine_tags,
    true as is_featured,
    true as must_order,
    'spreadsheet' as source_type,
    coalesce(confidence, 0.850) as source_confidence
  from staging_food_businesses
  where import_run_id = p_import_run_id
    and validation_status = 'valid'
    and signature_dish is not null
    and trim(signature_dish) <> ''
  order by business_id, signature_dish, confidence desc
  on conflict (id) do update set
    venue_id = excluded.venue_id,
    building_id = excluded.building_id,
    name = excluded.name,
    image_url = excluded.image_url,
    price = excluded.price,
    price_range = excluded.price_range,
    cuisine_tags = excluded.cuisine_tags,
    is_featured = excluded.is_featured,
    must_order = excluded.must_order,
    source_confidence = excluded.source_confidence,
    updated_at = now();

  -- 4.4. Seed dish_taste_vectors.
  insert into dish_taste_vectors (
    dish_id,
    sweet,
    spicy,
    sour,
    salty,
    rich,
    aromatic,
    vector
  )
  select distinct on (business_id, signature_dish)
    'dsh-' || md5(business_id || ':' || coalesce(signature_dish, 'Signature')) as dish_id,
    5.00 as sweet,
    5.00 as spicy,
    5.00 as sour,
    5.00 as salty,
    5.00 as rich,
    5.00 as aromatic,
    '[5,5,5,5,5,5]'::vector as vector
  from staging_food_businesses
  where import_run_id = p_import_run_id
    and validation_status = 'valid'
    and signature_dish is not null
    and trim(signature_dish) <> ''
  on conflict (dish_id) do nothing;

  -- 4.5. Seed venue_delivery_links.
  insert into venue_delivery_links (
    venue_id,
    platform,
    native_url,
    web_url,
    affiliate_eligible
  )
  select distinct on ('ven-' || s.business_id, lower(trim(p)))
    'ven-' || s.business_id as venue_id,
    lower(trim(p)) as platform,
    '' as native_url,
    '' as web_url,
    false as affiliate_eligible
  from staging_food_businesses s
  cross join unnest(s.delivery_platforms) p
  where s.import_run_id = p_import_run_id
    and s.validation_status = 'valid'
    and lower(trim(p)) in ('grabfood', 'foodpanda', 'deliveroo')
  on conflict (venue_id, platform) do nothing;

  -- 4.6. Dynamic aggregations & updates.
  -- Update buildings.floors and buildings.venue_count together.
  with stats as (
    select
      v.building_id,
      coalesce(array_agg(distinct v.floor order by v.floor) filter (where v.floor <> ''), '{}'::text[]) as floors_arr,
      count(*) as v_count
    from venues v
    where v.building_id in (
      select distinct 'bld-' || md5(lower(trim(coalesce(building_name, 'Standalone'))) || ':' || lower(trim(coalesce(postal_code, ''))))
      from staging_food_businesses
      where import_run_id = p_import_run_id
        and validation_status = 'valid'
    )
    group by v.building_id
  )
  update buildings b
  set
    floors = s.floors_arr,
    venue_count = s.v_count,
    updated_at = now()
  from stats s
  where b.id = s.building_id;

  -- Update venues.top_dish_id.
  with top_dishes as (
    select distinct on (venue_id)
      venue_id,
      id as top_dish_id
    from dishes
    where venue_id in (
      select distinct 'ven-' || business_id
      from staging_food_businesses
      where import_run_id = p_import_run_id
        and validation_status = 'valid'
    )
    order by venue_id, must_order desc, is_featured desc, rating_avg desc, id
  )
  update venues v
  set top_dish_id = td.top_dish_id,
      updated_at = now()
  from top_dishes td
  where v.id = td.venue_id;

  -- Update validation_status to 'promoted'.
  update staging_food_businesses
  set validation_status = 'promoted'
  where import_run_id = p_import_run_id
    and validation_status = 'valid';

end;
$$;
