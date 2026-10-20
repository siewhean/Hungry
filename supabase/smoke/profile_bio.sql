-- Smoke checks for 20261020120000_profile_bio.sql.
-- The owner can set a bio of up to 150 characters, a longer one is rejected,
-- the bio is copied to public_profiles, and another user cannot write it.
-- Reuses an existing profile. Runs in a transaction and rolls back.

begin;

select set_config(
  'smoke.bio_owner',
  (select id::text from public.user_profiles order by created_at nulls last limit 1),
  true
);
select set_config(
  'smoke.bio_other',
  coalesce(
    (
      select id::text from public.user_profiles
      where id::text <> current_setting('smoke.bio_owner')
      order by created_at nulls last
      limit 1
    ),
    '00000000-0000-0000-0000-000000000000'
  ),
  true
);

do $$
begin
  if nullif(current_setting('smoke.bio_owner', true), '') is null then
    raise exception 'profile_bio smoke needs at least one existing user_profiles row';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('smoke.bio_owner'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);

update public.user_profiles
set bio = repeat('b', 150)
where id = current_setting('smoke.bio_owner')::uuid;

do $$
begin
  if (
    select bio from public.user_profiles where id = current_setting('smoke.bio_owner')::uuid
  ) is distinct from repeat('b', 150) then
    raise exception 'Owner should be able to save a 150-character bio';
  end if;

  begin
    update public.user_profiles
    set bio = repeat('b', 151)
    where id = current_setting('smoke.bio_owner')::uuid;
    raise exception 'A 151-character bio should be rejected';
  exception
    when check_violation then null;
  end;
end $$;

reset role;

do $$
begin
  if (
    select bio from public.public_profiles where id = current_setting('smoke.bio_owner')::uuid
  ) is distinct from repeat('b', 150) then
    raise exception 'public_profiles.bio should mirror user_profiles.bio';
  end if;
end $$;

-- Another signed-in user cannot change the owner's bio (RLS filters the row).
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('smoke.bio_other'), true);

update public.user_profiles
set bio = 'hijacked'
where id = current_setting('smoke.bio_owner')::uuid
  and current_setting('smoke.bio_other') <> current_setting('smoke.bio_owner');

reset role;

do $$
begin
  if (
    select bio from public.user_profiles where id = current_setting('smoke.bio_owner')::uuid
  ) = 'hijacked' then
    raise exception 'Another user should not be able to edit this bio';
  end if;
end $$;

rollback;
