-- expect-row-loss: app_private.request_rate_rules
-- down-loses-data: the two rate-limit configuration rows added by this migration are recreated on reapply.
set local lock_timeout = '2s';

do $rollback$
declare
  v_restore jsonb := obj_description(
    'app_private.stall_menu_rows(text,double precision,text,integer,boolean)'::regprocedure,
    'pg_proc'
  )::jsonb;
begin
  if jsonb_typeof(v_restore->'repair_venue') is distinct from 'boolean'
    or jsonb_typeof(v_restore->'repair_search') is distinct from 'boolean'
  then
    raise exception 'Stall detail rollback cannot identify the prior function definitions';
  end if;

  if (v_restore->>'repair_venue')::boolean then
    execute $legacy$
CREATE OR REPLACE FUNCTION public.get_venue_detail(p_venue_id text)
 RETURNS TABLE(
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
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public', 'extensions'
AS $function$
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
      select jsonb_agg(
        jsonb_build_object(
          'dish_id', d.id,
          'id', d.id,
          'venue_id', d.venue_id,
          'building_id', d.building_id,
          'venue_name', v.name,
          'unit_number', v.unit_number,
          'floor', v.floor,
          'name', d.name,
          'image_url', coalesce(
            public.catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url),
            public.catalog_display_image_url(v.image_url, v.media_approved_for_display, v.media_rights_status, v.media_source_url)
          ),
          'blurhash', d.blurhash,
          'distance_meters', 0,
          'rating', d.rating_avg,
          'rating_avg', d.rating_avg,
          'review_count', d.review_count,
          'price', d.price,
          'price_range', d.price_range,
          'live_crowd', d.live_crowd,
          'taste_tags', d.taste_tags,
          'taste_vector', jsonb_build_object(
            'sweet', coalesce(dtv.sweet, 5),
            'spicy', coalesce(dtv.spicy, 5),
            'sour', coalesce(dtv.sour, 5),
            'salty', coalesce(dtv.salty, 5),
            'rich', coalesce(dtv.rich, 5),
            'aromatic', coalesce(dtv.aromatic, 5)
          ),
          'dietary_flags', coalesce((
            select array_agg(df.slug::text order by df.slug::text)
            from dish_dietary_flags ddf
            join dietary_flags df on df.id = ddf.dietary_flag_id
            where ddf.dish_id = d.id
          ), '{}'::text[]),
          'gallery', coalesce((
            select array_agg(safe_image.url order by safe_image.sort_order)
            from (
              select
                di.sort_order,
                public.catalog_display_image_url(di.url, di.media_approved_for_display, di.media_rights_status, di.media_source_url) as url
              from dish_images di
              where di.dish_id = d.id
            ) safe_image
            where safe_image.url is not null
          ), case
            when coalesce(
              public.catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url),
              public.catalog_display_image_url(v.image_url, v.media_approved_for_display, v.media_rights_status, v.media_source_url)
            ) is null then '{}'::text[]
            else array[
              coalesce(
                public.catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url),
                public.catalog_display_image_url(v.image_url, v.media_approved_for_display, v.media_rights_status, v.media_source_url)
              )
            ]
          end),
          'description', d.description,
          'must_order', d.must_order,
          'availability_flags', d.availability_flags,
          'food_type', d.food_type,
          'course', d.course,
          'cuisine_tags', d.cuisine_tags,
          'rank_score', coalesce(d.rating_avg, 4.0)::double precision,
          'cursor_score', coalesce(d.rating_avg, 4.0)::double precision,
          'cursor_id', d.id,
          'price_basis', case d.price_confidence
            when 'counter_price' then 'counter'
            when 'listed_price' then 'menu'
            when 'delivery_price' then 'delivery'
            else 'menu'
          end,
          'price_checked_at', coalesce(d.price_checked_at, d.created_at)
        )
        order by d.is_featured desc, d.must_order desc, d.rating_avg desc nulls last, d.id
      )
      from (
        select d.*
        from dishes d
        where d.venue_id = v.id
          and d.archived_at is null
          and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
        order by d.is_featured desc, d.must_order desc, d.rating_avg desc nulls last, d.id
        limit 100
      ) d
      left join dish_taste_vectors dtv on dtv.dish_id = d.id
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
$function$
$legacy$;
  end if;

  if (v_restore->>'repair_search')::boolean then
    alter function public.search_venues_by_location(text,text,double precision,double precision,integer,integer)
      stable;
  end if;
end;
$rollback$;

drop function public.get_stall_menu_page(text, text, integer);
drop function public.get_stall_header(text);
drop function app_private.stall_menu_rows(text, double precision, text, integer, boolean);

delete from app_private.request_rate_rules
where route in ('rpc/get_stall_header', 'rpc/get_stall_menu_page');

notify pgrst, 'reload schema';
