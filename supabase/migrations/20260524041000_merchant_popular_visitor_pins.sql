-- Merchant-selected popular visitors shown on public stall detail pages.
-- V1 pins are review-backed only so every visible visitor can open a real review.

create table if not exists public.merchant_popular_visitor_pins (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.merchant_outlets(id) on delete cascade,
  venue_id text not null references public.venues(id) on delete cascade,
  review_id uuid not null references public.reviews(id) on delete cascade,
  source_id text not null,
  author_profile_id uuid references public.public_profiles(id) on delete set null,
  author_name text not null,
  author_avatar_url text,
  author_location text,
  review_text text not null default '',
  rating numeric(2, 1) not null check (rating >= 0 and rating <= 5),
  dish_name text,
  visited_at timestamptz not null,
  pinned_at timestamptz not null default now(),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (outlet_id, review_id)
);

create index if not exists idx_popular_visitor_pins_outlet_active_order
  on public.merchant_popular_visitor_pins(outlet_id, is_active, sort_order, pinned_at desc);

create index if not exists idx_popular_visitor_pins_venue_active_order
  on public.merchant_popular_visitor_pins(venue_id, is_active, sort_order, pinned_at desc);

create or replace function public.normalize_merchant_popular_visitor_pin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  outlet_venue_id text;
  review_row public.reviews%rowtype;
  profile_row public.public_profiles%rowtype;
  resolved_dish_name text;
begin
  select mo.venue_id
    into outlet_venue_id
  from public.merchant_outlets mo
  where mo.id = new.outlet_id;

  if outlet_venue_id is null then
    raise exception 'popular visitor pin outlet must be linked to a venue';
  end if;

  if new.venue_id is distinct from outlet_venue_id then
    raise exception 'popular visitor pin venue must match the managed outlet venue';
  end if;

  select *
    into review_row
  from public.reviews r
  where r.id = new.review_id;

  if not found or review_row.venue_id is distinct from outlet_venue_id then
    raise exception 'popular visitor pin review must belong to the managed outlet venue';
  end if;

  select *
    into profile_row
  from public.public_profiles pp
  where pp.id = review_row.user_id;

  select d.name
    into resolved_dish_name
  from public.dishes d
  where d.id = review_row.dish_id;

  new.venue_id := outlet_venue_id;
  new.source_id := review_row.id::text;
  new.author_profile_id := case when profile_row.id is null then null else profile_row.id end;
  new.author_name := coalesce(profile_row.display_name, review_row.author_name, 'Hungry diner');
  new.author_avatar_url := profile_row.avatar_url;
  new.review_text := review_row.text;
  new.rating := review_row.rating;
  new.dish_name := resolved_dish_name;
  new.visited_at := review_row.created_at;
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.normalize_merchant_popular_visitor_pin() from public;
revoke execute on function public.normalize_merchant_popular_visitor_pin() from anon;
revoke execute on function public.normalize_merchant_popular_visitor_pin() from authenticated;

drop trigger if exists trg_normalize_merchant_popular_visitor_pin
  on public.merchant_popular_visitor_pins;
create trigger trg_normalize_merchant_popular_visitor_pin
before insert or update of
  outlet_id,
  venue_id,
  review_id,
  source_id,
  author_profile_id,
  author_name,
  author_avatar_url,
  review_text,
  rating,
  dish_name,
  visited_at
on public.merchant_popular_visitor_pins
for each row
execute function public.normalize_merchant_popular_visitor_pin();

alter table public.merchant_popular_visitor_pins enable row level security;

revoke all on public.merchant_popular_visitor_pins from anon, authenticated;
grant select on public.merchant_popular_visitor_pins to anon, authenticated;
grant insert, update, delete on public.merchant_popular_visitor_pins to authenticated;

drop policy if exists popular_visitor_pins_public_active_read
  on public.merchant_popular_visitor_pins;
create policy popular_visitor_pins_public_active_read
on public.merchant_popular_visitor_pins for select
to anon, authenticated
using (is_active = true);

drop policy if exists popular_visitor_pins_merchant_read
  on public.merchant_popular_visitor_pins;
create policy popular_visitor_pins_merchant_read
on public.merchant_popular_visitor_pins for select
to authenticated
using (public.merchant_can_manage_outlet_v2(outlet_id));

drop policy if exists popular_visitor_pins_merchant_insert
  on public.merchant_popular_visitor_pins;
create policy popular_visitor_pins_merchant_insert
on public.merchant_popular_visitor_pins for insert
to authenticated
with check (
  public.merchant_can_manage_outlet_v2(outlet_id)
  and exists (
    select 1
    from public.merchant_outlets mo
    where mo.id = merchant_popular_visitor_pins.outlet_id
      and mo.venue_id = merchant_popular_visitor_pins.venue_id
  )
  and exists (
    select 1
    from public.reviews r
    where r.id = merchant_popular_visitor_pins.review_id
      and r.venue_id = merchant_popular_visitor_pins.venue_id
  )
);

drop policy if exists popular_visitor_pins_merchant_update
  on public.merchant_popular_visitor_pins;
create policy popular_visitor_pins_merchant_update
on public.merchant_popular_visitor_pins for update
to authenticated
using (public.merchant_can_manage_outlet_v2(outlet_id))
with check (
  public.merchant_can_manage_outlet_v2(outlet_id)
  and exists (
    select 1
    from public.merchant_outlets mo
    where mo.id = merchant_popular_visitor_pins.outlet_id
      and mo.venue_id = merchant_popular_visitor_pins.venue_id
  )
  and exists (
    select 1
    from public.reviews r
    where r.id = merchant_popular_visitor_pins.review_id
      and r.venue_id = merchant_popular_visitor_pins.venue_id
  )
);

drop policy if exists popular_visitor_pins_merchant_delete
  on public.merchant_popular_visitor_pins;
create policy popular_visitor_pins_merchant_delete
on public.merchant_popular_visitor_pins for delete
to authenticated
using (public.merchant_can_manage_outlet_v2(outlet_id));

drop policy if exists popular_visitor_pins_service_role_all
  on public.merchant_popular_visitor_pins;
create policy popular_visitor_pins_service_role_all
on public.merchant_popular_visitor_pins for all
to service_role
using (true)
with check (true);
