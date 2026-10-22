-- Place search and in-mall discovery.
-- * catalog_raw_places: malls, hawker centres and food courts (buildings with 3+ stalls), by
--   name or by position ("which place is this phone inside").
-- * catalog_raw_dishes_page / catalog_raw_venues_page take p_building_id, so a place's results
--   hold only that building's stalls. Bodies are copied from
--   20261021150000_catalog_search_distance_places_stall_dishes.sql with only that filter added
--   (and the id in the cursor fingerprint); the old signatures are dropped.
-- * catalog_suggest returns the building id on place suggestions, and only suggests places.
-- * get_discovery_feed_by_location takes p_building_id: stalls in that building come first
--   (at most 60, so a big mall never fills the whole feed), then the rest as before.
-- Guests can call all of these, like the other catalog reads.

begin;

drop function if exists public.catalog_raw_dishes_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text, text[]);
drop function if exists public.catalog_raw_venues_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text[]);
drop function if exists public.get_discovery_feed_by_location(text, double precision, double precision, integer, integer);

create or replace function public.catalog_raw_dishes_page(
  p_query text default null, p_lat double precision default null, p_lng double precision default null,
  p_radius_meters integer default null, p_cuisine_tags text[] default '{}', p_dietary_flags text[] default '{}',
  p_max_price numeric default null, p_open_only boolean default false, p_sort text default 'quality',
  p_cursor text default null, p_release_id uuid default null, p_limit integer default 24, p_venue_id text default null,
  p_building_types text[] default '{}', p_building_id text default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_release uuid; v_cursor jsonb; v_fingerprint text; v_limit integer := least(greatest(coalesce(p_limit, 24), 1), 50);
  v_items jsonb; v_next text; v_count integer;
begin
  perform public.catalog_raw_require_authenticated();
  v_release := public.catalog_raw_release_for_read(p_release_id);
  v_fingerprint := md5(concat_ws('|', coalesce(lower(trim(p_query)), ''), coalesce(p_lat::text, ''), coalesce(p_lng::text, ''), coalesce(p_radius_meters::text, ''), array_to_string(coalesce(p_cuisine_tags, '{}'), ','), array_to_string(coalesce(p_dietary_flags, '{}'), ','), array_to_string(coalesce(p_building_types, '{}'), ','), coalesce(p_max_price::text, ''), p_open_only::text, p_sort, coalesce(p_venue_id, ''), coalesce(p_building_id, '')));
  v_cursor := case when p_cursor is null then null else public.catalog_raw_cursor_value(p_cursor) end;
  if v_cursor is not null and (v_cursor->>'release_id')::uuid <> v_release then raise exception 'catalog cursor release mismatch' using errcode = '22023'; end if;
  if v_cursor is not null and v_cursor->>'fingerprint' <> v_fingerprint then raise exception 'catalog cursor query mismatch' using errcode = '22023'; end if;

  with candidates as materialized (
    select c.*, coalesce(st_distance(c.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)::integer, 2147483647) as computed_distance,
      case when nullif(trim(coalesce(p_query, '')), '') is null then 0::double precision
           -- Text match first, plus up to 0.15 for being close (half-weight at ~2 km).
           else greatest(similarity(c.name, p_query), similarity(c.venue_name, p_query), similarity(coalesce(c.food_type, ''), p_query), similarity(coalesce(c.building_name, ''), p_query))
             + coalesce(0.15 * exp(-st_distance(c.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 3000.0), 0) end as relevance
    from public.catalog_raw_dish_cards c
    where c.release_id = v_release
      and (p_venue_id is null or c.venue_id = p_venue_id)
      and (p_building_id is null or c.building_id = p_building_id)
      and (cardinality(coalesce(p_building_types, '{}')) = 0 or c.building_type = any(p_building_types))
      and (p_open_only = false or c.is_open)
      and (p_max_price is null or c.price <= p_max_price)
      and (cardinality(coalesce(p_cuisine_tags, '{}')) = 0 or c.cuisine_tags && p_cuisine_tags)
      and (cardinality(coalesce(p_dietary_flags, '{}')) = 0 or c.dietary_flags @> p_dietary_flags)
      and (p_lat is null or p_lng is null or p_radius_meters is null or st_dwithin(c.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_meters))
      and (nullif(trim(coalesce(p_query, '')), '') is null or c.name % p_query or c.venue_name % p_query or c.name ilike '%' || p_query || '%' or c.venue_name ilike '%' || p_query || '%' or c.food_type ilike '%' || p_query || '%' or c.food_type % p_query
        or c.building_name ilike '%' || p_query || '%' or c.building_name % p_query)
  ), page as materialized (
    select * from candidates c
    where v_cursor is null
      or (p_sort = 'nearby' and (c.computed_distance > coalesce((v_cursor->>'distance')::integer, -1) or (c.computed_distance = (v_cursor->>'distance')::integer and c.id > v_cursor->>'id')))
      or (p_sort = 'relevance' and (c.relevance < (v_cursor->>'score')::double precision or (c.relevance = (v_cursor->>'score')::double precision and c.id > v_cursor->>'id')))
      or (p_sort not in ('nearby', 'relevance') and (
        c.rating < (v_cursor->>'score')::numeric
        or (c.rating = (v_cursor->>'score')::numeric and (
          c.review_count < coalesce((v_cursor->>'review_count')::integer, 0)
          or (c.review_count = coalesce((v_cursor->>'review_count')::integer, 0) and c.id > v_cursor->>'id')
        ))
      ))
    order by
      case when p_sort = 'nearby' then c.computed_distance end asc,
      case when p_sort = 'relevance' then c.relevance end desc,
      case when p_sort not in ('nearby', 'relevance') then c.rating end desc,
      case when p_sort not in ('nearby', 'relevance') then c.review_count end desc,
      c.id asc
    limit v_limit + 1
  ), visible as (select * from page limit v_limit), tail as (select * from page offset v_limit limit 1), cursor_row as (
    select * from visible
    where exists (select 1 from tail)
    order by
      case when p_sort = 'nearby' then computed_distance end desc,
      case when p_sort = 'relevance' then relevance end asc,
      case when p_sort not in ('nearby', 'relevance') then rating end asc,
      case when p_sort not in ('nearby', 'relevance') then review_count end asc,
      id desc
    limit 1
  )
  select
    coalesce(jsonb_agg(
      -- The real distance from the viewer replaces the stored distance_meters column.
      (to_jsonb(visible) - 'listing_location' - 'computed_distance' - 'relevance')
        || jsonb_build_object('distance_meters', nullif(computed_distance, 2147483647))
      order by
        case when p_sort = 'nearby' then computed_distance end asc,
        case when p_sort = 'relevance' then relevance end desc,
        case when p_sort not in ('nearby', 'relevance') then rating end desc,
        case when p_sort not in ('nearby', 'relevance') then review_count end desc,
        id asc
    ), '[]'::jsonb),
    count(*)::integer,
    (select public.catalog_raw_cursor(jsonb_build_object('release_id', v_release, 'fingerprint', v_fingerprint, 'id', id, 'distance', computed_distance, 'review_count', review_count, 'score', case when p_sort = 'nearby' then computed_distance else case when p_sort = 'relevance' then relevance else rating::double precision end end)) from cursor_row)
  into v_items, v_count, v_next
  from visible;
  return jsonb_build_object('items', v_items, 'next_cursor', v_next, 'release_id', v_release,
    'totals', (select jsonb_build_object('venues', venue_total, 'dishes', dish_total) from public.catalog_releases where id = v_release));
end;
$$;

-- Guests browse the catalog too (20261019210000_guest_catalog_raw_reads.sql).
revoke all on function public.catalog_raw_dishes_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text, text[], text) from public;
grant execute on function public.catalog_raw_dishes_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text, text[], text) to anon, authenticated;

create or replace function public.catalog_raw_venues_page(
  p_query text default null, p_lat double precision default null, p_lng double precision default null, p_radius_meters integer default null,
  p_cuisine_tags text[] default '{}', p_dietary_flags text[] default '{}', p_max_price numeric default null, p_open_only boolean default false,
  p_sort text default 'quality', p_cursor text default null, p_release_id uuid default null, p_limit integer default 24,
  p_building_types text[] default '{}', p_building_id text default null
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_release uuid; v_limit integer := least(greatest(coalesce(p_limit, 24), 1), 50); v_items jsonb; v_next text; v_fingerprint text; v_cursor jsonb;
begin
  perform public.catalog_raw_require_authenticated(); v_release := public.catalog_raw_release_for_read(p_release_id);
  v_fingerprint := md5(concat_ws('|', coalesce(lower(trim(p_query)), ''), coalesce(p_lat::text, ''), coalesce(p_lng::text, ''), coalesce(p_radius_meters::text, ''), array_to_string(coalesce(p_cuisine_tags, '{}'), ','), array_to_string(coalesce(p_dietary_flags, '{}'), ','), array_to_string(coalesce(p_building_types, '{}'), ','), coalesce(p_max_price::text, ''), p_open_only::text, p_sort, coalesce(p_building_id, '')));
  v_cursor := case when p_cursor is null then null else public.catalog_raw_cursor_value(p_cursor) end;
  if v_cursor is not null and ((v_cursor->>'release_id')::uuid <> v_release or v_cursor->>'fingerprint' <> v_fingerprint) then raise exception 'catalog cursor mismatch' using errcode = '22023'; end if;
  with dish_matches as materialized (
    -- Stalls whose dishes or food types in this release match the query, with the best match score.
    select dc.venue_id, max(greatest(similarity(dc.name, p_query), similarity(coalesce(dc.food_type, ''), p_query))) as score
    from public.catalog_raw_dish_cards dc
    where nullif(trim(coalesce(p_query, '')), '') is not null
      and dc.release_id = v_release
      and (dc.name % p_query or dc.name ilike '%' || p_query || '%' or dc.food_type ilike '%' || p_query || '%' or dc.food_type % p_query)
    group by dc.venue_id
  ), candidates as materialized (
    select c.*, coalesce(st_distance(c.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)::integer, 2147483647) as computed_distance,
      case when nullif(trim(coalesce(p_query, '')), '') is null then 0::double precision
           else greatest(similarity(c.name, p_query), similarity(coalesce(c.building_name, ''), p_query), coalesce(dm.score, 0))
             + coalesce(0.15 * exp(-st_distance(c.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 3000.0), 0) end as relevance
    from public.catalog_raw_venue_cards c
    left join dish_matches dm on dm.venue_id = c.id
    where c.release_id = v_release and (p_open_only = false or c.is_open)
      and (p_building_id is null or c.building_id = p_building_id)
      and (cardinality(coalesce(p_building_types, '{}')) = 0 or c.building_type = any(p_building_types))
      and (cardinality(coalesce(p_cuisine_tags, '{}')) = 0 or c.cuisine_tags && p_cuisine_tags)
      and (cardinality(coalesce(p_dietary_flags, '{}')) = 0 or c.dietary_flags @> p_dietary_flags)
      and (p_max_price is null or c.min_price <= p_max_price)
      and (p_lat is null or p_lng is null or p_radius_meters is null or st_dwithin(c.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_meters))
      and (nullif(trim(coalesce(p_query, '')), '') is null or c.name % p_query or c.name ilike '%' || p_query || '%'
        or c.building_name % p_query or c.building_name ilike '%' || p_query || '%' or dm.venue_id is not null)
  ), page as materialized (
    select * from candidates c where v_cursor is null
      or (p_sort = 'nearby' and (c.computed_distance > (v_cursor->>'distance')::integer or (c.computed_distance = (v_cursor->>'distance')::integer and (lower(c.name) > v_cursor->>'name' or (lower(c.name) = v_cursor->>'name' and c.id > v_cursor->>'id')))))
      or (p_sort = 'relevance' and (c.relevance < (v_cursor->>'score')::double precision or (c.relevance = (v_cursor->>'score')::double precision and (lower(c.name) > v_cursor->>'name' or (lower(c.name) = v_cursor->>'name' and c.id > v_cursor->>'id')))))
      or (p_sort not in ('nearby', 'relevance') and (c.quality_rating < (v_cursor->>'score')::numeric or (c.quality_rating = (v_cursor->>'score')::numeric and (c.quality_review_count < (v_cursor->>'review_count')::integer or (c.quality_review_count = (v_cursor->>'review_count')::integer and (lower(c.name) > v_cursor->>'name' or (lower(c.name) = v_cursor->>'name' and c.id > v_cursor->>'id')))))))
    order by case when p_sort = 'nearby' then c.computed_distance end asc, case when p_sort = 'relevance' then c.relevance end desc, case when p_sort not in ('nearby', 'relevance') then c.quality_rating end desc, case when p_sort not in ('nearby', 'relevance') then c.quality_review_count end desc, lower(c.name) asc, c.id asc limit v_limit + 1
  ), visible as (select * from page limit v_limit), tail as (select * from page offset v_limit limit 1), cursor_row as (
    select * from visible
    where exists (select 1 from tail)
    order by
      case when p_sort = 'nearby' then computed_distance end desc,
      case when p_sort = 'relevance' then relevance end asc,
      case when p_sort not in ('nearby', 'relevance') then quality_rating end asc,
      case when p_sort not in ('nearby', 'relevance') then quality_review_count end asc,
      lower(name) desc,
      id desc
    limit 1
  )
  select
    coalesce(jsonb_agg(
      -- Venue cards have no stored distance; report the real one from the viewer.
      (to_jsonb(visible) - 'listing_location' - 'computed_distance' - 'relevance')
        || jsonb_build_object('distance_meters', nullif(computed_distance, 2147483647))
      order by
        case when p_sort = 'nearby' then computed_distance end asc,
        case when p_sort = 'relevance' then relevance end desc,
        case when p_sort not in ('nearby', 'relevance') then quality_rating end desc,
        case when p_sort not in ('nearby', 'relevance') then quality_review_count end desc,
        lower(name) asc,
        id asc
    ), '[]'::jsonb),
    (select public.catalog_raw_cursor(jsonb_build_object('release_id', v_release, 'fingerprint', v_fingerprint, 'id', id, 'name', lower(name), 'distance', computed_distance, 'review_count', quality_review_count, 'score', case when p_sort = 'nearby' then computed_distance else case when p_sort = 'relevance' then relevance else quality_rating::double precision end end)) from cursor_row)
  into v_items, v_next
  from visible;
  return jsonb_build_object('items', v_items, 'next_cursor', v_next, 'release_id', v_release, 'totals', (select jsonb_build_object('venues', venue_total, 'dishes', dish_total) from public.catalog_releases where id = v_release));
end;
$$;

-- Guests browse the catalog too (20261019210000_guest_catalog_raw_reads.sql).
revoke all on function public.catalog_raw_venues_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text[], text) from public;
grant execute on function public.catalog_raw_venues_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text[], text) to anon, authenticated;

-- catalog_raw_places: malls, hawker centres, food courts and other buildings with several
-- stalls, from the active release. A "place" is any building with at least 3 stalls, whatever
-- its building_type, because the loader types buildings from their names and a mall like JEM
-- can come through as "other".
--   * p_query matches the building name (start of the name or of any word, or close by trigram).
--   * p_lat/p_lng with p_radius_meters keeps buildings with a stall inside the radius, so
--     "which place am I in" is radius 100 and limit 1.
--   * p_lat/p_lng alone only add distance_meters (to the nearest stall in the building).
-- Order: name match first, then nearest, then busiest.
create or replace function public.catalog_raw_places(
  p_query text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_meters integer default null,
  p_limit integer default 8,
  p_release_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_release uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 8), 1), 20);
  v_query text := left(nullif(trim(coalesce(p_query, '')), ''), 64);
  v_escaped text;
  v_point geography;
  v_items jsonb;
begin
  perform public.catalog_raw_require_authenticated();
  v_release := public.catalog_raw_release_for_read(p_release_id);
  v_escaped := replace(replace(replace(coalesce(v_query, ''), '\', '\\'), '%', '\%'), '_', '\_');
  if p_lat is not null and p_lng is not null then
    v_point := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  end if;

  with matched as (
    select distinct c.building_id
    from public.catalog_raw_venue_cards c
    where c.release_id = v_release
      and c.building_name is not null
      and (v_query is null
        or c.building_name ilike v_escaped || '%'
        or c.building_name ilike '% ' || v_escaped || '%'
        or c.building_name % v_query)
      and (v_point is null or p_radius_meters is null
        or st_dwithin(c.listing_location, v_point, p_radius_meters))
  ), places as (
    select
      c.building_id as id,
      max(c.building_name) as name,
      max(c.building_type) as building_type,
      count(*)::integer as venue_count,
      avg(c.latitude) as latitude,
      avg(c.longitude) as longitude,
      case when v_point is null then null else min(st_distance(c.listing_location, v_point))::integer end as distance_meters,
      bool_or(v_query is not null and c.building_name ilike v_escaped || '%') as starts_with
    from public.catalog_raw_venue_cards c
    join matched m on m.building_id = c.building_id
    where c.release_id = v_release
    group by c.building_id
    having count(*) >= 3
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'building_type', p.building_type,
      'venue_count', p.venue_count,
      'latitude', p.latitude,
      'longitude', p.longitude,
      'distance_meters', p.distance_meters
    ) order by p.starts_with desc, p.distance_meters asc nulls last, p.venue_count desc, p.name, p.id), '[]'::jsonb)
  into v_items
  from (select * from places order by starts_with desc, distance_meters asc nulls last, venue_count desc, name, id limit v_limit) p;

  return v_items;
end;
$$;

create index if not exists catalog_raw_venue_cards_release_building_idx
  on public.catalog_raw_venue_cards (release_id, building_id);

revoke all on function public.catalog_raw_places(text, double precision, double precision, integer, integer, uuid) from public;
grant execute on function public.catalog_raw_places(text, double precision, double precision, integer, integer, uuid) to anon, authenticated;

create or replace function public.catalog_suggest(p_prefix text default null, p_limit integer default 8)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_release uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 8), 1), 8);
  v_prefix text := left(nullif(trim(coalesce(p_prefix, '')), ''), 64);
  v_escaped text;
  v_items jsonb;
begin
  perform public.catalog_raw_require_authenticated();
  v_release := public.catalog_raw_release_for_read(null);

  if v_prefix is null or char_length(v_prefix) < 2 then
    select coalesce(jsonb_agg(jsonb_build_object('kind', 'food_type', 'label', t.food_type) order by t.weight desc, t.food_type), '[]'::jsonb)
    into v_items
    from (
      select c.food_type, count(*) as weight
      from public.catalog_raw_dish_cards c
      where c.release_id = v_release and c.food_type is not null
      group by c.food_type
      order by count(*) desc, c.food_type
      limit v_limit
    ) t;
    return v_items;
  end if;

  -- Typed text is matched literally, never as a LIKE pattern.
  v_escaped := replace(replace(replace(v_prefix, '\', '\\'), '%', '\%'), '_', '\_');

  with matches as (
    select 'food_type'::text as kind, c.food_type as label, count(*) as weight, 0 as kind_rank, null::text as ref
    from public.catalog_raw_dish_cards c
    where c.release_id = v_release and c.food_type is not null
      and (c.food_type ilike v_escaped || '%' or c.food_type ilike '% ' || v_escaped || '%')
    group by c.food_type
    union all
    -- Places are buildings with several stalls (malls, hawker centres, food courts); the id
    -- lets the app scope results to that building.
    select 'place', max(c.building_name), count(*), 1, c.building_id
    from public.catalog_raw_venue_cards c
    where c.release_id = v_release and c.building_name is not null
      and (c.building_name ilike v_escaped || '%' or c.building_name ilike '% ' || v_escaped || '%')
    group by c.building_id
    having count(*) >= 3
    union all
    select 'stall', c.name, count(*), 2, null::text
    from public.catalog_raw_venue_cards c
    where c.release_id = v_release
      and (c.name ilike v_escaped || '%' or c.name ilike '% ' || v_escaped || '%')
    group by c.name
  ), ranked as (
    select kind, label, kind_rank, weight, ref, (label ilike v_escaped || '%') as starts_with
    from matches
    order by (label ilike v_escaped || '%') desc, kind_rank, weight desc, label
    limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'label', label) || case when ref is null then '{}'::jsonb else jsonb_build_object('id', ref) end
    order by starts_with desc, kind_rank, weight desc, label), '[]'::jsonb)
  into v_items
  from ranked;
  return v_items;
end;
$$;

create or replace function public.get_discovery_feed_by_location(
  p_area_name text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_meters integer default 3000,
  p_limit integer default 50,
  p_building_id text default null
)
returns table (
  venue_id text,
  venue_name text,
  venue_logo_url text,
  building_id text,
  building_name text,
  planning_area text,
  is_open boolean,
  distance_meters integer,
  top_dish_id text,
  top_dish_name text,
  top_dish_image text,
  top_dish_rating numeric,
  top_dish_review_count integer,
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
    select name, center_lat, center_lng
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
      exists (select 1 from area_match) as area_found,
      lower(trim(nullif(coalesce(p_area_name, ''), ''))) as area_key
  ),
  candidate_venues as materialized (
    select *
    from (
      select
        v.id,
        v.name,
        v.logo_url as venue_logo_url,
        v.building_id,
        v.planning_area as venue_planning_area,
        v.is_open,
        v.location as venue_location,
        v.image_url as venue_image_url,
        v.media_approved_for_display as venue_media_approved_for_display,
        v.media_rights_status as venue_media_rights_status,
        v.media_source_url as venue_media_source_url,
        v.menu_approved_for_display as venue_menu_approved_for_display,
        v.menu_rights_status as venue_menu_rights_status,
        v.menu_source_url as venue_menu_source_url,
        v.cuisine_tags as venue_cuisine_tags,
        b.name as building_name,
        b.planning_area as building_planning_area,
        b.location as building_location,
        b.image_url as building_image_url,
        b.media_approved_for_display as building_media_approved_for_display,
        b.media_rights_status as building_media_rights_status,
        b.media_source_url as building_media_source_url,
        b.is_closed_today,
        exists (
          select 1
          from dishes d
          where d.venue_id = v.id
            and d.price > 0
            and public.catalog_menu_is_displayable(
              d.menu_approved_for_display,
              d.menu_rights_status,
              d.menu_source_url
            )
        ) as has_menu,
        case
          when params.lat is not null and params.lng is not null then
            st_distance(
              coalesce(v.location, b.location),
              st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography
            )
          else null
        end as request_distance_meters
      from venues v
      join buildings b on b.id = v.building_id
      cross join params
      where params.area_requested
        and params.area_found
        and lower(trim(v.planning_area)) = params.area_key

      union all

      select
        v.id,
        v.name,
        v.logo_url as venue_logo_url,
        v.building_id,
        v.planning_area as venue_planning_area,
        v.is_open,
        v.location as venue_location,
        v.image_url as venue_image_url,
        v.media_approved_for_display as venue_media_approved_for_display,
        v.media_rights_status as venue_media_rights_status,
        v.media_source_url as venue_media_source_url,
        v.menu_approved_for_display as venue_menu_approved_for_display,
        v.menu_rights_status as venue_menu_rights_status,
        v.menu_source_url as venue_menu_source_url,
        v.cuisine_tags as venue_cuisine_tags,
        b.name as building_name,
        b.planning_area as building_planning_area,
        b.location as building_location,
        b.image_url as building_image_url,
        b.media_approved_for_display as building_media_approved_for_display,
        b.media_rights_status as building_media_rights_status,
        b.media_source_url as building_media_source_url,
        b.is_closed_today,
        exists (
          select 1
          from dishes d
          where d.venue_id = v.id
            and d.price > 0
            and public.catalog_menu_is_displayable(
              d.menu_approved_for_display,
              d.menu_rights_status,
              d.menu_source_url
            )
        ) as has_menu,
        case
          when params.lat is not null and params.lng is not null then
            st_distance(
              coalesce(v.location, b.location),
              st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography
            )
          else null
        end as request_distance_meters
      from venues v
      join buildings b on b.id = v.building_id
      cross join params
      where params.area_requested
        and params.area_found
        and v.planning_area is null
        and lower(trim(b.planning_area)) = params.area_key

      union all

      select
        v.id,
        v.name,
        v.logo_url as venue_logo_url,
        v.building_id,
        v.planning_area as venue_planning_area,
        v.is_open,
        v.location as venue_location,
        v.image_url as venue_image_url,
        v.media_approved_for_display as venue_media_approved_for_display,
        v.media_rights_status as venue_media_rights_status,
        v.media_source_url as venue_media_source_url,
        v.menu_approved_for_display as venue_menu_approved_for_display,
        v.menu_rights_status as venue_menu_rights_status,
        v.menu_source_url as venue_menu_source_url,
        v.cuisine_tags as venue_cuisine_tags,
        b.name as building_name,
        b.planning_area as building_planning_area,
        b.location as building_location,
        b.image_url as building_image_url,
        b.media_approved_for_display as building_media_approved_for_display,
        b.media_rights_status as building_media_rights_status,
        b.media_source_url as building_media_source_url,
        b.is_closed_today,
        exists (
          select 1
          from dishes d
          where d.venue_id = v.id
            and d.price > 0
            and public.catalog_menu_is_displayable(
              d.menu_approved_for_display,
              d.menu_rights_status,
              d.menu_source_url
            )
        ) as has_menu,
        case
          when params.lat is not null and params.lng is not null then
            st_distance(
              coalesce(v.location, b.location),
              st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography
            )
          else null
        end as request_distance_meters
      from venues v
      join buildings b on b.id = v.building_id
      cross join params
      where not (params.area_requested and params.area_found)
        and (
          params.lat is null
          or params.lng is null
          or st_dwithin(
            coalesce(v.location, b.location),
            st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography,
            params.radius_meters
          )
        )
    ) filtered
    order by coalesce(filtered.building_id = p_building_id, false) desc, filtered.has_menu desc, filtered.request_distance_meters asc nulls last
    limit 500
  ),
  candidates as (
    select
      cv.id as venue_id,
      cv.name as venue_name,
      nullif(trim(cv.venue_logo_url), '') as venue_logo_url,
      cv.building_id,
      cv.building_name,
      coalesce(cv.venue_planning_area, cv.building_planning_area) as planning_area,
      cv.is_open,
      coalesce(cv.request_distance_meters, 0)::integer as distance_meters,
      top_dish.id as top_dish_id,
      top_dish.name as top_dish_name,
      coalesce(
        top_dish_image.url,
        public.catalog_display_image_url(top_dish.image_url, top_dish.media_approved_for_display, top_dish.media_rights_status, top_dish.media_source_url),
        public.catalog_display_image_url(cv.venue_image_url, cv.venue_media_approved_for_display, cv.venue_media_rights_status, cv.venue_media_source_url),
        public.catalog_display_image_url(cv.building_image_url, cv.building_media_approved_for_display, cv.building_media_rights_status, cv.building_media_source_url)
      ) as top_dish_image,
      top_dish.rating_avg as top_dish_rating,
      top_dish.review_count as top_dish_review_count,
      top_dish.price as top_dish_price,
      coalesce(cv.venue_cuisine_tags, '{}'::text[]) as cuisine_tags,
      (
        case when cv.is_open and not cv.is_closed_today then 0.320 else 0 end
        + case
            when cv.request_distance_meters is null then 0
            else greatest(0, 0.320 - least(cv.request_distance_meters, 3000)::double precision / 10000)
          end
        + least(coalesce(top_dish.rating_avg, 0)::double precision / 5, 1) * 0.260
        + public.catalog_venue_menu_priority_score(
            cv.id,
            cv.venue_menu_approved_for_display,
            cv.venue_menu_rights_status,
            cv.venue_menu_source_url
          )
      )::double precision as rank_score
    from candidate_venues cv
    cross join params
    left join lateral (
      select d.*
      from dishes d
      where d.venue_id = cv.id
        and d.price > 0
        and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
      order by
        exists (
          select 1
          from dish_images di
          where di.dish_id = d.id
            and public.catalog_display_image_url(
              di.url,
              di.media_approved_for_display,
              di.media_rights_status,
              di.media_source_url
            ) is not null
        ) desc,
        (public.catalog_display_image_url(
          d.image_url,
          d.media_approved_for_display,
          d.media_rights_status,
          d.media_source_url
        ) is not null) desc,
        d.must_order desc,
        d.is_featured desc,
        d.rating_avg desc,
        d.review_count desc,
        d.id
      limit 1
    ) top_dish on true
    left join lateral (
      select public.catalog_display_image_url(di.url, di.media_approved_for_display, di.media_rights_status, di.media_source_url) as url
      from dish_images di
      where di.dish_id = top_dish.id
        and public.catalog_display_image_url(
          di.url,
          di.media_approved_for_display,
          di.media_rights_status,
          di.media_source_url
        ) is not null
      order by di.sort_order
      limit 1
    ) top_dish_image on true
  )
  select
    candidates.venue_id,
    candidates.venue_name,
    candidates.venue_logo_url,
    candidates.building_id,
    candidates.building_name,
    candidates.planning_area,
    candidates.is_open,
    candidates.distance_meters,
    candidates.top_dish_id,
    candidates.top_dish_name,
    candidates.top_dish_image,
    candidates.top_dish_rating,
    candidates.top_dish_review_count,
    candidates.top_dish_price,
    candidates.cuisine_tags,
    candidates.rank_score
  from (
    select
      candidates.*,
      row_number() over (
        partition by coalesce(candidates.building_id = p_building_id, false)
        order by
          (nullif(trim(candidates.top_dish_image), '') is not null) desc,
          (candidates.top_dish_id is not null) desc,
          candidates.rank_score desc,
          candidates.distance_meters,
          candidates.venue_id
      ) as place_rank
    from candidates
  ) candidates
  order by
    -- Stalls in the viewer's own building first, but at most 60 of them, so a big mall
    -- never crowds out everything else in the feed.
    (coalesce(candidates.building_id = p_building_id, false) and candidates.place_rank <= 60) desc,
    (nullif(trim(candidates.top_dish_image), '') is not null) desc,
    (candidates.top_dish_id is not null) desc,
    candidates.rank_score desc,
    candidates.distance_meters,
    candidates.venue_id
  limit (select result_limit from params);
$$;

grant execute on function public.get_discovery_feed_by_location(
  text,
  double precision,
  double precision,
  integer,
  integer,
  text
) to anon, authenticated;

commit;
