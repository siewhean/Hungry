-- Smoke checks for 20261019180000_portfolio_collaborator_profiles.sql.
-- The owner and a collaborator see collaborators with their display names;
-- a stranger sees none, even on a public list. The owner can still add and
-- remove collaborators through the existing table policies. Runs in a
-- transaction and rolls back.

begin;

insert into user_profiles (id, display_name, avatar_url)
values
  ('00000000-0000-0047-a000-000000000001', 'Collab Smoke Owner', null),
  ('00000000-0000-0047-a000-000000000002', 'Collab Smoke Friend', 'https://example.com/friend.png'),
  ('00000000-0000-0047-a000-000000000003', 'Collab Smoke Stranger', null),
  ('00000000-0000-0047-a000-000000000004', 'Collab Smoke Editor', null)
on conflict (id) do nothing;

insert into portfolios (id, owner_id, name, type, visibility)
values (
  '00000000-0000-0047-a000-0000000000a1',
  '00000000-0000-0047-a000-000000000001',
  'Collab Smoke List',
  'collection',
  'public'
);

insert into portfolio_collaborators (portfolio_id, user_id, role)
values (
  '00000000-0000-0047-a000-0000000000a1',
  '00000000-0000-0047-a000-000000000002',
  'viewer'
);

set local role authenticated;

-- Owner: sees the collaborator by name, can add an editor and remove them again.
select set_config('request.jwt.claim.sub', '00000000-0000-0047-a000-000000000001', true);

do $$
begin
  if not exists (
    select 1
    from public.list_portfolio_collaborators('00000000-0000-0047-a000-0000000000a1')
    where display_name = 'Collab Smoke Friend'
      and avatar_url = 'https://example.com/friend.png'
      and role = 'viewer'
  ) then
    raise exception 'owner cannot see collaborator names';
  end if;

  insert into public.portfolio_collaborators (portfolio_id, user_id, role)
  values (
    '00000000-0000-0047-a000-0000000000a1',
    '00000000-0000-0047-a000-000000000004',
    'editor'
  );

  if (
    select count(*)
    from public.list_portfolio_collaborators('00000000-0000-0047-a000-0000000000a1')
  ) <> 2 then
    raise exception 'owner does not see the added editor';
  end if;

  delete from public.portfolio_collaborators
  where portfolio_id = '00000000-0000-0047-a000-0000000000a1'
    and user_id = '00000000-0000-0047-a000-000000000004';
end $$;

-- Collaborator: sees the list's collaborators.
select set_config('request.jwt.claim.sub', '00000000-0000-0047-a000-000000000002', true);

do $$
begin
  if (
    select count(*)
    from public.list_portfolio_collaborators('00000000-0000-0047-a000-0000000000a1')
  ) <> 1 then
    raise exception 'collaborator cannot see the collaborators';
  end if;
end $$;

-- Stranger: no rows, even though the list is public.
select set_config('request.jwt.claim.sub', '00000000-0000-0047-a000-000000000003', true);

do $$
begin
  if exists (
    select 1 from public.list_portfolio_collaborators('00000000-0000-0047-a000-0000000000a1')
  ) then
    raise exception 'stranger can see collaborators';
  end if;
end $$;

reset role;

do $$
begin
  if exists (
    select 1
    from pg_proc
    where oid = 'public.list_portfolio_collaborators(uuid)'::regprocedure
      and prosecdef
  ) then
    raise exception 'public.list_portfolio_collaborators must be security invoker';
  end if;
end $$;

select 'portfolio_collaborator_profiles_smoke_passed' as result;

rollback;
