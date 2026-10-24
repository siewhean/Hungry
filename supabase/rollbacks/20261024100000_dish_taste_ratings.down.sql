-- Down for 20261024100000_dish_taste_ratings.
-- The ratings are copied to rollback_archive before the table is dropped.
-- expect-row-loss: app_private.request_rate_rules
create schema if not exists rollback_archive;
drop table if exists rollback_archive.dish_taste_ratings_20261024100000;
create table rollback_archive.dish_taste_ratings_20261024100000 as
  select * from public.dish_taste_ratings;

delete from app_private.request_rate_rules where route = 'rpc/submit_dish_taste_rating';

drop function if exists public.get_dish_taste_rating_summary(text);
drop function if exists public.submit_dish_taste_rating(text, jsonb, uuid);
drop table if exists public.dish_taste_ratings;
