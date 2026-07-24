-- Release 0.1: close Advisor findings without widening the authenticated raw
-- catalog lane. The conditional view changes cover legacy linked-project
-- objects that predate the migration history.

-- This migration must follow the Versioned Raw Catalog Reads chain. A clear
-- prerequisite failure is safer than applying only a subset of the grant
-- hardening to an unreconciled remote schema.
do $$
declare
  function_signature text;
  missing_signatures text[] := '{}';
begin
  foreach function_signature in array array[
    'public.catalog_raw_release_for_read(uuid)',
    'public.catalog_raw_require_authenticated()',
    'public.catalog_raw_cursor(jsonb)',
    'public.catalog_raw_cursor_value(text)',
    'public.catalog_raw_dishes_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text,text[])',
    'public.catalog_raw_venue_menu_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text,text[])',
    'public.catalog_raw_venues_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text[])',
    'public.catalog_raw_dish_detail(text,uuid)',
    'public.catalog_raw_venue_detail(text,uuid)',
    'public.catalog_raw_map_view(double precision,double precision,double precision,double precision,double precision,uuid,double precision,double precision,integer,text[],text[],boolean,numeric)'
  ] loop
    if to_regprocedure(function_signature) is null then
      missing_signatures := array_append(missing_signatures, function_signature);
    end if;
  end loop;

  if cardinality(missing_signatures) > 0 then
    raise exception 'release advisor hardening prerequisites are absent: %', array_to_string(missing_signatures, ', ');
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.v_venue_data_quality') is not null then
    alter view public.v_venue_data_quality set (security_invoker = true);
    revoke all on table public.v_venue_data_quality from public, anon, authenticated;
    grant select on table public.v_venue_data_quality to service_role;
  end if;

  if to_regclass('public.v_data_quality_dashboard') is not null then
    alter view public.v_data_quality_dashboard set (security_invoker = true);
    revoke all on table public.v_data_quality_dashboard from public, anon, authenticated;
    grant select on table public.v_data_quality_dashboard to service_role;
  end if;
end;
$$;

-- This linked-project-only RPC has no repository owner or client call path.
-- Remove it from client roles rather than accepting an untracked definer route.
do $$
declare
  function_signature text := 'public.catalog_raw_discover_sections(double precision,double precision,integer,text,uuid,integer,text[],text[],numeric)';
begin
  if to_regprocedure(function_signature) is not null then
    execute format('revoke all on function %s from public, anon, authenticated', function_signature);
    execute format('grant execute on function %s to service_role', function_signature);
  end if;
end;
$$;

-- Pin every app-owned function reported with a mutable search_path. These
-- signatures are guarded because several are legacy linked-project objects.
do $$
declare
  function_signature text;
begin
  foreach function_signature in array array[
    'public.venue_is_open_now(text)',
    'public.flag_stale_venue_records()',
    'public.flag_stale_venue_records(integer)',
    'public.promote_submission_to_venue(uuid)',
    'public.determine_change_request_risk(text,text,jsonb)',
    'public.hungry_set_dish_food_type_tag()',
    'public.hungry_classify_food_type(text)',
    'public.catalog_raw_cursor(jsonb)',
    'public.catalog_raw_cursor_value(text)'
  ] loop
    if to_regprocedure(function_signature) is not null then
      execute format('alter function %s set search_path = public, pg_catalog, pg_temp', function_signature);
    end if;
  end loop;
end;
$$;

-- The following helpers are called only from SECURITY DEFINER outer RPCs.
-- Removing their direct grants keeps them unreachable through PostgREST while
-- retaining the authenticated raw catalog read lane.
revoke all on function public.catalog_raw_release_for_read(uuid) from public, anon, authenticated;
revoke all on function public.catalog_raw_require_authenticated() from public, anon, authenticated;
revoke all on function public.catalog_raw_cursor(jsonb) from public, anon, authenticated;
revoke all on function public.catalog_raw_cursor_value(text) from public, anon, authenticated;
grant execute on function public.catalog_raw_release_for_read(uuid) to service_role;
grant execute on function public.catalog_raw_require_authenticated() to service_role;
grant execute on function public.catalog_raw_cursor(jsonb) to service_role;
grant execute on function public.catalog_raw_cursor_value(text) to service_role;

-- These are administrative or trigger functions, not client RPCs.
do $$
declare
  function_signature text;
begin
  foreach function_signature in array array[
    'public.apply_merchant_change_request(uuid)',
    'public.promote_submission_to_venue(uuid)',
    'public.submit_change_request_for_outlet(uuid,text,text,jsonb,text)',
    'public.trg_fn_user_stall_submissions_notifications()',
    'public.trg_merchant_change_requests_before_insert()',
    'public.trg_merchant_change_requests_after_insert()',
    'public.trg_merchant_change_requests_after_update()'
  ] loop
    if to_regprocedure(function_signature) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', function_signature);
      execute format('grant execute on function %s to service_role', function_signature);
    end if;
  end loop;
end;
$$;

-- Keep outer raw-read RPCs explicitly authenticated-only. Their
-- SECURITY DEFINER bodies enforce auth.uid() and their projection tables have
-- no direct client read policy.
revoke all on function public.catalog_raw_dishes_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text, text[]) from public, anon;
revoke all on function public.catalog_raw_venue_menu_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text, text[]) from public, anon;
revoke all on function public.catalog_raw_venues_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text[]) from public, anon;
revoke all on function public.catalog_raw_dish_detail(text, uuid) from public, anon;
revoke all on function public.catalog_raw_venue_detail(text, uuid) from public, anon;
revoke all on function public.catalog_raw_map_view(double precision, double precision, double precision, double precision, double precision, uuid, double precision, double precision, integer, text[], text[], boolean, numeric) from public, anon;
grant execute on function public.catalog_raw_dishes_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text, text[]) to authenticated, service_role;
grant execute on function public.catalog_raw_venue_menu_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text, text[]) to authenticated, service_role;
grant execute on function public.catalog_raw_venues_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text[]) to authenticated, service_role;
grant execute on function public.catalog_raw_dish_detail(text, uuid) to authenticated, service_role;
grant execute on function public.catalog_raw_venue_detail(text, uuid) to authenticated, service_role;
grant execute on function public.catalog_raw_map_view(double precision, double precision, double precision, double precision, double precision, uuid, double precision, double precision, integer, text[], text[], boolean, numeric) to authenticated, service_role;
