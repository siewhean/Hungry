-- Smoke checks for 20261019111000_portfolio_private_notes_guard.sql.
-- A public list's items stay readable to other users, but private_notes is
-- only returned to the owner and collaborators. Runs in a transaction and
-- rolls back.

begin;

-- Fixed ids for this smoke only.
--   owner:        00000000-0000-0044-a000-000000000001
--   collaborator: 00000000-0000-0044-a000-000000000002
--   stranger:     00000000-0000-0044-a000-000000000003
--   portfolio:    00000000-0000-0044-a000-0000000000a1
insert into user_profiles (id, display_name)
values
  ('00000000-0000-0044-a000-000000000001', 'Notes Smoke Owner'),
  ('00000000-0000-0044-a000-000000000002', 'Notes Smoke Collaborator'),
  ('00000000-0000-0044-a000-000000000003', 'Notes Smoke Stranger')
on conflict (id) do nothing;

insert into buildings (id, slug, name, building_type, latitude, longitude, floors)
values (
  'notes-smoke-building',
  'notes-smoke-building',
  'Notes Smoke Building',
  'hawker_centre',
  1.3002,
  103.8002,
  array['01']
)
on conflict (id) do nothing;

insert into venues (id, building_id, name, unit_number, floor)
values ('notes-smoke-venue', 'notes-smoke-building', 'Notes Smoke Venue', '#01-02', '01')
on conflict (id) do nothing;

insert into portfolios (id, owner_id, name, type, visibility, published_at)
values (
  '00000000-0000-0044-a000-0000000000a1',
  '00000000-0000-0044-a000-000000000001',
  'Notes Smoke List',
  'collection',
  'public',
  now()
);

insert into portfolio_items (portfolio_id, item_type, stall_id, public_notes, private_notes)
values (
  '00000000-0000-0044-a000-0000000000a1',
  'stall',
  'notes-smoke-venue',
  'Public note',
  'Secret note'
);

insert into portfolio_collaborators (portfolio_id, user_id, role)
values (
  '00000000-0000-0044-a000-0000000000a1',
  '00000000-0000-0044-a000-000000000002',
  'viewer'
);

set local role authenticated;

-- Stranger: sees the row and public notes, but not private_notes.
select set_config('request.jwt.claim.sub', '00000000-0000-0044-a000-000000000003', true);
do $$
begin
  if (
    select count(*)
    from public.portfolio_items
    where portfolio_id = '00000000-0000-0044-a000-0000000000a1'
      and public_notes = 'Public note'
  ) <> 1 then
    raise exception 'A public list item should stay readable to other users';
  end if;

  begin
    perform private_notes
    from public.portfolio_items
    where portfolio_id = '00000000-0000-0044-a000-0000000000a1';
    raise exception 'Selecting private_notes directly should be refused';
  exception
    when insufficient_privilege then null;
  end;

  if exists (
    select 1
    from public.get_portfolio_private_notes('00000000-0000-0044-a000-0000000000a1')
  ) then
    raise exception 'get_portfolio_private_notes should return nothing to a stranger';
  end if;
end $$;

-- Collaborator and owner: the RPC returns the note.
select set_config('request.jwt.claim.sub', '00000000-0000-0044-a000-000000000002', true);
do $$
begin
  if not exists (
    select 1
    from public.get_portfolio_private_notes('00000000-0000-0044-a000-0000000000a1')
    where private_notes = 'Secret note'
  ) then
    raise exception 'A collaborator should read private notes';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0044-a000-000000000001', true);
do $$
begin
  if not exists (
    select 1
    from public.get_portfolio_private_notes('00000000-0000-0044-a000-0000000000a1')
    where private_notes = 'Secret note'
  ) then
    raise exception 'The owner should read private notes';
  end if;
end $$;

reset role;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_portfolio_private_notes'
      and p.prosecdef
  ) then
    raise exception 'public.get_portfolio_private_notes must be SECURITY INVOKER';
  end if;
end $$;

rollback;
