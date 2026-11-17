begin;
-- Rank all eligible candidates; no pre-limit can discard dietary/taste matches.
create or replace function public.taste_similarity_v2(p_requested jsonb,p_actual jsonb) returns double precision language plpgsql immutable set search_path='' as $$
declare axis text; wanted numeric; actual numeric; distance numeric:=0;
begin
 if p_requested is null then return 0; end if;
 if jsonb_typeof(p_requested)<>'object' then raise exception 'Taste must be an object' using errcode='22023';end if;
 foreach axis in array array['sweet','spicy','sour','salty','rich','aromatic'] loop
  if jsonb_typeof(p_requested->axis) is distinct from 'number' then raise exception 'All taste axes required' using errcode='22023'; end if;
  wanted:=(p_requested->>axis)::numeric;
  if wanted<0 or wanted>10 then raise exception 'Taste axis out of range' using errcode='22023'; end if;
  if jsonb_typeof(p_actual->axis) is distinct from 'number' then return 0; end if;
  actual:=(p_actual->>axis)::numeric; distance:=distance+abs(wanted-actual);
 end loop;
 return greatest(0,1-distance/60)::double precision;
end $$;
revoke all on function public.taste_similarity_v2(jsonb,jsonb) from public;
grant execute on function public.taste_similarity_v2(jsonb,jsonb) to anon,authenticated;


create or replace function public.search_dishes_v2(
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
  p_open_only boolean default false,
  p_taste_values jsonb default null
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
    from dishes d
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
      and not exists (
        select 1 from unnest(params.dietary_flags) as requested(flag)
        where not (
          requested.flag = any(coalesce(d.availability_flags,'{}'::text[]))
          or requested.flag = any(coalesce(v.dietary_tags,'{}'::text[]))
          or exists(select 1 from dish_dietary_flags ddf join dietary_flags df on df.id=ddf.dietary_flag_id where ddf.dish_id=d.id and df.slug::text=requested.flag)
        )
      )
      and coalesce(app_private.residential_privacy_v2(v.id),'exact')<>'hidden'
      and (params.query is null or greatest(similarity(d.name,params.query),similarity(v.name,params.query))>0.1 or d.name ilike '%'||params.query||'%' or v.name ilike '%'||params.query||'%' or array_to_string(d.taste_tags,' ') ilike '%'||params.query||'%' or array_to_string(d.cuisine_tags,' ') ilike '%'||params.query||'%' or array_to_string(v.cuisine_tags,' ') ilike '%'||params.query||'%')
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
        case when p_taste_values is null then
          (0.55 * lean_candidates.text_score)+(0.25 * lean_candidates.rating_score)+(0.20 * lean_candidates.distance_score)
        else (0.40 * lean_candidates.text_score)+(0.20 * lean_candidates.rating_score)+(0.15 * lean_candidates.distance_score)
          +(0.25 * public.taste_similarity_v2(p_taste_values, (select jsonb_build_object('sweet',sweet,'spicy',spicy,'sour',sour,'salty',salty,'rich',rich,'aromatic',aromatic) from public.dish_taste_vectors where dish_id=lean_candidates.dish_id))) end
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

grant execute on function public.search_dishes_v2(
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
  boolean,
  jsonb
) to anon, authenticated;

create or replace function public.get_public_portfolio(p_portfolio_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'description', p.description,
    'type', p.type,
    'owner_display_name', up.display_name,
    'updated_at', p.updated_at,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'item_type', i.item_type,
          'dish_id', i.dish_id,
          'stall_id', coalesce(i.stall_id, d.venue_id),
          'name', coalesce(d.name, v.name),
          'stall_name', coalesce(dv.name, v.name),
          'price', d.price,
          'score', i.score,
          'public_notes', i.public_notes,
          'image_url', public.catalog_display_image_url(d.image_url,d.media_approved_for_display,d.media_rights_status,d.media_source_url),
          'map_query', case when exists(select 1 from public.merchant_outlets mo where mo.venue_id=coalesce(i.stall_id,d.venue_id) and mo.business_type='home_based' and mo.location_privacy<>'exact') then null else nullif(concat_ws(', ',
            coalesce(dv.name, v.name),
            coalesce(dv.unit_number, v.unit_number),
            b.name,
            coalesce(dv.address, v.address, b.address),
            'Singapore ' || coalesce(dv.postal_code, v.postal_code, b.postal_code)
          ), '') end
        )
        order by i.position, i.created_at
      )
      from public.portfolio_items i
      left join public.dishes d on d.id = i.dish_id
      left join public.venues dv on dv.id = d.venue_id
      left join public.venues v on v.id = i.stall_id
      left join public.buildings b on b.id = coalesce(dv.building_id, v.building_id)
      where i.portfolio_id = p.id and coalesce(app_private.residential_privacy_v2(coalesce(i.stall_id,d.venue_id)),'exact')<>'hidden'
    ), '[]'::jsonb)
  )
  from public.portfolios p
  left join public.user_profiles up on up.id = p.owner_id
  where p.id = p_portfolio_id and p.visibility = 'public' and not public.app_user_block_exists(auth.uid(),p.owner_id) and not exists(select 1 from public.portfolio_flags f where f.portfolio_id=p.id and f.status='removed');
$$;

revoke all on function public.get_public_portfolio(uuid) from public;
grant execute on function public.get_public_portfolio(uuid) to anon, authenticated;

create or replace function app_private.get_public_portfolio(p_portfolio_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select public.get_public_portfolio(p_portfolio_id) $$;

create or replace function public.taste_cosine_v2(p_requested double precision[],p_actual jsonb) returns double precision language plpgsql immutable set search_path='' as $$
declare axes text[]:=array['sweet','spicy','sour','salty','rich','aromatic']; i integer; wanted double precision; actual double precision; dot double precision:=0; a_norm double precision:=0;b_norm double precision:=0;
begin
 if cardinality(p_requested)<>6 then raise exception 'Six taste axes required' using errcode='22023';end if;
 for i in 1..6 loop
  wanted:=p_requested[i];actual:=(p_actual->>axes[i])::double precision;
  if wanted is null or wanted<0 or wanted>10 or wanted='NaN'::double precision then raise exception 'Invalid taste axis' using errcode='22023';end if;
  if actual is null then return 0;end if;
  dot:=dot+wanted*actual;a_norm:=a_norm+wanted*wanted;b_norm:=b_norm+actual*actual;
 end loop;
 if a_norm=0 or b_norm=0 then return 0;end if;return greatest(0,least(1,dot/sqrt(a_norm*b_norm)));
end $$;
revoke all on function public.taste_cosine_v2(double precision[],jsonb) from public;grant execute on function public.taste_cosine_v2(double precision[],jsonb) to anon,authenticated;
create or replace function public.get_taste_recommendations_v2(
  p_surface text,
  p_user_vector double precision[],
  p_dietary_flags text[] default '{}'::text[],
  p_query text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_meters integer default null,
  p_exclude_dish_ids text[] default '{}'::text[],
  p_limit integer default 20,
  p_max_price numeric default null,
  p_preferred_cuisines text[] default '{}'
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
      coalesce(p_user_vector,array[5,5,5,5,5,5]::double precision[]) as user_vector,
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
      public.taste_cosine_v2(params.user_vector,jsonb_build_object('sweet',dtv.sweet,'spicy',dtv.spicy,'sour',dtv.sour,'salty',dtv.salty,'rich',dtv.rich,'aromatic',dtv.aromatic)) as vector_score,
      case when d.cuisine_tags && coalesce(p_preferred_cuisines,'{}'::text[]) or v.cuisine_tags && coalesce(p_preferred_cuisines,'{}'::text[]) then 1::double precision else 0::double precision end as cuisine_score,
      case
        when params.lat is not null and params.lng is not null then
          greatest(
            0,
            1 - (
              st_distance(
                coalesce(v.location,b.location),
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
    where dtv.sweet is not null and dtv.spicy is not null and dtv.sour is not null and dtv.salty is not null and dtv.rich is not null and dtv.aromatic is not null
      and (p_max_price is null or d.price<=p_max_price)
      and coalesce(app_private.residential_privacy_v2(v.id),'exact')<>'hidden'
      and public.catalog_menu_is_displayable(d.menu_approved_for_display,d.menu_rights_status,d.menu_source_url)
      and not (d.id = any(params.exclude_dish_ids))
      and (
        cardinality(params.dietary_flags) = 0
        or not exists (
          select 1
          from unnest(params.dietary_flags) as requested(flag)
          where not (requested.flag=any(coalesce(d.availability_flags,'{}'::text[])) or requested.flag=any(coalesce(v.dietary_tags,'{}'::text[])) or exists (
            select 1 from dish_dietary_flags ddf join dietary_flags df on df.id=ddf.dietary_flag_id where ddf.dish_id=d.id and df.slug::text=requested.flag))
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
            coalesce(v.location,b.location),
            st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography,
            params.radius_filter_meters
          )
        )
        or (
          (params.lat is null or params.lng is null)
          and d.distance_meters <= params.radius_filter_meters
        )
      )

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
      ) * case when cardinality(coalesce(p_preferred_cuisines,'{}'::text[]))>0 then 0.95 else 1 end + case when cardinality(coalesce(p_preferred_cuisines,'{}'::text[]))>0 then 0.05*tg.cuisine_score else 0 end as match_score,
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

revoke all on function public.get_taste_recommendations_v2(text,double precision[],text[],text,double precision,double precision,integer,text[],integer,numeric,text[]) from public;
grant execute on function public.get_taste_recommendations_v2(text,double precision[],text[],text,double precision,double precision,integer,text[],integer,numeric,text[]) to anon,authenticated;

commit;
