-- Smoke checks for the round-two merchant mediums and lows (G9):
--   20261022090000_merchant_reply_length_check.sql            (L14)
--   20261022090100_merchant_outlet_business_type_lock.sql     (M2)
--   20261022090200_merchant_claim_interest_own_select.sql     (M1)
--   20261022090300_dishes_draft_member_select.sql             (M3)
--   20261022090400_merchant_accounts_no_self_insert.sql       (L15)
--   20261022090500_merchant_media_upload_requires_membership.sql (L17, helper only)
--   20261022090600_merchant_write_rate_limits.sql             (L18)
--   20261022090700_featured_visitor_pin_no_avatar_copy.sql    (L19)
-- Rolls back.

begin;

-- Fixed ids for this smoke only.
--   owner:    00000000-0000-0220-b000-000000000001
--   stranger: 00000000-0000-0220-b000-000000000002
--   diner:    00000000-0000-0220-b000-000000000003
--   account:  00000000-0000-0220-a000-000000000001
--   outlet:   00000000-0000-0220-d000-000000000001 (verified, smoke-r2g-venue)
--   review:   00000000-0000-0220-e000-000000000001
--   promo:    00000000-0000-0220-f000-000000000001
--   draft:    00000000-0000-0220-c000-000000000001
insert into buildings (id, name, building_type, latitude, longitude)
values
  ('smoke-r2g-building', 'Smoke R2G Building', 'hawker_centre', 1.3, 103.8);

insert into venues (id, building_id, name, unit_number, floor, latitude, longitude)
values
  ('smoke-r2g-venue', 'smoke-r2g-building', 'Smoke R2G Stall', '#01-01', 'L1', 1.301, 103.801),
  ('smoke-r2g-venue-2', 'smoke-r2g-building', 'Smoke R2G Stall 2', '#01-02', 'L1', 1.302, 103.802),
  ('smoke-r2g-venue-3', 'smoke-r2g-building', 'Smoke R2G Stall 3', '#01-03', 'L1', 1.303, 103.803),
  ('smoke-r2g-venue-4', 'smoke-r2g-building', 'Smoke R2G Stall 4', '#01-04', 'L1', 1.304, 103.804),
  ('smoke-r2g-venue-5', 'smoke-r2g-building', 'Smoke R2G Stall 5', '#01-05', 'L1', 1.305, 103.805),
  ('smoke-r2g-venue-6', 'smoke-r2g-building', 'Smoke R2G Stall 6', '#01-06', 'L1', 1.306, 103.806);

insert into dishes (
  id, venue_id, building_id, name, price,
  menu_approved_for_display, menu_rights_status, media_approved_for_display, media_rights_status
)
values
  ('smoke-r2g-dish', 'smoke-r2g-venue', 'smoke-r2g-building', 'Laksa', 5,
   true, 'licensed', true, 'licensed');

insert into auth.users (id, email)
values
  ('00000000-0000-0220-b000-000000000001', 'r2g-owner@example.test'),
  ('00000000-0000-0220-b000-000000000002', 'r2g-stranger@example.test'),
  ('00000000-0000-0220-b000-000000000003', 'r2g-diner@example.test');

insert into merchant_accounts (id, user_id, display_name, email)
values (
  '00000000-0000-0220-a000-000000000001',
  '00000000-0000-0220-b000-000000000001',
  'Smoke R2G Merchant',
  'r2g-owner@example.test'
);

insert into merchant_outlets (id, merchant_account_id, venue_id, building_id, name, business_type, is_live)
values
  ('00000000-0000-0220-d000-000000000001', '00000000-0000-0220-a000-000000000001',
   'smoke-r2g-venue', 'smoke-r2g-building', 'Smoke R2G Stall', 'hawker_stall', true);

select set_config('request.jwt.claim.role', 'service_role', true);
insert into merchant_verifications (outlet_id, status, verified_at)
values ('00000000-0000-0220-d000-000000000001', 'verified', now());

insert into reviews (id, user_id, dish_id, venue_id, author_name, rating, text)
values
  ('00000000-0000-0220-e000-000000000001', '00000000-0000-0220-b000-000000000003',
   'smoke-r2g-dish', 'smoke-r2g-venue', 'Diner', 5, 'Great');

insert into merchant_promotions (id, outlet_id, title, description, status, start_date, end_date)
values (
  '00000000-0000-0220-f000-000000000001', '00000000-0000-0220-d000-000000000001',
  'Draft promo', 'Counters stay server-only', 'draft', now(), now() + interval '1 day'
);

insert into dishes_draft (
  id, venue_id, building_id, name, name_normalized, extraction_confidence
)
values (
  '00000000-0000-0220-c000-000000000001', 'smoke-r2g-venue', 'smoke-r2g-building',
  'Photo laksa', 'photo laksa', 0.9
);

-- L19: the pin trigger no longer copies the diner's avatar.
update user_profiles
set avatar_url = 'https://example.test/diner.png'
where id = '00000000-0000-0220-b000-000000000003';

insert into merchant_popular_visitor_pins (
  outlet_id, venue_id, review_id, source_id, author_name, review_text, rating, visited_at
)
values (
  '00000000-0000-0220-d000-000000000001', 'smoke-r2g-venue',
  '00000000-0000-0220-e000-000000000001', 'x', 'x', '', 5, now()
);

do $$
begin
  if exists (
    select 1 from merchant_popular_visitor_pins
    where review_id = '00000000-0000-0220-e000-000000000001'
      and author_avatar_url is not null
  ) then
    raise exception 'featured visitor pin copied the diner avatar';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Owner session
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0220-b000-000000000001', true);
set local role authenticated;

-- M2: business type is locked while the outlet is verified.
do $$
begin
  begin
    update merchant_outlets set business_type = 'cafe'
    where id = '00000000-0000-0220-d000-000000000001';
    raise exception 'merchant changed business_type on a verified outlet';
  exception when insufficient_privilege then
    null;
  end;

  -- Other profile edits still work.
  update merchant_outlets set name = 'Smoke R2G Stall Renamed'
  where id = '00000000-0000-0220-d000-000000000001';
end $$;

-- L14: an oversized reply is rejected, a normal one is kept.
do $$
begin
  begin
    update reviews
    set merchant_reply_text = repeat('x', 1001), merchant_replied_at = now()
    where id = '00000000-0000-0220-e000-000000000001';
    raise exception 'oversized merchant reply was stored';
  exception when check_violation then
    null;
  end;

  update reviews set merchant_reply_text = 'Thanks!', merchant_replied_at = now()
  where id = '00000000-0000-0220-e000-000000000001';
end $$;

-- L18: promotion counters are server-only.
do $$
begin
  begin
    update merchant_promotions set impressions = 999
    where id = '00000000-0000-0220-f000-000000000001';
    raise exception 'merchant wrote a promotion counter';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into merchant_promotions (outlet_id, title, description, status, start_date, end_date, clicks)
    values ('00000000-0000-0220-d000-000000000001', 'Pre-counted', '', 'draft',
            now(), now() + interval '1 day', 50);
    raise exception 'merchant inserted a promotion with counters';
  exception when insufficient_privilege then
    null;
  end;

  update merchant_promotions set title = 'Draft promo renamed'
  where id = '00000000-0000-0220-f000-000000000001';
end $$;

-- M3: the venue manager reads the venue's photo drafts.
do $$
begin
  if (select count(*) from dishes_draft where venue_id = 'smoke-r2g-venue') <> 1 then
    raise exception 'venue manager cannot read photo drafts';
  end if;
end $$;

-- L15: no self-service merchant accounts.
do $$
begin
  begin
    insert into merchant_accounts (user_id, display_name, email)
    values ('00000000-0000-0220-b000-000000000001', 'Second account', 'r2g-owner@example.test');
    raise exception 'user inserted a merchant account directly';
  exception when insufficient_privilege or unique_violation then
    null;
  end;
end $$;

-- L17: the owner counts as a merchant member for media uploads.
do $$
begin
  if not app_private.current_user_is_merchant_member() then
    raise exception 'merchant owner is not a merchant member';
  end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Stranger session
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0220-b000-000000000002', true);
set local role authenticated;

-- M3: another signed-in user reads nothing from dishes_draft.
do $$
begin
  if exists (select 1 from dishes_draft) then
    raise exception 'non-member read photo drafts';
  end if;
end $$;

-- L17: not a merchant member.
do $$
begin
  if app_private.current_user_is_merchant_member() then
    raise exception 'stranger counted as a merchant member';
  end if;
end $$;

-- M1 + L18: claims are readable by their author only, and rate limited per user.
do $$
declare
  v_venue text;
  v_status text;
begin
  perform public.submit_merchant_claim_interest('smoke-r2g-venue', 'Stranger');
  -- Repeating the same venue returns "already exists" and does not count.
  if public.submit_merchant_claim_interest('smoke-r2g-venue', 'Stranger') is not null then
    raise exception 'duplicate claim created a second row';
  end if;

  foreach v_venue in array array[
    'smoke-r2g-venue-2', 'smoke-r2g-venue-3', 'smoke-r2g-venue-4', 'smoke-r2g-venue-5'
  ] loop
    perform public.submit_merchant_claim_interest(v_venue, 'Stranger');
  end loop;

  begin
    perform public.submit_merchant_claim_interest('smoke-r2g-venue-6', 'Stranger');
    raise exception 'sixth claim in a day was accepted';
  exception when sqlstate 'P0001' then
    -- The failure above also uses P0001, so only the rate-limit message counts as a pass.
    if sqlerrm not like '%rate limit%' then
      raise;
    end if;
  end;

  select status into v_status from merchant_claim_interests
  where venue_id = 'smoke-r2g-venue' and claimed_by = '00000000-0000-0220-b000-000000000002';
  if v_status is distinct from 'new' then
    raise exception 'claimant cannot read their own claim';
  end if;
end $$;

reset role;

-- The owner sees none of the stranger's claims.
select set_config('request.jwt.claim.sub', '00000000-0000-0220-b000-000000000001', true);
set local role authenticated;

do $$
begin
  if exists (select 1 from merchant_claim_interests) then
    raise exception 'claims leaked to another user';
  end if;
end $$;

reset role;

select 'merchant_r2_mediums_lows_smoke_passed' as result;
rollback;
