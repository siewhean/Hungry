-- Undo 20261109090000_place_people: drops get_place_people (public wrapper and app_private body)
-- and its rate rule. The rate rule row is copied to rollback_archive first. No table or column
-- was added, so no user data is lost.
-- expect-row-loss: app_private.request_rate_rules

drop function if exists public.get_place_people(text, text, integer);
drop function if exists app_private.get_place_people(text, text, integer);

create schema if not exists rollback_archive;

drop table if exists rollback_archive.request_rate_rules_20261109090000;
create table rollback_archive.request_rate_rules_20261109090000
  (like app_private.request_rate_rules including all);
insert into rollback_archive.request_rate_rules_20261109090000
select * from app_private.request_rate_rules
where route = 'rpc/get_place_people';

delete from app_private.request_rate_rules where route = 'rpc/get_place_people';

notify pgrst, 'reload schema';
