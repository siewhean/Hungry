-- merchant-L19: pinning a review to the featured-visitors showcase copied the diner's avatar
-- onto the pin. The showcase now shows the display name only (no photo) until diners can opt
-- out. Redefines public.normalize_merchant_popular_visitor_pin(), based on its only definition
-- (20260524041000); the one change is author_avatar_url := null. Existing pins are cleared.

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
  -- The diner's photo is not copied into the merchant's showcase.
  new.author_avatar_url := null;
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

-- The normalize trigger is skipped for this clean-up so a pin whose review is gone still clears.
alter table public.merchant_popular_visitor_pins
  disable trigger trg_normalize_merchant_popular_visitor_pin;

update public.merchant_popular_visitor_pins
set author_avatar_url = null
where author_avatar_url is not null;

alter table public.merchant_popular_visitor_pins
  enable trigger trg_normalize_merchant_popular_visitor_pin;
