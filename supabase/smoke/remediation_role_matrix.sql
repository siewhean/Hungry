-- Audited role matrix. Only the retained isolated local fixture is permitted.
\set ON_ERROR_STOP on
begin;
do $$begin if current_database() not like 'hungry_remediation_%' then raise exception 'Isolated database required';end if;end$$;
set local role postgres;
create function pg_temp.assert_true(value boolean,label text) returns void language plpgsql as $$begin if value is distinct from true then raise exception 'FAILED: %',label;end if;end$$;
insert into public.user_profiles(id,display_name) values
 ('11000000-0000-4000-8000-000000000001','Matrix owner'),
 ('11000000-0000-4000-8000-000000000002','Matrix editor'),
 ('11000000-0000-4000-8000-000000000003','Matrix viewer'),
 ('11000000-0000-4000-8000-000000000004','Matrix follower'),
 ('11000000-0000-4000-8000-000000000005','Matrix stranger');
insert into public.buildings(id,name,latitude,longitude) values('matrix-building','Matrix centre',1.3,103.8);
insert into public.venues(id,building_id,name) values('matrix-venue','matrix-building','Matrix stall');
insert into public.dishes(id,venue_id,building_id,name,menu_approved_for_display) values('matrix-dish','matrix-venue','matrix-building','Matrix dish',true);
insert into public.portfolios(id,owner_id,name,type,visibility) values
 ('21000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','Follower list','collection','followers_only'),
 ('21000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000001','Private list','collection','private'),
 ('21000000-0000-4000-8000-000000000003','11000000-0000-4000-8000-000000000001','Public list','collection','public');
insert into public.portfolio_collaborators(portfolio_id,user_id,role) values
 ('21000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000002','editor'),
 ('21000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000003','viewer');
insert into public.follows(follower_id,followee_id,status,approved_at) values('11000000-0000-4000-8000-000000000004','11000000-0000-4000-8000-000000000001','approved',now());
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.add_portfolio_item_v2('21000000-0000-4000-8000-000000000001','dish','matrix-dish',null,8,'Visible note','Owner-only-and-collaborator secret',null) as item_id \gset
select public.add_portfolio_item_v2('21000000-0000-4000-8000-000000000003','dish','matrix-dish',null,8,'Public visible note','Never public secret',null);
-- Real editor mutation accepts protected notes and explicit clearing.
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000002',true);
select public.update_portfolio_item_v2(:'item_id','{"score":8.8,"publicNotes":null,"privateNotes":"Editor changed secret"}',null);
select pg_temp.assert_true((select score=8.8 and public_notes is null from public.portfolio_items where id=:'item_id'),'editor score and public-note clear accepted');
select pg_temp.assert_true((select private_notes='Editor changed secret' from public.get_portfolio_private_notes_v2('21000000-0000-4000-8000-000000000001')),'editor protected note write accepted');
-- Viewer reads explicit collaborator notes but cannot edit them.
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000003',true);
select pg_temp.assert_true((select private_notes='Editor changed secret' from public.get_portfolio_private_notes_v2('21000000-0000-4000-8000-000000000001')),'viewer protected note read accepted');
do $$begin begin perform public.update_portfolio_item_v2((select id from public.portfolio_items where portfolio_id='21000000-0000-4000-8000-000000000001'),'{"privateNotes":"Viewer write"}',null);raise exception 'FAILED viewer write authorized';exception when insufficient_privilege then null;end;end$$;
-- Owner can update and clear a note after an editor has written it.
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
select public.update_portfolio_item_v2(:'item_id','{"score":9,"privateNotes":null}',null);
select pg_temp.assert_true((select score=9 from public.portfolio_items where id=:'item_id'),'owner score update accepted');
select pg_temp.assert_true((select private_notes is null from public.get_portfolio_private_notes_v2('21000000-0000-4000-8000-000000000001')),'owner protected note clear accepted');
-- An approved follower may read the followers-only list, never protected notes.
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000004',true);
select pg_temp.assert_true((select count(*)=1 from public.portfolios where id='21000000-0000-4000-8000-000000000001'),'approved follower list read');
select pg_temp.assert_true((select count(*)=1 from public.portfolio_items where portfolio_id='21000000-0000-4000-8000-000000000001'),'approved follower item read');
select pg_temp.assert_true((select count(*)=0 from public.get_portfolio_private_notes_v2('21000000-0000-4000-8000-000000000001')),'approved follower protected notes denied');
select pg_temp.assert_true((select count(*)=0 from public.portfolios where id='21000000-0000-4000-8000-000000000002'),'follower private list denied');
-- Stranger has no implicit private/follower access.
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000005',true);
select pg_temp.assert_true((select count(*)=0 from public.portfolios where id in ('21000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000002')),'stranger private/follower lists denied');
select pg_temp.assert_true((select count(*)=0 from public.get_portfolio_private_notes_v2('21000000-0000-4000-8000-000000000003')),'stranger public-list protected notes denied');
-- Blocking removes otherwise approved follower access immediately.
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
insert into public.user_blocks(blocker_id,blocked_user_key) values(auth.uid(),'11000000-0000-4000-8000-000000000004');
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000004',true);
select pg_temp.assert_true((select count(*)=0 from public.portfolios where id='21000000-0000-4000-8000-000000000001'),'blocked approved follower read denied');
select pg_temp.assert_true(public.get_public_portfolio('21000000-0000-4000-8000-000000000003') is null,'blocked public shared read denied');
-- Anonymous access uses only the safe explicit public projection.
select set_config('request.jwt.claim.sub','',true);set local role anon;
select pg_temp.assert_true(public.get_public_portfolio('21000000-0000-4000-8000-000000000001') is null,'anonymous followers-only share denied');
select pg_temp.assert_true(public.get_public_portfolio('21000000-0000-4000-8000-000000000002') is null,'anonymous private share denied');
select pg_temp.assert_true(public.get_public_portfolio('21000000-0000-4000-8000-000000000003')->>'name'='Public list','anonymous public projection accepted');
select pg_temp.assert_true(not (public.get_public_portfolio('21000000-0000-4000-8000-000000000003')->'items'->0 ? 'private_notes'),'anonymous projection omits protected column');
select pg_temp.assert_true(public.get_public_portfolio('21000000-0000-4000-8000-000000000003')::text not like '%Never public secret%','anonymous projection omits protected value');
rollback;
