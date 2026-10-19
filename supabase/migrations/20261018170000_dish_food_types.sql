-- Dish food types (e.g. "Chicken Rice", "Nasi Lemak") so searching a food type finds every dish of that type.
-- Values come from the owner-vetted list in data/dish_food_types/; dishes without one stay null.

begin;

alter table public.dishes
  add column if not exists food_type text,
  add column if not exists course text;

alter table public.dishes drop constraint if exists dishes_course_check;
alter table public.dishes
  add constraint dishes_course_check
  check (course is null or course in ('Main', 'Side', 'Drink', 'Dessert & bakery'));

create index if not exists dishes_food_type_lower_idx on public.dishes (lower(food_type)) where food_type is not null;

alter table public.catalog_raw_dish_cards add column if not exists food_type text;

-- Publish and per-venue refresh insert dish cards with explicit column lists; fill food_type from the dish.
create or replace function public.catalog_raw_dish_cards_fill_food_type()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.food_type is null then
    select d.food_type into new.food_type from public.dishes d where d.id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.catalog_raw_dish_cards_fill_food_type() from public, anon, authenticated;

drop trigger if exists catalog_raw_dish_cards_fill_food_type on public.catalog_raw_dish_cards;
create trigger catalog_raw_dish_cards_fill_food_type
  before insert on public.catalog_raw_dish_cards
  for each row execute function public.catalog_raw_dish_cards_fill_food_type();

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
  with query_area_match as (
    select a.name, a.center_lat, a.center_lng
    from areas a
    where nullif(trim(coalesce(p_area_name, p_query, '')), '') is not null
      and a.name_normalized = lower(trim(coalesce(p_area_name, p_query)))
    limit 1
  ),
  params as (
    select
      case
        when exists (select 1 from query_area_match)
          and nullif(trim(coalesce(p_area_name, '')), '') is null
          then null
        else nullif(trim(coalesce(p_query, '')), '')
      end as query,
      coalesce((select center_lat from query_area_match), p_lat) as lat,
      coalesce((select center_lng from query_area_match), p_lng) as lng,
      case
        when (select center_lat from query_area_match) is not null then greatest(coalesce(p_radius_meters, 3000), 1)
        else nullif(p_radius_meters, 0)
      end as radius_meters,
      coalesce(p_dietary_flags, '{}'::text[]) as dietary_flags,
      coalesce(p_cuisine_tags, '{}'::text[]) as cuisine_tags,
      p_max_price as max_price,
      coalesce(p_open_only, false) as open_only,
      nullif(trim(coalesce(p_area_name, '')), '') is not null as area_requested,
      exists (select 1 from query_area_match) as area_found,
      least(greatest(coalesce(p_limit, 20), 1), 50) as result_limit,
      p_cursor_score as cursor_score,
      nullif(p_cursor_id, '') as cursor_id,
      nullif(p_venue_id, '') as venue_id
  ),
  candidate_ids as materialized (
    select distinct dish_id
    from (
      (
        select d.id as dish_id
        from dishes d
        cross join params
        where params.query is not null
          and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
          and (params.venue_id is null or d.venue_id = params.venue_id)
          and (
            d.name ilike '%' || params.query || '%'
            or d.name % params.query
          )
        order by greatest(
          similarity(d.name, params.query),
          case when d.name ilike '%' || params.query || '%' then 0.65 else 0 end
        ) desc, d.rating_avg desc, d.id
        limit 250
      )

      union all

      (
        select d.id as dish_id
        from dishes d
        join venues v on v.id = d.venue_id
        cross join params
        where params.query is not null
          and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
          and (params.venue_id is null or d.venue_id = params.venue_id)
          and (
            v.name ilike '%' || params.query || '%'
            or v.name % params.query
          )
        order by greatest(
          similarity(v.name, params.query),
          case when v.name ilike '%' || params.query || '%' then 0.55 else 0 end
        ) desc, d.rating_avg desc, d.id
        limit 250
      )

      union all

      (
        select d.id as dish_id
        from dishes d
        join venues v on v.id = d.venue_id
        cross join params
        where params.query is not null
          and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
          and (params.venue_id is null or d.venue_id = params.venue_id)
          and (
            coalesce(d.food_type, '') ilike '%' || params.query || '%'
            or array_to_string(d.taste_tags, ' ') ilike '%' || params.query || '%'
            or array_to_string(d.cuisine_tags, ' ') ilike '%' || params.query || '%'
            or array_to_string(v.cuisine_tags, ' ') ilike '%' || params.query || '%'
          )
        order by d.rating_avg desc, d.id
        limit 250
      )

      union all

      (
        select d.id as dish_id
        from dishes d
        join venues v on v.id = d.venue_id
        join buildings b on b.id = d.building_id
        cross join params
        where params.query is null
          and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
          and (not params.area_requested or params.area_found)
          and (params.venue_id is null or d.venue_id = params.venue_id)
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
        order by d.rating_avg desc, d.review_count desc, d.id
        limit 750
      )
    ) matched
    limit 750
  ),
  lean_candidates as (
    select
      d.id as dish_id,
      d.venue_id,
      d.building_id,
      v.name as venue_name,
      v.unit_number,
      v.floor,
      d.name,
      coalesce(
        public.catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url),
        public.catalog_display_image_url(v.image_url, v.media_approved_for_display, v.media_rights_status, v.media_source_url)
      ) as image_url,
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
      d.description,
      d.must_order,
      d.availability_flags,
      case
        when params.query is null then 1::double precision
        else greatest(
          similarity(d.name, params.query),
          similarity(v.name, params.query),
          case
            when d.name ilike '%' || params.query || '%'
              or v.name ilike '%' || params.query || '%'
              or coalesce(d.food_type, '') ilike '%' || params.query || '%'
              or array_to_string(d.taste_tags, ' ') ilike '%' || params.query || '%'
              or array_to_string(d.cuisine_tags, ' ') ilike '%' || params.query || '%'
              or array_to_string(v.cuisine_tags, ' ') ilike '%' || params.query || '%'
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
    from candidate_ids ci
    join dishes d on d.id = ci.dish_id
    join venues v on v.id = d.venue_id
    join buildings b on b.id = d.building_id
    cross join params
    where public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
      and (not params.area_requested or params.area_found)
      and (params.venue_id is null or d.venue_id = params.venue_id)
      and (not params.open_only or (v.is_open = true and b.is_closed_today = false))
      and (params.max_price is null or d.price <= params.max_price)
      and (
        cardinality(params.cuisine_tags) = 0
        or d.cuisine_tags && params.cuisine_tags
        or v.cuisine_tags && params.cuisine_tags
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
      lean_candidates.*,
      (
        (0.55 * lean_candidates.text_score)
        + (0.25 * lean_candidates.rating_score)
        + (0.20 * lean_candidates.distance_score)
      )::double precision as rank_score
    from lean_candidates
  ),
  limited as materialized (
    select scored.*
    from scored
    cross join params
    where (
      params.cursor_score is null
      or scored.rank_score < params.cursor_score
      or (scored.rank_score = params.cursor_score and scored.dish_id > params.cursor_id)
    )
    order by scored.rank_score desc, scored.dish_id
    limit (select result_limit from params)
  )
  select
    limited.dish_id,
    limited.venue_id,
    limited.building_id,
    limited.venue_name,
    limited.unit_number,
    limited.floor,
    limited.name,
    limited.image_url,
    limited.blurhash,
    limited.distance_meters,
    limited.rating,
    limited.review_count,
    limited.price,
    limited.price_range,
    limited.live_crowd,
    limited.taste_tags,
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
      where ddf.dish_id = limited.dish_id
    ), '{}'::text[]) as dietary_flags,
    coalesce((
      select array_agg(safe_image.url order by safe_image.sort_order)
      from (
        select
          di.sort_order,
          public.catalog_display_image_url(di.url, di.media_approved_for_display, di.media_rights_status, di.media_source_url) as url
        from dish_images di
        where di.dish_id = limited.dish_id
      ) safe_image
      where safe_image.url is not null
    ), case
      when limited.image_url is null then '{}'::text[]
      else array[limited.image_url]
    end) as gallery,
    limited.description,
    limited.must_order,
    limited.availability_flags,
    limited.rank_score,
    limited.rank_score as cursor_score,
    limited.dish_id as cursor_id
  from limited
  left join dish_taste_vectors dtv on dtv.dish_id = limited.dish_id
  order by limited.rank_score desc, limited.dish_id;
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
  text,
  text,
  text[],
  numeric,
  boolean
) to anon, authenticated;

create or replace function public.catalog_raw_dishes_page(
  p_query text default null, p_lat double precision default null, p_lng double precision default null,
  p_radius_meters integer default null, p_cuisine_tags text[] default '{}', p_dietary_flags text[] default '{}',
  p_max_price numeric default null, p_open_only boolean default false, p_sort text default 'quality',
  p_cursor text default null, p_release_id uuid default null, p_limit integer default 24, p_venue_id text default null,
  p_building_types text[] default '{}'
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_release uuid; v_cursor jsonb; v_fingerprint text; v_limit integer := least(greatest(coalesce(p_limit, 24), 1), 50);
  v_items jsonb; v_next text; v_count integer;
begin
  perform public.catalog_raw_require_authenticated();
  v_release := public.catalog_raw_release_for_read(p_release_id);
  v_fingerprint := md5(concat_ws('|', coalesce(lower(trim(p_query)), ''), coalesce(p_lat::text, ''), coalesce(p_lng::text, ''), coalesce(p_radius_meters::text, ''), array_to_string(coalesce(p_cuisine_tags, '{}'), ','), array_to_string(coalesce(p_dietary_flags, '{}'), ','), array_to_string(coalesce(p_building_types, '{}'), ','), coalesce(p_max_price::text, ''), p_open_only::text, p_sort, coalesce(p_venue_id, '')));
  v_cursor := case when p_cursor is null then null else public.catalog_raw_cursor_value(p_cursor) end;
  if v_cursor is not null and (v_cursor->>'release_id')::uuid <> v_release then raise exception 'catalog cursor release mismatch' using errcode = '22023'; end if;
  if v_cursor is not null and v_cursor->>'fingerprint' <> v_fingerprint then raise exception 'catalog cursor query mismatch' using errcode = '22023'; end if;

  with candidates as materialized (
    select c.*, coalesce(st_distance(c.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)::integer, 2147483647) as computed_distance,
      case when nullif(trim(coalesce(p_query, '')), '') is null then 0::double precision
           else greatest(similarity(c.name, p_query), similarity(c.venue_name, p_query), similarity(coalesce(c.food_type, ''), p_query)) end as relevance
    from public.catalog_raw_dish_cards c
    where c.release_id = v_release
      and (p_venue_id is null or c.venue_id = p_venue_id)
      and (cardinality(coalesce(p_building_types, '{}')) = 0 or c.building_type = any(p_building_types))
      and (p_open_only = false or c.is_open)
      and (p_max_price is null or c.price <= p_max_price)
      and (cardinality(coalesce(p_cuisine_tags, '{}')) = 0 or c.cuisine_tags && p_cuisine_tags)
      and (cardinality(coalesce(p_dietary_flags, '{}')) = 0 or c.dietary_flags && p_dietary_flags)
      and (p_lat is null or p_lng is null or p_radius_meters is null or st_dwithin(c.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_meters))
      and (nullif(trim(coalesce(p_query, '')), '') is null or c.name % p_query or c.venue_name % p_query or c.name ilike '%' || p_query || '%' or c.venue_name ilike '%' || p_query || '%' or c.food_type ilike '%' || p_query || '%' or c.food_type % p_query)
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
      to_jsonb(visible) - 'listing_location' - 'computed_distance' - 'relevance'
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

commit;
