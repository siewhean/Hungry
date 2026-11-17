-- Taste engine plan, phase 2: server ranking matches the on-device engine (src/lib/ai/tasteEngine.ts).
-- 1. AI-tagged vectors are weighted by their confidence; the taste weight they lose moves to
--    distance and rating in equal halves. Seed/curated ('default') vectors stay fully trusted.
-- 2. When the caller has favourite dishes, 20% of the taste score comes from overlap between a
--    dish's taste tags and the tags of those favourites.
-- Signature and return shape are unchanged, so the app needs no change to call it.

create or replace function public.get_taste_recommendations(
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
  is_serendipitous boolean
)
language sql
stable
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
    false as is_serendipitous
  from scored
  order by scored.match_score desc, scored.dish_id
  limit (select result_limit from params);
$$;
