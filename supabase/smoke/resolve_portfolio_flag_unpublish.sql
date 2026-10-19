-- Smoke checks for 20261019112000_resolve_portfolio_flag_unpublish.sql.
-- A moderator's "removed" takes the reported list down and closes its other
-- pending reports; non-moderators cannot resolve. Runs in a transaction and
-- rolls back.

begin;

-- Fixed ids for this smoke only.
--   owner:     00000000-0000-0044-b000-000000000001
--   reporter1: 00000000-0000-0044-b000-000000000002
--   reporter2: 00000000-0000-0044-b000-000000000003
--   moderator: 00000000-0000-0044-b000-000000000004
--   portfolio: 00000000-0000-0044-b000-0000000000a1
insert into user_profiles (id, display_name)
values
  ('00000000-0000-0044-b000-000000000001', 'Flag Smoke Owner'),
  ('00000000-0000-0044-b000-000000000002', 'Flag Smoke Reporter 1'),
  ('00000000-0000-0044-b000-000000000003', 'Flag Smoke Reporter 2'),
  ('00000000-0000-0044-b000-000000000004', 'Flag Smoke Moderator')
on conflict (id) do nothing;

insert into app_ops_admins (user_id, role, enabled)
values ('00000000-0000-0044-b000-000000000004', 'operator', true)
on conflict (user_id) do update set enabled = true, role = excluded.role;

insert into portfolios (id, owner_id, name, type, visibility, published_at)
values (
  '00000000-0000-0044-b000-0000000000a1',
  '00000000-0000-0044-b000-000000000001',
  'Flag Smoke List',
  'collection',
  'public',
  now()
);

insert into portfolio_flags (id, portfolio_id, reporter_id, reason)
values
  (
    '00000000-0000-0044-b000-0000000000f1',
    '00000000-0000-0044-b000-0000000000a1',
    '00000000-0000-0044-b000-000000000002',
    'spam'
  ),
  (
    '00000000-0000-0044-b000-0000000000f2',
    '00000000-0000-0044-b000-0000000000a1',
    '00000000-0000-0044-b000-000000000003',
    'inappropriate'
  );

set local role authenticated;

-- A reporter cannot resolve reports.
select set_config('request.jwt.claim.sub', '00000000-0000-0044-b000-000000000002', true);
do $$
begin
  begin
    perform public.resolve_portfolio_flag('00000000-0000-0044-b000-0000000000f1', 'removed');
    raise exception 'A non-moderator should not resolve reports';
  exception
    when insufficient_privilege then null;
  end;
end $$;

-- The moderator removes: the list is unpublished and both reports close.
select set_config('request.jwt.claim.sub', '00000000-0000-0044-b000-000000000004', true);
select public.resolve_portfolio_flag('00000000-0000-0044-b000-0000000000f1', 'removed');

reset role;

do $$
begin
  if exists (
    select 1
    from public.portfolios
    where id = '00000000-0000-0044-b000-0000000000a1'
      and (visibility <> 'private' or published_at is not null)
  ) then
    raise exception 'A removed list should be private and unpublished';
  end if;

  if exists (
    select 1
    from public.portfolio_flags
    where portfolio_id = '00000000-0000-0044-b000-0000000000a1'
      and status <> 'removed'
  ) then
    raise exception 'Every pending report on a removed list should close as removed';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'resolve_portfolio_flag'
      and p.prosecdef
  ) then
    raise exception 'public.resolve_portfolio_flag must be SECURITY INVOKER';
  end if;
end $$;

rollback;
