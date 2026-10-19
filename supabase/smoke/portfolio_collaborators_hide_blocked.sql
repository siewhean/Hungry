-- Smoke checks for 20261019181000_portfolio_collaborators_hide_blocked.sql.
-- A collaborator does not see another collaborator they blocked (or who
-- blocked them); the owner still sees everyone. Runs in a transaction and
-- rolls back.

begin;

insert into user_profiles (id, display_name, avatar_url)
values
  ('00000000-0000-0047-b000-000000000001', 'Block Smoke Owner', null),
  ('00000000-0000-0047-b000-000000000002', 'Block Smoke Blocker', null),
  ('00000000-0000-0047-b000-000000000003', 'Block Smoke Blocked', null),
  ('00000000-0000-0047-b000-000000000004', 'Block Smoke Bystander', null)
on conflict (id) do nothing;

insert into portfolios (id, owner_id, name, type, visibility)
values (
  '00000000-0000-0047-b000-0000000000a1',
  '00000000-0000-0047-b000-000000000001',
  'Block Smoke List',
  'collection',
  'private'
);

insert into portfolio_collaborators (portfolio_id, user_id, role)
values
  ('00000000-0000-0047-b000-0000000000a1', '00000000-0000-0047-b000-000000000002', 'viewer'),
  ('00000000-0000-0047-b000-0000000000a1', '00000000-0000-0047-b000-000000000003', 'viewer'),
  ('00000000-0000-0047-b000-0000000000a1', '00000000-0000-0047-b000-000000000004', 'viewer');

insert into user_blocks (blocker_id, blocked_user_key)
values ('00000000-0000-0047-b000-000000000002', '00000000-0000-0047-b000-000000000003');

set local role authenticated;

-- Owner: sees all three collaborators.
select set_config('request.jwt.claim.sub', '00000000-0000-0047-b000-000000000001', true);

do $$
begin
  if (
    select count(*)
    from public.list_portfolio_collaborators('00000000-0000-0047-b000-0000000000a1')
  ) <> 3 then
    raise exception 'owner must see every collaborator';
  end if;
end $$;

-- Blocker: sees self and the bystander, not the blocked user.
select set_config('request.jwt.claim.sub', '00000000-0000-0047-b000-000000000002', true);

do $$
begin
  if exists (
    select 1
    from public.list_portfolio_collaborators('00000000-0000-0047-b000-0000000000a1')
    where user_id = '00000000-0000-0047-b000-000000000003'
  ) then
    raise exception 'blocker can see the collaborator they blocked';
  end if;
  if (
    select count(*)
    from public.list_portfolio_collaborators('00000000-0000-0047-b000-0000000000a1')
  ) <> 2 then
    raise exception 'blocker should see self and the bystander';
  end if;
end $$;

-- Blocked user: does not see the blocker.
select set_config('request.jwt.claim.sub', '00000000-0000-0047-b000-000000000003', true);

do $$
begin
  if exists (
    select 1
    from public.list_portfolio_collaborators('00000000-0000-0047-b000-0000000000a1')
    where user_id = '00000000-0000-0047-b000-000000000002'
  ) then
    raise exception 'blocked user can see the blocker';
  end if;
end $$;

-- Bystander: sees all three.
select set_config('request.jwt.claim.sub', '00000000-0000-0047-b000-000000000004', true);

do $$
begin
  if (
    select count(*)
    from public.list_portfolio_collaborators('00000000-0000-0047-b000-0000000000a1')
  ) <> 3 then
    raise exception 'bystander should see every collaborator';
  end if;
end $$;

reset role;

select 'portfolio_collaborators_hide_blocked_smoke_passed' as result;

rollback;
