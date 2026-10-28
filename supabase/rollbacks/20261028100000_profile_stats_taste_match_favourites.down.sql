-- Down for 20261028100000_profile_stats_taste_match_favourites.
-- The pinned dishes are copied to rollback_archive before the table is dropped.
-- expect-row-loss: app_private.request_rate_rules
create schema if not exists rollback_archive;
drop table if exists rollback_archive.profile_favourite_dishes_20261028100000;
create table rollback_archive.profile_favourite_dishes_20261028100000 as
  select * from public.profile_favourite_dishes;

delete from app_private.request_rate_rules
where route in (
  'rpc/get_my_review_stats',
  'rpc/get_taste_match',
  'rpc/set_profile_favourite_dishes'
);

drop function if exists public.set_profile_favourite_dishes(text[]);
drop function if exists app_private.set_profile_favourite_dishes(text[]);
drop table if exists public.profile_favourite_dishes;
drop function if exists public.get_taste_match(uuid);
drop function if exists app_private.get_taste_match(uuid);
drop function if exists public.get_my_review_stats();

notify pgrst, 'reload schema';
