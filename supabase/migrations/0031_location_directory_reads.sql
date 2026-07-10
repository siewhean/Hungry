-- Phase 2 follow-up: bounded server-side reads for location and building directory surfaces.
-- Read-only only: no canonical ID migration, feed models, merchant dashboard,
-- menu versioning, media unification, background jobs, analytics, or commerce.

create index if not exists idx_building_floors_building_sort_label
  on building_floors(building_id, sort_order, floor_label);
create index if not exists idx_venues_building_floor_id
  on venues(building_id, floor, id);
create index if not exists idx_dishes_building_rating_id
  on dishes(building_id, rating_avg desc, id);

create or replace function public.list_buildings(
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_meters integer default null,
  p_limit integer default 50,
  p_cursor_distance_meters integer default null,
  p_cursor_id text default null
)
returns table (
  id text,
  name text,
  building_type text,
  latitude double precision,
  longitude double precision,
  floors text[],
  venue_count integer,
  is_closed_today boolean,
  hero_dish_id text,
  open_venue_count integer,
  distance_meters integer,
  cursor_distance_meters integer,
  cursor_id text
)
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select
      p_lat as lat,
      p_lng as lng,
      nullif(p_radius_meters, 0) as radius_meters,
      least(greatest(coalesce(p_limit, 50), 1), 100) as result_limit,
      p_cursor_distance_meters as cursor_distance_meters,
      nullif(p_cursor_id, '') as cursor_id
  ),
  candidates as (
    select
      b.id,
      b.name,
      b.building_type,
      b.latitude,
      b.longitude,
      b.floors,
      b.venue_count,
      b.is_closed_today,
      b.hero_dish_id,
      coalesce(venue_stats.open_venue_count, 0)::integer as open_venue_count,
      case
        when params.lat is not null and params.lng is not null then
          st_distance(
            b.location,
            st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography
          )::integer
        else 0
      end as distance_meters
    from buildings b
    cross join params
    left join lateral (
      select count(*) filter (where v.is_open = true and b.is_closed_today = false) as open_venue_count
      from venues v
      where v.building_id = b.id
    ) venue_stats on true
    where (
      params.radius_meters is null
      or (
        params.lat is not null
        and params.lng is not null
        and st_dwithin(
          b.location,
          st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography,
          params.radius_meters
        )
      )
    )
  )
  select
    candidates.id,
    candidates.name,
    candidates.building_type,
    candidates.latitude,
    candidates.longitude,
    candidates.floors,
    candidates.venue_count,
    candidates.is_closed_today,
    candidates.hero_dish_id,
    candidates.open_venue_count,
    candidates.distance_meters,
    candidates.distance_meters as cursor_distance_meters,
    candidates.id as cursor_id
  from candidates
  cross join params
  where (
    params.cursor_distance_meters is null
    or candidates.distance_meters > params.cursor_distance_meters
    or (
      candidates.distance_meters = params.cursor_distance_meters
      and candidates.id > params.cursor_id
    )
  )
  order by candidates.distance_meters, candidates.id
  limit (select result_limit from params);
$$;

create or replace function public.list_venues_by_building(
  p_building_id text,
  p_open_now boolean default null,
  p_limit integer default 100,
  p_cursor_floor_sort integer default null,
  p_cursor_id text default null
)
returns table (
  venue_id text,
  building_id text,
  name text,
  unit_number text,
  floor text,
  is_open boolean,
  live_crowd text,
  top_dish_id text,
  operating_hours text,
  closure_notice text,
  delivery_links jsonb,
  floor_sort integer,
  cursor_floor_sort integer,
  cursor_id text
)
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select
      nullif(p_building_id, '') as building_id,
      p_open_now as open_now,
      least(greatest(coalesce(p_limit, 100), 1), 100) as result_limit,
      p_cursor_floor_sort as cursor_floor_sort,
      nullif(p_cursor_id, '') as cursor_id
  )
  select
    v.id as venue_id,
    v.building_id,
    v.name,
    v.unit_number,
    v.floor,
    v.is_open,
    v.live_crowd,
    v.top_dish_id,
    v.operating_hours,
    v.closure_notice,
    coalesce(delivery.delivery_links, '[]'::jsonb) as delivery_links,
    coalesce(bf.sort_order, 9999) as floor_sort,
    coalesce(bf.sort_order, 9999) as cursor_floor_sort,
    v.id as cursor_id
  from venues v
  cross join params
  left join building_floors bf on bf.building_id = v.building_id and bf.floor_label = v.floor
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'platform', vdl.platform,
        'nativeUrl', vdl.native_url,
        'webUrl', vdl.web_url,
        'affiliateEligible', vdl.affiliate_eligible
      )
      order by vdl.platform
    ) as delivery_links
    from venue_delivery_links vdl
    where vdl.venue_id = v.id
  ) delivery on true
  where v.building_id = params.building_id
    and (params.open_now is null or v.is_open = params.open_now)
    and (
      params.cursor_floor_sort is null
      or coalesce(bf.sort_order, 9999) > params.cursor_floor_sort
      or (
        coalesce(bf.sort_order, 9999) = params.cursor_floor_sort
        and params.cursor_id is not null
        and v.id > params.cursor_id
      )
    )
  order by coalesce(bf.sort_order, 9999), v.id
  limit (select result_limit from params);
$$;

create or replace function public.get_building_detail(p_building_id text)
returns table (
  id text,
  name text,
  building_type text,
  latitude double precision,
  longitude double precision,
  floors text[],
  venue_count integer,
  is_closed_today boolean,
  hero_dish_id text,
  address text,
  postal_code text,
  operating_hours text,
  description text,
  famous_dishes text[],
  total_stalls integer,
  open_stalls integer,
  avg_rating numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    b.id,
    b.name,
    b.building_type,
    b.latitude,
    b.longitude,
    b.floors,
    b.venue_count,
    b.is_closed_today,
    b.hero_dish_id,
    ''::text as address,
    ''::text as postal_code,
    ''::text as operating_hours,
    null::text as description,
    coalesce(famous.famous_dishes, '{}'::text[]) as famous_dishes,
    coalesce(venue_stats.total_stalls, 0)::integer as total_stalls,
    coalesce(venue_stats.open_stalls, 0)::integer as open_stalls,
    coalesce(dish_stats.avg_rating, 0)::numeric as avg_rating
  from buildings b
  left join lateral (
    select
      count(*)::integer as total_stalls,
      count(*) filter (where v.is_open = true and b.is_closed_today = false)::integer as open_stalls
    from venues v
    where v.building_id = b.id
  ) venue_stats on true
  left join lateral (
    select avg(d.rating_avg)::numeric as avg_rating
    from dishes d
    where d.building_id = b.id
  ) dish_stats on true
  left join lateral (
    select array_agg(dish_names.name order by dish_names.rating_avg desc, dish_names.id) as famous_dishes
    from (
      select d.id, d.name, d.rating_avg
      from dishes d
      where d.building_id = b.id
      order by d.rating_avg desc, d.id
      limit 4
    ) dish_names
  ) famous on true
  where b.id = p_building_id
  limit 1;
$$;

revoke execute on function public.list_buildings(
  double precision,
  double precision,
  integer,
  integer,
  integer,
  text
) from public;
grant execute on function public.list_buildings(
  double precision,
  double precision,
  integer,
  integer,
  integer,
  text
) to anon, authenticated;

revoke execute on function public.list_venues_by_building(
  text,
  boolean,
  integer,
  integer,
  text
) from public;
grant execute on function public.list_venues_by_building(
  text,
  boolean,
  integer,
  integer,
  text
) to anon, authenticated;

revoke execute on function public.get_building_detail(text) from public;
grant execute on function public.get_building_detail(text) to anon, authenticated;

comment on function public.list_buildings(
  double precision,
  double precision,
  integer,
  integer,
  integer,
  text
) is
  'Bounded building directory read path with optional location/radius filtering and cursor pagination.';

comment on function public.list_venues_by_building(text, boolean, integer, integer, text) is
  'Bounded venue directory read path for one building with optional open-now filtering.';

comment on function public.get_building_detail(text) is
  'Building detail read path with computed stall counts, open stall count, average dish rating, and top dish names.';
