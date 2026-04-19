-- Phase 7 baseline seed for discovery/search venue categories.
-- Idempotent and migration-safe.

create table if not exists venue_categories (
  id uuid primary key default gen_random_uuid(),
  slug citext not null unique,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists venue_category_links (
  venue_id text not null references venues(id) on delete cascade,
  category_id uuid not null references venue_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (venue_id, category_id)
);

alter table venue_categories enable row level security;
alter table venue_category_links enable row level security;

drop policy if exists "public_select_venue_categories" on venue_categories;
create policy "public_select_venue_categories" on venue_categories for select using (true);

drop policy if exists "public_select_venue_category_links" on venue_category_links;
create policy "public_select_venue_category_links" on venue_category_links for select using (true);

insert into venue_categories (slug, display_name)
values
  ('local_favourites', 'local favourites'),
  ('noodles', 'noodles'),
  ('rice', 'rice'),
  ('desserts', 'desserts'),
  ('late_night', 'late night')
on conflict (slug) do update
set display_name = excluded.display_name;
