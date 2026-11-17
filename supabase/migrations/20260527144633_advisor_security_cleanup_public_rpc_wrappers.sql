-- Clear app-owned Supabase Security Advisor warnings introduced after the
-- earlier private-wrapper pass.
--
-- Public RPC names stay stable for the mobile app. SECURITY DEFINER bodies
-- move to app_private, and public functions become SECURITY INVOKER wrappers
-- so the exposed API schema no longer contains client-callable definer bodies.

begin;

create schema if not exists app_private;
grant usage on schema app_private to anon, authenticated, service_role;

alter function public.update_updated_at_column()
  set search_path = public, pg_catalog;

alter function public.food_cred_default_points(text)
  set search_path = public, pg_catalog;

alter function public.food_cred_daily_cap(text)
  set search_path = public, pg_catalog;

revoke all on function public.enforce_merchant_promotion_target_dish()
  from public, anon, authenticated;

revoke all on function public.refresh_merchant_analytics_daily_rollup(uuid, date)
  from public, anon, authenticated;
grant execute on function public.refresh_merchant_analytics_daily_rollup(uuid, date)
  to service_role;

revoke all on function public.refresh_merchant_dish_analytics_daily(uuid, text, date)
  from public, anon, authenticated;
grant execute on function public.refresh_merchant_dish_analytics_daily(uuid, text, date)
  to service_role;

do $$
declare
  rec record;
  v_public regprocedure;
  v_public_is_definer boolean;
  v_private regprocedure;
  v_call_sql text;
  v_body text;
  v_role text;
begin
  for rec in
    select *
    from (
      values
        (
          'record_merchant_dish_view',
          $q$p_dish_id text, p_session_id text DEFAULT NULL::text$q$,
          $q$p_dish_id text, p_session_id text$q$,
          $q$uuid$q$,
          $q$p_dish_id, p_session_id$q$,
          false,
          array['anon', 'authenticated', 'service_role']
        ),
        (
          'record_merchant_action_event',
          $q$p_event_type text, p_session_id text, p_outlet_id uuid DEFAULT NULL::uuid, p_venue_id text DEFAULT NULL::text, p_dish_id text DEFAULT NULL::text, p_promotion_id uuid DEFAULT NULL::uuid, p_source text DEFAULT 'customer'::text, p_metadata jsonb DEFAULT '{}'::jsonb$q$,
          $q$p_event_type text, p_session_id text, p_outlet_id uuid, p_venue_id text, p_dish_id text, p_promotion_id uuid, p_source text, p_metadata jsonb$q$,
          $q$uuid$q$,
          $q$p_event_type, p_session_id, p_outlet_id, p_venue_id, p_dish_id, p_promotion_id, p_source, p_metadata$q$,
          false,
          array['anon', 'authenticated', 'service_role']
        ),
        (
          'get_merchant_analytics',
          $q$p_outlet_id uuid, p_since timestamp with time zone DEFAULT NULL::timestamp with time zone, p_until timestamp with time zone DEFAULT NULL::timestamp with time zone$q$,
          $q$p_outlet_id uuid, p_since timestamp with time zone, p_until timestamp with time zone$q$,
          $q$jsonb$q$,
          $q$p_outlet_id, p_since, p_until$q$,
          false,
          array['authenticated', 'service_role']
        ),
        (
          'persist_merchant_weekly_summary',
          $q$p_outlet_id uuid, p_week_start date, p_week_end date, p_total_views integer, p_dish_views integer, p_top_dishes jsonb, p_new_reviews integer, p_average_rating numeric, p_rating_change numeric, p_unreplied_reviews integer, p_promotion_views integer, p_metadata jsonb DEFAULT '{}'::jsonb$q$,
          $q$p_outlet_id uuid, p_week_start date, p_week_end date, p_total_views integer, p_dish_views integer, p_top_dishes jsonb, p_new_reviews integer, p_average_rating numeric, p_rating_change numeric, p_unreplied_reviews integer, p_promotion_views integer, p_metadata jsonb$q$,
          $q$uuid$q$,
          $q$p_outlet_id, p_week_start, p_week_end, p_total_views, p_dish_views, p_top_dishes, p_new_reviews, p_average_rating, p_rating_change, p_unreplied_reviews, p_promotion_views, p_metadata$q$,
          false,
          array['authenticated', 'service_role']
        ),
        (
          'record_passport_progress',
          $q$p_category_id text, p_event_type text, p_reference_id text DEFAULT NULL::text$q$,
          $q$p_category_id text, p_event_type text, p_reference_id text$q$,
          $q$void$q$,
          $q$p_category_id, p_event_type, p_reference_id$q$,
          false,
          array['authenticated', 'service_role']
        ),
        (
          'add_portfolio_item_with_passport',
          $q$p_portfolio_id uuid, p_item_type text, p_dish_id text DEFAULT NULL::text, p_stall_id text DEFAULT NULL::text, p_score integer DEFAULT NULL::integer, p_public_notes text DEFAULT NULL::text, p_private_notes text DEFAULT NULL::text, p_expected_portfolio_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone$q$,
          $q$p_portfolio_id uuid, p_item_type text, p_dish_id text, p_stall_id text, p_score integer, p_public_notes text, p_private_notes text, p_expected_portfolio_updated_at timestamp with time zone$q$,
          $q$uuid$q$,
          $q$p_portfolio_id, p_item_type, p_dish_id, p_stall_id, p_score, p_public_notes, p_private_notes, p_expected_portfolio_updated_at$q$,
          false,
          array['authenticated', 'service_role']
        ),
        (
          'update_portfolio_item_with_version',
          $q$p_item_id uuid, p_score integer DEFAULT NULL::integer, p_public_notes text DEFAULT NULL::text, p_private_notes text DEFAULT NULL::text, p_expected_portfolio_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone$q$,
          $q$p_item_id uuid, p_score integer, p_public_notes text, p_private_notes text, p_expected_portfolio_updated_at timestamp with time zone$q$,
          $q$void$q$,
          $q$p_item_id, p_score, p_public_notes, p_private_notes, p_expected_portfolio_updated_at$q$,
          false,
          array['authenticated', 'service_role']
        ),
        (
          'delete_portfolio_item_with_version',
          $q$p_item_id uuid, p_expected_portfolio_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone$q$,
          $q$p_item_id uuid, p_expected_portfolio_updated_at timestamp with time zone$q$,
          $q$void$q$,
          $q$p_item_id, p_expected_portfolio_updated_at$q$,
          false,
          array['authenticated', 'service_role']
        ),
        (
          'publish_portfolio_with_passport',
          $q$p_portfolio_id uuid, p_expected_portfolio_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone$q$,
          $q$p_portfolio_id uuid, p_expected_portfolio_updated_at timestamp with time zone$q$,
          $q$void$q$,
          $q$p_portfolio_id, p_expected_portfolio_updated_at$q$,
          false,
          array['authenticated', 'service_role']
        ),
        (
          'reorder_checklist_items',
          $q$p_checklist_id uuid, p_item_ids uuid[]$q$,
          $q$p_checklist_id uuid, p_item_ids uuid[]$q$,
          $q$void$q$,
          $q$p_checklist_id, p_item_ids$q$,
          false,
          array['authenticated', 'service_role']
        ),
        (
          'reorder_portfolio_items',
          $q$p_portfolio_id uuid, p_item_ids uuid[], p_expected_portfolio_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone$q$,
          $q$p_portfolio_id uuid, p_item_ids uuid[], p_expected_portfolio_updated_at timestamp with time zone$q$,
          $q$void$q$,
          $q$p_portfolio_id, p_item_ids, p_expected_portfolio_updated_at$q$,
          false,
          array['authenticated', 'service_role']
        ),
        (
          'search_portfolios',
          $q$p_query text, p_type text DEFAULT NULL::text, p_visibility text DEFAULT 'public'::text$q$,
          $q$p_query text, p_type text, p_visibility text$q$,
          $q$TABLE(id uuid, owner_id uuid, name text, description text, type text, visibility text, published_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, item_count bigint, follower_count bigint)$q$,
          $q$p_query, p_type, p_visibility$q$,
          true,
          array['authenticated', 'service_role']
        ),
        (
          'submit_user_stall_submission',
          $q$p_stall_name text, p_image_url text, p_image_storage_bucket text DEFAULT NULL::text, p_image_storage_path text DEFAULT NULL::text, p_image_mime_type text DEFAULT NULL::text, p_gallery_images jsonb DEFAULT '[]'::jsonb, p_source_url text DEFAULT NULL::text, p_building_name text DEFAULT NULL::text, p_area text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_postal_code text DEFAULT NULL::text, p_unit_number text DEFAULT NULL::text, p_floor text DEFAULT NULL::text, p_operating_hours text DEFAULT NULL::text, p_menu_items jsonb DEFAULT '[]'::jsonb, p_delivery_links jsonb DEFAULT '[]'::jsonb, p_notes text DEFAULT NULL::text$q$,
          $q$p_stall_name text, p_image_url text, p_image_storage_bucket text, p_image_storage_path text, p_image_mime_type text, p_gallery_images jsonb, p_source_url text, p_building_name text, p_area text, p_address text, p_postal_code text, p_unit_number text, p_floor text, p_operating_hours text, p_menu_items jsonb, p_delivery_links jsonb, p_notes text$q$,
          $q$public.user_stall_submissions$q$,
          $q$p_stall_name, p_image_url, p_image_storage_bucket, p_image_storage_path, p_image_mime_type, p_gallery_images, p_source_url, p_building_name, p_area, p_address, p_postal_code, p_unit_number, p_floor, p_operating_hours, p_menu_items, p_delivery_links, p_notes$q$,
          false,
          array['authenticated', 'service_role']
        ),
        (
          'submit_user_stall_submission',
          $q$p_stall_name text, p_image_url text, p_image_storage_bucket text DEFAULT NULL::text, p_image_storage_path text DEFAULT NULL::text, p_image_mime_type text DEFAULT NULL::text, p_source_url text DEFAULT NULL::text, p_building_name text DEFAULT NULL::text, p_area text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_unit_number text DEFAULT NULL::text, p_floor text DEFAULT NULL::text, p_operating_hours text DEFAULT NULL::text, p_menu_items jsonb DEFAULT '[]'::jsonb, p_delivery_links jsonb DEFAULT '[]'::jsonb, p_notes text DEFAULT NULL::text$q$,
          $q$p_stall_name text, p_image_url text, p_image_storage_bucket text, p_image_storage_path text, p_image_mime_type text, p_source_url text, p_building_name text, p_area text, p_address text, p_unit_number text, p_floor text, p_operating_hours text, p_menu_items jsonb, p_delivery_links jsonb, p_notes text$q$,
          $q$public.user_stall_submissions$q$,
          $q$p_stall_name, p_image_url, p_image_storage_bucket, p_image_storage_path, p_image_mime_type, p_source_url, p_building_name, p_area, p_address, p_unit_number, p_floor, p_operating_hours, p_menu_items, p_delivery_links, p_notes$q$,
          false,
          array['authenticated', 'service_role']
        )
    ) as t(name, args, identity_args, result_type, call_args, use_star, roles)
  loop
    select p.oid::regprocedure
         , p.prosecdef
      into v_public
         , v_public_is_definer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = rec.name
      and pg_get_function_identity_arguments(p.oid) = btrim(rec.identity_args);

    select p.oid::regprocedure
      into v_private
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app_private'
      and p.proname = rec.name
      and pg_get_function_identity_arguments(p.oid) = btrim(rec.identity_args);

    if v_public is not null and v_public_is_definer then
      if v_private is not null then
        execute format('drop function %s', v_private);
      end if;

      execute format('alter function %s set schema app_private', v_public);
    end if;

    select p.oid::regprocedure
      into v_private
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app_private'
      and p.proname = rec.name
      and pg_get_function_identity_arguments(p.oid) = btrim(rec.identity_args);

    if v_private is null then
      raise notice 'Skipping app_private.% because the private body was not found', rec.name;
      continue;
    end if;

    v_call_sql := case
      when btrim(rec.call_args) = '' then format('app_private.%I()', rec.name)
      else format('app_private.%I(%s)', rec.name, rec.call_args)
    end;

    v_body := case
      when rec.use_star then format('select * from %s;', v_call_sql)
      else format('select %s;', v_call_sql)
    end;

    execute format(
      'create or replace function public.%I(%s)
       returns %s
       language sql
       security invoker
       set search_path = public, app_private
       as %L',
      rec.name,
      rec.args,
      rec.result_type,
      v_body
    );

    select p.oid::regprocedure
      into v_public
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = rec.name
      and pg_get_function_identity_arguments(p.oid) = btrim(rec.identity_args);

    execute format('revoke all on function %s from public, anon, authenticated', v_public);
    execute format('revoke all on function %s from public, anon, authenticated', v_private);

    foreach v_role in array rec.roles loop
      execute format('grant execute on function %s to %I', v_public, v_role);
      execute format('grant execute on function %s to %I', v_private, v_role);
    end loop;
  end loop;
end;
$$;

commit;
