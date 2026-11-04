-- Undo 20261104120000_security_review_hardening: puts the request hook back to its
-- 20261022120000 body (no PostGIS write block), drops the review and avatar triggers and their
-- functions, and gives anon and authenticated back execute on the two ops functions, as they
-- had it before. No table or row is touched.

create or replace function app_private.check_request_rate()
returns void
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_method text := upper(coalesce(current_setting('request.method', true), ''));
  v_route text := regexp_replace(ltrim(coalesce(current_setting('request.path', true), ''), '/'), '/+$', '');
  v_claims jsonb;
  v_headers jsonb;
  v_role text;
  v_who text;
  v_default record;
  v_rule record;
  v_cap integer;
  v_key text;
  v_hits integer := 0;
  v_over boolean := false;
begin
  if v_route = '' or v_method in ('', 'OPTIONS') then
    return;
  end if;

  begin
    v_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  exception when others then
    v_claims := null;
  end;
  v_role := coalesce(v_claims ->> 'role', 'anon');
  -- service_role (Edge Functions, workers) and any other role are never limited.
  if v_role not in ('anon', 'authenticated') then
    return;
  end if;

  if v_method in ('GET', 'HEAD') then
    -- A read-only transaction cannot write the counter, so RPCs over GET would skip the limit.
    -- The app calls every RPC with POST.
    if v_route like 'rpc/%' then
      raise sqlstate 'PGRST' using
        message = '{"code":"method_not_allowed","message":"Call RPCs with POST","details":null,"hint":null}',
        detail = '{"status":405,"headers":{"Allow":"POST"}}';
    end if;
    return;
  end if;

  begin
    select anon_per_minute, user_per_minute into v_default
    from app_private.request_rate_rules where route = '*';
    select anon_per_minute, user_per_minute into v_rule
    from app_private.request_rate_rules where route = v_route;

    if v_role = 'authenticated' then
      v_who := 'u:' || coalesce(v_claims ->> 'sub', '');
      v_cap := coalesce(v_rule.user_per_minute, v_default.user_per_minute);
    else
      begin
        v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
      exception when others then
        v_headers := null;
      end;
      v_who := 'ip:' || coalesce(
        nullif(btrim(v_headers ->> 'cf-connecting-ip'), ''),
        nullif(btrim(v_headers ->> 'x-real-ip'), ''),
        nullif(btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), ''),
        ''
      );
      v_cap := coalesce(v_rule.anon_per_minute, v_default.anon_per_minute);
    end if;

    -- No usable caller identity (no IP, no sub), or no default row: nothing to count against.
    if v_cap is null or v_who in ('u:', 'ip:') then
      return;
    end if;

    -- A route with its own cap for this caller type counts on its own; everything else shares '*'.
    v_key := v_who || '|' || case
      when v_role = 'authenticated' and v_rule.user_per_minute is not null then v_route
      when v_role = 'anon' and v_rule.anon_per_minute is not null then v_route
      else '*'
    end;

    insert into app_private.request_rate_counters (key, bucket, hits)
    values (v_key, date_trunc('minute', now()), 1)
    on conflict (key, bucket) do update
      set hits = app_private.request_rate_counters.hits + 1
    returning hits into v_hits;

    v_over := v_hits > v_cap;
  exception when others then
    -- Fail open.
    return;
  end;

  if v_over then
    raise sqlstate 'PGRST' using
      message = '{"code":"rate_limited","message":"Too many requests","details":null,"hint":"Slow down and try again in a minute."}',
      detail = '{"status":429,"headers":{"Retry-After":"60"}}';
  end if;
end;
$$;

revoke all on function app_private.check_request_rate() from public;
grant execute on function app_private.check_request_rate() to anon, authenticated, service_role;

drop trigger if exists trg_reviews_reset_server_fields on public.reviews;
drop function if exists app_private.reviews_reset_server_fields();

drop trigger if exists trg_user_profiles_check_avatar_url on public.user_profiles;
drop function if exists app_private.user_profiles_check_avatar_url();

grant execute on function public.promote_staging_to_production(uuid) to public, anon, authenticated;
grant execute on function public.set_post_moderation_state(uuid, text, text, uuid, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
