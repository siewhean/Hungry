-- Smoke checks for 20261029090100_profile_card_hides_deactivated.sql.
-- Another viewer (and an anonymous one) gets no profile card while a deletion request is pending;
-- the owner still gets their own; cancelling the request brings the card back. Rolls back.

begin;

insert into user_profiles (id, display_name)
values
  ('00000000-0000-0062-b000-000000000001', 'Card Leaver Smoke'),
  ('00000000-0000-0062-b000-000000000002', 'Card Viewer Smoke')
on conflict (id) do nothing;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0062-b000-000000000002', true);
set local role authenticated;

do $$
begin
  if (select count(*) from public.get_profile_card('00000000-0000-0062-b000-000000000001')) <> 1 then
    raise exception 'An active account must have a visible card';
  end if;
end $$;

reset role;
insert into account_deletion_requests (id, user_id, status)
values ('00000000-0000-0062-a000-000000000001', '00000000-0000-0062-b000-000000000001', 'requested');

select set_config('request.jwt.claim.sub', '00000000-0000-0062-b000-000000000002', true);
set local role authenticated;

do $$
begin
  if exists (select 1 from public.get_profile_card('00000000-0000-0062-b000-000000000001')) then
    raise exception 'A pending-deletion account must have no card for another viewer';
  end if;
end $$;

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0062-b000-000000000001', true);
set local role authenticated;

do $$
begin
  if (select count(*) from public.get_profile_card('00000000-0000-0062-b000-000000000001')) <> 1 then
    raise exception 'The owner must still get their own card';
  end if;
end $$;

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
set local role anon;

do $$
begin
  if exists (select 1 from public.get_profile_card('00000000-0000-0062-b000-000000000001')) then
    raise exception 'An anonymous visitor must not see a pending-deletion card';
  end if;
end $$;

reset role;
update account_deletion_requests
set status = 'cancelled'
where id = '00000000-0000-0062-a000-000000000001';

select set_config('request.jwt.claim.sub', '00000000-0000-0062-b000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
begin
  if (select count(*) from public.get_profile_card('00000000-0000-0062-b000-000000000001')) <> 1 then
    raise exception 'Cancelling the request must bring the card back';
  end if;
end $$;

select 'profile_card_hides_deactivated smoke passed' as result;

rollback;
