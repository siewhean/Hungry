-- smoke: supabase/smoke/n_plus_one_batched_reads.sql
-- N+1 sweep: reads the app and the OCR worker used to repeat once per row.
--
-- get_item_details      names, photos and prices for a set of dish and stall ids in one call
--                       (checklists asked once per item through get_dish_detail / get_venue_detail).
-- get_venue_summaries   the get_venue_detail columns without the embedded 50-dish page, for a set
--                       of venue ids (Decide for Me read one full venue detail per candidate stall
--                       just to know whether it was open).
-- apply_menu_draft_matches   the ingest-menu-photo worker bumped each matched draft with its own
--                       UPDATE; one set-based UPDATE now does them all.
--
-- merchant_set_dishes_availability_flag   "Mark all available" called the one-dish function once
--                       per sold-out dish; one UPDATE now covers the whole list.
-- reorder_popular_visitor_pins   saving a new pin order ran one UPDATE per pin.
--
-- Rollback: drop function public.get_item_details(text[], text[]);
--           drop function public.get_venue_summaries(text[]);
--           drop function public.apply_menu_draft_matches(jsonb);
--           drop function public.merchant_set_dishes_availability_flag(text[], text, text, boolean);
--           drop function public.reorder_popular_visitor_pins(uuid, uuid[]);

create or replace function public.get_item_details(
  p_dish_ids text[] default '{}',
  p_stall_ids text[] default '{}'
)
returns table (
  dish_id text,
  stall_id text,
  name text,
  stall_name text,
  price numeric,
  image_url text
)
language sql
volatile
security invoker
set search_path = public
as $$
  select
    d.id,
    null::text,
    d.name,
    dv.name,
    d.price,
    public.catalog_display_image_url(
      d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url
    )
  from public.dishes d
  left join public.venues dv on dv.id = d.venue_id
  where d.id = any(p_dish_ids[1:200])
  union all
  select
    null::text,
    v.id,
    v.name,
    v.name,
    null::numeric,
    public.catalog_display_image_url(
      v.image_url, v.media_approved_for_display, v.media_rights_status, v.media_source_url
    )
  from public.venues v
  where v.id = any(p_stall_ids[1:200]);
$$;

revoke all on function public.get_item_details(text[], text[]) from public, anon;
grant execute on function public.get_item_details(text[], text[]) to authenticated, service_role;

create or replace function public.get_venue_summaries(p_venue_ids text[])
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
  display_image_url text,
  opening_schedule jsonb,
  latitude double precision,
  longitude double precision
)
language sql
volatile
security invoker
set search_path = public, extensions
as $$
  select
    v.id,
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
    ),
    coalesce(vdl.links, '[]'::jsonb),
    public.catalog_display_image_url(
      v.image_url, v.media_approved_for_display, v.media_rights_status, v.media_source_url
    ),
    v.opening_schedule,
    v.latitude,
    v.longitude
  from public.venues v
  join public.buildings b on b.id = v.building_id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'platform', l.platform,
        'nativeUrl', l.native_url,
        'webUrl', l.web_url,
        'affiliateEligible', l.affiliate_eligible
      )
      order by l.platform
    ) as links
    from public.venue_delivery_links l
    where l.venue_id = v.id
  ) vdl on true
  where v.id = any(p_venue_ids[1:50]);
$$;

grant execute on function public.get_venue_summaries(text[]) to anon, authenticated, service_role;

-- Set-based confidence bump for drafts the OCR worker matched to an existing draft.
-- p_matches: [{"id": uuid, "confidence": 0..1, "bumps": integer}, ...]
create or replace function public.apply_menu_draft_matches(p_matches jsonb)
returns integer
language sql
security invoker
set search_path = public
as $$
  with matches as (
    select m.id, m.confidence, m.bumps
    from jsonb_to_recordset(coalesce(p_matches, '[]'::jsonb))
      as m(id uuid, confidence numeric, bumps integer)
  ),
  updated as (
    update public.dishes_draft d
    set extraction_confidence = greatest(d.extraction_confidence, least(greatest(m.confidence, 0), 1)),
        confidence_bumps = d.confidence_bumps + greatest(m.bumps, 0),
        updated_at = now()
    from matches m
    where d.id = m.id
    returning d.id
  )
  select count(*)::integer from updated;
$$;

revoke all on function public.apply_menu_draft_matches(jsonb) from public, anon, authenticated;
grant execute on function public.apply_menu_draft_matches(jsonb) to service_role;

-- Sets or clears one availability flag on many dishes of a venue with a single UPDATE.
-- Returns the ids that changed; a dish that is missing or not editable by the caller is left out.
-- SECURITY INVOKER like merchant_set_dish_availability_flag: the merchant's own RLS decides.
create or replace function public.merchant_set_dishes_availability_flag(
  p_dish_ids text[],
  p_venue_id text,
  p_flag text,
  p_enabled boolean
)
returns text[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_flag text := public.merchant_normalize_availability_flag(p_flag);
  v_changed text[];
begin
  if v_flag = '' then
    raise exception 'availability flag is required' using errcode = '22023';
  end if;
  if p_enabled is null then
    raise exception 'enabled is required' using errcode = '22023';
  end if;

  with updated as (
    update public.dishes d
    set availability_flags = (
      select coalesce(array_agg(f.flag order by f.ord), '{}'::text[])
      from unnest(d.availability_flags) with ordinality as f(flag, ord)
      where public.merchant_normalize_availability_flag(f.flag) <> v_flag
    ) || case when p_enabled then array[v_flag] else '{}'::text[] end
    where d.id = any(p_dish_ids[1:200])
      and d.venue_id = p_venue_id
    returning d.id
  )
  select coalesce(array_agg(id), '{}'::text[]) into v_changed from updated;
  return v_changed;
end;
$$;

revoke all on function public.merchant_set_dishes_availability_flag(text[], text, text, boolean)
  from public, anon;
grant execute on function public.merchant_set_dishes_availability_flag(text[], text, text, boolean)
  to authenticated, service_role;

-- Saves a new order for an outlet's active popular-visitor pins in one UPDATE.
-- The first id gets sort_order 0. SECURITY INVOKER: the merchant's RLS decides which pins change.
create or replace function public.reorder_popular_visitor_pins(
  p_outlet_id uuid,
  p_pin_ids uuid[]
)
returns integer
language sql
security invoker
set search_path = public
as $$
  with updated as (
    update public.merchant_popular_visitor_pins p
    set sort_order = o.position - 1
    from unnest(p_pin_ids[1:100]) with ordinality as o(id, position)
    where p.id = o.id
      and p.outlet_id = p_outlet_id
      and p.is_active
    returning p.id
  )
  select count(*)::integer from updated;
$$;

revoke all on function public.reorder_popular_visitor_pins(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_popular_visitor_pins(uuid, uuid[]) to authenticated, service_role;

-- Rate limits (CLAUDE.md rule 10). Volatile read RPCs above so the limiter can count them.
insert into app_private.request_rate_rules (route, anon_per_minute, user_per_minute, note) values
  ('rpc/get_venue_summaries', 120, 180, 'stall summaries for open-now checks'),
  ('rpc/get_item_details', null, 120, 'names and photos for list items'),
  ('rpc/merchant_set_dishes_availability_flag', null, 60, 'bulk sold-out toggle'),
  ('rpc/reorder_popular_visitor_pins', null, 30, 'featured visitor reorder')
on conflict (route) do update
  set anon_per_minute = excluded.anon_per_minute,
      user_per_minute = excluded.user_per_minute,
      note = excluded.note;

notify pgrst, 'reload schema';
