-- Smoke checks for 20261022100200_profile_text_guards.sql.
-- Display names are capped at 40 characters and reserved names are refused for
-- an existing profile, a new profile is sanitised instead of refused, bios go
-- through the review text filter, and trusted (non-app) writes are not
-- filtered. Runs in a transaction and rolls back.

begin;

-- Fixed ids for this smoke only.
--   editor: 00000000-0000-0202-b000-000000000001 (existing profile)
--   newbie: 00000000-0000-0202-b000-000000000002 (first write, as the app)
insert into user_profiles (id, display_name)
values ('00000000-0000-0202-b000-000000000001', 'Name Guard Editor')
on conflict (id) do nothing;

do $$
begin
  if not app_private.is_reserved_display_name('Hungry')
    or not app_private.is_reserved_display_name('  H u n g r y  Team ')
    or not app_private.is_reserved_display_name('Adm1n')
    or not app_private.is_reserved_display_name('HUNGRY_official')
    or not app_private.is_reserved_display_name('hungry support 2') then
    raise exception 'reserved names should be detected';
  end if;
  if app_private.is_reserved_display_name('Hungry Hippo')
    or app_private.is_reserved_display_name('Appetite')
    or app_private.is_reserved_display_name('Hungry Appetite')
    or app_private.is_reserved_display_name(null) then
    raise exception 'ordinary names must not be reserved';
  end if;
end $$;

-- The cap exists as a constraint.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_display_name_length'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    raise exception 'user_profiles_display_name_length should exist';
  end if;
  -- The length trigger cuts a long name to 40 before the constraint can see it.
  update public.user_profiles
  set display_name = repeat('x', 41)
  where id = '00000000-0000-0202-b000-000000000001';
  if (select char_length(display_name) from public.user_profiles
      where id = '00000000-0000-0202-b000-000000000001') <> 40 then
    raise exception 'a 41-character name should be cut to 40 for trusted writes';
  end if;
  -- Trusted code may still hold a reserved name.
  update public.user_profiles
  set display_name = 'Hungry Team'
  where id = '00000000-0000-0202-b000-000000000001';
  update public.user_profiles
  set display_name = 'Name Guard Editor'
  where id = '00000000-0000-0202-b000-000000000001';
end $$;

-- An existing profile, as the app.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0202-b000-000000000001', true);
set local role authenticated;

do $$
begin
  begin
    update public.user_profiles set display_name = 'Hungry Team'
    where id = '00000000-0000-0202-b000-000000000001';
    raise exception 'a reserved name should be refused';
  exception when check_violation then
    if sqlerrm !~ 'reserved' then raise; end if;
  end;

  begin
    update public.user_profiles set display_name = repeat('y', 41)
    where id = '00000000-0000-0202-b000-000000000001';
    raise exception 'a 41-character name should be refused';
  exception when check_violation then
    null;
  end;

  begin
    update public.user_profiles set display_name = 'fuck face'
    where id = '00000000-0000-0202-b000-000000000001';
    raise exception 'a blocked term in a name should be refused';
  exception when check_violation then
    null;
  end;

  begin
    update public.user_profiles set bio = 'Call me 91234567 or 81234567 or visit www.a.com'
    where id = '00000000-0000-0202-b000-000000000001';
    raise exception 'a bio with several links or numbers should be refused';
  exception when check_violation then
    null;
  end;

  update public.user_profiles
  set display_name = repeat('z', 40), bio = 'Loves chicken rice'
  where id = '00000000-0000-0202-b000-000000000001';

  -- Re-saving the same name through an upsert (the app's save path) is fine.
  insert into public.user_profiles (id, display_name)
  values ('00000000-0000-0202-b000-000000000001', repeat('z', 40))
  on conflict (id) do update set display_name = excluded.display_name;

  begin
    insert into public.user_profiles (id, display_name)
    values ('00000000-0000-0202-b000-000000000001', 'Official')
    on conflict (id) do update set display_name = excluded.display_name;
    raise exception 'upserting a reserved name onto an existing profile should be refused';
  exception when check_violation then
    null;
  end;
end $$;

-- A brand-new profile is sanitised, never refused.
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0202-b000-000000000002', true);
set local role authenticated;

do $$
declare
  v_name text;
begin
  insert into public.user_profiles (id, display_name)
  values ('00000000-0000-0202-b000-000000000002', repeat('n', 60))
  on conflict (id) do nothing;
  select display_name into v_name from public.user_profiles
  where id = '00000000-0000-0202-b000-000000000002';
  if char_length(v_name) <> 40 then
    raise exception 'a new profile''s long name should be cut to 40, got %', char_length(v_name);
  end if;
end $$;

reset role;
delete from public.user_profiles where id = '00000000-0000-0202-b000-000000000002';
select set_config('request.jwt.claim.sub', '00000000-0000-0202-b000-000000000002', true);
set local role authenticated;

do $$
declare
  v_name text := 'unset';
begin
  insert into public.user_profiles (id, display_name)
  values ('00000000-0000-0202-b000-000000000002', 'Admin');
  select display_name into v_name from public.user_profiles
  where id = '00000000-0000-0202-b000-000000000002';
  if v_name is not null then
    raise exception 'a new profile''s reserved name should be dropped, got %', v_name;
  end if;
end $$;

reset role;

select 'profile_text_guards' as check_name, 'ok' as detail;

rollback;
