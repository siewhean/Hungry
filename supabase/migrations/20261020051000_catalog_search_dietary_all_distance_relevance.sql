-- Search review fixes for the paged catalog (dishes and stalls):
-- * Dietary filters mean "all of" (@>), matching the client, instead of "any of" (&&).
-- * Text relevance adds a small distance decay when the viewer's location is known, so a
--   close match ranks above an equally good far one. The cursor stores the same score.
-- * Trigram indexes for the other searched columns (venue_name, food_type) on dish cards.
-- Bodies are copied from 20261018170000_dish_food_types.sql and
-- 20260713120000_versioned_raw_catalog_reads.sql with only those changes; grants are re-stated.

create index if not exists catalog_raw_dish_cards_venue_name_trgm_idx
  on public.catalog_raw_dish_cards using gin (venue_name gin_trgm_ops);
create index if not exists catalog_raw_dish_cards_food_type_trgm_idx
  on public.catalog_raw_dish_cards using gin (food_type gin_trgm_ops)
  where food_type is not null;

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
           -- Text match first, plus up to 0.15 for being close (half-weight at ~2 km).
           else greatest(similarity(c.name, p_query), similarity(c.venue_name, p_query), similarity(coalesce(c.food_type, ''), p_query))
             + coalesce(0.15 * exp(-st_distance(c.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 3000.0), 0) end as relevance
    from public.catalog_raw_dish_cards c
    where c.release_id = v_release
      and (p_venue_id is null or c.venue_id = p_venue_id)
      and (cardinality(coalesce(p_building_types, '{}')) = 0 or c.building_type = any(p_building_types))
      and (p_open_only = false or c.is_open)
      and (p_max_price is null or c.price <= p_max_price)
      and (cardinality(coalesce(p_cuisine_tags, '{}')) = 0 or c.cuisine_tags && p_cuisine_tags)
      and (cardinality(coalesce(p_dietary_flags, '{}')) = 0 or c.dietary_flags @> p_dietary_flags)
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

revoke all on function public.catalog_raw_dishes_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text, text[]) from public, anon;
grant execute on function public.catalog_raw_dishes_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text, text[]) to authenticated;

create or replace function public.catalog_raw_venues_page(
  p_query text default null, p_lat double precision default null, p_lng double precision default null, p_radius_meters integer default null,
  p_cuisine_tags text[] default '{}', p_dietary_flags text[] default '{}', p_max_price numeric default null, p_open_only boolean default false,
  p_sort text default 'quality', p_cursor text default null, p_release_id uuid default null, p_limit integer default 24,
  p_building_types text[] default '{}'
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_release uuid; v_limit integer := least(greatest(coalesce(p_limit, 24), 1), 50); v_items jsonb; v_next text; v_fingerprint text; v_cursor jsonb;
begin
  perform public.catalog_raw_require_authenticated(); v_release := public.catalog_raw_release_for_read(p_release_id);
  v_fingerprint := md5(concat_ws('|', coalesce(lower(trim(p_query)), ''), coalesce(p_lat::text, ''), coalesce(p_lng::text, ''), coalesce(p_radius_meters::text, ''), array_to_string(coalesce(p_cuisine_tags, '{}'), ','), array_to_string(coalesce(p_dietary_flags, '{}'), ','), array_to_string(coalesce(p_building_types, '{}'), ','), coalesce(p_max_price::text, ''), p_open_only::text, p_sort));
  v_cursor := case when p_cursor is null then null else public.catalog_raw_cursor_value(p_cursor) end;
  if v_cursor is not null and ((v_cursor->>'release_id')::uuid <> v_release or v_cursor->>'fingerprint' <> v_fingerprint) then raise exception 'catalog cursor mismatch' using errcode = '22023'; end if;
  with candidates as materialized (
    select c.*, coalesce(st_distance(c.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)::integer, 2147483647) as computed_distance,
      case when nullif(trim(coalesce(p_query, '')), '') is null then 0::double precision else similarity(c.name, p_query) + coalesce(0.15 * exp(-st_distance(c.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 3000.0), 0) end as relevance
    from public.catalog_raw_venue_cards c where c.release_id = v_release and (p_open_only = false or c.is_open)
      and (cardinality(coalesce(p_building_types, '{}')) = 0 or c.building_type = any(p_building_types))
      and (cardinality(coalesce(p_cuisine_tags, '{}')) = 0 or c.cuisine_tags && p_cuisine_tags)
      and (cardinality(coalesce(p_dietary_flags, '{}')) = 0 or c.dietary_flags @> p_dietary_flags)
      and (p_max_price is null or c.min_price <= p_max_price)
      and (p_lat is null or p_lng is null or p_radius_meters is null or st_dwithin(c.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_meters))
      and (nullif(trim(coalesce(p_query, '')), '') is null or c.name % p_query or c.name ilike '%' || p_query || '%')
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
      to_jsonb(visible) - 'listing_location' - 'computed_distance' - 'relevance'
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

revoke all on function public.catalog_raw_venues_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text[]) from public, anon;
grant execute on function public.catalog_raw_venues_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text[]) to authenticated;
