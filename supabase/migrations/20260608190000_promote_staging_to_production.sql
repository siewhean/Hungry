-- Migration to promote validated staging food business records to production tables.
-- Safe to re-run.

-- 0. Redefine merchant catalog write guards to allow service_role and system/superuser bypass.
create or replace function enforce_merchant_venue_update_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not merchant_can_manage_venue(old.id) then
    raise exception 'not authorized to update venue' using errcode = '42501';
  end if;

  if new.id is distinct from old.id
    or new.hygiene_grade is distinct from old.hygiene_grade
    or new.is_open is distinct from old.is_open
    or new.top_dish_id is distinct from old.top_dish_id
    or new.closure_notice is distinct from old.closure_notice
    or new.live_crowd is distinct from old.live_crowd
    or new.created_at is distinct from old.created_at then
    raise exception 'merchant venue updates are limited to profile fields' using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function enforce_merchant_dish_write_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if not merchant_outlet_matches_catalog_link(new.venue_id, new.building_id) then
      raise exception 'dish insert must match a managed merchant outlet' using errcode = '42501';
    end if;

    if new.distance_meters is distinct from 0
      or new.rating_avg is distinct from 0
      or new.review_count is distinct from 0
      or new.live_crowd is not null then
      raise exception 'merchant dish inserts cannot set aggregate or live fields' using errcode = '42501';
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if not merchant_can_manage_venue(old.venue_id) then
      raise exception 'not authorized to update dish' using errcode = '42501';
    end if;

    if new.id is distinct from old.id
      or new.venue_id is distinct from old.venue_id
      or new.distance_meters is distinct from old.distance_meters
      or new.rating_avg is distinct from old.rating_avg
      or new.review_count is distinct from old.review_count
      or new.live_crowd is distinct from old.live_crowd
      or new.created_at is distinct from old.created_at then
      raise exception 'merchant dish updates cannot change identity, aggregate, or live fields' using errcode = '42501';
    end if;

    if not merchant_outlet_matches_catalog_link(new.venue_id, new.building_id) then
      raise exception 'dish building must match a managed merchant outlet' using errcode = '42501';
    end if;

    return new;
  end if;

  return new;
end;
$$;

-- 1. Update get_discovery_feed_by_location function to handle empty string fallbacks correctly.
create or replace function public.get_discovery_feed_by_location(
  p_area_name text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_meters integer default 3000,
  p_limit integer default 50
)
returns table (
  venue_id text,
  venue_name text,
  building_id text,
  building_name text,
  planning_area text,
  is_open boolean,
  distance_meters integer,
  top_dish_id text,
  top_dish_name text,
  top_dish_image text,
  top_dish_price numeric,
  cuisine_tags text[],
  rank_score double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with area_match as (
    select center_lat, center_lng
    from areas
    where nullif(trim(coalesce(p_area_name, '')), '') is not null
      and name_normalized = lower(trim(p_area_name))
    limit 1
  ),
  params as (
    select
      coalesce((select center_lat from area_match), p_lat) as lat,
      coalesce((select center_lng from area_match), p_lng) as lng,
      greatest(coalesce(p_radius_meters, 3000), 1) as radius_meters,
      least(greatest(coalesce(p_limit, 50), 1), 100) as result_limit,
      nullif(trim(coalesce(p_area_name, '')), '') is not null as area_requested,
      exists (select 1 from area_match) as area_found
  ),
  candidates as (
    select
      v.id as venue_id,
      v.name as venue_name,
      v.building_id,
      b.name as building_name,
      coalesce(v.planning_area, b.planning_area) as planning_area,
      v.is_open,
      case
        when params.lat is not null and params.lng is not null then
          st_distance(
            coalesce(v.location, b.location),
            st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography
          )::integer
        else 0
      end as distance_meters,
      coalesce(v.top_dish_id, top_dish.id) as top_dish_id,
      top_dish.name as top_dish_name,
      coalesce(nullif(top_dish.image_url, ''), nullif(v.image_url, ''), nullif(b.image_url, '')) as top_dish_image,
      top_dish.price as top_dish_price,
      coalesce(v.cuisine_tags, '{}'::text[]) as cuisine_tags,
      (
        case when v.is_open and not b.is_closed_today then 0.35 else 0 end
        + greatest(0, 0.35 - least(coalesce(top_dish.distance_meters, 0), 3000)::double precision / 10000)
        + least(coalesce(top_dish.rating_avg, 0)::double precision / 5, 1) * 0.30
      )::double precision as rank_score
    from venues v
    join buildings b on b.id = v.building_id
    cross join params
    left join lateral (
      select d.*
      from dishes d
      where d.venue_id = v.id
      order by d.must_order desc, d.is_featured desc, d.rating_avg desc, d.id
      limit 1
    ) top_dish on true
    where (not params.area_requested or params.area_found)
      and (
        params.lat is null
        or params.lng is null
        or st_dwithin(
          coalesce(v.location, b.location),
          st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography,
          params.radius_meters
        )
      )
  )
  select
    candidates.venue_id,
    candidates.venue_name,
    candidates.building_id,
    candidates.building_name,
    candidates.planning_area,
    candidates.is_open,
    candidates.distance_meters,
    candidates.top_dish_id,
    candidates.top_dish_name,
    candidates.top_dish_image,
    candidates.top_dish_price,
    candidates.cuisine_tags,
    candidates.rank_score
  from candidates
  order by candidates.rank_score desc, candidates.distance_meters, candidates.venue_id
  limit (select result_limit from params);
$$;

-- 2. Update search_dishes function to handle empty string gallery fallbacks correctly.
create or replace function public.search_dishes(
  p_query text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_meters integer default null,
  p_dietary_flags text[] default '{}'::text[],
  p_limit integer default 20,
  p_cursor_score double precision default null,
  p_cursor_id text default null,
  p_venue_id text default null,
  p_area_name text default null,
  p_cuisine_tags text[] default null,
  p_max_price numeric default null,
  p_open_only boolean default false
)
returns table (
  dish_id text,
  venue_id text,
  building_id text,
  venue_name text,
  unit_number text,
  floor text,
  name text,
  image_url text,
  blurhash text,
  distance_meters integer,
  rating numeric,
  review_count integer,
  price numeric,
  price_range text,
  live_crowd text,
  taste_tags text[],
  taste_vector jsonb,
  dietary_flags text[],
  gallery text[],
  description text,
  must_order boolean,
  availability_flags text[],
  rank_score double precision,
  cursor_score double precision,
  cursor_id text
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with area_match as (
    select a.name, a.center_lat, a.center_lng
    from areas a
    where nullif(trim(coalesce(p_area_name, '')), '') is not null
      and a.name_normalized = lower(trim(p_area_name))
    limit 1
  ),
  params as (
    select
      nullif(trim(coalesce(p_query, '')), '') as query,
      coalesce((select center_lat from area_match), p_lat) as lat,
      coalesce((select center_lng from area_match), p_lng) as lng,
      case
        when (select center_lat from area_match) is not null then greatest(coalesce(p_radius_meters, 3000), 1)
        else nullif(p_radius_meters, 0)
      end as radius_meters,
      coalesce(p_dietary_flags, '{}'::text[]) as dietary_flags,
      coalesce(p_cuisine_tags, '{}'::text[]) as cuisine_tags,
      p_max_price as max_price,
      coalesce(p_open_only, false) as open_only,
      nullif(trim(coalesce(p_area_name, '')), '') is not null as area_requested,
      exists (select 1 from area_match) as area_found,
      least(greatest(coalesce(p_limit, 20), 1), 50) as result_limit,
      p_cursor_score as cursor_score,
      nullif(p_cursor_id, '') as cursor_id,
      nullif(p_venue_id, '') as venue_id
  ),
  candidates as (
    select
      d.id as dish_id,
      d.venue_id,
      d.building_id,
      v.name as venue_name,
      v.unit_number,
      v.floor,
      d.name,
      coalesce(nullif(d.image_url, ''), nullif(v.image_url, '')) as image_url,
      d.blurhash,
      case
        when params.lat is not null and params.lng is not null then
          st_distance(
            coalesce(v.location, b.location),
            st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography
          )::integer
        else d.distance_meters
      end as distance_meters,
      d.rating_avg as rating,
      d.review_count,
      d.price,
      d.price_range,
      d.live_crowd,
      d.taste_tags,
      jsonb_build_object(
        'sweet', coalesce(dtv.sweet, 5),
        'spicy', coalesce(dtv.spicy, 5),
        'sour', coalesce(dtv.sour, 5),
        'salty', coalesce(dtv.salty, 5),
        'rich', coalesce(dtv.rich, 5),
        'aromatic', coalesce(dtv.aromatic, 5)
      ) as taste_vector,
      coalesce((
        select array_agg(df.slug::text order by df.slug::text)
        from dish_dietary_flags ddf
        join dietary_flags df on df.id = ddf.dietary_flag_id
        where ddf.dish_id = d.id
      ), '{}'::text[]) as dietary_flags,
      coalesce((
        select array_agg(di.url order by di.sort_order)
        from dish_images di
        where di.dish_id = d.id
      ), case when coalesce(nullif(d.image_url, ''), nullif(v.image_url, '')) is null then '{}'::text[] else array[coalesce(nullif(d.image_url, ''), nullif(v.image_url, ''))] end) as gallery,
      d.description,
      d.must_order,
      d.availability_flags,
      case
        when params.query is null then 1::double precision
        else greatest(
          similarity(d.name, params.query),
          similarity(v.name, params.query),
          case
            when concat_ws(' ', d.name, v.name, array_to_string(d.taste_tags, ' '), array_to_string(d.cuisine_tags, ' '), array_to_string(v.cuisine_tags, ' ')) ilike '%' || params.query || '%'
              then 0.55
            else 0
          end
        )
      end as text_score,
      least(greatest(d.rating_avg::double precision / 5, 0), 1) as rating_score,
      case
        when params.radius_meters is null then greatest(0, 1 - (d.distance_meters::double precision / 2500))
        else greatest(0, 1 - (
          case
            when params.lat is not null and params.lng is not null then
              st_distance(
                coalesce(v.location, b.location),
                st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography
              )
            else d.distance_meters::double precision
          end / greatest(params.radius_meters, 1)
        ))
      end as distance_score
    from dishes d
    join venues v on v.id = d.venue_id
    join buildings b on b.id = d.building_id
    left join dish_taste_vectors dtv on dtv.dish_id = d.id
    cross join params
    where (not params.area_requested or params.area_found)
      and (params.venue_id is null or d.venue_id = params.venue_id)
      and (not params.open_only or (v.is_open = true and b.is_closed_today = false))
      and (params.max_price is null or d.price <= params.max_price)
      and (
        cardinality(params.cuisine_tags) = 0
        or d.cuisine_tags && params.cuisine_tags
        or v.cuisine_tags && params.cuisine_tags
      )
      and (
        params.query is null
        or concat_ws(' ', d.name, v.name, array_to_string(d.taste_tags, ' '), array_to_string(d.cuisine_tags, ' '), array_to_string(v.cuisine_tags, ' ')) ilike '%' || params.query || '%'
        or d.name % params.query
        or v.name % params.query
      )
      and (
        cardinality(params.dietary_flags) = 0
        or d.availability_flags && params.dietary_flags
        or v.dietary_tags && params.dietary_flags
        or not exists (
          select 1
          from unnest(params.dietary_flags) as requested(flag)
          where not exists (
            select 1
            from dish_dietary_flags ddf
            join dietary_flags df on df.id = ddf.dietary_flag_id
            where ddf.dish_id = d.id
              and df.slug::text = requested.flag
          )
        )
      )
      and (
        params.radius_meters is null
        or (
          params.lat is not null
          and params.lng is not null
          and st_dwithin(
            coalesce(v.location, b.location),
            st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography,
            params.radius_meters
          )
        )
        or (
          (params.lat is null or params.lng is null)
          and d.distance_meters <= params.radius_meters
        )
      )
  ),
  scored as (
    select
      candidates.*,
      (
        (0.55 * candidates.text_score)
        + (0.25 * candidates.rating_score)
        + (0.20 * candidates.distance_score)
      )::double precision as rank_score
    from candidates
  )
  select
    scored.dish_id,
    scored.venue_id,
    scored.building_id,
    scored.venue_name,
    scored.unit_number,
    scored.floor,
    scored.name,
    scored.image_url,
    scored.blurhash,
    scored.distance_meters,
    scored.rating,
    scored.review_count,
    scored.price,
    scored.price_range,
    scored.live_crowd,
    scored.taste_tags,
    scored.taste_vector,
    scored.dietary_flags,
    scored.gallery,
    scored.description,
    scored.must_order,
    scored.availability_flags,
    scored.rank_score,
    scored.rank_score as cursor_score,
    scored.dish_id as cursor_id
  from scored
  cross join params
  where (
    params.cursor_score is null
    or scored.rank_score < params.cursor_score
    or (scored.rank_score = params.cursor_score and scored.dish_id > params.cursor_id)
  )
  order by scored.rank_score desc, scored.dish_id
  limit (select result_limit from params);
$$;

-- 3. Update get_dish_detail function to handle empty string fallbacks correctly.
create or replace function public.get_dish_detail(p_dish_id text)
returns table (
  dish_id text,
  venue_id text,
  building_id text,
  venue_name text,
  unit_number text,
  floor text,
  name text,
  image_url text,
  blurhash text,
  distance_meters integer,
  rating numeric,
  review_count integer,
  price numeric,
  price_range text,
  live_crowd text,
  taste_tags text[],
  taste_vector jsonb,
  dietary_flags text[],
  gallery text[],
  description text,
  must_order boolean,
  availability_flags text[],
  reviews jsonb
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    d.id as dish_id,
    d.venue_id,
    d.building_id,
    v.name as venue_name,
    v.unit_number,
    v.floor,
    d.name,
    coalesce(nullif(d.image_url, ''), nullif(v.image_url, '')) as image_url,
    d.blurhash,
    d.distance_meters,
    d.rating_avg as rating,
    d.review_count,
    d.price,
    d.price_range,
    d.live_crowd,
    d.taste_tags,
    jsonb_build_object(
      'sweet', coalesce(dtv.sweet, 5),
      'spicy', coalesce(dtv.spicy, 5),
      'sour', coalesce(dtv.sour, 5),
      'salty', coalesce(dtv.salty, 5),
      'rich', coalesce(dtv.rich, 5),
      'aromatic', coalesce(dtv.aromatic, 5)
    ) as taste_vector,
    coalesce((
      select array_agg(df.slug::text order by df.slug::text)
      from dish_dietary_flags ddf
      join dietary_flags df on df.id = ddf.dietary_flag_id
      where ddf.dish_id = d.id
    ), '{}'::text[]) as dietary_flags,
    coalesce((
      select array_agg(di.url order by di.sort_order)
      from dish_images di
      where di.dish_id = d.id
    ), case when coalesce(nullif(d.image_url, ''), nullif(v.image_url, '')) is null then '{}'::text[] else array[coalesce(nullif(d.image_url, ''), nullif(v.image_url, ''))] end) as gallery,
    d.description,
    d.must_order,
    d.availability_flags,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', r.id::text,
          'authorName', coalesce(r.author_name, 'Hungry User'),
          'rating', r.rating,
          'createdAt', r.created_at,
          'text', r.text,
          'tags', r.tags,
          'wouldRecommend', r.would_recommend,
          'photos', coalesce((
            select jsonb_agg(rp.url order by rp.sort_order)
            from review_photos rp
            where rp.review_id = r.id
          ), '[]'::jsonb)
        )
        order by r.created_at desc, r.id
      )
      from reviews r
      where r.dish_id = d.id
    ), '[]'::jsonb) as reviews
  from dishes d
  join venues v on v.id = d.venue_id
  left join dish_taste_vectors dtv on dtv.dish_id = d.id
  where d.id = p_dish_id
  limit 1;
$$;

-- 4. Create promote_staging_to_production function.
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
      image_url
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
