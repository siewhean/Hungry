-- Preserve the existing detail RPC signature while exposing cuisine metadata to
-- clients that can consume it. A versioned RPC avoids dropping the deployed
-- function or changing its table return type in place.
create or replace function public.get_dish_detail_v2(p_dish_id text)
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
  cuisine_tags text[],
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
    detail.dish_id,
    detail.venue_id,
    detail.building_id,
    detail.venue_name,
    detail.unit_number,
    detail.floor,
    detail.name,
    detail.image_url,
    detail.blurhash,
    detail.distance_meters,
    detail.rating,
    detail.review_count,
    detail.price,
    detail.price_range,
    detail.live_crowd,
    detail.taste_tags,
    coalesce(d.cuisine_tags, v.cuisine_tags, '{}'::text[]) as cuisine_tags,
    detail.taste_vector,
    detail.dietary_flags,
    detail.gallery,
    detail.description,
    detail.must_order,
    detail.availability_flags,
    detail.reviews
  from public.get_dish_detail(p_dish_id) detail
  join public.dishes d on d.id = detail.dish_id
  join public.venues v on v.id = detail.venue_id;
$$;

revoke all on function public.get_dish_detail_v2(text) from public;
grant execute on function public.get_dish_detail_v2(text) to anon, authenticated;

-- Bound recommendation/profile detail hydration to one network round trip.
create or replace function public.get_dish_details(p_dish_ids text[])
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
  cuisine_tags text[],
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
  select detail.*
  from unnest(coalesce(p_dish_ids, '{}'::text[])) with ordinality requested(dish_id, position)
  cross join lateral public.get_dish_detail_v2(requested.dish_id) detail
  order by requested.position;
$$;

revoke all on function public.get_dish_details(text[]) from public;
grant execute on function public.get_dish_details(text[]) to anon, authenticated;
