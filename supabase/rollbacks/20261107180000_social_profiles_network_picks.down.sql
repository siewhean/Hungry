-- Undo 20261107180000_social_profiles_network_picks: drops the five read RPCs (public wrappers
-- and app_private bodies), the shared taste-match helper and their rate rules. The rate rule rows
-- are copied to rollback_archive first. No table or column was added, so no user data is lost.
-- expect-row-loss: app_private.request_rate_rules

drop function if exists public.get_profile_relationship(uuid);
drop function if exists app_private.get_profile_relationship(uuid);
drop function if exists public.get_taste_matches(uuid[]);
drop function if exists app_private.get_taste_matches(uuid[]);
drop function if exists public.get_people_suggestions(integer);
drop function if exists app_private.get_people_suggestions(integer);
drop function if exists public.get_network_stall_picks(integer);
drop function if exists app_private.get_network_stall_picks(integer);
drop function if exists public.get_taste_comparison(uuid);
drop function if exists app_private.get_taste_comparison(uuid);
drop function if exists app_private.taste_match_score(
  numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric, numeric
);

create schema if not exists rollback_archive;

drop table if exists rollback_archive.request_rate_rules_20261107180000;
create table rollback_archive.request_rate_rules_20261107180000
  (like app_private.request_rate_rules including all);
insert into rollback_archive.request_rate_rules_20261107180000
select * from app_private.request_rate_rules
where route in (
  'rpc/get_profile_relationship',
  'rpc/get_taste_matches',
  'rpc/get_people_suggestions',
  'rpc/get_network_stall_picks',
  'rpc/get_taste_comparison'
);
delete from app_private.request_rate_rules
where route in (
  'rpc/get_profile_relationship',
  'rpc/get_taste_matches',
  'rpc/get_people_suggestions',
  'rpc/get_network_stall_picks',
  'rpc/get_taste_comparison'
);

notify pgrst, 'reload schema';
