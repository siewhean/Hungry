-- Round-two search fixes for the paged catalog (search-M1, M3, M4, M11, L2):
-- * M1/L2  Text queries are capped at 80 characters and must have at least 2 characters;
--          anything shorter returns an empty page instead of scoring most of the catalog.
--          LIKE wildcards in the typed text (% _ \) are matched literally, so "%" no longer
--          matches every row.
-- * M3     A new 'price' sort (cheapest first; dishes and stalls without a price last), and a
--          capped match_count in the page (at most 100: the app shows "100+").
-- * M4     Relevance adds a small capped quality term (at most 0.10): ln(1 + review_count),
--          rating, verification and having an approved photo. The cursor score is the same
--          relevance value, so paging is unchanged.
-- * M11    New p_food_keywords: the Noodles and Rice chips match dishes by food type or name
--          (and stalls that sell such a dish) instead of exact cuisine tags.
-- Bodies are copied from 20261021150000_catalog_search_distance_places_stall_dishes.sql with
-- only those changes. Both functions stay SECURITY DEFINER with search_path public, extensions
-- and are executable by anon and authenticated. Adding a parameter changes the signature, so
-- the previous signatures are dropped first (PostgREST would otherwise see two overloads).
--
-- statement_timeout is deliberately not set here: a function-level SET does not re-arm the
-- timer of the statement that is already running. Set a role-level timeout for anon and
-- authenticated (and edge rate limiting) outside the migrations.

drop function if exists public.catalog_raw_dishes_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text, text[]);
drop function if exists public.catalog_raw_venues_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text[]);

create or replace function public.catalog_raw_dishes_page(
  p_query text default null, p_lat double precision default null, p_lng double precision default null,
  p_radius_meters integer default null, p_cuisine_tags text[] default '{}', p_dietary_flags text[] default '{}',
  p_max_price numeric default null, p_open_only boolean default false, p_sort text default 'quality',
  p_cursor text default null, p_release_id uuid default null, p_limit integer default 24, p_venue_id text default null,
  p_building_types text[] default '{}', p_food_keywords text[] default '{}'
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_release uuid; v_cursor jsonb; v_fingerprint text; v_limit integer := least(greatest(coalesce(p_limit, 24), 1), 50);
  v_items jsonb; v_next text; v_count integer; v_match_count integer;
  v_query text := left(nullif(trim(coalesce(p_query, '')), ''), 80);
  v_like text;
  v_food_patterns text[];
  v_totals jsonb;
begin
  perform public.catalog_raw_require_authenticated();
  v_release := public.catalog_raw_release_for_read(p_release_id);
  v_totals := (select jsonb_build_object('venues', venue_total, 'dishes', dish_total) from public.catalog_releases where id = v_release);
  -- One character matches most of the catalog; the app asks for at least two.
  if v_query is not null and char_length(v_query) < 2 then
    return jsonb_build_object('items', '[]'::jsonb, 'next_cursor', null, 'release_id', v_release, 'match_count', 0, 'totals', v_totals);
  end if;
  v_like := '%' || replace(replace(replace(coalesce(v_query, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_food_patterns := coalesce((
    select array_agg('%' || replace(replace(replace(k.keyword, '\', '\\'), '%', '\%'), '_', '\_') || '%')
    from (
      select left(trim(raw.keyword), 40) as keyword
      from unnest(coalesce(p_food_keywords, '{}')) as raw(keyword)
      where nullif(trim(raw.keyword), '') is not null
      limit 12
    ) k
  ), '{}');
  v_fingerprint := md5(concat_ws('|', coalesce(lower(v_query), ''), coalesce(p_lat::text, ''), coalesce(p_lng::text, ''), coalesce(p_radius_meters::text, ''), array_to_string(coalesce(p_cuisine_tags, '{}'), ','), array_to_string(coalesce(p_dietary_flags, '{}'), ','), array_to_string(coalesce(p_building_types, '{}'), ','), array_to_string(v_food_patterns, ','), coalesce(p_max_price::text, ''), p_open_only::text, p_sort, coalesce(p_venue_id, '')));
  v_cursor := case when p_cursor is null then null else public.catalog_raw_cursor_value(p_cursor) end;
  if v_cursor is not null and (v_cursor->>'release_id')::uuid <> v_release then raise exception 'catalog cursor release mismatch' using errcode = '22023'; end if;
  if v_cursor is not null and v_cursor->>'fingerprint' <> v_fingerprint then raise exception 'catalog cursor query mismatch' using errcode = '22023'; end if;

  with candidates as materialized (
    select c.*, coalesce(st_distance(c.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)::integer, 2147483647) as computed_distance,
      coalesce(c.price, 1000000)::double precision as price_key,
      case when v_query is null then 0::double precision
           -- Text match first, plus up to 0.15 for being close (half-weight at ~2 km), plus up to
           -- 0.10 for quality: reviews (log-scaled, full at 50), rating, verification, a photo.
           else greatest(similarity(c.name, v_query), similarity(c.venue_name, v_query), similarity(coalesce(c.food_type, ''), v_query), similarity(coalesce(c.building_name, ''), v_query))
             + coalesce(0.15 * exp(-st_distance(c.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 3000.0), 0)
             + 0.04 * least(ln(1 + greatest(c.review_count, 0)::double precision) / ln(51::double precision), 1)
             + 0.03 * least(greatest(c.rating, 0)::double precision, 5) / 5
             + case when c.verification_status in ('verified', 'approved') then 0.02 else 0 end
             + case when c.image_url is not null then 0.01 else 0 end end as relevance
    from public.catalog_raw_dish_cards c
    where c.release_id = v_release
      and (p_venue_id is null or c.venue_id = p_venue_id)
      and (cardinality(coalesce(p_building_types, '{}')) = 0 or c.building_type = any(p_building_types))
      and (p_open_only = false or c.is_open)
      and (p_max_price is null or c.price <= p_max_price)
      and (cardinality(coalesce(p_cuisine_tags, '{}')) = 0 or c.cuisine_tags && p_cuisine_tags)
      and (cardinality(coalesce(p_dietary_flags, '{}')) = 0 or c.dietary_flags @> p_dietary_flags)
      and (cardinality(v_food_patterns) = 0 or c.food_type ilike any(v_food_patterns) or c.name ilike any(v_food_patterns))
      and (p_lat is null or p_lng is null or p_radius_meters is null or st_dwithin(c.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_meters))
      and (v_query is null or c.name % v_query or c.venue_name % v_query or c.name ilike v_like or c.venue_name ilike v_like or c.food_type ilike v_like or c.food_type % v_query
        or c.building_name ilike v_like or c.building_name % v_query)
  ), page as materialized (
    select * from candidates c
    where v_cursor is null
      or (p_sort = 'nearby' and (c.computed_distance > coalesce((v_cursor->>'distance')::integer, -1) or (c.computed_distance = (v_cursor->>'distance')::integer and c.id > v_cursor->>'id')))
      or (p_sort = 'relevance' and (c.relevance < (v_cursor->>'score')::double precision or (c.relevance = (v_cursor->>'score')::double precision and c.id > v_cursor->>'id')))
      or (p_sort = 'price' and (c.price_key > (v_cursor->>'score')::double precision or (c.price_key = (v_cursor->>'score')::double precision and c.id > v_cursor->>'id')))
      or (p_sort not in ('nearby', 'relevance', 'price') and (
        c.rating < (v_cursor->>'score')::numeric
        or (c.rating = (v_cursor->>'score')::numeric and (
          c.review_count < coalesce((v_cursor->>'review_count')::integer, 0)
          or (c.review_count = coalesce((v_cursor->>'review_count')::integer, 0) and c.id > v_cursor->>'id')
        ))
      ))
    order by
      case when p_sort = 'nearby' then c.computed_distance end asc,
      case when p_sort = 'relevance' then c.relevance end desc,
      case when p_sort = 'price' then c.price_key end asc,
      case when p_sort not in ('nearby', 'relevance', 'price') then c.rating end desc,
      case when p_sort not in ('nearby', 'relevance', 'price') then c.review_count end desc,
      c.id asc
    limit v_limit + 1
  ), visible as (select * from page limit v_limit), tail as (select * from page offset v_limit limit 1), cursor_row as (
    select * from visible
    where exists (select 1 from tail)
    order by
      case when p_sort = 'nearby' then computed_distance end desc,
      case when p_sort = 'relevance' then relevance end asc,
      case when p_sort = 'price' then price_key end desc,
      case when p_sort not in ('nearby', 'relevance', 'price') then rating end asc,
      case when p_sort not in ('nearby', 'relevance', 'price') then review_count end asc,
      id desc
    limit 1
  )
  select
    coalesce(jsonb_agg(
      -- The real distance from the viewer replaces the stored distance_meters column.
      (to_jsonb(visible) - 'listing_location' - 'computed_distance' - 'relevance' - 'price_key')
        || jsonb_build_object('distance_meters', nullif(computed_distance, 2147483647))
      order by
        case when p_sort = 'nearby' then computed_distance end asc,
        case when p_sort = 'relevance' then relevance end desc,
        case when p_sort = 'price' then price_key end asc,
        case when p_sort not in ('nearby', 'relevance', 'price') then rating end desc,
        case when p_sort not in ('nearby', 'relevance', 'price') then review_count end desc,
        id asc
    ), '[]'::jsonb),
    count(*)::integer,
    (select public.catalog_raw_cursor(jsonb_build_object('release_id', v_release, 'fingerprint', v_fingerprint, 'id', id, 'distance', computed_distance, 'review_count', review_count, 'score', case when p_sort = 'nearby' then computed_distance else case when p_sort = 'relevance' then relevance else case when p_sort = 'price' then price_key else rating::double precision end end end)) from cursor_row),
    -- Capped at 100 so counting stays cheap; the candidate set is already materialised.
    (select count(*)::integer from (select 1 from candidates limit 100) capped)
  into v_items, v_count, v_next, v_match_count
  from visible;
  return jsonb_build_object('items', v_items, 'next_cursor', v_next, 'release_id', v_release, 'match_count', v_match_count, 'totals', v_totals);
end;
$$;

-- Guests browse the catalog too (20261019210000_guest_catalog_raw_reads.sql).
revoke all on function public.catalog_raw_dishes_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text, text[], text[]) from public;
grant execute on function public.catalog_raw_dishes_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text, text[], text[]) to anon, authenticated;

create or replace function public.catalog_raw_venues_page(
  p_query text default null, p_lat double precision default null, p_lng double precision default null, p_radius_meters integer default null,
  p_cuisine_tags text[] default '{}', p_dietary_flags text[] default '{}', p_max_price numeric default null, p_open_only boolean default false,
  p_sort text default 'quality', p_cursor text default null, p_release_id uuid default null, p_limit integer default 24,
  p_building_types text[] default '{}', p_food_keywords text[] default '{}'
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_release uuid; v_limit integer := least(greatest(coalesce(p_limit, 24), 1), 50); v_items jsonb; v_next text; v_fingerprint text; v_cursor jsonb;
  v_match_count integer;
  v_query text := left(nullif(trim(coalesce(p_query, '')), ''), 80);
  v_like text;
  v_food_patterns text[];
  v_totals jsonb;
begin
  perform public.catalog_raw_require_authenticated(); v_release := public.catalog_raw_release_for_read(p_release_id);
  v_totals := (select jsonb_build_object('venues', venue_total, 'dishes', dish_total) from public.catalog_releases where id = v_release);
  if v_query is not null and char_length(v_query) < 2 then
    return jsonb_build_object('items', '[]'::jsonb, 'next_cursor', null, 'release_id', v_release, 'match_count', 0, 'totals', v_totals);
  end if;
  v_like := '%' || replace(replace(replace(coalesce(v_query, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_food_patterns := coalesce((
    select array_agg('%' || replace(replace(replace(k.keyword, '\', '\\'), '%', '\%'), '_', '\_') || '%')
    from (
      select left(trim(raw.keyword), 40) as keyword
      from unnest(coalesce(p_food_keywords, '{}')) as raw(keyword)
      where nullif(trim(raw.keyword), '') is not null
      limit 12
    ) k
  ), '{}');
  v_fingerprint := md5(concat_ws('|', coalesce(lower(v_query), ''), coalesce(p_lat::text, ''), coalesce(p_lng::text, ''), coalesce(p_radius_meters::text, ''), array_to_string(coalesce(p_cuisine_tags, '{}'), ','), array_to_string(coalesce(p_dietary_flags, '{}'), ','), array_to_string(coalesce(p_building_types, '{}'), ','), array_to_string(v_food_patterns, ','), coalesce(p_max_price::text, ''), p_open_only::text, p_sort));
  v_cursor := case when p_cursor is null then null else public.catalog_raw_cursor_value(p_cursor) end;
  if v_cursor is not null and ((v_cursor->>'release_id')::uuid <> v_release or v_cursor->>'fingerprint' <> v_fingerprint) then raise exception 'catalog cursor mismatch' using errcode = '22023'; end if;
  with dish_matches as materialized (
    -- Stalls whose dishes or food types in this release match the query, with the best match score.
    select dc.venue_id, max(greatest(similarity(dc.name, v_query), similarity(coalesce(dc.food_type, ''), v_query))) as score
    from public.catalog_raw_dish_cards dc
    where v_query is not null
      and dc.release_id = v_release
      and (dc.name % v_query or dc.name ilike v_like or dc.food_type ilike v_like or dc.food_type % v_query)
    group by dc.venue_id
  ), food_matches as materialized (
    -- Stalls that sell a dish of the requested food types (Noodles, Rice chips), near the viewer when a radius is set.
    select distinct dc.venue_id
    from public.catalog_raw_dish_cards dc
    where cardinality(v_food_patterns) > 0
      and dc.release_id = v_release
      and (dc.food_type ilike any(v_food_patterns) or dc.name ilike any(v_food_patterns))
      and (p_lat is null or p_lng is null or p_radius_meters is null or st_dwithin(dc.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_meters))
  ), candidates as materialized (
    select c.*, coalesce(st_distance(c.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)::integer, 2147483647) as computed_distance,
      coalesce(c.min_price, 1000000)::double precision as price_key,
      case when v_query is null then 0::double precision
           else greatest(similarity(c.name, v_query), similarity(coalesce(c.building_name, ''), v_query), coalesce(dm.score, 0))
             + coalesce(0.15 * exp(-st_distance(c.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 3000.0), 0)
             + 0.04 * least(ln(1 + greatest(c.quality_review_count, 0)::double precision) / ln(51::double precision), 1)
             + 0.03 * least(greatest(c.quality_rating, 0)::double precision, 5) / 5
             + case when c.verification_status in ('verified', 'approved') then 0.02 else 0 end
             + case when c.image_url is not null then 0.01 else 0 end end as relevance
    from public.catalog_raw_venue_cards c
    left join dish_matches dm on dm.venue_id = c.id
    left join food_matches fm on fm.venue_id = c.id
    where c.release_id = v_release and (p_open_only = false or c.is_open)
      and (cardinality(coalesce(p_building_types, '{}')) = 0 or c.building_type = any(p_building_types))
      and (cardinality(coalesce(p_cuisine_tags, '{}')) = 0 or c.cuisine_tags && p_cuisine_tags)
      and (cardinality(coalesce(p_dietary_flags, '{}')) = 0 or c.dietary_flags @> p_dietary_flags)
      and (cardinality(v_food_patterns) = 0 or fm.venue_id is not null)
      and (p_max_price is null or c.min_price <= p_max_price)
      and (p_lat is null or p_lng is null or p_radius_meters is null or st_dwithin(c.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_meters))
      and (v_query is null or c.name % v_query or c.name ilike v_like
        or c.building_name % v_query or c.building_name ilike v_like or dm.venue_id is not null)
  ), page as materialized (
    select * from candidates c where v_cursor is null
      or (p_sort = 'nearby' and (c.computed_distance > (v_cursor->>'distance')::integer or (c.computed_distance = (v_cursor->>'distance')::integer and (lower(c.name) > v_cursor->>'name' or (lower(c.name) = v_cursor->>'name' and c.id > v_cursor->>'id')))))
      or (p_sort = 'relevance' and (c.relevance < (v_cursor->>'score')::double precision or (c.relevance = (v_cursor->>'score')::double precision and (lower(c.name) > v_cursor->>'name' or (lower(c.name) = v_cursor->>'name' and c.id > v_cursor->>'id')))))
      or (p_sort = 'price' and (c.price_key > (v_cursor->>'score')::double precision or (c.price_key = (v_cursor->>'score')::double precision and (lower(c.name) > v_cursor->>'name' or (lower(c.name) = v_cursor->>'name' and c.id > v_cursor->>'id')))))
      or (p_sort not in ('nearby', 'relevance', 'price') and (c.quality_rating < (v_cursor->>'score')::numeric or (c.quality_rating = (v_cursor->>'score')::numeric and (c.quality_review_count < (v_cursor->>'review_count')::integer or (c.quality_review_count = (v_cursor->>'review_count')::integer and (lower(c.name) > v_cursor->>'name' or (lower(c.name) = v_cursor->>'name' and c.id > v_cursor->>'id')))))))
    order by case when p_sort = 'nearby' then c.computed_distance end asc, case when p_sort = 'relevance' then c.relevance end desc, case when p_sort = 'price' then c.price_key end asc, case when p_sort not in ('nearby', 'relevance', 'price') then c.quality_rating end desc, case when p_sort not in ('nearby', 'relevance', 'price') then c.quality_review_count end desc, lower(c.name) asc, c.id asc limit v_limit + 1
  ), visible as (select * from page limit v_limit), tail as (select * from page offset v_limit limit 1), cursor_row as (
    select * from visible
    where exists (select 1 from tail)
    order by
      case when p_sort = 'nearby' then computed_distance end desc,
      case when p_sort = 'relevance' then relevance end asc,
      case when p_sort = 'price' then price_key end desc,
      case when p_sort not in ('nearby', 'relevance', 'price') then quality_rating end asc,
      case when p_sort not in ('nearby', 'relevance', 'price') then quality_review_count end asc,
      lower(name) desc,
      id desc
    limit 1
  )
  select
    coalesce(jsonb_agg(
      -- Venue cards have no stored distance; report the real one from the viewer.
      (to_jsonb(visible) - 'listing_location' - 'computed_distance' - 'relevance' - 'price_key')
        || jsonb_build_object('distance_meters', nullif(computed_distance, 2147483647))
      order by
        case when p_sort = 'nearby' then computed_distance end asc,
        case when p_sort = 'relevance' then relevance end desc,
        case when p_sort = 'price' then price_key end asc,
        case when p_sort not in ('nearby', 'relevance', 'price') then quality_rating end desc,
        case when p_sort not in ('nearby', 'relevance', 'price') then quality_review_count end desc,
        lower(name) asc,
        id asc
    ), '[]'::jsonb),
    (select public.catalog_raw_cursor(jsonb_build_object('release_id', v_release, 'fingerprint', v_fingerprint, 'id', id, 'name', lower(name), 'distance', computed_distance, 'review_count', quality_review_count, 'score', case when p_sort = 'nearby' then computed_distance else case when p_sort = 'relevance' then relevance else case when p_sort = 'price' then price_key else quality_rating::double precision end end end)) from cursor_row),
    (select count(*)::integer from (select 1 from candidates limit 100) capped)
  into v_items, v_next, v_match_count
  from visible;
  return jsonb_build_object('items', v_items, 'next_cursor', v_next, 'release_id', v_release, 'match_count', v_match_count, 'totals', v_totals);
end;
$$;

-- Guests browse the catalog too (20261019210000_guest_catalog_raw_reads.sql).
revoke all on function public.catalog_raw_venues_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text[], text[]) from public;
grant execute on function public.catalog_raw_venues_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text[], text[]) to anon, authenticated;
