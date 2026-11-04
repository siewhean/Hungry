-- Smoke checks for 20261029170000_merchant_text_filter.sql.
-- A merchant cannot save a dish name, description or tag, or a stall name or description, that
-- contains a blocked term; ordinary text, a link and a phone number in a description pass; the
-- service role is not filtered. Runs in a transaction and rolls back. Brings its own building.
--   owner: 00000000-0000-0074-b000-000000000001
--   account: 00000000-0000-0074-a000-000000000001
--   outlet:  00000000-0000-0074-d000-000000000001

begin;

insert into buildings (id, slug, name, building_type, latitude, longitude, floors)
values ('smoke-mtf-building', 'smoke-mtf-building', 'Smoke MTF Building', 'hawker_centre', 1.4901, 103.6401, array['01']);

insert into venues (id, building_id, name, unit_number, floor)
values ('smoke-mtf-venue', 'smoke-mtf-building', 'Smoke MTF Stall', '#01-01', '01');

insert into auth.users (id, email)
values ('00000000-0000-0074-b000-000000000001', 'mtf-owner@example.test');

insert into merchant_accounts (id, user_id, display_name, email)
values ('00000000-0000-0074-a000-000000000001', '00000000-0000-0074-b000-000000000001', 'Smoke MTF Merchant', 'mtf-owner@example.test');

insert into merchant_outlets (id, merchant_account_id, venue_id, building_id, name, business_type, is_live)
values (
  '00000000-0000-0074-d000-000000000001', '00000000-0000-0074-a000-000000000001',
  'smoke-mtf-venue', 'smoke-mtf-building', 'Smoke MTF Stall', 'hawker_stall', true
);

select set_config('request.jwt.claim.role', 'service_role', true);
insert into merchant_verifications (outlet_id, status, verified_at)
values ('00000000-0000-0074-d000-000000000001', 'verified', now());

select set_config('request.jwt.claim.sub', '00000000-0000-0074-b000-000000000001', true);
set local role authenticated;

do $$
begin
  -- Ordinary text, with a link and a phone number, is saved.
  perform public.merchant_save_dish(
    'smoke-mtf-dish-1', 'smoke-mtf-venue', 'smoke-mtf-building',
    jsonb_build_object(
      'name', 'Laksa', 'price', 5,
      'description', 'Order at www.example.com or call 6123 4567',
      'taste_tags', jsonb_build_array('spicy', 'creamy')
    )
  );

  -- A blocked term in the name, the description or a tag is refused.
  begin
    perform public.merchant_save_dish(
      'smoke-mtf-dish-2', 'smoke-mtf-venue', 'smoke-mtf-building',
      jsonb_build_object('name', 'Fucking good noodles', 'price', 5)
    );
    raise exception 'a blocked dish name should be refused';
  exception when check_violation then
    null;
  end;
  begin
    perform public.merchant_save_dish(
      'smoke-mtf-dish-1', 'smoke-mtf-venue', 'smoke-mtf-building',
      jsonb_build_object('description', 'Better than the BITCH next door')
    );
    raise exception 'a blocked dish description should be refused';
  exception when check_violation then
    null;
  end;
  begin
    perform public.merchant_save_dish(
      'smoke-mtf-dish-1', 'smoke-mtf-venue', 'smoke-mtf-building',
      jsonb_build_object('taste_tags', jsonb_build_array('spicy', 'asshole'))
    );
    raise exception 'a blocked dish tag should be refused';
  exception when check_violation then
    null;
  end;

  -- The stall's own name and description are checked the same way.
  begin
    update public.merchant_outlets
    set description = 'wanker special'
    where id = '00000000-0000-0074-d000-000000000001';
    raise exception 'a blocked stall description should be refused';
  exception when check_violation then
    null;
  end;
  update public.merchant_outlets
  set description = 'Famous for laksa since 1980'
  where id = '00000000-0000-0074-d000-000000000001';
end $$;

reset role;

-- The service role is not filtered.
update public.dishes set description = 'wanker special' where id = 'smoke-mtf-dish-1';

select 'merchant_text_filter_passed' as result;

rollback;
