-- Smoke checks for the round-two merchant verification fixes:
--   20261021180000_merchant_promotions_require_verification.sql (H46)
--   20261021180100_merchant_review_reply_requires_verification.sql (H47)
--   20261021180200_merchant_venue_direct_writes_ops_only.sql (H48)
--   20261021180300_merchant_profile_publish_on_verify.sql (H49)
-- An ops-linked but unverified outlet cannot publish promotions or reply to
-- reviews, and diners never see its promotions; no merchant writes venue
-- columns directly; profile edits saved while pending reach the venue when
-- the outlet is verified. Rolls back.

begin;

-- Fixed ids for this smoke only.
--   owner:    00000000-0000-0218-b000-000000000001
--   diner:    00000000-0000-0218-b000-000000000002
--   account:  00000000-0000-0218-a000-000000000001
--   outlets:  00000000-0000-0218-d000-000000000001 (verified, smoke-r2f-venue)
--             00000000-0000-0218-d000-000000000002 (pending,  smoke-r2f-pending)
--   reviews:  00000000-0000-0218-e000-00000000000{1,2}
--   promos:   00000000-0000-0218-f000-00000000000{1..4}
insert into buildings (id, name, building_type, latitude, longitude)
values ('smoke-r2f-building', 'Smoke R2F Building', 'hawker_centre', 1.3, 103.8);

insert into venues (
  id, building_id, name, unit_number, floor, operating_hours, latitude, longitude,
  address, postal_code, contact_phone, website_url
)
values
  ('smoke-r2f-venue', 'smoke-r2f-building', 'Verified Stall', '#01-01', 'L1', 'Old hours',
   1.301, 103.801, '1 Smoke Street', '123456', null, null),
  ('smoke-r2f-pending', 'smoke-r2f-building', 'Pending Old', '#02-02', 'L2', 'Pending old hours',
   1.302, 103.802, '2 Smoke Street', '654321', '+6560000000', null);

insert into dishes (
  id, venue_id, building_id, name, price,
  menu_approved_for_display, menu_rights_status, media_approved_for_display, media_rights_status
)
values
  ('smoke-r2f-dish', 'smoke-r2f-venue', 'smoke-r2f-building', 'Laksa', 5,
   true, 'licensed', true, 'licensed'),
  ('smoke-r2f-pending-dish', 'smoke-r2f-pending', 'smoke-r2f-building', 'Mee Siam', 4,
   true, 'licensed', true, 'licensed');

insert into auth.users (id, email)
values
  ('00000000-0000-0218-b000-000000000001', 'r2f-owner@example.test'),
  ('00000000-0000-0218-b000-000000000002', 'r2f-diner@example.test');

insert into merchant_accounts (id, user_id, display_name, email)
values (
  '00000000-0000-0218-a000-000000000001',
  '00000000-0000-0218-b000-000000000001',
  'Smoke R2F Merchant',
  'r2f-owner@example.test'
);

insert into merchant_outlets (id, merchant_account_id, venue_id, building_id, name, business_type, is_live)
values
  ('00000000-0000-0218-d000-000000000001', '00000000-0000-0218-a000-000000000001',
   'smoke-r2f-venue', 'smoke-r2f-building', 'Verified Stall', 'hawker_stall', true),
  ('00000000-0000-0218-d000-000000000002', '00000000-0000-0218-a000-000000000001',
   'smoke-r2f-pending', 'smoke-r2f-building', 'Pending Old', 'hawker_stall', true);

select set_config('request.jwt.claim.role', 'service_role', true);
insert into merchant_verifications (outlet_id, status, verified_at)
values ('00000000-0000-0218-d000-000000000001', 'verified', now());
insert into merchant_verifications (outlet_id, status)
values ('00000000-0000-0218-d000-000000000002', 'submitted');

insert into reviews (id, user_id, dish_id, venue_id, author_name, rating, text)
values
  ('00000000-0000-0218-e000-000000000001', '00000000-0000-0218-b000-000000000002',
   'smoke-r2f-dish', 'smoke-r2f-venue', 'Diner', 5, 'Great'),
  ('00000000-0000-0218-e000-000000000002', '00000000-0000-0218-b000-000000000002',
   'smoke-r2f-pending-dish', 'smoke-r2f-pending', 'Diner', 4, 'Good');

-- A promotion that went 'active' on the pending outlet before this fix
-- (inserted as postgres here, which the guard lets through).
insert into merchant_promotions (id, outlet_id, title, description, status, start_date, end_date)
values (
  '00000000-0000-0218-f000-000000000001', '00000000-0000-0218-d000-000000000002',
  'Legacy pending promo', 'Should stay hidden', 'active', now() - interval '1 day', now() + interval '1 day'
);

-- ---------------------------------------------------------------------------
-- Owner session
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0218-b000-000000000001', true);
set local role authenticated;

-- H46: no publishing from the pending outlet; drafts are fine.
do $$
begin
  begin
    insert into merchant_promotions (outlet_id, title, description, status, start_date, end_date)
    values ('00000000-0000-0218-d000-000000000002', 'Live now', 'Nope', 'active',
            now() - interval '1 hour', now() + interval '1 day');
    raise exception 'unverified outlet published an active promotion';
  exception when insufficient_privilege then
    null;
  end;

  insert into merchant_promotions (id, outlet_id, title, description, status, start_date, end_date)
  values ('00000000-0000-0218-f000-000000000002', '00000000-0000-0218-d000-000000000002',
          'Draft', 'Kept as draft', 'draft', now() - interval '1 hour', now() + interval '1 day');

  begin
    update merchant_promotions set status = 'scheduled'
    where id = '00000000-0000-0218-f000-000000000002';
    raise exception 'unverified outlet scheduled a promotion';
  exception when insufficient_privilege then
    null;
  end;

  insert into merchant_promotions (id, outlet_id, title, description, status, start_date, end_date)
  values ('00000000-0000-0218-f000-000000000003', '00000000-0000-0218-d000-000000000001',
          'Verified promo', 'Visible', 'active', now() - interval '1 hour', now() + interval '1 day');
end $$;

-- H47: replies need a verified outlet at the venue.
do $$
begin
  begin
    update reviews set merchant_reply_text = 'Thanks!', merchant_replied_at = now()
    where id = '00000000-0000-0218-e000-000000000002';
    raise exception 'unverified merchant replied to a review';
  exception when insufficient_privilege then
    null;
  end;

  update reviews set merchant_reply_text = 'Thanks!', merchant_replied_at = now()
  where id = '00000000-0000-0218-e000-000000000001';
  if (select merchant_reply_text from reviews where id = '00000000-0000-0218-e000-000000000001')
     is distinct from 'Thanks!' then
    raise exception 'verified merchant could not reply';
  end if;
end $$;

-- H48: no direct venue column writes, verified or not.
do $$
begin
  begin
    update venues set website_url = 'http://insecure.example.test' where id = 'smoke-r2f-venue';
    raise exception 'merchant wrote website_url directly';
  exception when insufficient_privilege then
    null;
  end;
  begin
    update venues set google_rating = 5 where id = 'smoke-r2f-venue';
    raise exception 'merchant wrote google_rating directly';
  exception when insufficient_privilege then
    null;
  end;
  begin
    update venues set contact_phone = '+6599999999' where id = 'smoke-r2f-pending';
    raise exception 'unverified merchant wrote contact_phone directly';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- H49: profile edits while pending.
update merchant_outlets
set
  name = 'Pending New',
  operating_hours = 'Mon-Sun 09:00-21:00',
  contact_phone = '+6591112222',
  social_links = '[{"platform": "website", "url": "https://pending.example.test"}]'::jsonb,
  cuisine_categories = array['Malay'],
  temporary_closure = ''
where id = '00000000-0000-0218-d000-000000000002';

reset role;

do $$
declare
  v public.venues;
begin
  select * into v from venues where id = 'smoke-r2f-pending';
  if v.name <> 'Pending Old' or v.operating_hours <> 'Pending old hours' then
    raise exception 'pending profile reached the venue before verification: %', row_to_json(v);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Diner view (anon): only the verified outlet's promotion
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

do $$
begin
  if exists (select 1 from public.list_customer_active_promotions('smoke-r2f-pending', null))
     or exists (
       select 1 from public.merchant_promotions
       where outlet_id = '00000000-0000-0218-d000-000000000002'
     ) then
    raise exception 'diners can see a promotion from an unverified outlet';
  end if;
  if (select count(*) from public.list_customer_active_promotions('smoke-r2f-venue', null)) <> 1 then
    raise exception 'verified outlet promotion should be visible to diners';
  end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Ops verify the pending outlet: the saved profile goes live (H49)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.role', 'service_role', true);
update merchant_verifications
set status = 'verified', verified_at = now()
where outlet_id = '00000000-0000-0218-d000-000000000002';

do $$
declare
  v public.venues;
begin
  select * into v from venues where id = 'smoke-r2f-pending';
  if v.name <> 'Pending New'
     or v.operating_hours <> 'Mon-Sun 09:00-21:00'
     or v.contact_phone is distinct from '+6591112222'
     or v.website_url is distinct from 'https://pending.example.test'
     or v.cuisine_tags is distinct from array['Malay'] then
    raise exception 'pending profile did not go live on verification: %', row_to_json(v);
  end if;
  -- Blank outlet fields keep the venue's values.
  if v.unit_number <> '#02-02' or v.address is distinct from '2 Smoke Street' then
    raise exception 'full sync wiped venue fields the merchant never filled: %', row_to_json(v);
  end if;
end $$;

-- Lapsed verification hides the verified outlet's promotion again (H46).
update merchant_verifications
set expires_at = now() - interval '1 minute'
where outlet_id = '00000000-0000-0218-d000-000000000001';

select set_config('request.jwt.claim.role', 'anon', true);
set local role anon;

do $$
begin
  if exists (select 1 from public.list_customer_active_promotions('smoke-r2f-venue', null)) then
    raise exception 'promotion still visible after the outlet verification lapsed';
  end if;
end $$;

reset role;

select 'merchant_r2_verification_gates_smoke_passed' as result;
rollback;
