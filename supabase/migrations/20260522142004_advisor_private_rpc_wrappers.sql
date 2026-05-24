-- Move client-callable app-owned SECURITY DEFINER bodies out of the exposed
-- public RPC schema, then preserve the public RPC contract with SECURITY
-- INVOKER wrappers. This targets Supabase Security Advisor checks 0028/0029
-- without changing mobile service RPC names.

create schema if not exists app_private;

grant usage on schema app_private to anon, authenticated, service_role;

do $$
declare
  rec record;
  v_public regprocedure;
  v_private regprocedure;
  v_call_sql text;
  v_body text;
  v_role text;
begin
  for rec in
    select *
    from (
      values
        ('app_is_current_user_ops_admin', $q$ $q$, $q$ $q$, $q$boolean$q$, $q$ $q$, false, array['authenticated', 'service_role']),
        ('app_user_block_exists', $q$p_left_user_id uuid, p_right_user_id uuid$q$, $q$p_left_user_id uuid, p_right_user_id uuid$q$, $q$boolean$q$, $q$p_left_user_id, p_right_user_id$q$, false, array['authenticated', 'service_role']),
        ('award_food_cred', $q$p_source_action text, p_related_entity_id text DEFAULT NULL::text, p_related_entity_type text DEFAULT NULL::text, p_points integer DEFAULT NULL::integer$q$, $q$p_source_action text, p_related_entity_id text, p_related_entity_type text, p_points integer$q$, $q$TABLE(total_points integer, level_index integer, points_awarded integer)$q$, $q$p_source_action, p_related_entity_id, p_related_entity_type, p_points$q$, true, array['authenticated', 'service_role']),
        ('can_access_conversation', $q$p_conversation_id uuid$q$, $q$p_conversation_id uuid$q$, $q$boolean$q$, $q$p_conversation_id$q$, false, array['authenticated', 'service_role']),
        ('can_read_author_content', $q$p_author_id uuid$q$, $q$p_author_id uuid$q$, $q$boolean$q$, $q$p_author_id$q$, false, array['anon', 'authenticated', 'service_role']),
        ('can_read_post', $q$p_post_id uuid$q$, $q$p_post_id uuid$q$, $q$boolean$q$, $q$p_post_id$q$, false, array['authenticated', 'service_role']),
        ('cancel_merchant_change_request', $q$p_change_request_id uuid$q$, $q$p_change_request_id uuid$q$, $q$merchant_change_requests$q$, $q$p_change_request_id$q$, true, array['authenticated', 'service_role']),
        ('enqueue_merchant_team_invite_email', $q$p_merchant_account_id uuid, p_recipient_email text, p_member_id uuid, p_role text, p_invitee_name text$q$, $q$p_merchant_account_id uuid, p_recipient_email text, p_member_id uuid, p_role text, p_invitee_name text$q$, $q$uuid$q$, $q$p_merchant_account_id, p_recipient_email, p_member_id, p_role, p_invitee_name$q$, false, array['authenticated', 'service_role']),
        ('enqueue_merchant_weekly_summary_email', $q$p_merchant_account_id uuid, p_outlet_id uuid, p_recipient_email text, p_summary_id text, p_member_id text, p_subject text, p_body text$q$, $q$p_merchant_account_id uuid, p_outlet_id uuid, p_recipient_email text, p_summary_id text, p_member_id text, p_subject text, p_body text$q$, $q$uuid$q$, $q$p_merchant_account_id, p_outlet_id, p_recipient_email, p_summary_id, p_member_id, p_subject, p_body$q$, false, array['authenticated', 'service_role']),
        ('get_merchant_change_request_detail', $q$p_change_request_id uuid$q$, $q$p_change_request_id uuid$q$, $q$merchant_change_requests$q$, $q$p_change_request_id$q$, true, array['authenticated', 'service_role']),
        ('get_merchant_dish_view_counts', $q$p_outlet_id uuid, p_since timestamp with time zone DEFAULT NULL::timestamp with time zone, p_until timestamp with time zone DEFAULT NULL::timestamp with time zone$q$, $q$p_outlet_id uuid, p_since timestamp with time zone, p_until timestamp with time zone$q$, $q$TABLE(dish_id text, view_count bigint)$q$, $q$p_outlet_id, p_since, p_until$q$, true, array['authenticated', 'service_role']),
        ('increment_mission_progress', $q$p_mission_type text$q$, $q$p_mission_type text$q$, $q$void$q$, $q$p_mission_type$q$, false, array['authenticated', 'service_role']),
        ('is_merchant_member', $q$p_merchant_account_id uuid$q$, $q$p_merchant_account_id uuid$q$, $q$boolean$q$, $q$p_merchant_account_id$q$, false, array['authenticated', 'service_role']),
        ('is_platform_operator', $q$ $q$, $q$ $q$, $q$boolean$q$, $q$ $q$, false, array['authenticated', 'service_role']),
        ('list_content_moderation_queue', $q$p_limit integer DEFAULT 100$q$, $q$p_limit integer$q$, $q$TABLE(source text, target_type text, target_id text, report_count bigint, latest_reported_at timestamp with time zone)$q$, $q$p_limit$q$, true, array['authenticated', 'service_role']),
        ('list_merchant_change_requests', $q$p_organization_id uuid, p_status text DEFAULT NULL::text, p_cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 25$q$, $q$p_organization_id uuid, p_status text, p_cursor_created_at timestamp with time zone, p_cursor_id uuid, p_limit integer$q$, $q$SETOF merchant_change_requests$q$, $q$p_organization_id, p_status, p_cursor_created_at, p_cursor_id, p_limit$q$, true, array['authenticated', 'service_role']),
        ('merchant_can_manage_legacy_outlet', $q$p_outlet_id uuid$q$, $q$p_outlet_id uuid$q$, $q$boolean$q$, $q$p_outlet_id$q$, false, array['authenticated', 'service_role']),
        ('merchant_can_manage_organization', $q$p_organization_id uuid$q$, $q$p_organization_id uuid$q$, $q$boolean$q$, $q$p_organization_id$q$, false, array['authenticated', 'service_role']),
        ('merchant_can_manage_outlet_v2', $q$p_outlet_id uuid$q$, $q$p_outlet_id uuid$q$, $q$boolean$q$, $q$p_outlet_id$q$, false, array['authenticated', 'service_role']),
        ('merchant_can_view_organization', $q$p_organization_id uuid$q$, $q$p_organization_id uuid$q$, $q$boolean$q$, $q$p_organization_id$q$, false, array['authenticated', 'service_role']),
        ('merchant_is_org_member', $q$p_organization_id uuid$q$, $q$p_organization_id uuid$q$, $q$boolean$q$, $q$p_organization_id$q$, false, array['authenticated', 'service_role']),
        ('record_merchant_dish_view', $q$p_dish_id text, p_session_id text DEFAULT NULL::text$q$, $q$p_dish_id text, p_session_id text$q$, $q$uuid$q$, $q$p_dish_id, p_session_id$q$, false, array['authenticated', 'service_role']),
        ('record_taste_interaction_event', $q$p_type text, p_surface text, p_user_vector_before double precision[], p_user_vector_after double precision[], p_dish_id text DEFAULT NULL::text, p_query text DEFAULT NULL::text, p_chip_id text DEFAULT NULL::text, p_button_id text DEFAULT NULL::text, p_rating numeric DEFAULT NULL::numeric, p_applied boolean DEFAULT true, p_confidence_delta numeric DEFAULT 0, p_source text DEFAULT 'explicit_feedback'::text, p_created_at timestamp with time zone DEFAULT now(), p_metadata jsonb DEFAULT '{}'::jsonb$q$, $q$p_type text, p_surface text, p_user_vector_before double precision[], p_user_vector_after double precision[], p_dish_id text, p_query text, p_chip_id text, p_button_id text, p_rating numeric, p_applied boolean, p_confidence_delta numeric, p_source text, p_created_at timestamp with time zone, p_metadata jsonb$q$, $q$uuid$q$, $q$p_type, p_surface, p_user_vector_before, p_user_vector_after, p_dish_id, p_query, p_chip_id, p_button_id, p_rating, p_applied, p_confidence_delta, p_source, p_created_at, p_metadata$q$, false, array['authenticated', 'service_role']),
        ('report_content', $q$p_target_type text, p_target_id text, p_reason text, p_target_author_key text DEFAULT NULL::text$q$, $q$p_target_type text, p_target_id text, p_reason text, p_target_author_key text$q$, $q$uuid$q$, $q$p_target_type, p_target_id, p_reason, p_target_author_key$q$, false, array['authenticated', 'service_role']),
        ('report_post', $q$p_post_id uuid, p_reason_code text, p_details text DEFAULT NULL::text$q$, $q$p_post_id uuid, p_reason_code text, p_details text$q$, $q$uuid$q$, $q$p_post_id, p_reason_code, p_details$q$, false, array['authenticated', 'service_role']),
        ('review_merchant_change_request', $q$p_change_request_id uuid, p_status text, p_review_note text DEFAULT NULL::text$q$, $q$p_change_request_id uuid, p_status text, p_review_note text$q$, $q$merchant_change_requests$q$, $q$p_change_request_id, p_status, p_review_note$q$, true, array['authenticated', 'service_role']),
        ('send_chat_message', $q$p_conversation_id uuid, p_body text, p_client_nonce text DEFAULT NULL::text, p_sender_merchant_account_id uuid DEFAULT NULL::uuid$q$, $q$p_conversation_id uuid, p_body text, p_client_nonce text, p_sender_merchant_account_id uuid$q$, $q$TABLE(id uuid, conversation_id uuid, sender_user_id uuid, sender_merchant_account_id uuid, body text, client_nonce text, delivered_at timestamp with time zone, created_at timestamp with time zone)$q$, $q$p_conversation_id, p_body, p_client_nonce, p_sender_merchant_account_id$q$, true, array['authenticated', 'service_role']),
        ('submit_menu_photo', $q$p_venue_id text, p_storage_path text, p_content_type text, p_size_bytes integer$q$, $q$p_venue_id text, p_storage_path text, p_content_type text, p_size_bytes integer$q$, $q$uuid$q$, $q$p_venue_id, p_storage_path, p_content_type, p_size_bytes$q$, false, array['authenticated', 'service_role']),
        ('submit_merchant_change_request', $q$p_organization_id uuid, p_venue_id text, p_target_type text, p_change_type text, p_payload jsonb DEFAULT '{}'::jsonb, p_outlet_id uuid DEFAULT NULL::uuid, p_target_id text DEFAULT NULL::text, p_risk_level text DEFAULT 'review_required'::text$q$, $q$p_organization_id uuid, p_venue_id text, p_target_type text, p_change_type text, p_payload jsonb, p_outlet_id uuid, p_target_id text, p_risk_level text$q$, $q$merchant_change_requests$q$, $q$p_organization_id, p_venue_id, p_target_type, p_change_type, p_payload, p_outlet_id, p_target_id, p_risk_level$q$, true, array['authenticated', 'service_role']),
        ('submit_merchant_claim_interest', $q$p_venue_id text, p_contact_name text DEFAULT NULL::text, p_contact_phone text DEFAULT NULL::text, p_contact_email text DEFAULT NULL::text, p_uen text DEFAULT NULL::text, p_notes text DEFAULT NULL::text$q$, $q$p_venue_id text, p_contact_name text, p_contact_phone text, p_contact_email text, p_uen text, p_notes text$q$, $q$uuid$q$, $q$p_venue_id, p_contact_name, p_contact_phone, p_contact_email, p_uen, p_notes$q$, false, array['authenticated', 'service_role']),
        ('upsert_stall_interaction', $q$p_stall_id text, p_is_saved boolean DEFAULT NULL::boolean, p_is_tried boolean DEFAULT NULL::boolean, p_is_reviewed boolean DEFAULT NULL::boolean$q$, $q$p_stall_id text, p_is_saved boolean, p_is_tried boolean, p_is_reviewed boolean$q$, $q$TABLE(user_id uuid, stall_id text, is_saved boolean, is_tried boolean, is_reviewed boolean, saved_at timestamp with time zone, tried_at timestamp with time zone, reviewed_at timestamp with time zone)$q$, $q$p_stall_id, p_is_saved, p_is_tried, p_is_reviewed$q$, true, array['authenticated', 'service_role'])
    ) as t(name, args, identity_args, result_type, call_args, use_star, roles)
  loop
    select p.oid::regprocedure
      into v_public
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

    if v_private is null and v_public is not null then
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
      raise notice 'Skipping %.% because the private body was not found', 'app_private', rec.name;
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

comment on schema app_private is
  'Non-exposed implementation schema for SECURITY DEFINER helper/RPC bodies. Public RPC names are preserved as SECURITY INVOKER wrappers.';
