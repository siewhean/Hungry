-- Smoke checks for 20261022070000_lists_extras_mediums_lows.sql.
-- M1: publishing again after Unpublish makes the list public and keeps the first
--     published_at.
-- M8: owners add only people they follow, never across a block, never themselves;
--     a stranger cannot read collaborator rows of a public list; a collaborator can
--     leave but cannot remove someone else.
-- M10: a 501-character description is refused.
-- L7: a dish the public cannot see is left out of the share page and cannot be
--     added to a list.
-- M14: get_portfolio_item_details returns names in one call.
-- Runs in a transaction and rolls back.

begin;

insert into user_profiles (id, display_name)
values
  ('00000000-0000-0070-a000-000000000001', 'Extras Smoke Owner'),
  ('00000000-0000-0070-a000-000000000002', 'Extras Smoke Followed'),
  ('00000000-0000-0070-a000-000000000003', 'Extras Smoke Stranger'),
  ('00000000-0000-0070-a000-000000000004', 'Extras Smoke Blocker'),
  ('00000000-0000-0070-a000-000000000005', 'Extras Smoke Second')
on conflict (id) do nothing;

insert into buildings (id, slug, name, building_type, latitude, longitude, floors)
values (
  'extras-smoke-building',
  'extras-smoke-building',
  'Extras Smoke Building',
  'hawker_centre',
  1.3001,
  103.8001,
  array['01']
)
on conflict (id) do nothing;

insert into venues (id, building_id, name, floor)
values ('extras-smoke-venue', 'extras-smoke-building', 'Extras Smoke Venue', '01')
on conflict (id) do nothing;

insert into dishes (
  id, venue_id, building_id, name, price, menu_approved_for_display, menu_rights_status
)
values
  ('extras-smoke-shown', 'extras-smoke-venue', 'extras-smoke-building', 'Extras Shown Dish', 4.5, true, 'operator_owned'),
  ('extras-smoke-hidden', 'extras-smoke-venue', 'extras-smoke-building', 'Extras Hidden Dish', 5.5, false, 'unverified')
on conflict (id) do nothing;

insert into portfolios (id, owner_id, name, type, visibility, published_at)
values
  (
    '00000000-0000-0070-a000-0000000000a1',
    '00000000-0000-0070-a000-000000000001',
    'Extras Smoke Republish',
    'collection',
    'public',
    now() - interval '2 days'
  ),
  (
    '00000000-0000-0070-a000-0000000000a2',
    '00000000-0000-0070-a000-000000000001',
    'Extras Smoke Public List',
    'collection',
    'public',
    null
  );

-- Owner follows the person they may add; the blocker is followed too but blocks the owner.
insert into follows (follower_id, followee_id, status)
values
  ('00000000-0000-0070-a000-000000000001', '00000000-0000-0070-a000-000000000002', 'approved'),
  ('00000000-0000-0070-a000-000000000001', '00000000-0000-0070-a000-000000000004', 'approved'),
  ('00000000-0000-0070-a000-000000000001', '00000000-0000-0070-a000-000000000005', 'approved');

insert into user_blocks (blocker_id, blocked_user_key)
values ('00000000-0000-0070-a000-000000000004', '00000000-0000-0070-a000-000000000001');

-- A hidden dish placed straight into a list (as if added before the rule existed).
insert into portfolio_items (portfolio_id, item_type, dish_id, position)
values
  ('00000000-0000-0070-a000-0000000000a2', 'dish', 'extras-smoke-shown', 0),
  ('00000000-0000-0070-a000-0000000000a2', 'dish', 'extras-smoke-hidden', 1);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0070-a000-000000000001', true);

-- M1: Unpublish (private), then publish again.
do $$
declare
  v_first timestamptz;
begin
  select published_at into v_first
  from public.portfolios
  where id = '00000000-0000-0070-a000-0000000000a1';

  update public.portfolios
  set visibility = 'private'
  where id = '00000000-0000-0070-a000-0000000000a1';

  perform public.publish_portfolio_with_passport('00000000-0000-0070-a000-0000000000a1');

  if not exists (
    select 1 from public.portfolios
    where id = '00000000-0000-0070-a000-0000000000a1'
      and visibility = 'public'
      and published_at = v_first
  ) then
    raise exception 'publishing again after unpublish must make the list public and keep published_at';
  end if;
end $$;

-- M10: description length.
do $$
begin
  begin
    update public.portfolios
    set description = repeat('x', 501)
    where id = '00000000-0000-0070-a000-0000000000a1';
    raise exception 'a 501-character description was accepted';
  exception when check_violation then
    null;
  end;

  update public.portfolios
  set description = repeat('x', 500)
  where id = '00000000-0000-0070-a000-0000000000a1';
end $$;

-- M8: owner adds a followed person, but not a stranger, a blocker, or themselves.
do $$
begin
  insert into public.portfolio_collaborators (portfolio_id, user_id, role)
  values (
    '00000000-0000-0070-a000-0000000000a2',
    '00000000-0000-0070-a000-000000000002',
    'editor'
  );
  insert into public.portfolio_collaborators (portfolio_id, user_id, role)
  values (
    '00000000-0000-0070-a000-0000000000a2',
    '00000000-0000-0070-a000-000000000005',
    'viewer'
  );

  begin
    insert into public.portfolio_collaborators (portfolio_id, user_id, role)
    values (
      '00000000-0000-0070-a000-0000000000a2',
      '00000000-0000-0070-a000-000000000003',
      'viewer'
    );
    raise exception 'owner added someone they do not follow';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.portfolio_collaborators (portfolio_id, user_id, role)
    values (
      '00000000-0000-0070-a000-0000000000a2',
      '00000000-0000-0070-a000-000000000004',
      'viewer'
    );
    raise exception 'owner added someone who blocked them';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.portfolio_collaborators (portfolio_id, user_id, role)
    values (
      '00000000-0000-0070-a000-0000000000a2',
      '00000000-0000-0070-a000-000000000001',
      'editor'
    );
    raise exception 'owner added themselves as a collaborator';
  exception when insufficient_privilege then
    null;
  end;

  if (
    select count(*) from public.portfolio_collaborators
    where portfolio_id = '00000000-0000-0070-a000-0000000000a2'
  ) <> 2 then
    raise exception 'owner should see both collaborator rows';
  end if;
end $$;

-- L12: the owner changes a role in place.
do $$
begin
  update public.portfolio_collaborators
  set role = 'viewer'
  where portfolio_id = '00000000-0000-0070-a000-0000000000a2'
    and user_id = '00000000-0000-0070-a000-000000000002';

  if not exists (
    select 1 from public.portfolio_collaborators
    where portfolio_id = '00000000-0000-0070-a000-0000000000a2'
      and user_id = '00000000-0000-0070-a000-000000000002'
      and role = 'viewer'
  ) then
    raise exception 'owner cannot change a collaborator role';
  end if;
end $$;

-- L7: a hidden dish cannot be added, and the share page leaves it out.
do $$
declare
  v_page jsonb;
begin
  begin
    perform public.add_portfolio_item_with_passport(
      '00000000-0000-0070-a000-0000000000a2',
      'dish',
      'extras-smoke-hidden'
    );
    raise exception 'a dish the public cannot see was added to a list';
  exception when others then
    if sqlerrm not like '%not available to add%' then
      raise;
    end if;
  end;

  v_page := public.get_public_portfolio('00000000-0000-0070-a000-0000000000a2');
  if jsonb_array_length(v_page -> 'items') <> 1
    or v_page -> 'items' -> 0 ->> 'name' <> 'Extras Shown Dish' then
    raise exception 'share page must list only the displayable dish: %', v_page -> 'items';
  end if;
end $$;

-- M14: one call returns the names; the dish the public cannot see has no name.
do $$
begin
  if (
    select count(*) from public.get_portfolio_item_details('00000000-0000-0070-a000-0000000000a2')
  ) <> 2 then
    raise exception 'get_portfolio_item_details must return a row per item';
  end if;

  if not exists (
    select 1 from public.get_portfolio_item_details('00000000-0000-0070-a000-0000000000a2')
    where dish_id = 'extras-smoke-shown' and name = 'Extras Shown Dish' and price = 4.5
  ) then
    raise exception 'get_portfolio_item_details must name the displayable dish';
  end if;

  if exists (
    select 1 from public.get_portfolio_item_details('00000000-0000-0070-a000-0000000000a2')
    where dish_id = 'extras-smoke-hidden' and name is not null
  ) then
    raise exception 'get_portfolio_item_details leaked a dish the public cannot see';
  end if;
end $$;

-- M8: a stranger cannot read collaborator rows, even though the list is public.
select set_config('request.jwt.claim.sub', '00000000-0000-0070-a000-000000000003', true);

do $$
begin
  if exists (
    select 1 from public.portfolio_collaborators
    where portfolio_id = '00000000-0000-0070-a000-0000000000a2'
  ) then
    raise exception 'stranger can read collaborator rows of a public list';
  end if;
end $$;

-- A collaborator sees only their own row, cannot remove someone else, and can leave.
select set_config('request.jwt.claim.sub', '00000000-0000-0070-a000-000000000002', true);

do $$
declare
  v_deleted integer;
begin
  if (
    select count(*) from public.portfolio_collaborators
    where portfolio_id = '00000000-0000-0070-a000-0000000000a2'
  ) <> 1 then
    raise exception 'collaborator should see only their own row';
  end if;

  update public.portfolio_collaborators
  set role = 'editor'
  where portfolio_id = '00000000-0000-0070-a000-0000000000a2'
    and user_id = '00000000-0000-0070-a000-000000000002';
  get diagnostics v_deleted = row_count;
  if v_deleted <> 0 then
    raise exception 'collaborator changed their own role';
  end if;

  delete from public.portfolio_collaborators
  where portfolio_id = '00000000-0000-0070-a000-0000000000a2'
    and user_id = '00000000-0000-0070-a000-000000000005';
  get diagnostics v_deleted = row_count;
  if v_deleted <> 0 then
    raise exception 'collaborator removed another collaborator';
  end if;

  delete from public.portfolio_collaborators
  where portfolio_id = '00000000-0000-0070-a000-0000000000a2'
    and user_id = '00000000-0000-0070-a000-000000000002';
  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then
    raise exception 'collaborator cannot leave a list';
  end if;
end $$;

reset role;

select 'lists_extras_mediums_lows_smoke_passed' as result;

rollback;
