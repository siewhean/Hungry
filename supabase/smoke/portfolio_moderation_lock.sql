-- Smoke checks for 20261019113000_portfolio_moderation_lock.sql.
-- After a moderator removes a reported list, the owner cannot make it public
-- again (table UPDATE or publish RPC) or clear the takedown marker. Runs in a
-- transaction and rolls back.

begin;

-- Fixed ids for this smoke only.
--   owner:     00000000-0000-0045-b000-000000000001
--   reporter:  00000000-0000-0045-b000-000000000002
--   moderator: 00000000-0000-0045-b000-000000000003
--   portfolio: 00000000-0000-0045-b000-0000000000a1
insert into user_profiles (id, display_name)
values
  ('00000000-0000-0045-b000-000000000001', 'Lock Smoke Owner'),
  ('00000000-0000-0045-b000-000000000002', 'Lock Smoke Reporter'),
  ('00000000-0000-0045-b000-000000000003', 'Lock Smoke Moderator')
on conflict (id) do nothing;

insert into app_ops_admins (user_id, role, enabled)
values ('00000000-0000-0045-b000-000000000003', 'operator', true)
on conflict (user_id) do update set enabled = true, role = excluded.role;

insert into portfolios (id, owner_id, name, type, visibility, published_at)
values (
  '00000000-0000-0045-b000-0000000000a1',
  '00000000-0000-0045-b000-000000000001',
  'Lock Smoke List',
  'collection',
  'public',
  now()
);

insert into portfolio_flags (id, portfolio_id, reporter_id, reason)
values (
  '00000000-0000-0045-b000-0000000000f1',
  '00000000-0000-0045-b000-0000000000a1',
  '00000000-0000-0045-b000-000000000002',
  'spam'
);

set local role authenticated;

-- Before any takedown the owner cannot set the marker themselves.
select set_config('request.jwt.claim.sub', '00000000-0000-0045-b000-000000000001', true);
do $$
begin
  begin
    update public.portfolios
    set moderation_removed_at = now(), visibility = 'private', published_at = null
    where id = '00000000-0000-0045-b000-0000000000a1';
    raise exception 'An owner should not set moderation_removed_at';
  exception
    when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0045-b000-000000000003', true);
select public.resolve_portfolio_flag('00000000-0000-0045-b000-0000000000f1', 'removed');

select set_config('request.jwt.claim.sub', '00000000-0000-0045-b000-000000000001', true);
do $$
begin
  begin
    update public.portfolios
    set visibility = 'public'
    where id = '00000000-0000-0045-b000-0000000000a1';
    raise exception 'A removed list should not be made public again';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.portfolios
    set visibility = 'followers_only'
    where id = '00000000-0000-0045-b000-0000000000a1';
    raise exception 'A removed list should not be shared with followers';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.publish_portfolio_with_passport('00000000-0000-0045-b000-0000000000a1', null);
    raise exception 'A removed list should not be republished';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.portfolios
    set moderation_removed_at = null
    where id = '00000000-0000-0045-b000-0000000000a1';
    raise exception 'An owner should not clear moderation_removed_at';
  exception
    when insufficient_privilege then null;
  end;

  -- Private edits still work.
  update public.portfolios
  set name = 'Lock Smoke List (renamed)'
  where id = '00000000-0000-0045-b000-0000000000a1';
end $$;

reset role;

do $$
begin
  if not exists (
    select 1
    from public.portfolios
    where id = '00000000-0000-0045-b000-0000000000a1'
      and moderation_removed_at is not null
      and visibility = 'private'
      and published_at is null
      and name = 'Lock Smoke List (renamed)'
  ) then
    raise exception 'A removed list should stay private, unpublished and marked';
  end if;
end $$;

rollback;
