-- Sprint 5: Core Supabase schema for repository/service parity.
-- This schema is mock-to-live friendly: content entities use text IDs to preserve fixture keys.

create table if not exists dietary_flags (
  id uuid primary key default uuid_generate_v4(),
  slug citext not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists buildings (
  id text primary key,
  slug text unique,
  name text not null,
  building_type text not null check (building_type in ('hawker_centre', 'food_court', 'restaurant', 'mixed_development')),
  latitude double precision not null,
  longitude double precision not null,
  location geography(point, 4326) generated always as (st_setsrid(st_makepoint(longitude, latitude), 4326)::geography) stored,
  floors text[] not null default '{}',
  venue_count integer not null default 0,
  is_closed_today boolean not null default false,
  hero_dish_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_buildings_location on buildings using gist (location);

create table if not exists building_floors (
  id uuid primary key default uuid_generate_v4(),
  building_id text not null references buildings(id) on delete cascade,
  floor_label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (building_id, floor_label)
);

create table if not exists venues (
  id text primary key,
  building_id text not null references buildings(id) on delete cascade,
  name text not null,
  unit_number text not null default '',
  floor text not null,
  hygiene_grade text not null default 'A' check (hygiene_grade in ('A', 'B', 'C', 'D')),
  is_open boolean not null default true,
  top_dish_id text,
  operating_hours text not null default '',
  closure_notice text,
  live_crowd text check (live_crowd in ('low', 'medium', 'high')),
  created_at timestamptz not null default now()
);

create index if not exists idx_venues_building_id on venues(building_id);

create table if not exists venue_delivery_links (
  id uuid primary key default uuid_generate_v4(),
  venue_id text not null references venues(id) on delete cascade,
  platform text not null check (platform in ('grabfood', 'foodpanda', 'deliveroo')),
  native_url text not null default '',
  web_url text not null default '',
  affiliate_eligible boolean not null default false,
  created_at timestamptz not null default now(),
  unique (venue_id, platform)
);

create table if not exists dishes (
  id text primary key,
  venue_id text not null references venues(id) on delete cascade,
  building_id text not null references buildings(id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  blurhash text,
  distance_meters integer not null default 0,
  rating_avg numeric(3, 2) not null default 0,
  review_count integer not null default 0,
  price numeric(8, 2) not null default 0,
  price_range text not null default '',
  live_crowd text check (live_crowd in ('low', 'medium', 'high')),
  taste_tags text[] not null default '{}',
  must_order boolean not null default false,
  availability_flags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_dishes_venue_id on dishes(venue_id);
create index if not exists idx_dishes_building_id on dishes(building_id);
create index if not exists idx_dishes_name_trgm on dishes using gin (name gin_trgm_ops);

create table if not exists dish_images (
  id uuid primary key default uuid_generate_v4(),
  dish_id text not null references dishes(id) on delete cascade,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (dish_id, sort_order)
);

create table if not exists dish_taste_vectors (
  dish_id text primary key references dishes(id) on delete cascade,
  sweet numeric(4, 2) not null default 5,
  spicy numeric(4, 2) not null default 5,
  sour numeric(4, 2) not null default 5,
  salty numeric(4, 2) not null default 5,
  rich numeric(4, 2) not null default 5,
  aromatic numeric(4, 2) not null default 5,
  vector vector(6),
  updated_at timestamptz not null default now()
);

create table if not exists dish_dietary_flags (
  dish_id text not null references dishes(id) on delete cascade,
  dietary_flag_id uuid not null references dietary_flags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (dish_id, dietary_flag_id)
);

create table if not exists user_profiles (
  id uuid primary key,
  display_name text,
  email citext,
  dietary_preferences text[] not null default '{}',
  favourite_dish_ids text[] not null default '{}',
  reviewed_dish_ids text[] not null default '{}',
  taste_profile jsonb,
  dishes_reviewed integer not null default 0,
  stalls_visited integer not null default 0,
  favourites_count integer not null default 0,
  sweet numeric(4, 2),
  spicy numeric(4, 2),
  sour numeric(4, 2),
  salty numeric(4, 2),
  rich numeric(4, 2),
  aromatic numeric(4, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_taste_vectors (
  user_id uuid primary key,
  sweet numeric(4, 2) not null default 5,
  spicy numeric(4, 2) not null default 5,
  sour numeric(4, 2) not null default 5,
  salty numeric(4, 2) not null default 5,
  rich numeric(4, 2) not null default 5,
  aromatic numeric(4, 2) not null default 5,
  vector vector(6),
  updated_at timestamptz not null default now()
);

create table if not exists user_favourite_dishes (
  user_id uuid not null,
  dish_id text not null references dishes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, dish_id)
);

create table if not exists reviews (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid,
  dish_id text not null references dishes(id) on delete cascade,
  venue_id text references venues(id) on delete set null,
  author_name text,
  rating numeric(2, 1) not null check (rating >= 0 and rating <= 5),
  text text not null default '',
  tags text[] not null default '{}',
  would_recommend boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_reviews_dish_id on reviews(dish_id);
create index if not exists idx_reviews_user_id on reviews(user_id);

create table if not exists review_photos (
  id uuid primary key default uuid_generate_v4(),
  review_id uuid not null references reviews(id) on delete cascade,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (review_id, sort_order)
);

create table if not exists blog_posts (
  id text primary key,
  title text not null,
  excerpt text not null default '',
  area text not null default 'Singapore',
  source_name text not null default 'Hungry',
  source_logo text not null default 'HG',
  image_url text,
  url text not null,
  related_venue_id text references venues(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists stall_posts (
  id text primary key,
  venue_id text references venues(id) on delete set null,
  building_id text references buildings(id) on delete set null,
  author_name text not null default 'Hungry',
  author_location text not null default 'Singapore',
  author_avatar_url text,
  media_type text not null default 'photo' check (media_type in ('photo', 'video')),
  media_url text not null,
  caption text not null default '',
  dish_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists bites (
  id text primary key default uuid_generate_v4()::text,
  author_id uuid,
  author_name text not null default 'Hungry User',
  author_avatar text,
  dish_id text references dishes(id) on delete set null,
  dish_name text not null default '',
  venue_id text references venues(id) on delete set null,
  venue_name text not null default '',
  unit_number text not null default '',
  building_id text references buildings(id) on delete set null,
  building_name text not null default '',
  photo_url text not null,
  caption text not null default '',
  sweet numeric(4, 2) not null default 5,
  spicy numeric(4, 2) not null default 5,
  sour numeric(4, 2) not null default 5,
  salty numeric(4, 2) not null default 5,
  rich numeric(4, 2) not null default 5,
  aromatic numeric(4, 2) not null default 5,
  craving_count integer not null default 0,
  saved_count integer not null default 0,
  rating numeric(2, 1) not null default 0,
  price numeric(8, 2) not null default 0,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create index if not exists idx_bites_created_at on bites(created_at desc);
create index if not exists idx_bites_dish_id on bites(dish_id);

create table if not exists bite_reactions (
  id uuid primary key default uuid_generate_v4(),
  bite_id text not null references bites(id) on delete cascade,
  user_id uuid not null,
  reaction text not null check (reaction in ('craving', 'save')),
  created_at timestamptz not null default now(),
  unique (bite_id, user_id, reaction)
);
