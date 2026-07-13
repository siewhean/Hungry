-- Release-versioned, authenticated raw catalog reads. Base tables remain the
-- source of truth; these projections make the full inventory pageable without
-- downloading it to a device or weakening curated public read rules.

create table if not exists public.catalog_releases (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'building'
    check (status in ('building', 'active', 'retired', 'failed')),
  venue_total integer not null default 0,
  dish_total integer not null default 0,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  expires_at timestamptz
);

create unique index if not exists catalog_releases_one_active_idx
  on public.catalog_releases ((status = 'active')) where status = 'active';

create table if not exists public.catalog_raw_venue_cards (
  release_id uuid not null references public.catalog_releases(id) on delete cascade,
  id text not null,
  building_id text not null,
  name text not null,
  building_name text,
  building_type text,
  unit_number text,
  floor text,
  address text,
  postal_code text,
  operating_hours text,
  image_url text,
  latitude double precision,
  longitude double precision,
  listing_location geography(point, 4326),
  is_open boolean not null default false,
  menu_count integer not null default 0,
  cuisine_tags text[] not null default '{}',
  dietary_flags text[] not null default '{}',
  min_price numeric(10, 2),
  quality_rating numeric(4, 2) not null default 0,
  quality_review_count integer not null default 0,
  representative_dish jsonb,
  verification_status text not null,
  menu_rights_status text not null default 'unverified',
  media_rights_status text not null default 'unverified',
  menu_source_url text,
  media_source_url text,
  updated_at timestamptz,
  primary key (release_id, id)
);

create table if not exists public.catalog_raw_dish_cards (
  release_id uuid not null references public.catalog_releases(id) on delete cascade,
  id text not null,
  venue_id text not null,
  building_id text not null,
  name text not null,
  venue_name text not null,
  building_name text,
  building_type text,
  description text,
  price numeric(10, 2),
  price_range text,
  image_url text,
  distance_meters integer,
  rating numeric(4, 2) not null default 0,
  review_count integer not null default 0,
  cuisine_tags text[] not null default '{}',
  dietary_flags text[] not null default '{}',
  is_open boolean not null default false,
  listing_location geography(point, 4326),
  verification_status text not null,
  menu_rights_status text not null default 'unverified',
  media_rights_status text not null default 'unverified',
  menu_source_url text,
  media_source_url text,
  updated_at timestamptz,
  primary key (release_id, id)
);

create table if not exists public.catalog_raw_dish_media (
  release_id uuid not null references public.catalog_releases(id) on delete cascade,
  dish_id text not null,
  media_key text not null,
  url text not null,
  source_url text,
  rights_status text not null default 'unverified',
  approved_for_display boolean not null default false,
  sort_order integer not null default 0,
  primary key (release_id, dish_id, media_key)
);

alter table public.catalog_releases enable row level security;
alter table public.catalog_raw_venue_cards enable row level security;
alter table public.catalog_raw_dish_cards enable row level security;
alter table public.catalog_raw_dish_media enable row level security;
revoke all on table public.catalog_releases from public, anon, authenticated;
revoke all on table public.catalog_raw_venue_cards from public, anon, authenticated;
revoke all on table public.catalog_raw_dish_cards from public, anon, authenticated;
revoke all on table public.catalog_raw_dish_media from public, anon, authenticated;

create index if not exists catalog_raw_venue_cards_release_quality_idx
  on public.catalog_raw_venue_cards (release_id, quality_rating desc, quality_review_count desc, name, id);
create index if not exists catalog_raw_venue_cards_release_building_type_idx
  on public.catalog_raw_venue_cards (release_id, building_type, id);
create index if not exists catalog_raw_venue_cards_release_location_idx
  on public.catalog_raw_venue_cards using gist (listing_location);
create index if not exists catalog_raw_venue_cards_name_trgm_idx
  on public.catalog_raw_venue_cards using gin (name gin_trgm_ops);
create index if not exists catalog_raw_dish_cards_release_quality_idx
  on public.catalog_raw_dish_cards (release_id, rating desc, review_count desc, id);
create index if not exists catalog_raw_dish_cards_release_venue_idx
  on public.catalog_raw_dish_cards (release_id, venue_id, rating desc, id);
create index if not exists catalog_raw_dish_cards_release_location_idx
  on public.catalog_raw_dish_cards using gist (listing_location);
create index if not exists catalog_raw_dish_cards_name_trgm_idx
  on public.catalog_raw_dish_cards using gin (name gin_trgm_ops);
create index if not exists catalog_raw_dish_media_release_dish_idx
  on public.catalog_raw_dish_media (release_id, dish_id, sort_order);

create or replace function public.catalog_raw_release_for_read(p_release_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_release_id uuid;
begin
  select id into v_release_id
  from public.catalog_releases
  where (p_release_id is null and status = 'active')
     or (p_release_id is not null and id = p_release_id and (status = 'active' or (status = 'retired' and expires_at > now())))
  order by activated_at desc nulls last
  limit 1;
  if v_release_id is null then
    raise exception 'catalog release unavailable' using errcode = 'P0001';
  end if;
  return v_release_id;
end;
$$;

create or replace function public.catalog_raw_require_authenticated()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
end;
$$;

-- Runs from the controlled promotion workflow only. It snapshots all source rows,
-- checks optional expected counts, then atomically switches the active release.
create or replace function public.catalog_raw_publish_release(
  p_expected_venues integer default null,
  p_expected_dishes integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_release_id uuid := gen_random_uuid();
  v_venue_total integer;
  v_dish_total integer;
begin
  insert into public.catalog_releases (id, status) values (v_release_id, 'building');

  insert into public.catalog_raw_venue_cards (
    release_id, id, building_id, name, building_name, building_type, unit_number, floor, address, postal_code,
    operating_hours, image_url, latitude, longitude, listing_location, is_open, menu_count, cuisine_tags,
    dietary_flags, min_price, quality_rating, quality_review_count,
    representative_dish, verification_status, menu_rights_status, media_rights_status,
    menu_source_url, media_source_url, updated_at
  )
  select
    v_release_id, v.id, v.building_id, v.name, b.name, b.building_type, v.unit_number, v.floor,
    coalesce(v.address, b.address), coalesce(v.postal_code, b.postal_code), v.operating_hours,
    v.image_url, coalesce(v.latitude, b.latitude), coalesce(v.longitude, b.longitude),
    coalesce(v.location, b.location), v.is_open,
    coalesce(menu_counts.menu_count, 0), coalesce(menu_counts.cuisine_tags, '{}'),
    coalesce(menu_counts.dietary_flags, '{}'), menu_counts.min_price,
    coalesce(top_dish.rating, 0), coalesce(top_dish.review_count, 0), top_dish.card,
    case when v.menu_approved_for_display and v.media_approved_for_display then 'approved'
         when v.source_confidence >= 0.85 then 'verified' else 'raw' end,
    v.menu_rights_status, v.media_rights_status, v.menu_source_url, v.media_source_url, v.updated_at
  from public.venues v
  join public.buildings b on b.id = v.building_id
  left join lateral (
    select count(distinct d.id)::integer as menu_count,
      array_remove(array_agg(distinct tag), null) as cuisine_tags,
      array_remove(array_agg(distinct dietary.slug), null) as dietary_flags,
      min(d.price) as min_price
    from public.dishes d
    left join lateral unnest(d.cuisine_tags) tag on true
    left join public.dish_dietary_flags ddf on ddf.dish_id = d.id
    left join public.dietary_flags dietary on dietary.id = ddf.dietary_flag_id
    where d.venue_id = v.id
  ) menu_counts on true
  left join lateral (
    select jsonb_build_object('id', d.id, 'name', d.name, 'image_url', d.image_url,
      'price', d.price, 'verification_status', case when d.menu_approved_for_display and d.media_approved_for_display then 'approved'
      when d.source_confidence >= 0.85 then 'verified' else 'raw' end) as card
      , d.rating_avg as rating, d.review_count
    from public.dishes d where d.venue_id = v.id order by d.rating_avg desc, d.review_count desc, d.id limit 1
  ) top_dish on true;

  insert into public.catalog_raw_dish_cards (
    release_id, id, venue_id, building_id, name, venue_name, building_name, building_type, description, price,
    price_range, image_url, distance_meters, rating, review_count, cuisine_tags, dietary_flags,
    is_open, listing_location, verification_status, menu_rights_status, media_rights_status,
    menu_source_url, media_source_url, updated_at
  )
  select
    v_release_id, d.id, d.venue_id, d.building_id, d.name, v.name, b.name, b.building_type, d.description,
    d.price, d.price_range,
    coalesce(d.image_url, primary_media.url), d.distance_meters, d.rating_avg, d.review_count,
    coalesce(nullif(d.cuisine_tags, '{}'), v.cuisine_tags, '{}'), coalesce(flags.slugs, '{}'),
    v.is_open, coalesce(v.location, b.location),
    case when d.menu_approved_for_display and d.media_approved_for_display then 'approved'
         when d.source_confidence >= 0.85 then 'verified' else 'raw' end,
    d.menu_rights_status, d.media_rights_status, d.menu_source_url, d.media_source_url, d.updated_at
  from public.dishes d
  join public.venues v on v.id = d.venue_id
  join public.buildings b on b.id = d.building_id
  left join lateral (
    select di.url from public.dish_images di where di.dish_id = d.id order by di.sort_order, di.id limit 1
  ) primary_media on true
  left join lateral (
    select array_agg(df.slug order by df.slug) as slugs
    from public.dish_dietary_flags ddf join public.dietary_flags df on df.id = ddf.dietary_flag_id
    where ddf.dish_id = d.id
  ) flags on true;

  insert into public.catalog_raw_dish_media (
    release_id, dish_id, media_key, url, source_url, rights_status, approved_for_display, sort_order
  )
  select v_release_id, d.id, 'inline:' || d.id, d.image_url, d.media_source_url,
         d.media_rights_status, d.media_approved_for_display, -1
  from public.dishes d where nullif(trim(coalesce(d.image_url, '')), '') is not null
  union all
  select v_release_id, di.dish_id, di.id::text, di.url, di.media_source_url,
         di.media_rights_status, di.media_approved_for_display, di.sort_order
  from public.dish_images di;

  select count(*)::integer into v_venue_total from public.catalog_raw_venue_cards where release_id = v_release_id;
  select count(*)::integer into v_dish_total from public.catalog_raw_dish_cards where release_id = v_release_id;
  if (p_expected_venues is not null and v_venue_total <> p_expected_venues)
     or (p_expected_dishes is not null and v_dish_total <> p_expected_dishes) then
    update public.catalog_releases set status = 'failed', venue_total = v_venue_total, dish_total = v_dish_total where id = v_release_id;
    return v_release_id;
  end if;

  update public.catalog_releases
  set status = 'retired', expires_at = now() + interval '24 hours'
  where status = 'active';
  update public.catalog_releases
  set status = 'active', venue_total = v_venue_total, dish_total = v_dish_total, activated_at = now()
  where id = v_release_id;
  return v_release_id;
end;
$$;

create or replace function public.catalog_raw_cursor(p_value jsonb)
returns text language sql immutable as $$
  select encode(convert_to(p_value::text, 'utf8'), 'base64')
$$;

create or replace function public.catalog_raw_cursor_value(p_cursor text)
returns jsonb language plpgsql immutable as $$
begin
  return convert_from(decode(p_cursor, 'base64'), 'utf8')::jsonb;
exception when others then
  raise exception 'invalid catalog cursor' using errcode = '22023';
end;
$$;

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
           else greatest(similarity(c.name, p_query), similarity(c.venue_name, p_query)) end as relevance
    from public.catalog_raw_dish_cards c
    where c.release_id = v_release
      and (p_venue_id is null or c.venue_id = p_venue_id)
      and (cardinality(coalesce(p_building_types, '{}')) = 0 or c.building_type = any(p_building_types))
      and (p_open_only = false or c.is_open)
      and (p_max_price is null or c.price <= p_max_price)
      and (cardinality(coalesce(p_cuisine_tags, '{}')) = 0 or c.cuisine_tags && p_cuisine_tags)
      and (cardinality(coalesce(p_dietary_flags, '{}')) = 0 or c.dietary_flags && p_dietary_flags)
      and (p_lat is null or p_lng is null or p_radius_meters is null or st_dwithin(c.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_meters))
      and (nullif(trim(coalesce(p_query, '')), '') is null or c.name % p_query or c.venue_name % p_query or c.name ilike '%' || p_query || '%' or c.venue_name ilike '%' || p_query || '%')
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

create or replace function public.catalog_raw_venue_menu_page(
  p_query text default null, p_lat double precision default null, p_lng double precision default null, p_radius_meters integer default null,
  p_cuisine_tags text[] default '{}', p_dietary_flags text[] default '{}', p_max_price numeric default null, p_open_only boolean default false,
  p_sort text default 'quality', p_cursor text default null, p_release_id uuid default null, p_limit integer default 24, p_venue_id text default null,
  p_building_types text[] default '{}'
) returns jsonb language sql security definer set search_path = public, extensions as $$
  select public.catalog_raw_dishes_page(p_query, p_lat, p_lng, p_radius_meters, p_cuisine_tags, p_dietary_flags, p_max_price, p_open_only, p_sort, p_cursor, p_release_id, p_limit, p_venue_id, p_building_types)
$$;

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
      case when nullif(trim(coalesce(p_query, '')), '') is null then 0::double precision else similarity(c.name, p_query) end as relevance
    from public.catalog_raw_venue_cards c where c.release_id = v_release and (p_open_only = false or c.is_open)
      and (cardinality(coalesce(p_building_types, '{}')) = 0 or c.building_type = any(p_building_types))
      and (cardinality(coalesce(p_cuisine_tags, '{}')) = 0 or c.cuisine_tags && p_cuisine_tags)
      and (cardinality(coalesce(p_dietary_flags, '{}')) = 0 or c.dietary_flags && p_dietary_flags)
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

create or replace function public.catalog_raw_dish_detail(p_dish_id text, p_release_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_release uuid; v_result jsonb;
begin
  perform public.catalog_raw_require_authenticated(); v_release := public.catalog_raw_release_for_read(p_release_id);
  select to_jsonb(c) - 'listing_location' || jsonb_build_object('media', coalesce((select jsonb_agg(jsonb_build_object('url', m.url, 'source_url', m.source_url, 'rights_status', m.rights_status, 'approved_for_display', m.approved_for_display, 'sort_order', m.sort_order) order by m.sort_order) from public.catalog_raw_dish_media m where m.release_id = v_release and m.dish_id = c.id), '[]'::jsonb)) into v_result
  from public.catalog_raw_dish_cards c where c.release_id = v_release and c.id = p_dish_id;
  if v_result is null then raise exception 'catalog dish not found' using errcode = 'P0002'; end if; return v_result;
end;
$$;

create or replace function public.catalog_raw_venue_detail(p_venue_id text, p_release_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_release uuid; v_result jsonb;
begin
  perform public.catalog_raw_require_authenticated(); v_release := public.catalog_raw_release_for_read(p_release_id);
  select to_jsonb(c) - 'listing_location' into v_result from public.catalog_raw_venue_cards c where c.release_id = v_release and c.id = p_venue_id;
  if v_result is null then raise exception 'catalog venue not found' using errcode = 'P0002'; end if; return v_result;
end;
$$;

create or replace function public.catalog_raw_map_view(
  p_min_lat double precision, p_min_lng double precision, p_max_lat double precision, p_max_lng double precision,
  p_zoom double precision, p_release_id uuid default null, p_near_lat double precision default null,
  p_near_lng double precision default null, p_radius_meters integer default null,
  p_building_types text[] default '{}', p_cuisine_tags text[] default '{}', p_open_only boolean default false,
  p_min_rating numeric default null
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_release uuid; v_items jsonb; v_cell numeric := case when p_zoom < 12 then 0.08 when p_zoom < 14 then 0.02 else 0.004 end;
begin
  perform public.catalog_raw_require_authenticated(); v_release := public.catalog_raw_release_for_read(p_release_id);
  if p_zoom < 14 then
    select coalesce(jsonb_agg(jsonb_build_object('kind','cluster','id',cell,'latitude',avg(latitude),'longitude',avg(longitude),'count',count(*))), '[]'::jsonb) into v_items
    from (
      select floor(latitude / v_cell)::text || ':' || floor(longitude / v_cell)::text as cell, latitude, longitude
      from public.catalog_raw_venue_cards
      where release_id = v_release and latitude between p_min_lat and p_max_lat and longitude between p_min_lng and p_max_lng
        and (cardinality(coalesce(p_building_types, '{}')) = 0 or building_type = any(p_building_types))
        and (cardinality(coalesce(p_cuisine_tags, '{}')) = 0 or cuisine_tags && p_cuisine_tags)
        and (p_open_only = false or is_open)
        and (p_min_rating is null or quality_rating >= p_min_rating)
        and (p_near_lat is null or p_near_lng is null or p_radius_meters is null or st_dwithin(listing_location, st_setsrid(st_makepoint(p_near_lng, p_near_lat), 4326)::geography, p_radius_meters))
    ) cells;
  else
    select coalesce(jsonb_agg(jsonb_build_object('kind','venue','id',id,'label',name,'latitude',latitude,'longitude',longitude,'verification_status',verification_status)), '[]'::jsonb) into v_items
    from (
      select * from public.catalog_raw_venue_cards
      where release_id = v_release and latitude between p_min_lat and p_max_lat and longitude between p_min_lng and p_max_lng
        and (cardinality(coalesce(p_building_types, '{}')) = 0 or building_type = any(p_building_types))
        and (cardinality(coalesce(p_cuisine_tags, '{}')) = 0 or cuisine_tags && p_cuisine_tags)
        and (p_open_only = false or is_open)
        and (p_min_rating is null or quality_rating >= p_min_rating)
        and (p_near_lat is null or p_near_lng is null or p_radius_meters is null or st_dwithin(listing_location, st_setsrid(st_makepoint(p_near_lng, p_near_lat), 4326)::geography, p_radius_meters))
      order by quality_rating desc, quality_review_count desc, id limit 500
    ) venues;
  end if;
  return jsonb_build_object('release_id', v_release, 'items', v_items);
end;
$$;

revoke all on function public.catalog_raw_publish_release(integer, integer) from public, anon, authenticated;
revoke all on function public.catalog_raw_dishes_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text, text[]) from public, anon;
revoke all on function public.catalog_raw_venue_menu_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text, text[]) from public, anon;
revoke all on function public.catalog_raw_venues_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text[]) from public, anon;
revoke all on function public.catalog_raw_dish_detail(text, uuid) from public, anon;
revoke all on function public.catalog_raw_venue_detail(text, uuid) from public, anon;
revoke all on function public.catalog_raw_map_view(double precision, double precision, double precision, double precision, double precision, uuid, double precision, double precision, integer, text[], text[], boolean, numeric) from public, anon;
grant execute on function public.catalog_raw_dishes_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text, text[]) to authenticated;
grant execute on function public.catalog_raw_venue_menu_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text, text[]) to authenticated;
grant execute on function public.catalog_raw_venues_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text[]) to authenticated;
grant execute on function public.catalog_raw_dish_detail(text, uuid) to authenticated;
grant execute on function public.catalog_raw_venue_detail(text, uuid) to authenticated;
grant execute on function public.catalog_raw_map_view(double precision, double precision, double precision, double precision, double precision, uuid, double precision, double precision, integer, text[], text[], boolean, numeric) to authenticated;
