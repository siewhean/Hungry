\set ON_ERROR_STOP on
begin;
do $$begin if current_database() not like 'hungry_remediation_%' then raise exception 'Fixture only';end if;end$$;
set local role postgres;
insert into user_profiles(id,display_name) values('90000000-0000-4000-8000-000000000001','QA owner');
insert into buildings(id,name,latitude,longitude) values('qa-home','QA Home',1.31234,103.81234);
insert into venues(id,building_id,name,address,latitude,longitude) values('qa-home-venue','qa-home','QA Home venue','Private residential address',1.31234,103.81234);
insert into merchant_accounts(id,user_id) values('90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000001');
insert into merchant_outlets(id,merchant_account_id,venue_id,building_id,business_type,location_privacy) values('90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000002','qa-home-venue','qa-home','home_based','hidden');
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select count(*) as expected_zero from public.venues where id='qa-home-venue';
rollback;
