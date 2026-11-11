-- smoke: supabase/smoke/venue_detail_delivery_from_menu_links.sql
-- The stall and dish pages show Foodpanda and Grab buttons for stalls that have those links.
--
-- Production has no rows in venue_delivery_links: the directory loads each stall's Foodpanda or
-- Grab page into venues.menu_url / menu_source_url instead, so no stall ever showed a button.
-- get_venue_detail now also returns those two columns as delivery links when they are https
-- pages on Foodpanda (foodpanda.sg) or Grab (food.grab.com, grab.com), unless
-- venue_delivery_links already has a row for that app. Same columns and grants as
-- 20261028190000; only the delivery_links value changes. Any other host (the stall's own website,
-- a map link) is ignored, so a stall with no Foodpanda or Grab page gets no button.
-- Down: supabase/rollbacks/20261111150000_venue_detail_delivery_from_menu_links.down.sql.

create schema if not exists app_private;
grant usage on schema app_private to anon, authenticated, service_role;

create or replace function app_private.delivery_platform_for_url(p_url text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when p_url ~* '^https://(www\.)?foodpanda\.sg(/|\?|$)' then 'foodpanda'
    when p_url ~* '^https://(www\.|food\.)?grab\.com(/|\?|$)' then 'grabfood'
    else null
  end;
$$;

revoke all on function app_private.delivery_platform_for_url(text) from public;
grant execute on function app_private.delivery_platform_for_url(text) to anon, authenticated;

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
  longitude double precision,
  merchant_profile jsonb,
  active_promotions jsonb,
  claim_status text
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
          'platform', l.platform,
          'nativeUrl', l.native_url,
          'webUrl', l.web_url,
          'affiliateEligible', l.affiliate_eligible
        )
        order by l.platform
      )
      from (
        select vdl.platform, vdl.native_url, vdl.web_url, vdl.affiliate_eligible
        from venue_delivery_links vdl
        where vdl.venue_id = v.id
        union all
        -- The stall's own menu link, when it is a Foodpanda or Grab page and no row above covers
        -- that app. The directory loads these into menu_url / menu_source_url.
        select p.platform, '', p.url, false
        from (
          select distinct on (c.platform) c.platform, c.url
          from (
            select app_private.delivery_platform_for_url(u.url) as platform, u.url, u.ord
            from (values (v.menu_url, 1), (v.menu_source_url, 2)) as u(url, ord)
          ) c
          where c.platform is not null
          order by c.platform, c.ord
        ) p
        where not exists (
          select 1 from venue_delivery_links e
          where e.venue_id = v.id and e.platform = p.platform
        )
      ) l
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
    v.longitude,
    (
      select to_jsonb(mp)
      from public.get_public_merchant_profile(v.id) mp
      limit 1
    ) as merchant_profile,
    coalesce((
      select jsonb_agg(to_jsonb(ap))
      from public.list_customer_active_promotions(v.id, null) ap
    ), '[]'::jsonb) as active_promotions,
    app_private.my_merchant_claim_status(v.id) as claim_status
  from venues v
  join buildings b on b.id = v.building_id
  where v.id = p_venue_id
  limit 1;
$$;

grant execute on function public.get_venue_detail(text) to anon, authenticated;

-- Rate limited reads must be VOLATILE so the limiter can write its counter (20261022130000).
alter function public.get_venue_detail(text) volatile;

-- PostgREST caches function volatility and result columns with the rest of its schema.
notify pgrst, 'reload schema';
