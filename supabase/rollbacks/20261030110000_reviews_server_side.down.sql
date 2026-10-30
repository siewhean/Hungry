-- Down for 20261030110000_reviews_server_side.
-- The thumbnail paths are copied to rollback_archive before the column is dropped. Reviews and
-- photos themselves are untouched. Taste ratings go back to "keep the rating when its review is
-- deleted" (the review link is set to null).
-- expect-row-loss: app_private.request_rate_rules
create schema if not exists rollback_archive;
drop table if exists rollback_archive.review_photos_thumb_20261030110000;
create table rollback_archive.review_photos_thumb_20261030110000 as
  select id, review_id, thumb_path from public.review_photos where thumb_path is not null;

delete from app_private.request_rate_rules
where route in ('rpc/submit_review', 'rpc/get_review_feed_page', 'rpc/search_reviews');

drop trigger if exists trg_content_reports_block_self_report on public.content_reports;
drop function if exists app_private.content_reports_block_self_report();

alter table public.dish_taste_ratings
  drop constraint if exists dish_taste_ratings_review_id_fkey;
alter table public.dish_taste_ratings
  add constraint dish_taste_ratings_review_id_fkey
  foreign key (review_id) references public.reviews (id) on delete set null;

drop function if exists public.search_reviews(text, timestamptz, uuid, integer, boolean);
drop function if exists public.get_review_feed_page(integer, timestamptz, uuid, timestamptz, text, text[], boolean);
drop function if exists app_private.review_feed_page(integer, timestamptz, uuid, timestamptz, text, text[], boolean, text);
drop function if exists public.submit_review(jsonb, jsonb);

drop index if exists public.idx_reviews_tags;
drop index if exists public.idx_reviews_text_trgm;

alter table public.review_photos drop column if exists thumb_path;

notify pgrst, 'reload schema';
