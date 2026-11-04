-- Smoke checks for 20261104120000_security_review_hardening.sql.
-- 1. Writes to PostGIS's tables through the API are refused with 403 (also when the path is
--    percent-escaped); reads and other routes pass, and service_role is not blocked.
-- 2. A review a signed-in user inserts directly cannot carry a merchant reply, helpful count or
--    back-dated time; a service-role insert keeps what it sets.
-- 3. A profile photo address must be this project's avatars bucket, in the caller's own folder;
--    clearing it, keeping it and service-role writes still work.
-- 4. anon and authenticated can no longer run the two ops functions.
-- Runs in a transaction and rolls back.
--   author: 00000000-0000-0411-b000-000000000001
--   other:  00000000-0000-0411-b000-000000000002

begin;

insert into auth.users (id, email)
values
  ('00000000-0000-0411-b000-000000000001', 'security-smoke-1@example.test'),
  ('00000000-0000-0411-b000-000000000002', 'security-smoke-2@example.test')
on conflict (id) do nothing;

insert into user_profiles (id, display_name)
values
  ('00000000-0000-0411-b000-000000000001', 'Security Smoke One'),
  ('00000000-0000-0411-b000-000000000002', 'Security Smoke Two')
on conflict (id) do nothing;

select set_config('smoke.dish_id', (select d.id from dishes d order by d.id limit 1), true);

-- 1. Request hook. PostgREST sets these settings before it calls the pre-request function.
create function pg_temp.hit(p_method text, p_path text, p_claims jsonb) returns text
language plpgsql as $$
begin
  perform set_config('request.method', p_method, true);
  perform set_config('request.path', p_path, true);
  perform set_config('request.jwt.claims', coalesce(p_claims::text, ''), true);
  perform set_config('request.headers', '{"cf-connecting-ip":"203.0.113.41"}', true);
  perform app_private.check_request_rate();
  return 'ok';
exception when sqlstate 'PGRST' then
  return 'refused:' || (sqlerrm::jsonb ->> 'code');
end;
$$;

do $$
declare
  v_anon jsonb := '{"role":"anon"}';
  v_user jsonb := '{"role":"authenticated","sub":"00000000-0000-0411-b000-000000000001"}';
  v_service jsonb := '{"role":"service_role"}';
  v_case record;
begin
  for v_case in
    select * from (values
      ('POST', '/spatial_ref_sys', v_anon),
      ('PATCH', '/spatial_ref_sys', v_user),
      ('DELETE', '/spatial_ref_sys/', v_anon),
      ('POST', '/spatial%5Fref%5Fsys', v_anon),
      ('DELETE', '/%73patial_ref_sys', v_user),
      ('PUT', '/Spatial_Ref_Sys', v_anon),
      ('POST', '/geometry_columns', v_anon),
      ('DELETE', '/geography_columns', v_user)
    ) as t(method, path, claims)
  loop
    if pg_temp.hit(v_case.method, v_case.path, v_case.claims) <> 'refused:forbidden' then
      raise exception '% % must be refused with 403', v_case.method, v_case.path;
    end if;
  end loop;

  if pg_temp.hit('GET', '/spatial_ref_sys', v_anon) <> 'ok' then
    raise exception 'reading spatial_ref_sys must still work';
  end if;
  if pg_temp.hit('POST', '/spatial_ref_sys', v_service) <> 'ok' then
    raise exception 'service_role must not be blocked by the hook';
  end if;
  if pg_temp.hit('POST', '/rpc/catalog_suggest', v_anon) <> 'ok' then
    raise exception 'other routes must not be blocked';
  end if;
  if pg_temp.hit('POST', '/reviews', v_user) <> 'ok' then
    raise exception 'writes to app tables must not be blocked';
  end if;
  if pg_temp.hit('POST', '/rpc/spatial_ref_sys_lookalike', v_anon) <> 'ok' then
    raise exception 'only the exact PostGIS table routes are blocked';
  end if;
end;
$$;

-- 2. Reviews inserted by a signed-in user directly.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0411-b000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0411-b000-000000000001","iss":"https://smoke-ref.supabase.co/auth/v1"}',
  true
);
set local role authenticated;

insert into reviews (
  id, user_id, dish_id, rating, text,
  merchant_reply_text, merchant_replied_at, helpful_count, created_at, edited_at
)
values (
  '00000000-0000-0411-e000-000000000001',
  '00000000-0000-0411-b000-000000000001',
  current_setting('smoke.dish_id'),
  4,
  'Security smoke review',
  'Thanks from the owner (forged)',
  '2020-01-01T00:00:00Z',
  999,
  '2020-01-01T00:00:00Z',
  '2020-01-02T00:00:00Z'
);

reset role;

do $$
declare
  v record;
begin
  select * into v from reviews where id = '00000000-0000-0411-e000-000000000001';
  if v.merchant_reply_text is not null or v.merchant_replied_at is not null then
    raise exception 'a user-inserted review must not carry a merchant reply';
  end if;
  if v.helpful_count <> 0 then
    raise exception 'a user-inserted review must start with 0 helpful votes, got %', v.helpful_count;
  end if;
  if v.created_at < now() - interval '1 minute' then
    raise exception 'a user-inserted review must be stamped with the server time, got %', v.created_at;
  end if;
  if v.edited_at is not null then
    raise exception 'a new review must not be marked edited';
  end if;
end;
$$;

-- Service role (and the database owner) keep what they set.
insert into reviews (id, user_id, dish_id, rating, text, created_at)
values (
  '00000000-0000-0411-e000-000000000002',
  '00000000-0000-0411-b000-000000000002',
  current_setting('smoke.dish_id'),
  5,
  'Security smoke imported review',
  '2020-01-01T00:00:00Z'
);

do $$
begin
  if (select created_at from reviews where id = '00000000-0000-0411-e000-000000000002')
    <> '2020-01-01T00:00:00Z'::timestamptz then
    raise exception 'a service-side insert must keep its created_at';
  end if;
end;
$$;

-- 3. Profile photo addresses, as the signed-in author (iss https://smoke-ref.supabase.co).
create function pg_temp.set_avatar(p_url text) returns text
language plpgsql as $$
begin
  update user_profiles set avatar_url = p_url where id = '00000000-0000-0411-b000-000000000001';
  return 'ok';
exception when sqlstate '23514' then
  return 'refused';
end;
$$;
grant execute on function pg_temp.set_avatar(text) to authenticated;

set local role authenticated;

do $$
declare
  v_own text := 'https://smoke-ref.supabase.co/storage/v1/object/public/avatars/00000000-0000-0411-b000-000000000001/';
  v_bad text;
begin
  foreach v_bad in array array[
    'https://tracker.example/pixel.png',
    'https://smoke-ref.supabase.co/storage/v1/object/public/avatars/00000000-0000-0411-b000-000000000002/avatar-1.jpg',
    'https://smoke-ref.supabase.co/storage/v1/object/public/review-media/00000000-0000-0411-b000-000000000001/a.jpg',
    v_own || 'nested/avatar-1.jpg',
    v_own || '../00000000-0000-0411-b000-000000000002/avatar-1.jpg',
    v_own || 'avatar-1.jpg?redirect=https://tracker.example',
    'https://other-ref.supabase.co/storage/v1/object/public/avatars/00000000-0000-0411-b000-000000000001/avatar-1.jpg',
    'javascript:alert(1)'
  ]
  loop
    if pg_temp.set_avatar(v_bad) <> 'refused' then
      raise exception 'avatar % must be refused', v_bad;
    end if;
  end loop;

  if pg_temp.set_avatar(v_own || 'avatar-1730000000000.jpg') <> 'ok' then
    raise exception 'an avatar in the caller''s own folder must be accepted';
  end if;
  -- Keeping it (the app's profile upsert sends it again) works.
  insert into user_profiles (id, display_name, avatar_url)
  values ('00000000-0000-0411-b000-000000000001', 'Security Smoke One', v_own || 'avatar-1730000000000.jpg')
  on conflict (id) do update set avatar_url = excluded.avatar_url;
  if pg_temp.set_avatar(null) <> 'ok' or pg_temp.set_avatar('') <> 'ok' then
    raise exception 'removing the photo must work';
  end if;
end;
$$;

reset role;

do $$
begin
  if (select avatar_url from user_profiles where id = '00000000-0000-0411-b000-000000000001') is not null then
    raise exception 'an empty avatar must be stored as null';
  end if;
  -- Service-side writes are not checked.
  update user_profiles set avatar_url = 'https://cdn.example/imported.jpg'
  where id = '00000000-0000-0411-b000-000000000002';
end;
$$;

-- An unchanged photo from before this migration can be kept.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0411-b000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0411-b000-000000000002","iss":"https://smoke-ref.supabase.co/auth/v1"}',
  true
);
update user_profiles set avatar_url = 'https://cdn.example/imported.jpg', bio = 'Still here'
where id = '00000000-0000-0411-b000-000000000002';
reset role;

-- 4. Ops functions.
do $$
begin
  if has_function_privilege('anon', 'public.promote_staging_to_production(uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.promote_staging_to_production(uuid)', 'execute') then
    raise exception 'promote_staging_to_production must be service_role only';
  end if;
  if has_function_privilege('anon', 'public.set_post_moderation_state(uuid,text,text,uuid,jsonb)', 'execute')
    or has_function_privilege('authenticated', 'public.set_post_moderation_state(uuid,text,text,uuid,jsonb)', 'execute') then
    raise exception 'set_post_moderation_state must be service_role only';
  end if;
  if not has_function_privilege('service_role', 'public.promote_staging_to_production(uuid)', 'execute') then
    raise exception 'service_role must keep promote_staging_to_production';
  end if;
end;
$$;

rollback;
