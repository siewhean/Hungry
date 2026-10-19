-- Smoke checks for 20261019160000_portfolio_policy_recursion_fix.sql.
-- Signed-in and signed-out reads of portfolios and portfolio_collaborators no
-- longer fail with "infinite recursion detected in policy", and a collaborator
-- still sees a private list they were added to. Runs in a transaction and
-- rolls back.

begin;

insert into user_profiles (id, display_name)
values
  ('00000000-0000-0046-a000-000000000001', 'Recursion Smoke Owner'),
  ('00000000-0000-0046-a000-000000000002', 'Recursion Smoke Collaborator'),
  ('00000000-0000-0046-a000-000000000003', 'Recursion Smoke Stranger')
on conflict (id) do nothing;

insert into portfolios (id, owner_id, name, type, visibility)
values (
  '00000000-0000-0046-a000-0000000000a1',
  '00000000-0000-0046-a000-000000000001',
  'Recursion Smoke List',
  'collection',
  'private'
);

insert into portfolio_collaborators (portfolio_id, user_id, role)
values (
  '00000000-0000-0046-a000-0000000000a1',
  '00000000-0000-0046-a000-000000000002',
  'viewer'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0046-a000-000000000002', true);

do $$
begin
  if not exists (select 1 from public.portfolios where id = '00000000-0000-0046-a000-0000000000a1') then
    raise exception 'collaborator cannot see the private list they were added to';
  end if;
  perform count(*) from public.portfolio_collaborators;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0046-a000-000000000003', true);

do $$
begin
  if exists (select 1 from public.portfolios where id = '00000000-0000-0046-a000-0000000000a1') then
    raise exception 'stranger can see a private list';
  end if;
end $$;

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);

do $$
begin
  perform count(*) from public.portfolios;
end $$;

reset role;
select 'portfolio_policy_recursion_fix_smoke_passed' as result;

rollback;
