-- Undo 20261107090000_food_portfolio_pages: drops the four food portfolio RPCs (public wrappers
-- and app_private bodies), their rate rules, and user_profiles.pinned_post_ids. The pinned ids
-- are copied to rollback_archive first; the rate rule rows are copied too.
-- expect-row-loss: app_private.request_rate_rules

drop function if exists public.get_food_portfolio_top_posts(uuid);
drop function if exists app_private.get_food_portfolio_top_posts(uuid);
drop function if exists public.get_food_portfolio_stalls(uuid, integer);
drop function if exists app_private.get_food_portfolio_stalls(uuid, integer);
drop function if exists public.get_following_dish_feed(integer, timestamptz, uuid);
drop function if exists app_private.get_following_dish_feed(integer, timestamptz, uuid);
drop function if exists public.set_pinned_posts(uuid[]);
drop function if exists app_private.set_pinned_posts(uuid[]);

create schema if not exists rollback_archive;

drop table if exists rollback_archive.user_profiles_pinned_post_ids_20261107090000;
create table rollback_archive.user_profiles_pinned_post_ids_20261107090000 as
select id, pinned_post_ids, now() as archived_at
from public.user_profiles
where cardinality(pinned_post_ids) > 0;

drop table if exists rollback_archive.request_rate_rules_20261107090000;
create table rollback_archive.request_rate_rules_20261107090000
  (like app_private.request_rate_rules including all);
insert into rollback_archive.request_rate_rules_20261107090000
select * from app_private.request_rate_rules
where route in (
  'rpc/get_food_portfolio_top_posts',
  'rpc/get_food_portfolio_stalls',
  'rpc/get_following_dish_feed',
  'rpc/set_pinned_posts'
);
delete from app_private.request_rate_rules
where route in (
  'rpc/get_food_portfolio_top_posts',
  'rpc/get_food_portfolio_stalls',
  'rpc/get_following_dish_feed',
  'rpc/set_pinned_posts'
);

alter table public.user_profiles drop constraint if exists user_profiles_pinned_post_ids_max_three;
alter table public.user_profiles drop column if exists pinned_post_ids;

notify pgrst, 'reload schema';
