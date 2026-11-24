-- Validates real paging under guest and diner roles. Fixtures are rolled back.
begin;

insert into public.buildings (id, name, building_type, latitude, longitude)
values ('smoke-sdr-building', 'Smoke SDR Building', 'hawker_centre', 1.2803, 103.8448);

insert into public.venues (id, building_id, name, floor, operating_hours)
values
  ('smoke-sdr-menu', 'smoke-sdr-building', 'Smoke SDR Menu', '1', '09:00-17:00'),
  ('smoke-sdr-empty', 'smoke-sdr-building', 'Smoke SDR Empty', '1', ''),
  ('smoke-sdr-hidden', 'smoke-sdr-building', 'Smoke SDR Nonconsumer', '1', '');

insert into app_private.catalog_excluded_venues (venue_id, reason)
values ('smoke-sdr-hidden', 'manual');

insert into public.dishes (
  id, venue_id, building_id, name, price, price_confidence, rating_avg, review_count,
  distance_meters, availability_flags, menu_approved_for_display, menu_rights_status,
  image_url, media_approved_for_display, media_rights_status, archived_at, merchant_draft
)
select
  'smoke-sdr-dish-' || lpad(i::text, 3, '0'),
  'smoke-sdr-menu', 'smoke-sdr-building', 'Smoke SDR Dish ' || i, 5,
  case when i = 1 then 'delivery_price' end,
  case
    when i = 123 and not (
      select attnotnull from pg_attribute
      where attrelid = 'public.dishes'::regclass and attname = 'rating_avg'
    ) then null
    when i <= 123 then 3 + (i % 4) * 0.25
    else 4.9
  end,
  i % 3,
  case when i > 123 then 0 else (i % 4) * 200 end,
  case when i = 1 then array['sold_out'] else '{}'::text[] end,
  i < 125,
  case when i >= 125 then 'unverified' else 'merchant_owned' end,
  'https://example.com/hidden-smoke-image.jpg', false, 'unverified',
  case when i = 124 then now() end,
  i = 126
from generate_series(1, 126) i;

do $$
declare
  v_sig regprocedure;
begin
  foreach v_sig in array array[
    'public.get_stall_header(text)'::regprocedure,
    'public.get_stall_menu_page(text,text,integer)'::regprocedure,
    'public.get_venue_detail(text)'::regprocedure,
    'public.search_venues_by_location(text,text,double precision,double precision,integer,integer)'::regprocedure
  ] loop
    if exists (select 1 from pg_proc where oid = v_sig and (prosecdef or provolatile <> 'v'))
      or not has_function_privilege('anon', v_sig, 'EXECUTE')
      or not has_function_privilege('authenticated', v_sig, 'EXECUTE')
    then
      raise exception 'Stall RPC must run as the caller in a rate-limited POST: %', v_sig;
    end if;
  end loop;
end;
$$;

set local role anon;

do $$
declare
  v_page record;
  v_cursor text;
  v_all jsonb := '[]'::jsonb;
  v_legacy jsonb;
  v_legacy_page jsonb;
  v_expected text[];
  v_actual text[];
  v_item jsonb;
begin
  select * into v_page from public.get_stall_header('smoke-sdr-menu');
  if v_page.venue_id is distinct from 'smoke-sdr-menu'
    or v_page.operating_hours is distinct from '09:00-17:00'
    or to_jsonb(v_page) ?| array['dishes', 'claim_status', 'active_promotions', 'merchant_profile']
  then
    raise exception 'Expected a lean populated stall header';
  end if;

  if exists (select 1 from public.get_stall_header('smoke-sdr-hidden'))
    or exists (select 1 from public.get_stall_menu_page('smoke-sdr-hidden'))
    or exists (select 1 from public.get_stall_header('smoke-sdr-missing'))
    or exists (select 1 from public.get_stall_menu_page('smoke-sdr-missing'))
  then
    raise exception 'Hidden and missing venues must return no rows';
  end if;

  select * into v_page from public.get_stall_menu_page('smoke-sdr-empty');
  if v_page.dishes is distinct from '[]'::jsonb or v_page.next_cursor is not null then
    raise exception 'An existing empty venue must have an empty menu row';
  end if;

  for i in 1..7 loop
    select * into v_page from public.get_stall_menu_page('smoke-sdr-menu', v_cursor);
    if jsonb_array_length(v_page.dishes) is distinct from (case when i < 7 then 20 else 3 end)
      or (v_page.next_cursor is not null) is distinct from (i < 7)
    then
      raise exception 'Unexpected page shape at page %', i;
    end if;
    v_all := v_all || v_page.dishes;
    v_cursor := v_page.next_cursor;
  end loop;

  if (select count(distinct j->>'dish_id') from jsonb_array_elements(v_all) j) <> 123 then
    raise exception 'Expected 123 distinct visible dishes across all menu pages';
  end if;

  select j into v_item
  from jsonb_array_elements(v_all) j
  where j->>'dish_id' = 'smoke-sdr-dish-001';
  if v_item->>'price_basis' is distinct from 'delivery'
    or v_item->>'halal_status' is distinct from 'unknown'
    or v_item->'availability_flags' is distinct from '["sold_out"]'::jsonb
    or v_item->>'image_url' is not null
    or v_item->'gallery' is distinct from '[]'::jsonb
  then
    raise exception 'Menu did not preserve price, availability or media evidence';
  end if;

  if exists (
    select 1 from jsonb_array_elements(v_all) j
    where j->>'dish_id' in ('smoke-sdr-dish-124', 'smoke-sdr-dish-125', 'smoke-sdr-dish-126')
      or (j->>'dish_id' = 'smoke-sdr-dish-002' and j->>'price_basis' is not null)
  ) then
    raise exception 'Menu exposed a restricted dish or labeled an unknown price source';
  end if;

  select * into v_page from public.get_stall_menu_page('smoke-sdr-menu', p_limit => 100);
  if jsonb_array_length(v_page.dishes) is distinct from 50 or v_page.next_cursor is null then
    raise exception 'Menu page must be capped at 50 items';
  end if;

  begin
    perform * from public.get_stall_menu_page('smoke-sdr-empty', v_page.next_cursor);
    raise exception 'Menu cursor was accepted for a different venue';
  exception when invalid_parameter_value then
    null;
  end;

  begin
    perform * from public.get_stall_menu_page('smoke-sdr-menu', '{bad cursor');
    raise exception 'Malformed menu cursor was accepted';
  exception when invalid_parameter_value then
    null;
  end;

  select dishes into v_legacy from public.get_venue_detail('smoke-sdr-menu');
  if jsonb_array_length(v_legacy) is distinct from 50 then
    raise exception 'Legacy clients must receive a 50-item first page';
  end if;

  select array_agg(j->>'dish_id' order by n) into v_actual
  from jsonb_array_elements(v_legacy) with ordinality as s(j, n);

  select array_agg(s.dish_id order by s.cursor_score desc, s.cursor_id) into v_expected
  from public.search_dishes(p_venue_id => 'smoke-sdr-menu', p_limit => 50) s;
  if v_actual is distinct from v_expected then
    raise exception 'Legacy embedded menu does not share the search rank';
  end if;

  v_legacy_page := v_legacy;
  for i in 1..2 loop
    select jsonb_agg(to_jsonb(s) order by s.cursor_score desc, s.cursor_id) into v_legacy_page
    from public.search_dishes(
      p_venue_id => 'smoke-sdr-menu',
      p_cursor_score => (v_legacy_page->49->>'cursor_score')::double precision,
      p_cursor_id => v_legacy_page->49->>'cursor_id',
      p_limit => 50
    ) s;
    if jsonb_array_length(v_legacy_page) is distinct from (case when i = 1 then 50 else 23 end) then
      raise exception 'Legacy continuation must have the expected page size, page %', i;
    end if;
    v_legacy := v_legacy || v_legacy_page;
  end loop;

  select array_agg(j->>'dish_id' order by n) into v_actual
  from jsonb_array_elements(v_legacy) with ordinality as s(j, n);

  select array_agg(j->>'dish_id' order by n) into v_expected
  from jsonb_array_elements(v_all) with ordinality as s(j, n);
  if v_actual is distinct from v_expected then
    raise exception 'Legacy paging skips, reorders or repeats visible dishes';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0048-b000-000000000001', true);
set local role authenticated;

do $$
begin
  if not exists (
    select 1 from public.get_stall_header('smoke-sdr-menu') h
    where h.name = 'Smoke SDR Menu'
  ) or not exists (
    select 1 from public.get_stall_menu_page('smoke-sdr-menu', p_limit => 1) p
    where jsonb_array_length(p.dishes) = 1 and p.next_cursor is not null
  ) then
    raise exception 'Signed-in diners must be able to read the stall header and menu';
  end if;
end;
$$;

reset role;

select 'split_stall_detail_reads_smoke_passed' as result;

rollback;
