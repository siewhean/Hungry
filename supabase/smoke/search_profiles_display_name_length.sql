-- Smoke checks for 20261022081000_search_profiles_and_display_name_length.sql.
-- People search finds public accounts by name, skips private accounts, blocked
-- pairs and yourself, refuses short queries and guests; a display name is cut to
-- 40 characters. Runs in a transaction and rolls back.

begin;

-- Fixed ids for this smoke only.
--   searcher: 00000000-0000-0081-b000-000000000001
--   public:   00000000-0000-0081-b000-000000000002
--   private:  00000000-0000-0081-b000-000000000003
--   blocked:  00000000-0000-0081-b000-000000000004
insert into user_profiles (id, display_name)
values
  ('00000000-0000-0081-b000-000000000001', 'Zzq Searcher'),
  ('00000000-0000-0081-b000-000000000002', 'Zzq Public Friend'),
  ('00000000-0000-0081-b000-000000000003', 'Zzq Private Friend'),
  ('00000000-0000-0081-b000-000000000004', 'Zzq Blocked Friend')
on conflict (id) do nothing;

insert into privacy_settings (user_id, account_visibility)
values ('00000000-0000-0081-b000-000000000003', 'private')
on conflict (user_id) do update set account_visibility = excluded.account_visibility;

insert into user_blocks (blocker_id, blocked_user_key, reason)
values (
  '00000000-0000-0081-b000-000000000001',
  '00000000-0000-0081-b000-000000000004',
  'smoke'
);

-- A long name is cut to 40 characters on insert and on update.
do $$
declare
  v_name text;
begin
  insert into user_profiles (id, display_name)
  values ('00000000-0000-0081-b000-000000000005', repeat('x', 80));
  select display_name into v_name
  from user_profiles where id = '00000000-0000-0081-b000-000000000005';
  if char_length(v_name) <> 40 then
    raise exception 'Display name should be cut to 40 characters on insert, got %', char_length(v_name);
  end if;

  update user_profiles
  set display_name = '  ' || repeat('y', 90)
  where id = '00000000-0000-0081-b000-000000000005';
  select display_name into v_name
  from user_profiles where id = '00000000-0000-0081-b000-000000000005';
  if char_length(v_name) <> 40 or v_name <> repeat('y', 40) then
    raise exception 'Display name should be trimmed and cut to 40 characters on update';
  end if;
end $$;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0081-b000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0081-b000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  v_ids uuid[];
  v_rows integer;
begin
  select array_agg(user_id) into v_ids from public.search_profiles('zzq');
  if v_ids is null or v_ids <> array['00000000-0000-0081-b000-000000000002'::uuid] then
    raise exception 'Search should return only the public, unblocked, other account, got %', v_ids;
  end if;

  -- Case-insensitive partial match.
  select count(*) into v_rows from public.search_profiles('PUBLIC FRI');
  if v_rows <> 1 then
    raise exception 'Search should match a partial name in any case, got % rows', v_rows;
  end if;

  -- Wildcards in the query are literal.
  select count(*) into v_rows from public.search_profiles('z%q');
  if v_rows <> 0 then
    raise exception 'A percent sign in the query should not act as a wildcard';
  end if;

  -- Too short a query returns nothing.
  select count(*) into v_rows from public.search_profiles('z');
  if v_rows <> 0 then
    raise exception 'A one-character query should return nothing';
  end if;
end $$;
reset role;

-- Guests cannot search.
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  begin
    perform public.search_profiles('zzq');
    raise exception 'A signed-out visitor should not be able to search people';
  exception
    when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
