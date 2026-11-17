-- Guard merchant-linked catalog writes at the column level.
-- RLS proves the merchant can manage the row; these triggers prevent clients
-- from changing trust, aggregate, or system-managed catalog fields.

create or replace function merchant_outlet_matches_catalog_link(p_venue_id text, p_building_id text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from merchant_outlets mo
    left join merchant_accounts ma on ma.id = mo.merchant_account_id
    left join merchant_roles mr on mr.merchant_account_id = mo.merchant_account_id
    where mo.venue_id = p_venue_id
      and mo.building_id = p_building_id
      and (
        ma.user_id = auth.uid()
        or (mr.user_id = auth.uid() and mr.role in ('owner', 'manager'))
      )
  );
$$;

create or replace function enforce_merchant_venue_update_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
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

drop trigger if exists trg_enforce_merchant_venue_update_guard on venues;
create trigger trg_enforce_merchant_venue_update_guard
before update on venues
for each row
execute function enforce_merchant_venue_update_guard();

create or replace function enforce_merchant_dish_write_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
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

drop trigger if exists trg_enforce_merchant_dish_write_guard on dishes;
create trigger trg_enforce_merchant_dish_write_guard
before insert or update on dishes
for each row
execute function enforce_merchant_dish_write_guard();
