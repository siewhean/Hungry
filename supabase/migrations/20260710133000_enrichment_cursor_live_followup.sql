-- Follow-up for environments that recorded 20260710130000 before its cursor
-- columns/triggers were made self-contained. This is intentionally idempotent.
-- Trusted database/service roles bypass merchant-auth guards so controlled
-- service-role enrichment and project seeding can update catalog rows; normal
-- authenticated merchant writes retain the existing column restrictions.

alter table public.venues
  add column if not exists updated_at timestamptz not null default now();

alter table public.dishes
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_venues_updated_at on public.venues;
create trigger trg_venues_updated_at
  before update on public.venues
  for each row execute function public.set_updated_at();

drop trigger if exists trg_dishes_updated_at on public.dishes;
create trigger trg_dishes_updated_at
  before update on public.dishes
  for each row execute function public.set_updated_at();

create or replace function public.enforce_merchant_venue_update_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not merchant_can_manage_venue(old.id) then
    raise exception 'not authorized to update venue' using errcode = '42501';
  end if;

  if new.id is distinct from old.id
    or new.hygiene_grade is distinct from old.hygiene_grade
    or new.is_open is distinct from old.is_open
    or new.top_dish_id is distinct from old.top_dish_id
    or new.closure_notice is distinct from old.closure_notice
    or new.live_crowd is distinct from old.live_crowd
    or new.created_at is distinct from old.created_at then
    raise exception 'merchant venue updates are limited to profile fields' using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_merchant_dish_write_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if not merchant_outlet_matches_catalog_link(new.venue_id, new.building_id) then
      raise exception 'dish insert must match a managed merchant outlet' using errcode = '42501';
    end if;

    if new.distance_meters is distinct from 0
      or new.rating_avg is distinct from 0
      or new.review_count is distinct from 0
      or new.live_crowd is not null then
      raise exception 'merchant dish inserts cannot set aggregate or live fields' using errcode = '42501';
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if not merchant_can_manage_venue(old.venue_id) then
      raise exception 'not authorized to update dish' using errcode = '42501';
    end if;

    if new.id is distinct from old.id
      or new.venue_id is distinct from old.venue_id
      or new.distance_meters is distinct from old.distance_meters
      or new.rating_avg is distinct from old.rating_avg
      or new.review_count is distinct from old.review_count
      or new.live_crowd is distinct from old.live_crowd
      or new.created_at is distinct from old.created_at then
      raise exception 'merchant dish updates cannot change identity, aggregate, or live fields' using errcode = '42501';
    end if;

    if not merchant_outlet_matches_catalog_link(new.venue_id, new.building_id) then
      raise exception 'dish building must match a managed merchant outlet' using errcode = '42501';
    end if;

    return new;
  end if;

  return new;
end;
$$;
