-- Smoke checks for 20261022010000_guard_favourites_count.sql.
-- The owner cannot PATCH favourites_count (nor set it on insert), and the value does not
-- reach public_profiles; code running as the table owner still can. Rolls back.

begin;

-- Fixed id for this smoke only.
insert into user_profiles (id, display_name)
values ('00000000-0000-0063-b000-000000000001', 'Favourites Guard')
on conflict (id) do nothing;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0063-b000-000000000001', true);
set local role authenticated;

update user_profiles
set favourites_count = 999, display_name = 'Favourites Guard Renamed'
where id = '00000000-0000-0063-b000-000000000001';

reset role;

do $$
declare
  v_count integer;
  v_public integer;
  v_name text;
begin
  select up.favourites_count, pp.favourites_count, up.display_name
  into v_count, v_public, v_name
  from user_profiles up
  join public_profiles pp on pp.id = up.id
  where up.id = '00000000-0000-0063-b000-000000000001';

  if v_count is distinct from 0 or v_public is distinct from 0 then
    raise exception 'The owner must not change favourites_count (got %, public %)', v_count, v_public;
  end if;
  -- The guard leaves the rest of the row editable.
  if v_name is distinct from 'Favourites Guard Renamed' then
    raise exception 'Other profile columns should still update (got %)', v_name;
  end if;
end $$;

-- A new profile row written by a client role starts at 0 whatever it sends.
select set_config('request.jwt.claim.sub', '00000000-0000-0063-b000-000000000002', true);
set local role authenticated;
insert into user_profiles (id, display_name, favourites_count)
values ('00000000-0000-0063-b000-000000000002', 'Favourites Guard Two', 500);
reset role;

do $$
declare
  v_count integer;
begin
  select favourites_count into v_count
  from user_profiles
  where id = '00000000-0000-0063-b000-000000000002';
  if v_count is distinct from 0 then
    raise exception 'A client insert must start favourites_count at 0 (got %)', v_count;
  end if;
end $$;

-- Server-owned code (the table owner, as in account deletion) can still write it.
update user_profiles
set favourites_count = 7
where id = '00000000-0000-0063-b000-000000000001';

do $$
declare
  v_count integer;
begin
  select favourites_count into v_count
  from user_profiles
  where id = '00000000-0000-0063-b000-000000000001';
  if v_count is distinct from 7 then
    raise exception 'Server-owned writes to favourites_count should still work (got %)', v_count;
  end if;
end $$;

rollback;
