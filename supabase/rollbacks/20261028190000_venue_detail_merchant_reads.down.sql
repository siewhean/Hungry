-- Down for 20261028190000_venue_detail_merchant_reads.
-- get_venue_detail returns to the 20261022050000 columns (no merchant_profile, active_promotions
-- or claim_status) and the claim helper is dropped. Nothing is stored, so no data is lost.

drop function if exists public.get_venue_detail(text);

create function public.get_venue_detail(p_venue_id text)
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
  logo_url text,
  building jsonb,
  delivery_links jsonb,
  dishes jsonb,
  display_image_url text,
  opening_schedule jsonb,
  latitude double precision,
  longitude double precision
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
    v.logo_url,
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
    ), '[]'::jsonb) as dishes,
    public.catalog_display_image_url(
      v.image_url,
      v.media_approved_for_display,
      v.media_rights_status,
      v.media_source_url
    ) as display_image_url,
    v.opening_schedule,
    v.latitude,
    v.longitude
  from venues v
  join buildings b on b.id = v.building_id
  where v.id = p_venue_id
  limit 1;
$$;

grant execute on function public.get_venue_detail(text) to anon, authenticated;

alter function public.get_venue_detail(text) volatile;

drop function if exists app_private.my_merchant_claim_status(text);

notify pgrst, 'reload schema';
