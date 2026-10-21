-- Smoke checks for 20261021170000_portfolio_items_restore_private_notes_column_guard.sql.
-- After every portfolio_items grant migration, authenticated must hold no
-- table-wide SELECT and no column SELECT on private_notes, while a stranger
-- still reads a public list's other columns. Runs in a transaction and rolls back.

begin;

do $$
begin
  if has_table_privilege('authenticated', 'public.portfolio_items', 'select') then
    raise exception 'authenticated still has table-wide SELECT on portfolio_items';
  end if;
  if has_column_privilege('authenticated', 'public.portfolio_items', 'private_notes', 'select') then
    raise exception 'authenticated can SELECT portfolio_items.private_notes';
  end if;
  if has_column_privilege('anon', 'public.portfolio_items', 'private_notes', 'select') then
    raise exception 'anon can SELECT portfolio_items.private_notes';
  end if;
  if not has_column_privilege('authenticated', 'public.portfolio_items', 'public_notes', 'select') then
    raise exception 'authenticated lost SELECT on portfolio_items.public_notes';
  end if;
end $$;

insert into user_profiles (id, display_name)
values
  ('00000000-0000-0170-a000-000000000001', 'Guard Smoke Owner'),
  ('00000000-0000-0170-a000-000000000003', 'Guard Smoke Stranger')
on conflict (id) do nothing;

insert into buildings (id, slug, name, building_type, latitude, longitude, floors)
values (
  'guard-smoke-building',
  'guard-smoke-building',
  'Guard Smoke Building',
  'hawker_centre',
  1.3003,
  103.8003,
  array['01']
)
on conflict (id) do nothing;

insert into venues (id, building_id, name, unit_number, floor)
values ('guard-smoke-venue', 'guard-smoke-building', 'Guard Smoke Venue', '#01-03', '01')
on conflict (id) do nothing;

insert into portfolios (id, owner_id, name, type, visibility, published_at)
values (
  '00000000-0000-0170-a000-0000000000a1',
  '00000000-0000-0170-a000-000000000001',
  'Guard Smoke List',
  'collection',
  'public',
  now()
);

insert into portfolio_items (portfolio_id, item_type, stall_id, public_notes, private_notes)
values (
  '00000000-0000-0170-a000-0000000000a1',
  'stall',
  'guard-smoke-venue',
  'Public note',
  'Secret note'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0170-a000-000000000003', true);
do $$
begin
  if (
    select count(*)
    from public.portfolio_items
    where portfolio_id = '00000000-0000-0170-a000-0000000000a1'
      and public_notes = 'Public note'
  ) <> 1 then
    raise exception 'A public list item should stay readable to other users';
  end if;

  begin
    perform private_notes
    from public.portfolio_items
    where portfolio_id = '00000000-0000-0170-a000-0000000000a1';
    raise exception 'Selecting private_notes directly should be refused';
  exception
    when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
