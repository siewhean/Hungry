-- Server-side discovery read paths for high-volume app reads.
-- Phase 2 only: bounded RPCs for discovery/search/detail reads with cursor pagination.

create index if not exists idx_dishes_rating_id
  on dishes(rating_avg desc, id);
create index if not exists idx_dishes_price_id
  on dishes(price, id);
create index if not exists idx_dishes_venue_rating_id
  on dishes(venue_id, rating_avg desc, id);
create index if not exists idx_venues_open_building
  on venues(is_open, building_id, id);
create index if not exists idx_dish_images_dish_order
  on dish_images(dish_id, sort_order);
create index if not exists idx_reviews_dish_created
  on reviews(dish_id, created_at desc, id);
create index if not exists idx_dish_dietary_flags_flag_dish
  on dish_dietary_flags(dietary_flag_id, dish_id);

create or replace function public.search_dishes(
  p_query text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_meters integer default null,
  p_dietary_flags text[] default '{}'::text[],
  p_limit integer default 20,
  p_cursor_score double precision default null,
  p_cursor_id text default null,
  p_venue_id text default null
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
set search_path = public
as $$
  with params as (
    select
      nullif(trim(coalesce(p_query, '')), '') as query,
      p_lat as lat,
      p_lng as lng,
      nullif(p_radius_meters, 0) as radius_meters,
      coalesce(p_dietary_flags, '{}'::text[]) as dietary_flags,
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
      d.image_url,
      d.blurhash,
      case
        when params.lat is not null and params.lng is not null then
          st_distance(
            b.location,
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
      ), case when nullif(d.image_url, '') is null then '{}'::text[] else array[d.image_url] end) as gallery,
      d.description,
      d.must_order,
      d.availability_flags,
      case
        when params.query is null then 1::double precision
        else greatest(
          similarity(d.name, params.query),
          similarity(v.name, params.query),
          case
            when concat_ws(' ', d.name, v.name, array_to_string(d.taste_tags, ' ')) ilike '%' || params.query || '%'
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
                b.location,
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
    where (params.venue_id is null or d.venue_id = params.venue_id)
      and (
        params.query is null
        or concat_ws(' ', d.name, v.name, array_to_string(d.taste_tags, ' ')) ilike '%' || params.query || '%'
        or d.name % params.query
        or v.name % params.query
      )
      and (
        cardinality(params.dietary_flags) = 0
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
            b.location,
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
set search_path = public
as $$
  select
    d.id as dish_id,
    d.venue_id,
    d.building_id,
    v.name as venue_name,
    v.unit_number,
    v.floor,
    d.name,
    d.image_url,
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
    ), case when nullif(d.image_url, '') is null then '{}'::text[] else array[d.image_url] end) as gallery,
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

create or replace function public.get_venue_detail(p_venue_id text)
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
  building jsonb,
  delivery_links jsonb,
  dishes jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
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
    jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'type', b.building_type,
      'latitude', b.latitude,
      'longitude', b.longitude,
      'floors', b.floors,
      'venueCount', b.venue_count,
      'isClosedToday', b.is_closed_today,
      'heroDishId', b.hero_dish_id
    ) as building,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'platform', vdl.platform,
          'nativeUrl', vdl.native_url,
          'webUrl', vdl.web_url,
          'affiliateEligible', vdl.affiliate_eligible
        )
        order by vdl.platform
      )
      from venue_delivery_links vdl
      where vdl.venue_id = v.id
    ), '[]'::jsonb) as delivery_links,
    coalesce((
      select jsonb_agg(to_jsonb(sd) order by sd.rank_score desc, sd.dish_id)
      from public.search_dishes(null, null, null, null, '{}'::text[], 50, null, null, v.id) sd
    ), '[]'::jsonb) as dishes
  from venues v
  join buildings b on b.id = v.building_id
  where v.id = p_venue_id
  limit 1;
$$;

create or replace function public.get_nearby_open_venues(
  p_lat double precision,
  p_lng double precision,
  p_radius_meters integer default 2500,
  p_limit integer default 20,
  p_cursor_distance_meters integer default null,
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
      greatest(coalesce(p_radius_meters, 2500), 1) as radius_meters,
      least(greatest(coalesce(p_limit, 20), 1), 50) as result_limit,
      p_cursor_distance_meters as cursor_distance_meters,
      nullif(p_cursor_id, '') as cursor_id
  ),
  candidates as (
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
      case
        when params.lat is not null and params.lng is not null then
          st_distance(
            b.location,
            st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography
          )::integer
        else 0
      end as distance_meters
    from venues v
    join buildings b on b.id = v.building_id
    cross join params
    where v.is_open = true
      and b.is_closed_today = false
      and (
        params.lat is null
        or params.lng is null
        or st_dwithin(
          b.location,
          st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography,
          params.radius_meters
        )
      )
  )
  select
    candidates.venue_id,
    candidates.building_id,
    candidates.name,
    candidates.unit_number,
    candidates.floor,
    candidates.is_open,
    candidates.live_crowd,
    candidates.top_dish_id,
    candidates.operating_hours,
    candidates.closure_notice,
    candidates.distance_meters,
    candidates.distance_meters as cursor_distance_meters,
    candidates.venue_id as cursor_id
  from candidates
  cross join params
  where (
    params.cursor_distance_meters is null
    or candidates.distance_meters > params.cursor_distance_meters
    or (
      candidates.distance_meters = params.cursor_distance_meters
      and candidates.venue_id > params.cursor_id
    )
  )
  order by candidates.distance_meters, candidates.venue_id
  limit (select result_limit from params);
$$;

grant execute on function public.search_dishes(
  text,
  double precision,
  double precision,
  integer,
  text[],
  integer,
  double precision,
  text,
  text
) to anon, authenticated;

grant execute on function public.get_dish_detail(text) to anon, authenticated;
grant execute on function public.get_venue_detail(text) to anon, authenticated;

grant execute on function public.get_nearby_open_venues(
  double precision,
  double precision,
  integer,
  integer,
  integer,
  text
) to anon, authenticated;
