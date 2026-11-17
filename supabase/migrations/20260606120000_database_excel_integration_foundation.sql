-- Database + Excel integration foundation.
-- Safe scope: extend catalog tables for the canonical workbook, add Singapore
-- area lookup support, and expose bounded location RPCs for app reads.

create extension if not exists pg_trgm with schema extensions;

alter table import_runs
  drop constraint if exists import_runs_source_type_check;

alter table import_runs
  add constraint import_runs_source_type_check
  check (
    source_type in (
      'google_sheets',
      'csv',
      'spreadsheet',
      'google_places',
      'menu_ocr',
      'manual',
      'merchant',
      'system'
    )
  ) not valid;

insert into external_sources (
  slug,
  display_name,
  source_type,
  trust_tier,
  default_confidence,
  metadata
)
values (
  'hungry_fnb_excel_workbook',
  'Hungry F&B Database Excel Workbook',
  'spreadsheet',
  'staging',
  0.650,
  '{"path":"data/Hungry F&B Database.xlsx","purpose":"database excel integration staging import"}'::jsonb
)
on conflict (slug) do update set
  display_name = excluded.display_name,
  source_type = excluded.source_type,
  trust_tier = excluded.trust_tier,
  default_confidence = excluded.default_confidence,
  metadata = external_sources.metadata || excluded.metadata,
  updated_at = now();

alter table buildings
  add column if not exists address text,
  add column if not exists postal_code text,
  add column if not exists region text,
  add column if not exists planning_area text,
  add column if not exists business_id text,
  add column if not exists licence_no text,
  add column if not exists source_type text not null default 'manual',
  add column if not exists source_confidence numeric(4, 3) not null default 0.500,
  add column if not exists image_url text,
  add column if not exists updated_at timestamptz not null default now();

alter table buildings
  drop constraint if exists buildings_building_type_check;

alter table buildings
  add constraint buildings_building_type_check
  check (
    building_type in (
      'hawker_centre',
      'food_court',
      'restaurant',
      'mall',
      'mixed_development',
      'cafe',
      'bar_bistro',
      'chain_outlet',
      'standalone',
      'kopitiam',
      'other'
    )
  );

alter table buildings
  drop constraint if exists buildings_source_confidence_check;

alter table buildings
  add constraint buildings_source_confidence_check
  check (source_confidence >= 0 and source_confidence <= 1) not valid;

alter table venues
  add column if not exists business_id text,
  add column if not exists stall_id text,
  add column if not exists licence_no text,
  add column if not exists cuisine_tags text[] not null default '{}',
  add column if not exists dietary_tags text[] not null default '{}',
  add column if not exists image_url text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists location geography(point, 4326) generated always as (
    case
      when latitude is null or longitude is null then null
      else st_setsrid(st_makepoint(longitude, latitude), 4326)::geography
    end
  ) stored,
  add column if not exists address text,
  add column if not exists postal_code text,
  add column if not exists planning_area text,
  add column if not exists google_place_id text,
  add column if not exists google_rating numeric(3, 1),
  add column if not exists google_review_count integer,
  add column if not exists source_type text not null default 'manual',
  add column if not exists source_confidence numeric(4, 3) not null default 0.500,
  add column if not exists last_verified_at date,
  add column if not exists updated_at timestamptz not null default now();

alter table venues
  drop constraint if exists venues_source_confidence_check;

alter table venues
  add constraint venues_source_confidence_check
  check (source_confidence >= 0 and source_confidence <= 1) not valid;

alter table venues
  drop constraint if exists venues_google_rating_check;

alter table venues
  add constraint venues_google_rating_check
  check (google_rating is null or (google_rating >= 0 and google_rating <= 5)) not valid;

alter table venues
  drop constraint if exists venues_google_review_count_check;

alter table venues
  add constraint venues_google_review_count_check
  check (google_review_count is null or google_review_count >= 0) not valid;

alter table dishes
  add column if not exists cuisine_tags text[] not null default '{}',
  add column if not exists is_featured boolean not null default false,
  add column if not exists source_type text not null default 'manual',
  add column if not exists source_confidence numeric(4, 3) not null default 0.500,
  add column if not exists updated_at timestamptz not null default now();

alter table staging_food_businesses
  add column if not exists google_place_id text,
  add column if not exists google_name text,
  add column if not exists google_formatted_address text,
  add column if not exists google_latitude double precision,
  add column if not exists google_longitude double precision,
  add column if not exists google_primary_type text,
  add column if not exists google_types text[] not null default '{}',
  add column if not exists google_maps_uri text,
  add column if not exists google_business_status text,
  add column if not exists google_rating numeric(3, 1),
  add column if not exists google_review_count integer,
  add column if not exists google_price_level integer,
  add column if not exists google_website text,
  add column if not exists google_phone text,
  add column if not exists google_opening_hours text,
  add column if not exists google_opening_hours_json jsonb not null default '{}'::jsonb,
  add column if not exists google_photo_metadata jsonb not null default '{}'::jsonb,
  add column if not exists google_photo_last_refreshed date,
  add column if not exists menu_source text,
  add column if not exists menu_items_text text;

alter table dishes
  drop constraint if exists dishes_source_confidence_check;

alter table dishes
  add constraint dishes_source_confidence_check
  check (source_confidence >= 0 and source_confidence <= 1) not valid;

create table if not exists areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  name_normalized text not null unique,
  region text,
  center_lat double precision,
  center_lng double precision,
  center_location geography(point, 4326) generated always as (
    case
      when center_lat is null or center_lng is null then null
      else st_setsrid(st_makepoint(center_lng, center_lat), 4326)::geography
    end
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists venue_images (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null references venues(id) on delete cascade,
  url text not null,
  source_type text not null default 'manual',
  source_confidence numeric(4, 3) not null default 0.500,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, sort_order)
);

alter table venue_images
  drop constraint if exists venue_images_source_confidence_check;

alter table venue_images
  add constraint venue_images_source_confidence_check
  check (source_confidence >= 0 and source_confidence <= 1) not valid;

insert into areas (name, name_normalized, region, center_lat, center_lng) values
  ('Jurong East', 'jurong east', 'West', 1.3331, 103.7437),
  ('Jurong West', 'jurong west', 'West', 1.3404, 103.7066),
  ('Pioneer', 'pioneer', 'West', 1.3376, 103.6974),
  ('Tampines', 'tampines', 'East', 1.3526, 103.9448),
  ('Bedok', 'bedok', 'East', 1.3236, 103.9273),
  ('Woodlands', 'woodlands', 'North', 1.4382, 103.7891),
  ('Yishun', 'yishun', 'North', 1.4300, 103.8350),
  ('Ang Mo Kio', 'ang mo kio', 'North-East', 1.3691, 103.8454),
  ('Hougang', 'hougang', 'North-East', 1.3612, 103.8863),
  ('Sengkang', 'sengkang', 'North-East', 1.3868, 103.8914),
  ('Punggol', 'punggol', 'North-East', 1.3984, 103.9072),
  ('Bukit Batok', 'bukit batok', 'West', 1.3490, 103.7490),
  ('Clementi', 'clementi', 'West', 1.3150, 103.7650),
  ('Queenstown', 'queenstown', 'Central', 1.2943, 103.7861),
  ('Toa Payoh', 'toa payoh', 'Central', 1.3343, 103.8470),
  ('Bishan', 'bishan', 'Central', 1.3526, 103.8352),
  ('Novena', 'novena', 'Central', 1.3200, 103.8438),
  ('Bukit Timah', 'bukit timah', 'Central', 1.3294, 103.8021),
  ('Orchard', 'orchard', 'Central', 1.3048, 103.8318),
  ('Marina Bay', 'marina bay', 'Central', 1.2808, 103.8586),
  ('Chinatown', 'chinatown', 'Central', 1.2834, 103.8441),
  ('Little India', 'little india', 'Central', 1.3066, 103.8518),
  ('Geylang', 'geylang', 'East', 1.3135, 103.8896),
  ('Kallang', 'kallang', 'Central', 1.3111, 103.8728),
  ('Pasir Ris', 'pasir ris', 'East', 1.3721, 103.9490),
  ('Serangoon', 'serangoon', 'North-East', 1.3496, 103.8729),
  ('Buona Vista', 'buona vista', 'West', 1.3070, 103.7900),
  ('Commonwealth', 'commonwealth', 'West', 1.3027, 103.7985),
  ('Harbourfront', 'harbourfront', 'Central', 1.2651, 103.8219),
  ('Changi', 'changi', 'East', 1.3644, 103.9915),
  ('Lim Chu Kang', 'lim chu kang', 'North', 1.4200, 103.7100)
on conflict (name) do update set
  name_normalized = excluded.name_normalized,
  region = excluded.region,
  center_lat = excluded.center_lat,
  center_lng = excluded.center_lng,
  updated_at = now();

create unique index if not exists idx_buildings_business_id_unique
  on buildings(business_id)
  where business_id is not null;
create index if not exists idx_buildings_postal_code
  on buildings(postal_code)
  where postal_code is not null;
create index if not exists idx_buildings_planning_area
  on buildings(planning_area)
  where planning_area is not null;
create index if not exists idx_buildings_planning_area_location
  on buildings using gist (location)
  where location is not null;
create index if not exists idx_buildings_name_trgm
  on buildings using gin (name gin_trgm_ops);

create unique index if not exists idx_venues_business_id_unique
  on venues(business_id)
  where business_id is not null;
create index if not exists idx_venues_stall_id
  on venues(stall_id)
  where stall_id is not null;
create index if not exists idx_venues_location
  on venues using gist (location)
  where location is not null;
create index if not exists idx_venues_planning_area
  on venues(planning_area)
  where planning_area is not null;
create index if not exists idx_venues_planning_area_open
  on venues(planning_area, is_open, id);
create index if not exists idx_venues_open_location
  on venues(is_open, planning_area)
  where is_open = true;
create index if not exists idx_venues_cuisine_tags
  on venues using gin (cuisine_tags);
create index if not exists idx_venues_dietary_tags
  on venues using gin (dietary_tags);
create index if not exists idx_venues_name_trgm
  on venues using gin (name gin_trgm_ops);
create index if not exists idx_venues_postal_code
  on venues(postal_code)
  where postal_code is not null;
create index if not exists idx_venues_google_place_id
  on venues(google_place_id)
  where google_place_id is not null;

create index if not exists idx_dishes_cuisine_tags
  on dishes using gin (cuisine_tags);
create index if not exists idx_dishes_is_featured
  on dishes(is_featured)
  where is_featured = true;
create index if not exists idx_dishes_name_venue_trgm
  on dishes using gin ((name || ' ' || venue_id) gin_trgm_ops);

create index if not exists idx_staging_food_businesses_google_place_id
  on staging_food_businesses(google_place_id)
  where google_place_id is not null;
create index if not exists idx_staging_food_businesses_menu_source
  on staging_food_businesses(menu_source)
  where menu_source is not null;

create index if not exists idx_areas_name_normalized
  on areas(name_normalized);
create index if not exists idx_areas_center_location
  on areas using gist (center_location)
  where center_location is not null;
create index if not exists idx_venue_images_venue_order
  on venue_images(venue_id, sort_order);

alter table areas enable row level security;
alter table venue_images enable row level security;

drop policy if exists "public_select_areas" on areas;
create policy "public_select_areas" on areas for select to anon, authenticated using (true);

drop policy if exists "areas_service_role_all" on areas;
create policy "areas_service_role_all" on areas
  for all to service_role using (true) with check (true);

drop policy if exists "public_select_venue_images" on venue_images;
create policy "public_select_venue_images" on venue_images for select to anon, authenticated using (true);

drop policy if exists "venue_images_service_role_all" on venue_images;
create policy "venue_images_service_role_all" on venue_images
  for all to service_role using (true) with check (true);

drop trigger if exists trg_buildings_updated_at on buildings;
create trigger trg_buildings_updated_at
  before update on buildings
  for each row execute function public.set_updated_at();

drop trigger if exists trg_venues_updated_at on venues;
create trigger trg_venues_updated_at
  before update on venues
  for each row execute function public.set_updated_at();

drop trigger if exists trg_dishes_updated_at on dishes;
create trigger trg_dishes_updated_at
  before update on dishes
  for each row execute function public.set_updated_at();

drop trigger if exists trg_areas_updated_at on areas;
create trigger trg_areas_updated_at
  before update on areas
  for each row execute function public.set_updated_at();

drop trigger if exists trg_venue_images_updated_at on venue_images;
create trigger trg_venue_images_updated_at
  before update on venue_images
  for each row execute function public.set_updated_at();

-- Replace the original 9-argument RPC so PostgREST has a single search_dishes
-- entry point with optional Excel/location filters.
drop function if exists public.search_dishes(
  text,
  double precision,
  double precision,
  integer,
  text[],
  integer,
  double precision,
  text,
  text
) cascade;

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
      coalesce(nullif(d.image_url, ''), nullif(v.image_url, '')) as image_url,
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
        select array_agg(di.url order by di.sort_order)
        from dish_images di
        where di.dish_id = d.id
      ), case when nullif(coalesce(d.image_url, v.image_url), '') is null then '{}'::text[] else array[coalesce(d.image_url, v.image_url)] end) as gallery,
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
    where (not params.area_requested or params.area_found)
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
set search_path = public, extensions
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
      'latitude', coalesce(v.latitude, b.latitude),
      'longitude', coalesce(v.longitude, b.longitude),
      'floors', b.floors,
      'venueCount', b.venue_count,
      'isClosedToday', b.is_closed_today,
      'heroDishId', b.hero_dish_id,
      'address', coalesce(v.address, b.address),
      'postalCode', coalesce(v.postal_code, b.postal_code),
      'planningArea', coalesce(v.planning_area, b.planning_area)
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
      from public.search_dishes(
        p_query => null,
        p_lat => null,
        p_lng => null,
        p_radius_meters => null,
        p_dietary_flags => '{}'::text[],
        p_limit => 50,
        p_cursor_score => null,
        p_cursor_id => null,
        p_venue_id => v.id,
        p_area_name => null,
        p_cuisine_tags => null,
        p_max_price => null,
        p_open_only => false
      ) sd
    ), '[]'::jsonb) as dishes
  from venues v
  join buildings b on b.id = v.building_id
  where v.id = p_venue_id
  limit 1;
$$;

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
      coalesce(v.top_dish_id, top_dish.id) as top_dish_id,
      top_dish.name as top_dish_name,
      coalesce(top_dish.image_url, v.image_url, b.image_url) as top_dish_image,
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
      order by d.must_order desc, d.is_featured desc, d.rating_avg desc, d.id
      limit 1
    ) top_dish on true
    where (not params.area_requested or params.area_found)
      and (
        params.lat is null
        or params.lng is null
        or st_dwithin(
          coalesce(v.location, b.location),
          st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography,
          params.radius_meters
        )
      )
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
    candidates.top_dish_price,
    candidates.cuisine_tags,
    candidates.rank_score
  from candidates
  order by candidates.rank_score desc, candidates.distance_meters, candidates.venue_id
  limit (select result_limit from params);
$$;

create or replace function public.search_venues_by_location(
  p_query text default null,
  p_area_name text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_meters integer default 3000,
  p_limit integer default 30
)
returns table (
  venue_id text,
  building_id text,
  name text,
  building_name text,
  unit_number text,
  floor text,
  is_open boolean,
  planning_area text,
  cuisine_tags text[],
  distance_meters integer,
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
      nullif(trim(coalesce(p_query, '')), '') as query,
      coalesce((select center_lat from area_match), p_lat) as lat,
      coalesce((select center_lng from area_match), p_lng) as lng,
      greatest(coalesce(p_radius_meters, 3000), 1) as radius_meters,
      least(greatest(coalesce(p_limit, 30), 1), 100) as result_limit,
      nullif(trim(coalesce(p_area_name, '')), '') is not null as area_requested,
      exists (select 1 from area_match) as area_found
  )
  select
    v.id as venue_id,
    v.building_id,
    v.name,
    b.name as building_name,
    v.unit_number,
    v.floor,
    v.is_open,
    coalesce(v.planning_area, b.planning_area) as planning_area,
    v.cuisine_tags,
    case
      when params.lat is not null and params.lng is not null then
        st_distance(
          coalesce(v.location, b.location),
          st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography
        )::integer
      else 0
    end as distance_meters,
    case
      when params.query is null then 1::double precision
      else greatest(
        similarity(v.name, params.query),
        similarity(b.name, params.query),
        case
          when concat_ws(' ', v.name, b.name, array_to_string(v.cuisine_tags, ' ')) ilike '%' || params.query || '%'
            then 0.55
          else 0
        end
      )
    end as rank_score
  from venues v
  join buildings b on b.id = v.building_id
  cross join params
  where (not params.area_requested or params.area_found)
    and (
      params.query is null
      or concat_ws(' ', v.name, b.name, array_to_string(v.cuisine_tags, ' ')) ilike '%' || params.query || '%'
      or v.name % params.query
      or b.name % params.query
    )
    and (
      params.lat is null
      or params.lng is null
      or st_dwithin(
        coalesce(v.location, b.location),
        st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography,
        params.radius_meters
      )
    )
  order by rank_score desc, distance_meters, v.id
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
  text,
  text,
  text[],
  numeric,
  boolean
) to anon, authenticated;

grant execute on function public.get_venue_detail(text) to anon, authenticated;
grant execute on function public.get_discovery_feed_by_location(
  text,
  double precision,
  double precision,
  integer,
  integer
) to anon, authenticated;
grant execute on function public.search_venues_by_location(
  text,
  text,
  double precision,
  double precision,
  integer,
  integer
) to anon, authenticated;
