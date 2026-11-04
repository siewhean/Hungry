-- smoke: supabase/smoke/venue_detail_merchant_reads.sql
-- The stall page opens with fewer requests (round-four stall page, R4-STALL-13).
--
-- Opening a stall made eight reads: the stall, its menu page, claim status, merchant profile,
-- promotions, opening schedule, reviews and the diner's saved/visited marks. get_venue_detail
-- (based on 20261022050000_stall_dish_detail_reads.sql, the latest definition) already returns
-- the building, dishes, delivery links, photo, opening schedule and pin, so the three merchant
-- reads move into it. It now also returns, appended so older clients that read by name keep working:
--   merchant_profile    the row get_public_merchant_profile(venue) returns, as json, or null
--                       (verified, live outlets only: the same rule as that function)
--   active_promotions   the rows list_customer_active_promotions(venue, null) returns, as a json
--                       array ([] when there are none)
--   claim_status        the signed-in diner's own claim on this venue ('new', 'contacted',
--                       'qualified', 'converted' or 'rejected'); null for guests and when
--                       they have not claimed it
-- claim_status goes through a small definer helper because anon has no access to
-- merchant_claim_interests and an invoker read of it would fail for guests; the helper returns
-- only the caller's own row. get_venue_detail stays SECURITY INVOKER with the anon/authenticated
-- grants and, being rate limited (rpc/get_venue_detail), VOLATILE (see 20261022130000).
-- Down: supabase/rollbacks/20261028190000_venue_detail_merchant_reads.down.sql.

create schema if not exists app_private;
grant usage on schema app_private to anon, authenticated, service_role;

create or replace function app_private.my_merchant_claim_status(p_venue_id text)
returns text
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select mci.status
  from public.merchant_claim_interests mci
  where mci.venue_id = p_venue_id
    and mci.claimed_by = (select auth.uid())
  limit 1;
$$;

revoke all on function app_private.my_merchant_claim_status(text) from public;
grant execute on function app_private.my_merchant_claim_status(text) to anon, authenticated;

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
