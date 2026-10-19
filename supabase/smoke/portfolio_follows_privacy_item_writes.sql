-- Smoke checks for 20261020040000_portfolio_follows_privacy_item_writes.sql.
-- A stranger cannot list who follows a list; the follower sees their own row and
-- the owner sees every follower. Signed-in users cannot UPDATE or DELETE
-- portfolio_items directly, while the versioned RPC still edits. search_portfolios
-- treats % literally. Runs in a transaction and rolls back.

begin;

insert into user_profiles (id, display_name)
values
  ('00000000-0000-0048-a000-000000000001', 'Follow Smoke Owner'),
  ('00000000-0000-0048-a000-000000000002', 'Follow Smoke Follower'),
  ('00000000-0000-0048-a000-000000000003', 'Follow Smoke Stranger')
on conflict (id) do nothing;

insert into buildings (id, slug, name, building_type, latitude, longitude, floors)
values (
  'follow-smoke-building',
  'follow-smoke-building',
  'Follow Smoke Building',
  'hawker_centre',
  1.3001,
  103.8001,
  array['01']
)
on conflict (id) do nothing;

insert into venues (id, building_id, name, floor)
values ('follow-smoke-venue', 'follow-smoke-building', 'Follow Smoke Venue', '01')
on conflict (id) do nothing;

insert into dishes (id, venue_id, building_id, name)
values ('follow-smoke-dish', 'follow-smoke-venue', 'follow-smoke-building', 'Follow Smoke Dish')
on conflict (id) do nothing;

insert into portfolios (id, owner_id, name, type, visibility)
values (
  '00000000-0000-0048-a000-0000000000a1',
  '00000000-0000-0048-a000-000000000001',
  'Follow Smoke 50% List',
  'collection',
  'public'
);

insert into portfolio_items (id, portfolio_id, item_type, dish_id, score)
values (
  '00000000-0000-0048-a000-0000000000b1',
  '00000000-0000-0048-a000-0000000000a1',
  'dish',
  'follow-smoke-dish',
  7
);

insert into portfolio_follows (portfolio_id, user_id)
values ('00000000-0000-0048-a000-0000000000a1', '00000000-0000-0048-a000-000000000002');

set local role authenticated;

-- Stranger: sees no follow rows and cannot write items directly.
select set_config('request.jwt.claim.sub', '00000000-0000-0048-a000-000000000003', true);

do $$
begin
  if exists (
    select 1 from public.portfolio_follows
    where portfolio_id = '00000000-0000-0048-a000-0000000000a1'
  ) then
    raise exception 'stranger can list followers of another user''s list';
  end if;

  if (
    select count(*)
    from public.search_portfolios('Follow Smoke 50%', null, 'public')
    where id = '00000000-0000-0048-a000-0000000000a1'
  ) <> 1 then
    raise exception 'search_portfolios does not match a literal %%';
  end if;

  if exists (select 1 from public.search_portfolios('Follow Smoke 5_%', null, 'public')) then
    raise exception 'search_portfolios still treats _ as a wildcard';
  end if;
end $$;

-- Follower: sees only their own follow row.
select set_config('request.jwt.claim.sub', '00000000-0000-0048-a000-000000000002', true);

do $$
begin
  if (
    select count(*) from public.portfolio_follows
    where portfolio_id = '00000000-0000-0048-a000-0000000000a1'
  ) <> 1 then
    raise exception 'follower cannot see their own follow';
  end if;
end $$;

-- Owner: sees followers, cannot UPDATE/DELETE items directly, RPC still works.
select set_config('request.jwt.claim.sub', '00000000-0000-0048-a000-000000000001', true);

do $$
begin
  if (
    select count(*) from public.portfolio_follows
    where portfolio_id = '00000000-0000-0048-a000-0000000000a1'
  ) <> 1 then
    raise exception 'owner cannot see who follows their list';
  end if;

  begin
    update public.portfolio_items set score = 9
    where id = '00000000-0000-0048-a000-0000000000b1';
    raise exception 'direct portfolio_items UPDATE is still allowed';
  exception when insufficient_privilege then
    null;
  end;

  begin
    delete from public.portfolio_items
    where id = '00000000-0000-0048-a000-0000000000b1';
    raise exception 'direct portfolio_items DELETE is still allowed';
  exception when insufficient_privilege then
    null;
  end;

  perform public.update_portfolio_item_with_version(
    '00000000-0000-0048-a000-0000000000b1', 9, null, null, null
  );
end $$;

reset role;

do $$
begin
  if (
    select score from public.portfolio_items
    where id = '00000000-0000-0048-a000-0000000000b1'
  ) <> 9 then
    raise exception 'versioned item RPC no longer updates';
  end if;
end $$;

select 'portfolio_follows_privacy_item_writes smoke passed' as result;

rollback;
