-- smoke: supabase/smoke/security_review_hardening.sql
-- Security review fixes (2026-11-04). Each change closes a write the app never makes
-- but anyone holding the public app key could:
--
-- 1. PostGIS's own tables (spatial_ref_sys, geometry_columns, geography_columns) live in public
--    with insert/update/delete granted to anon and authenticated. They are owned by
--    supabase_admin, so this project cannot revoke those grants. The request hook
--    (app_private.check_request_rate, run before every PostgREST request) now answers 403 to any
--    write to them. Reads are untouched. Percent escapes in the path are undone before matching.
-- 2. A review inserted straight into public.reviews (not through submit_review) could carry a
--    made-up merchant reply, helpful count or date. A new BEFORE INSERT trigger resets those
--    server-owned fields for app callers (anon, authenticated). submit_review never sets them,
--    so it behaves as before. Updates are already guarded by enforce_merchant_review_reply_update.
-- 3. user_profiles.avatar_url accepted any address, so a profile photo could point at any site
--    (tracking viewers, or an image that skipped moderation). For app callers a new avatar must
--    be a public file in this project's avatars bucket, in the caller's own folder:
--    <project URL>/storage/v1/object/public/avatars/<user id>/<file name>. The project URL comes
--    from the iss claim of the caller's token. Clearing the photo and keeping the current one
--    always work. Service role and database jobs are not checked.
-- 3b. user_profiles.email could be set to any address by its owner. For app callers it now
--     follows the email claim of the caller's token.
-- 3c. website_waitlist_entries (anon insert) gets a 5 per minute cap per caller.
-- 4. promote_staging_to_production and set_post_moderation_state (ops tools, run from the
--    database) were executable by anon and authenticated. Nothing in the app, website or Edge
--    Functions calls them. Execute is now service_role only.
--
-- Rollback: supabase/rollbacks/20261104120000_security_review_hardening.down.sql.

-- 1. Request hook: same body as 20261022120000, plus the PostGIS write block.
create or replace function app_private.check_request_rate()
returns void
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_method text := upper(coalesce(current_setting('request.method', true), ''));
  v_route text := regexp_replace(ltrim(coalesce(current_setting('request.path', true), ''), '/'), '/+$', '');
  v_target text;
  v_escape text;
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

  -- PostGIS's tables are read-only for app callers (their write grants cannot be revoked here).
  if v_method not in ('GET', 'HEAD') then
    v_target := lower(v_route);
    -- Undo %XX escapes so /spatial%5Fref%5Fsys matches too. Each pass is 2 characters shorter.
    while v_target ~ '%[0-9a-f]{2}' loop
      v_escape := substring(v_target from '%([0-9a-f]{2})');
      v_target := replace(
        v_target,
        '%' || v_escape,
        case when v_escape = '00' then '' else chr(('x' || v_escape)::bit(8)::integer) end
      );
    end loop;
    v_target := lower(btrim(v_target, '/ '));
    if v_target in ('spatial_ref_sys', 'geometry_columns', 'geography_columns') then
      raise sqlstate 'PGRST' using
        message = '{"code":"forbidden","message":"This table is read-only","details":null,"hint":null}',
        detail = '{"status":403,"headers":{}}';
    end if;
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

-- 2. Reviews: server-owned fields start fresh on every app insert.
create or replace function app_private.reviews_reset_server_fields()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  -- Only app callers. Service role, migrations and definer functions keep what they set.
  if current_user in ('anon', 'authenticated') then
    new.merchant_reply_text := null;
    new.merchant_replied_at := null;
    new.helpful_count := 0;
    new.created_at := now();
    new.edited_at := null;
  end if;
  return new;
end;
$$;

revoke all on function app_private.reviews_reset_server_fields() from public, anon, authenticated;

drop trigger if exists trg_reviews_reset_server_fields on public.reviews;
create trigger trg_reviews_reset_server_fields
  before insert on public.reviews
  for each row
  execute function app_private.reviews_reset_server_fields();

-- 3. Profile photos: only this project's avatars bucket, in the caller's own folder.
create or replace function app_private.user_profiles_check_avatar_url()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_old text;
  v_iss text;
  v_base text;
  v_prefix text;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if new.avatar_url is null or btrim(new.avatar_url) = '' then
    new.avatar_url := null;
    return new;
  end if;

  -- Keeping the current photo is always fine. An upsert fires the INSERT trigger even when the
  -- row exists, so compare with the stored row there too.
  if tg_op = 'UPDATE' then
    v_old := old.avatar_url;
  else
    select up.avatar_url into v_old from public.user_profiles up where up.id = new.id;
  end if;
  if new.avatar_url is not distinct from v_old then
    return new;
  end if;

  begin
    v_iss := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'iss';
  exception when others then
    v_iss := null;
  end;
  v_base := regexp_replace(coalesce(v_iss, ''), '/auth/v1/?$', '');

  if v_base ~ '^https?://[^/?#@\s]+$' then
    v_prefix := v_base || '/storage/v1/object/public/avatars/' || new.id::text || '/';
    if starts_with(new.avatar_url, v_prefix)
      and substr(new.avatar_url, char_length(v_prefix) + 1) ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$' then
      return new;
    end if;
  end if;

  raise exception 'Profile photos must be uploaded from the app.'
    using errcode = '23514', hint = 'avatar_url_not_allowed';
end;
$$;

revoke all on function app_private.user_profiles_check_avatar_url() from public, anon, authenticated;

drop trigger if exists trg_user_profiles_check_avatar_url on public.user_profiles;
create trigger trg_user_profiles_check_avatar_url
  before insert or update of avatar_url on public.user_profiles
  for each row
  execute function app_private.user_profiles_check_avatar_url();

-- 3b. Profile email: the sign-in address, never a typed one. The app copies the auth email in at
--     sign-in; for app callers the stored value is now taken from the token's email claim (or
--     kept as it was when the token has none), so nobody can show another person's address.
create or replace function app_private.user_profiles_email_from_auth()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_email text;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  begin
    v_email := nullif(btrim(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email'), '');
  exception when others then
    v_email := null;
  end;

  if tg_op = 'UPDATE' then
    new.email := coalesce(v_email, old.email);
  else
    new.email := coalesce(
      v_email,
      (select up.email from public.user_profiles up where up.id = new.id)
    );
  end if;
  return new;
end;
$$;

revoke all on function app_private.user_profiles_email_from_auth() from public, anon, authenticated;

drop trigger if exists trg_user_profiles_email_from_auth on public.user_profiles;
create trigger trg_user_profiles_email_from_auth
  before insert or update of email on public.user_profiles
  for each row
  execute function app_private.user_profiles_email_from_auth();

-- 3c. Website waitlist: direct API inserts get their own small cap (the website itself writes
--     with the service role, which is never limited).
insert into app_private.request_rate_rules (route, anon_per_minute, user_per_minute, note) values
  ('website_waitlist_entries', 5, 5, 'website waitlist sign-ups sent straight to the API')
on conflict (route) do nothing;

-- 4. Ops-only functions: service role only.
revoke execute on function public.promote_staging_to_production(uuid) from public, anon, authenticated;
grant execute on function public.promote_staging_to_production(uuid) to service_role;
revoke execute on function public.set_post_moderation_state(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.set_post_moderation_state(uuid, text, text, uuid, jsonb) to service_role;

notify pgrst, 'reload schema';
