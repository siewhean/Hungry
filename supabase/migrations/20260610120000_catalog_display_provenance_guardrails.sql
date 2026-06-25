-- Catalog display provenance guardrails.
-- Safe to re-run. Keeps unverified imported media/menu data in canonical tables,
-- but prevents app-facing read RPCs from exposing it until rights are approved.

alter table buildings add column if not exists media_approved_for_display boolean not null default false;
alter table buildings add column if not exists media_rights_status text not null default 'unverified';
alter table buildings add column if not exists media_source_url text;
alter table buildings add column if not exists media_verified_at timestamptz;
alter table buildings add column if not exists media_verified_by uuid;

alter table venues add column if not exists media_approved_for_display boolean not null default false;
alter table venues add column if not exists media_rights_status text not null default 'unverified';
alter table venues add column if not exists media_source_url text;
alter table venues add column if not exists media_verified_at timestamptz;
alter table venues add column if not exists media_verified_by uuid;
alter table venues add column if not exists menu_approved_for_display boolean not null default false;
alter table venues add column if not exists menu_rights_status text not null default 'unverified';
alter table venues add column if not exists menu_source_url text;
alter table venues add column if not exists menu_verified_at timestamptz;
alter table venues add column if not exists menu_verified_by uuid;

alter table dishes add column if not exists media_approved_for_display boolean not null default false;
alter table dishes add column if not exists media_rights_status text not null default 'unverified';
alter table dishes add column if not exists media_source_url text;
alter table dishes add column if not exists media_verified_at timestamptz;
alter table dishes add column if not exists media_verified_by uuid;
alter table dishes add column if not exists menu_approved_for_display boolean not null default false;
alter table dishes add column if not exists menu_rights_status text not null default 'unverified';
alter table dishes add column if not exists menu_source_url text;
alter table dishes add column if not exists menu_verified_at timestamptz;
alter table dishes add column if not exists menu_verified_by uuid;

alter table dish_images add column if not exists media_approved_for_display boolean not null default false;
alter table dish_images add column if not exists media_rights_status text not null default 'unverified';
alter table dish_images add column if not exists media_source_url text;
alter table dish_images add column if not exists media_verified_at timestamptz;
alter table dish_images add column if not exists media_verified_by uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'buildings_media_rights_status_check') then
    alter table buildings add constraint buildings_media_rights_status_check
      check (media_rights_status in ('unverified', 'placeholder', 'merchant_owned', 'operator_owned', 'user_submitted', 'permitted_api', 'licensed', 'rejected'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'venues_media_rights_status_check') then
    alter table venues add constraint venues_media_rights_status_check
      check (media_rights_status in ('unverified', 'placeholder', 'merchant_owned', 'operator_owned', 'user_submitted', 'permitted_api', 'licensed', 'rejected'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'venues_menu_rights_status_check') then
    alter table venues add constraint venues_menu_rights_status_check
      check (menu_rights_status in ('unverified', 'merchant_owned', 'operator_owned', 'user_submitted', 'permitted_api', 'licensed', 'rejected'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dishes_media_rights_status_check') then
    alter table dishes add constraint dishes_media_rights_status_check
      check (media_rights_status in ('unverified', 'placeholder', 'merchant_owned', 'operator_owned', 'user_submitted', 'permitted_api', 'licensed', 'rejected'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dishes_menu_rights_status_check') then
    alter table dishes add constraint dishes_menu_rights_status_check
      check (menu_rights_status in ('unverified', 'merchant_owned', 'operator_owned', 'user_submitted', 'permitted_api', 'licensed', 'rejected'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dish_images_media_rights_status_check') then
    alter table dish_images add constraint dish_images_media_rights_status_check
      check (media_rights_status in ('unverified', 'placeholder', 'merchant_owned', 'operator_owned', 'user_submitted', 'permitted_api', 'licensed', 'rejected'));
  end if;
end $$;

create index if not exists idx_dishes_menu_display_approved
  on dishes(menu_approved_for_display, venue_id, rating_avg desc, id)
  where menu_approved_for_display = true;

create index if not exists idx_venues_menu_display_approved
  on venues(menu_approved_for_display, id)
  where menu_approved_for_display = true;

create index if not exists idx_dish_images_media_display_approved
  on dish_images(dish_id, sort_order)
  where media_approved_for_display = true;

update buildings
set media_rights_status = 'placeholder'
where media_approved_for_display = false
  and image_url ilike '%images.unsplash.com%'
  and media_rights_status = 'unverified';

update venues
set media_rights_status = 'placeholder'
where media_approved_for_display = false
  and image_url ilike '%images.unsplash.com%'
  and media_rights_status = 'unverified';

update dishes
set media_rights_status = 'placeholder'
where media_approved_for_display = false
  and image_url ilike '%images.unsplash.com%'
  and media_rights_status = 'unverified';

create or replace function public.catalog_url_is_delivery_app(p_url text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p_url, '')) like any (array[
    '%grab.com%',
    '%foodpanda.%',
    '%deliveroo.%'
  ]);
$$;

create or replace function public.catalog_display_image_url(
  p_url text,
  p_approved boolean,
  p_rights_status text,
  p_source_url text default null
)
returns text
language sql
immutable
as $$
  select case
    when nullif(trim(coalesce(p_url, '')), '') is null then null
    when coalesce(p_approved, false) = false then null
    when coalesce(p_rights_status, 'unverified') not in ('merchant_owned', 'operator_owned', 'user_submitted', 'permitted_api', 'licensed') then null
    when lower(p_url) like '%images.unsplash.com%' then null
    when public.catalog_url_is_delivery_app(concat_ws(' ', p_url, p_source_url))
      and coalesce(p_rights_status, 'unverified') <> 'licensed' then null
    else trim(p_url)
  end;
$$;

create or replace function public.catalog_menu_is_displayable(
  p_approved boolean,
  p_rights_status text,
  p_source_url text default null
)
returns boolean
language sql
immutable
as $$
  select coalesce(p_approved, false)
    and coalesce(p_rights_status, 'unverified') in ('merchant_owned', 'operator_owned', 'user_submitted', 'permitted_api', 'licensed')
    and (
      coalesce(p_rights_status, 'unverified') = 'licensed'
      or not public.catalog_url_is_delivery_app(p_source_url)
    );
$$;

-- App-facing discovery feed: keep venue identity visible, but only expose
-- approved menu items and approved images.
drop function if exists public.get_discovery_feed_by_location(text, double precision, double precision, integer, integer);

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
      top_dish.id as top_dish_id,
      top_dish.name as top_dish_name,
      coalesce(
        top_dish_image.url,
        public.catalog_display_image_url(top_dish.image_url, top_dish.media_approved_for_display, top_dish.media_rights_status, top_dish.media_source_url),
        public.catalog_display_image_url(v.image_url, v.media_approved_for_display, v.media_rights_status, v.media_source_url),
        public.catalog_display_image_url(b.image_url, b.media_approved_for_display, b.media_rights_status, b.media_source_url)
      ) as top_dish_image,
      top_dish.rating_avg as top_dish_rating,
      top_dish.review_count as top_dish_review_count,
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
        and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
      order by d.must_order desc, d.is_featured desc, d.rating_avg desc, d.id
      limit 1
    ) top_dish on true
    left join lateral (
      select public.catalog_display_image_url(di.url, di.media_approved_for_display, di.media_rights_status, di.media_source_url) as url
      from dish_images di
      where di.dish_id = top_dish.id
      order by di.sort_order
      limit 1
    ) top_dish_image on true
    where (not params.area_requested or params.area_found)
      and (
        (
          params.area_requested
          and lower(trim(coalesce(v.planning_area, b.planning_area, ''))) = lower(trim(p_area_name))
        )
        or params.lat is null
        or params.lng is null
        or st_dwithin(
          coalesce(v.location, b.location),
          st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography,
          params.radius_meters
        )
      )
      and top_dish.id is not null
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
    candidates.top_dish_rating,
    candidates.top_dish_review_count,
    candidates.top_dish_price,
    candidates.cuisine_tags,
    candidates.rank_score
  from candidates
  order by candidates.rank_score desc, candidates.distance_meters, candidates.venue_id
  limit (select result_limit from params);
$$;

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
        select array_agg(safe_image.url order by safe_image.sort_order)
        from (
          select
            di.sort_order,
            public.catalog_display_image_url(di.url, di.media_approved_for_display, di.media_rights_status, di.media_source_url) as url
          from dish_images di
          where di.dish_id = d.id
        ) safe_image
        where safe_image.url is not null
      ), case
        when coalesce(
          public.catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url),
          public.catalog_display_image_url(v.image_url, v.media_approved_for_display, v.media_rights_status, v.media_source_url)
        ) is null then '{}'::text[]
        else array[
          coalesce(
            public.catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url),
            public.catalog_display_image_url(v.image_url, v.media_approved_for_display, v.media_rights_status, v.media_source_url)
          )
        ]
      end) as gallery,
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
    coalesce(
      public.catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url),
      public.catalog_display_image_url(v.image_url, v.media_approved_for_display, v.media_rights_status, v.media_source_url)
    ) as image_url,
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
      select array_agg(safe_image.url order by safe_image.sort_order)
      from (
        select
          di.sort_order,
          public.catalog_display_image_url(di.url, di.media_approved_for_display, di.media_rights_status, di.media_source_url) as url
        from dish_images di
        where di.dish_id = d.id
      ) safe_image
      where safe_image.url is not null
    ), case
      when coalesce(
        public.catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url),
        public.catalog_display_image_url(v.image_url, v.media_approved_for_display, v.media_rights_status, v.media_source_url)
      ) is null then '{}'::text[]
      else array[
        coalesce(
          public.catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url),
          public.catalog_display_image_url(v.image_url, v.media_approved_for_display, v.media_rights_status, v.media_source_url)
        )
      ]
    end) as gallery,
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
    and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
  limit 1;
$$;

grant execute on function public.catalog_url_is_delivery_app(text) to anon, authenticated;
grant execute on function public.catalog_display_image_url(text, boolean, text, text) to anon, authenticated;
grant execute on function public.catalog_menu_is_displayable(boolean, text, text) to anon, authenticated;
