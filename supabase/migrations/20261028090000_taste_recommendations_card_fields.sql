-- smoke: supabase/smoke/taste_recommendations_card_fields.sql
-- Onboarding round four, ONB-X1: get_taste_recommendations returns the card itself.
-- Until now it returned only dish ids, and the app turned each id into a dish from the full
-- catalog download (7,863 buildings, 29,611 venues). On a phone that has not downloaded the
-- catalog yet (onboarding, a signed-out first run) that meant the first picks either waited for
-- the whole download or showed nothing, and a card had no stall pin to measure distance from.
--
-- The first five columns and the ranking are unchanged. New columns carry what a card shows:
-- stall name, unit and floor, price, rating, photo (the dish's own, rights-checked), food type,
-- taste tags and vector, dietary flags, and the stall pin (venue latitude/longitude, else the
-- building's). distance_meters is now the distance from the caller when a position is sent.
-- The candidates also pass the checks the published catalog applies (shown rights, not archived,
-- not a merchant draft, not at a hidden non-food venue), because there is no catalog behind the
-- cards any more.
--
-- The return type changes, so the function is dropped and created again: signature, volatility
-- (the rate limiter needs VOLATILE), search_path and grants are put back exactly as they were.
-- Down: supabase/rollbacks/20261028090000_taste_recommendations_card_fields.down.sql.

drop function if exists public.get_taste_recommendations(
  text,
  double precision[],
  text[],
  text,
  double precision,
  double precision,
  integer,
  text[],
  integer
);

create function public.get_taste_recommendations(
  p_surface text,
  p_user_vector double precision[],
  p_dietary_flags text[] default '{}'::text[],
  p_query text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_meters integer default null,
  p_exclude_dish_ids text[] default '{}'::text[],
  p_limit integer default 20
)
returns table (
  dish_id text,
  match_score double precision,
  match_percent integer,
  match_reason text,
  is_serendipitous boolean,
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
  food_type text,
  taste_tags text[],
  taste_vector jsonb,
  dietary_flags text[],
  latitude double precision,
  longitude double precision
)
language sql
volatile
security invoker
set search_path = public, extensions
as $$
  with params as (
    select
      (
        '[' ||
        array_to_string(coalesce(p_user_vector, array[5, 5, 5, 5, 5, 5]::double precision[]), ',') ||
        ']'
      )::vector(6) as user_vector,
      coalesce(p_dietary_flags, '{}'::text[]) as dietary_flags,
      nullif(trim(coalesce(p_query, '')), '') as query,
      p_lat as lat,
      p_lng as lng,
      nullif(p_radius_meters, 0) as radius_filter_meters,
      greatest(coalesce(p_radius_meters, 2500), 1) as score_radius_meters,
      coalesce(p_exclude_dish_ids, '{}'::text[]) as exclude_dish_ids,
      greatest(coalesce(p_limit, 20), 1) as result_limit
  ),
  -- Tag -> 0-1 affinity from the caller's favourites (RLS limits this to auth.uid()).
  liked_tag_counts as (
    select lower(trim(tag)) as tag, count(*)::double precision as tag_count
    from user_favourite_dishes f
    join dishes d on d.id = f.dish_id
    cross join lateral unnest(d.taste_tags) as tag
    where f.user_id = auth.uid()
      and trim(tag) <> ''
    group by lower(trim(tag))
  ),
  tag_affinity as (
    select tag, tag_count / max(tag_count) over () as affinity
    from liked_tag_counts
  ),
  vector_candidates as (
    select
      d.id as dish_id,
      d.name,
      d.distance_meters,
      d.rating_avg,
      d.taste_tags,
      d.venue_id,
      d.building_id,
      v.name as venue_name,
      v.unit_number,
      v.floor,
      d.food_type,
      d.price,
      d.price_range,
      d.review_count,
      d.blurhash,
      -- Only the dish's own photo: a stall photo on a dish card would show the wrong food.
      public.catalog_display_image_url(
        d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url
      ) as display_image_url,
      coalesce(v.latitude, b.latitude) as pin_latitude,
      coalesce(v.longitude, b.longitude) as pin_longitude,
      case
        when params.lat is not null and params.lng is not null then
          st_distance(
            b.location,
            st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography
          )::integer
        else d.distance_meters
      end as distance_from_user,
      dtv.sweet,
      dtv.spicy,
      dtv.sour,
      dtv.salty,
      dtv.rich,
      dtv.aromatic,
      case
        when dtv.source = 'default' then 1::double precision
        else least(greatest(dtv.confidence::double precision, 0), 1)
      end as confidence,
      greatest(0, 1 - (dtv.vector <=> params.user_vector)) as vector_score,
      case
        when params.lat is not null and params.lng is not null then
          greatest(
            0,
            1 - (
              st_distance(
                b.location,
                st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography
              ) / params.score_radius_meters
            )
          )
        else greatest(0, 1 - (d.distance_meters::double precision / params.score_radius_meters))
      end as distance_score,
      least(greatest(d.rating_avg::double precision / 5, 0), 1) as rating_score
    from dishes d
    join dish_taste_vectors dtv on dtv.dish_id = d.id
    join venues v on v.id = d.venue_id
    join buildings b on b.id = d.building_id
    cross join params
    where dtv.vector is not null
      -- The cards are shown as they are (no catalog download behind them), so a dish must pass
      -- the same checks the published catalog applies: shown rights, on the menu, not a draft,
      -- and not at a venue that is not a place to eat.
      and d.archived_at is null
      and not d.merchant_draft
      and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
      and not exists (select 1 from app_private.catalog_excluded_venues ex where ex.venue_id = d.venue_id)
      and not (d.id = any(params.exclude_dish_ids))
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
        params.query is null
        or concat_ws(' ', d.name, v.name, array_to_string(d.taste_tags, ' ')) ilike '%' || params.query || '%'
      )
      and (
        params.radius_filter_meters is null
        or (
          params.lat is not null
          and params.lng is not null
          and st_dwithin(
            b.location,
            st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography,
            params.radius_filter_meters
          )
        )
        or (
          (params.lat is null or params.lng is null)
          and d.distance_meters <= params.radius_filter_meters
        )
      )
    order by dtv.vector <=> params.user_vector
    limit (select greatest(result_limit * 5, 50) from params)
  ),
  tagged as (
    select
      vc.*,
      case
        when exists (select 1 from tag_affinity) then
          0.80 * vc.vector_score +
          0.20 * least(
            1,
            coalesce(
              (
                select sum(ta.affinity)
                from tag_affinity ta
                where ta.tag in (
                  select distinct lower(trim(t)) from unnest(vc.taste_tags) as t
                )
              ),
              0
            )
          )
        else vc.vector_score
      end as taste_score
    from vector_candidates vc
  ),
  scored as (
    select
      tg.dish_id,
      tg.venue_id,
      tg.building_id,
      tg.venue_name,
      tg.unit_number,
      tg.floor,
      tg.name,
      tg.display_image_url,
      tg.blurhash,
      tg.distance_from_user,
      tg.rating_avg,
      tg.review_count,
      tg.price,
      tg.price_range,
      tg.food_type,
      tg.taste_tags,
      tg.sweet,
      tg.spicy,
      tg.sour,
      tg.salty,
      tg.rich,
      tg.aromatic,
      tg.pin_latitude,
      tg.pin_longitude,
      (
        0.50 * tg.confidence * tg.taste_score +
        0.15 * 0.5 +
        (0.15 + 0.25 * (1 - tg.confidence)) * tg.distance_score +
        (0.10 + 0.25 * (1 - tg.confidence)) * tg.rating_score +
        0.10 * 0.5
      ) as match_score,
      case
        when greatest(tg.sweet, tg.spicy, tg.sour, tg.salty, tg.rich, tg.aromatic) = tg.spicy then 'Spicy profile match'
        when greatest(tg.sweet, tg.spicy, tg.sour, tg.salty, tg.rich, tg.aromatic) = tg.rich then 'Rich profile match'
        when greatest(tg.sweet, tg.spicy, tg.sour, tg.salty, tg.rich, tg.aromatic) = tg.aromatic then 'Aromatic profile match'
        when greatest(tg.sweet, tg.spicy, tg.sour, tg.salty, tg.rich, tg.aromatic) = tg.salty then 'Savory profile match'
        when greatest(tg.sweet, tg.spicy, tg.sour, tg.salty, tg.rich, tg.aromatic) = tg.sour then 'Tangy profile match'
        else 'Taste profile match'
      end as match_reason
    from tagged tg
  )
  select
    scored.dish_id,
    scored.match_score,
    greatest(0, least(100, round(scored.match_score * 100)::integer)) as match_percent,
    scored.match_reason,
    false as is_serendipitous,
    scored.venue_id,
    scored.building_id,
    scored.venue_name,
    scored.unit_number,
    scored.floor,
    scored.name,
    scored.display_image_url,
    scored.blurhash,
    scored.distance_from_user,
    scored.rating_avg,
    scored.review_count,
    scored.price,
    scored.price_range,
    scored.food_type,
    scored.taste_tags,
    jsonb_build_object(
      'sweet', scored.sweet,
      'spicy', scored.spicy,
      'sour', scored.sour,
      'salty', scored.salty,
      'rich', scored.rich,
      'aromatic', scored.aromatic
    ),
    coalesce((
      select array_agg(df.slug::text order by df.slug::text)
      from dish_dietary_flags ddf
      join dietary_flags df on df.id = ddf.dietary_flag_id
      where ddf.dish_id = scored.dish_id
    ), '{}'::text[]),
    scored.pin_latitude,
    scored.pin_longitude
  from scored
  order by scored.match_score desc, scored.dish_id
  limit (select result_limit from params);
$$;

grant execute on function public.get_taste_recommendations(text, double precision[], text[], text, double precision, double precision, integer, text[], integer) to anon, authenticated;

-- PostgREST caches function signatures with the rest of its schema.
notify pgrst, 'reload schema';
