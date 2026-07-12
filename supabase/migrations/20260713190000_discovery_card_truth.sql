-- Enrich the location feed with the exact card values consumed by the app.
-- The v1 function remains available during rollout; clients prefer this v2 RPC.

begin;

create or replace function public.get_discovery_card_feed_by_location(
  p_area_name text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_meters integer default 3000,
  p_limit integer default 50
)
returns table (
  venue_id text,
  venue_name text,
  venue_logo_url text,
  venue_image_url text,
  unit_number text,
  floor text,
  operating_hours text,
  building_id text,
  building_name text,
  building_image_url text,
  planning_area text,
  is_open boolean,
  distance_meters integer,
  top_dish_id text,
  top_dish_name text,
  top_dish_image text,
  top_dish_image_source_type text,
  top_dish_rating numeric,
  top_dish_review_count integer,
  top_dish_price numeric,
  top_dish_price_range text,
  top_dish_food_type_tag text,
  top_dish_cuisine_tags text[],
  top_dish_taste_tags text[],
  cuisine_tags text[],
  rank_score double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with base as materialized (
    select *
    from public.get_discovery_feed_by_location(
      p_area_name,
      p_lat,
      p_lng,
      p_radius_meters,
      least(greatest(least(greatest(coalesce(p_limit, 50), 1), 100) * 3, 50), 100)
    )
  ),
  enriched as (
    select
      base.venue_id,
      base.venue_name,
      base.venue_logo_url,
      public.catalog_display_image_url(
        v.image_url,
        v.media_approved_for_display,
        v.media_rights_status,
        v.media_source_url
      ) as venue_image_url,
      v.unit_number,
      v.floor,
      v.operating_hours,
      base.building_id,
      base.building_name,
      public.catalog_display_image_url(
        b.image_url,
        b.media_approved_for_display,
        b.media_rights_status,
        b.media_source_url
      ) as building_image_url,
      base.planning_area,
      base.is_open,
      base.distance_meters,
      base.top_dish_id,
      base.top_dish_name,
      base.top_dish_image,
      case
        when approved_dish_image.url is not null
          and base.top_dish_image = approved_dish_image.url then 'dish_image'
        when approved_dish_catalog_image.url is not null
          and base.top_dish_image = approved_dish_catalog_image.url then 'dish'
        when public.catalog_display_image_url(
          v.image_url,
          v.media_approved_for_display,
          v.media_rights_status,
          v.media_source_url
        ) = base.top_dish_image then 'venue'
        when public.catalog_display_image_url(
          b.image_url,
          b.media_approved_for_display,
          b.media_rights_status,
          b.media_source_url
        ) = base.top_dish_image then 'building'
        else 'local_fallback'
      end as top_dish_image_source_type,
      base.top_dish_rating,
      base.top_dish_review_count,
      base.top_dish_price,
      d.price_range as top_dish_price_range,
      null::text as top_dish_food_type_tag,
      coalesce(d.cuisine_tags, '{}'::text[]) as top_dish_cuisine_tags,
      coalesce(d.taste_tags, '{}'::text[]) as top_dish_taste_tags,
      coalesce(v.cuisine_tags, base.cuisine_tags, '{}'::text[]) as cuisine_tags,
      base.rank_score
    from base
    join public.venues v on v.id = base.venue_id
    join public.buildings b on b.id = base.building_id
    join public.dishes d on d.id = base.top_dish_id
    left join lateral (
      select public.catalog_display_image_url(
        di.url,
        di.media_approved_for_display,
        di.media_rights_status,
        di.media_source_url
      ) as url
      from public.dish_images di
      where di.dish_id = d.id
        and public.catalog_display_image_url(
          di.url,
          di.media_approved_for_display,
          di.media_rights_status,
          di.media_source_url
        ) is not null
      order by di.sort_order
      limit 1
    ) approved_dish_image on true
    left join lateral (
      select public.catalog_display_image_url(
        d.image_url,
        d.media_approved_for_display,
        d.media_rights_status,
        d.media_source_url
      ) as url
    ) approved_dish_catalog_image on true
    where base.top_dish_price > 0
  )
  select enriched.*
  from enriched
  order by
    enriched.distance_meters,
    (nullif(trim(enriched.top_dish_image), '') is not null) desc,
    enriched.rank_score desc,
    enriched.venue_id
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

revoke all on function public.get_discovery_card_feed_by_location(
  text,
  double precision,
  double precision,
  integer,
  integer
) from public;

grant execute on function public.get_discovery_card_feed_by_location(
  text,
  double precision,
  double precision,
  integer,
  integer
) to anon, authenticated;

commit;
