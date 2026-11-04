-- Smoke checks for 20261028190000_venue_detail_merchant_reads.sql.
-- get_venue_detail returns merchant_profile, active_promotions and claim_status: a stall with no
-- verified outlet has a null profile and [] promotions, a guest never sees a claim status, and a
-- signed-in diner sees only their own claim. Runs in a transaction and rolls back. Brings its own
-- building, so it runs on prod (no seed data) as well as staging.
--   user: 00000000-0000-0048-b000-000000000002

begin;

insert into buildings (id, name, building_type, latitude, longitude)
values ('smoke-vd-building', 'Smoke VD Building', 'hawker_centre', 1.2803, 103.8448);

insert into venues (id, building_id, name, floor)
values ('smoke-vd-venue', 'smoke-vd-building', 'Smoke VD Stall', '1');

insert into user_profiles (id, display_name)
values ('00000000-0000-0048-b000-000000000002', 'Venue Detail Smoke User')
on conflict (id) do nothing;

insert into merchant_claim_interests (venue_id, building_id, claimed_by, status)
values (
  'smoke-vd-venue',
  'smoke-vd-building',
  '00000000-0000-0048-b000-000000000002',
  'contacted'
);

set local role anon;

do $$
declare
  r record;
begin
  select * into r from public.get_venue_detail('smoke-vd-venue');
  if r.venue_id is distinct from 'smoke-vd-venue' then
    raise exception 'get_venue_detail should return the stall';
  end if;
  if r.merchant_profile is not null then
    raise exception 'a stall with no verified outlet should have no merchant_profile';
  end if;
  if r.active_promotions is distinct from '[]'::jsonb then
    raise exception 'a stall with no promotions should return []';
  end if;
  if r.claim_status is not null then
    raise exception 'a guest should never see a claim status, got %', r.claim_status;
  end if;
end $$;

reset role;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0048-b000-000000000002', true);
set local role authenticated;

do $$
declare
  v_status text;
begin
  select claim_status into v_status from public.get_venue_detail('smoke-vd-venue');
  if v_status is distinct from 'contacted' then
    raise exception 'the claimant should see their own claim status, got %', v_status;
  end if;
end $$;

reset role;

-- Someone else sees no claim on the same stall.
select set_config('request.jwt.claim.sub', '00000000-0000-0048-b000-0000000000ff', true);
set local role authenticated;

do $$
begin
  if (select claim_status from public.get_venue_detail('smoke-vd-venue')) is not null then
    raise exception 'another diner must not see the claim status';
  end if;
end $$;

reset role;

select 'venue_detail_merchant_reads_smoke_passed' as result;

rollback;
