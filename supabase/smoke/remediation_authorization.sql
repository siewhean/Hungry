-- Run against the isolated fixture, or an isolated replay with equivalent fixtures.
-- No hosted database mutation. All fixtures roll back.
\set ON_ERROR_STOP on
begin;
do $$begin if current_database() not like 'hungry_remediation_%' then raise exception 'Isolated database required';end if;end$$;
set local role postgres;
create function pg_temp.assert_true(value boolean,label text) returns void language plpgsql as $$begin if value is distinct from true then raise exception 'FAILED: %',label;end if;end$$;
insert into public.user_profiles(id,display_name) values('10000000-0000-4000-8000-000000000001','Owner'),('10000000-0000-4000-8000-000000000002','Collaborator'),('10000000-0000-4000-8000-000000000003','Stranger'),('10000000-0000-4000-8000-000000000004','Private');
insert into public.privacy_settings values('10000000-0000-4000-8000-000000000004','private');
insert into public.buildings(id,name,latitude,longitude,address,postal_code) values('b1','Centre',1.3,103.8,'Public address','123456'),('home','Residential',1.31456,103.81234,'Exact address','654321');
insert into public.venues(id,building_id,name,latitude,longitude,address,postal_code) values('v1','b1','Public',1.3,103.8,'Public address','123456'),('vh','home','Home business',1.31456,103.81234,'Exact address','654321');
insert into public.dishes(id,venue_id,building_id,name,menu_approved_for_display,price) values('d1','v1','b1','Dish',true,3),('dh','vh','home','Home dish',true,4);
insert into public.portfolios(id,owner_id,name,type,visibility) values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','List','collection','public');
insert into public.portfolio_collaborators(portfolio_id,user_id,role) values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','viewer');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.add_portfolio_item_v2('20000000-0000-4000-8000-000000000001','dish','d1',null,8.5,'Public','Secret',null) as item_id \gset
select pg_temp.assert_true((select score=8.5 and private_notes is null from public.portfolio_items where id=:'item_id'),'score decimal and legacy notes scrubbed');
select pg_temp.assert_true((select private_notes='Secret' from public.get_portfolio_private_notes_v2('20000000-0000-4000-8000-000000000001')),'owner sees notes');
do $$begin begin perform public.add_portfolio_item_v2('20000000-0000-4000-8000-000000000001','dish','d1',null,8.55,null,null,null);raise exception 'FAILED invalid score';exception when check_violation then null;end;end$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select pg_temp.assert_true((select count(*)=1 from public.get_portfolio_private_notes_v2('20000000-0000-4000-8000-000000000001')),'explicit viewer sees private notes');
do $$begin begin perform public.add_portfolio_item_v2('20000000-0000-4000-8000-000000000001','dish','d1',null,9,null,null,null);raise exception 'FAILED viewer write';exception when insufficient_privilege then null;end;end$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
select pg_temp.assert_true((select count(*)=1 from public.portfolios),'stranger public portfolio no recursion');
select pg_temp.assert_true((select count(*)=0 from public.get_portfolio_private_notes_v2('20000000-0000-4000-8000-000000000001')),'stranger cannot see notes');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$begin begin update public.portfolio_items set private_notes='leak';raise exception 'FAILED legacy notes write';exception when insufficient_privilege then null;end;end$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
-- Public follows approve; private requests remain pending until recipient decision.
select pg_temp.assert_true(public.request_follow_v2('10000000-0000-4000-8000-000000000001')->>'status'='approved','public follows immediate');
select pg_temp.assert_true(public.request_follow_v2('10000000-0000-4000-8000-000000000004')->>'status'='pending','private follows pending');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
select pg_temp.assert_true(public.decide_follow_request_v2('10000000-0000-4000-8000-000000000003',true)->>'status'='approved','recipient accepts');
select pg_temp.assert_true(public.decide_follow_request_v2('10000000-0000-4000-8000-000000000003',true)->>'status'='approved','decision replay');
-- Typed deletion cancellation never claims processing was cancelled.
select pg_temp.assert_true(public.request_account_deletion_v2('reason')->>'status'='requested','request deletion');
select pg_temp.assert_true(public.request_account_deletion_v2('reason')->>'status'='requested','request replay');
select pg_temp.assert_true(public.cancel_account_deletion_v2()->>'outcome'='cancelled','confirmed cancellation');
select pg_temp.assert_true(public.cancel_account_deletion_v2()->>'outcome'='not_pending','no false cancellation');
select public.request_account_deletion_v2(null);
set local role postgres;update public.account_deletion_requests set status='processing' where status='requested';set local role authenticated;
select pg_temp.assert_true(public.cancel_account_deletion_v2()->>'outcome'='processing','processing race truthful');
-- Collection saves persist and remain private.
insert into public.user_collection_saves(user_id,collection_id) values(auth.uid(),'collection-a');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
select pg_temp.assert_true((select count(*)=0 from public.user_collection_saves),'collection saves owner only');
-- Explicit portfolio audience is authoritative independently of account visibility.
set local role postgres;insert into public.privacy_settings values('10000000-0000-4000-8000-000000000001','private');set local role authenticated;
select pg_temp.assert_true(public.get_public_portfolio('20000000-0000-4000-8000-000000000001') is not null,'explicit public portfolio remains public');
set local role postgres;delete from public.privacy_settings where user_id='10000000-0000-4000-8000-000000000001';set local role authenticated;
-- Moderated portfolios must vanish from search and shared page, including legacy private body.
set local role postgres;insert into public.portfolio_flags(portfolio_id,status) values('20000000-0000-4000-8000-000000000001','removed');set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.search_portfolios('List')),'removed portfolio search');
select pg_temp.assert_true((select count(*)=0 from app_private.search_portfolios('List')),'removed legacy private search');
select pg_temp.assert_true(public.get_public_portfolio('20000000-0000-4000-8000-000000000001') is null,'removed shared view');
-- Role capability and protected residential exact preservation.
set local role postgres;
insert into public.merchant_accounts(id,user_id) values('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');
insert into public.merchant_outlets(id,merchant_account_id,venue_id,building_id,business_type,location_privacy) values('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','vh','home','home_based','approximate');
insert into public.merchant_verifications(outlet_id,status) values('40000000-0000-4000-8000-000000000001','draft');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);set local role authenticated;
select pg_temp.assert_true(not public.merchant_can_manage_venue('vh'),'unverified merchant rejected');
select pg_temp.assert_true((select address is null and postal_code is null and latitude=1.315 and longitude=103.815 from public.venues where id='vh'),'stable approximate projection');
select pg_temp.assert_true(public.merchant_get_exact_location_v2('40000000-0000-4000-8000-000000000001')->>'address'='Exact address','exact retained privately');
set local role postgres;update public.merchant_verifications set status='verified';set local role authenticated;
select pg_temp.assert_true(public.merchant_can_manage_venue('vh'),'verified owner capability');
set local role postgres;
create trigger fixture_venue_guard before update on public.venues for each row execute function public.enforce_merchant_venue_update_guard();
set local role authenticated;
do $$begin begin update public.venues set media_approved_for_display=true where id='vh';raise exception 'FAILED provenance';exception when insufficient_privilege then null;end;end$$;
set local role postgres;update public.merchant_outlets set location_privacy='hidden' where venue_id='vh';set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
select pg_temp.assert_true((select count(*)=0 from public.venues where id='vh'),'hidden ordinary read');
select pg_temp.assert_true((select count(*)=0 from public.dishes where id='dh'),'hidden dish read');
-- Anonymous reads safely exclude hidden rows, rather than raising helper permissions.
select set_config('request.jwt.claim.sub','',true);set local role anon;
select pg_temp.assert_true((select count(*)=1 from public.venues),'anon mixed ordinary and hidden reads');
set local role postgres;
insert into public.catalog_raw_venue_cards(release_id,id,address,latitude,longitude) values(gen_random_uuid(),'vh','Leak',1.31,103.81);
select pg_temp.assert_true((select count(*)=0 from public.catalog_raw_venue_cards where id='vh'),'hidden raw snapshot omitted');
update public.merchant_outlets set location_privacy='approximate' where venue_id='vh';
insert into public.catalog_raw_venue_cards(release_id,id,address,latitude,longitude) values(gen_random_uuid(),'vh','Leak',1.31,103.81);
select pg_temp.assert_true((select address is null and latitude=1.315 from public.catalog_raw_venue_cards where id='vh'),'approx raw sanitization');
insert into public.catalog_raw_dish_cards(release_id,id,venue_id,building_id,building_name) values(gen_random_uuid(),'dh','vh','home','Exact residential building');
select pg_temp.assert_true((select building_name is null from public.catalog_raw_dish_cards where venue_id='vh'),'raw dish building name redacted');
select pg_temp.assert_true((select name='Approximate home-business area' from public.buildings where id='home'),'public building name redacted');
update public.merchant_outlets set location_privacy='exact' where venue_id='vh';
select pg_temp.assert_true((select address='Exact address' and latitude=1.31456 from public.venues where id='vh'),'exact privacy restore preserves original');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
-- Category edits cannot reclassify a protected residential location as public.
set local role postgres;update public.merchant_outlets set business_type='restaurant',location_privacy='hidden' where venue_id='vh';
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.venues where id='vh'),'category change cannot bypass hidden');
set local role postgres;update public.merchant_outlets set business_type='home_based',location_privacy='exact' where venue_id='vh';
-- Deliberate protected address edits persist while public fields stay redacted.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);set local role authenticated;
select pg_temp.assert_true(public.merchant_update_exact_location_v2('40000000-0000-4000-8000-000000000001','{"address":"New exact","unit_number":"#09-09"}')->>'address'='New exact','protected exact patch persists');
set local role postgres;update public.merchant_outlets set location_privacy='approximate' where venue_id='vh';set local role authenticated;
select pg_temp.assert_true((select address is null and unit_number='' from public.venues where id='vh'),'exact edit public redacted');
select pg_temp.assert_true(public.merchant_get_exact_location_v2('40000000-0000-4000-8000-000000000001')->>'unit_number'='#09-09','protected unit retained');
select pg_temp.assert_true(public.merchant_update_exact_location_v2('40000000-0000-4000-8000-000000000001','{"address":null,"unit_number":null}')->'address'='null'::jsonb,'explicit protected clear');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
-- Every selected dietary condition must match before any result limit.
set local role postgres;
insert into public.dishes(id,venue_id,building_id,name,menu_approved_for_display,price,rating_avg,availability_flags) select 'seed-'||n,'v1','b1','Food '||n,true,2,5,'{}'::text[] from generate_series(1,800) n;
insert into public.dishes(id,venue_id,building_id,name,menu_approved_for_display,price,rating_avg,availability_flags) values('eligible','v1','b1','Eligible',true,2,1,array['halal','vegetarian']),('partial','v1','b1','Partial',true,2,5,array['halal']);
set local role authenticated;
select pg_temp.assert_true((select count(*)=1 from public.search_dishes_v2(p_dietary_flags=>array['halal','vegetarian'],p_limit=>1) where dish_id='eligible'),'all requirements before limit beyond800');
select pg_temp.assert_true((select count(*)=0 from public.search_dishes_v2(p_dietary_flags=>array['unknown'])),'unknown metadata no fallback');
select pg_temp.assert_true(public.taste_similarity_v2('{"sweet":10,"spicy":10,"sour":10,"salty":10,"rich":10,"aromatic":10}','{"sweet":10,"spicy":10,"sour":10,"salty":10,"rich":10,"aromatic":10}')=1,'taste ranking actual vector');
-- Private onboarding constraints survive profile persistence and stay out of safe projections.
update public.user_profiles set max_dish_budget=12.50,onboarding_cuisine_ids=array['Chinese'],onboarding_selected_dish_ids=array['d1'] where id='10000000-0000-4000-8000-000000000003';
select pg_temp.assert_true((select max_dish_budget=12.50 and onboarding_selected_dish_ids=array['d1'] from public.user_profiles where id='10000000-0000-4000-8000-000000000003'),'private preference persistence');
select pg_temp.assert_true(not exists(select 1 from information_schema.columns where table_schema='public' and table_name='public_profiles' and column_name in ('max_dish_budget','onboarding_cuisine_ids','onboarding_selected_dish_ids')),'safe profile excludes private preferences');
-- Canonical identity and safe relationship lists.
select pg_temp.assert_true((select count(*)=1 from public.get_user_relationships_v2('10000000-0000-4000-8000-000000000001','followers')),'public graph followers');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select pg_temp.assert_true((select count(*)=0 from public.get_user_relationships_v2('10000000-0000-4000-8000-000000000004','followers')),'stranger private graph denied');
do $$begin begin insert into public.user_blocks(blocker_id,blocked_user_key) values(auth.uid(),'not-a-canonical-author');raise exception 'FAILED noncanonical block';exception when invalid_parameter_value then null;end;end$$;
-- Budget is a hard candidate filter; cuisines are a soft score before the limit.
set local role postgres;
update public.dishes set price=1,rating_avg=5 where id in ('eligible','d1');
update public.dishes set cuisine_tags=array['Chinese'] where id='eligible';
insert into public.dish_taste_vectors(dish_id,sweet,spicy,sour,salty,rich,aromatic) values('eligible',5,5,5,5,5,5),('d1',5,5,5,5,5,5);
set local role authenticated;
select pg_temp.assert_true((select dish_id='eligible' from public.get_taste_recommendations_v2('discover',array[5,5,5,5,5,5]::double precision[],p_limit=>1,p_max_price=>2,p_preferred_cuisines=>array['Chinese'])),'preferred cuisines rank before limit');
select pg_temp.assert_true((select count(*)=0 from public.get_taste_recommendations_v2('discover',array[5,5,5,5,5,5]::double precision[],p_max_price=>0.5)),'budget no fallback');
select pg_temp.assert_true((select count(*)=1 from public.get_taste_recommendations_v2('discover',array[5,5,5,5,5,5]::double precision[],p_dietary_flags=>array['halal','vegetarian'])),'recommendations all dietary');
rollback;
