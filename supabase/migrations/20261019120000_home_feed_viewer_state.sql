-- Home feed: return the viewer's own like and save state with every row.
--
-- get_home_social_feed_v2 returns counts only, so the app seeded every post as
-- "not liked / not saved". After a reinstall the heart showed empty and a tap
-- deleted the existing like. v3 wraps v2 (same filters, order and cursor) and
-- adds viewer_has_liked / viewer_has_saved. v2 stays for older app builds.
--
-- SECURITY INVOKER: post_likes / post_saves RLS already lets the viewer read
-- their own rows on posts they can read.

create or replace function public.get_home_social_feed_v3(
  p_limit integer default 20,
  p_cursor_feed_created_at timestamptz default null,
  p_cursor_post_id uuid default null
)
returns table (
  id uuid,
  author_id uuid,
  venue_id text,
  building_id text,
  dish_id text,
  visibility text,
  caption text,
  generated_content jsonb,
  like_count integer,
  comment_count integer,
  save_count integer,
  share_count integer,
  published_at timestamptz,
  created_at timestamptz,
  media jsonb,
  author_display_name text,
  author_avatar_url text,
  venue_name text,
  venue_unit_number text,
  venue_building_id text,
  building_name text,
  dish_name text,
  dish_price numeric,
  dish_rating numeric,
  dish_image_url text,
  feed_created_at timestamptz,
  cursor_feed_created_at timestamptz,
  cursor_post_id uuid,
  viewer_has_liked boolean,
  viewer_has_saved boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    feed.id,
    feed.author_id,
    feed.venue_id,
    feed.building_id,
    feed.dish_id,
    feed.visibility,
    feed.caption,
    feed.generated_content,
    feed.like_count,
    feed.comment_count,
    feed.save_count,
    feed.share_count,
    feed.published_at,
    feed.created_at,
    feed.media,
    feed.author_display_name,
    feed.author_avatar_url,
    feed.venue_name,
    feed.venue_unit_number,
    feed.venue_building_id,
    feed.building_name,
    feed.dish_name,
    feed.dish_price,
    feed.dish_rating,
    feed.dish_image_url,
    feed.feed_created_at,
    feed.cursor_feed_created_at,
    feed.cursor_post_id,
    exists (
      select 1
      from public.post_likes pl
      where pl.post_id = feed.id
        and pl.user_id = auth.uid()
    ) as viewer_has_liked,
    exists (
      select 1
      from public.post_saves ps
      where ps.post_id = feed.id
        and ps.user_id = auth.uid()
    ) as viewer_has_saved
  from public.get_home_social_feed_v2(p_limit, p_cursor_feed_created_at, p_cursor_post_id) feed
  order by feed.feed_created_at desc, feed.id desc;
$$;

revoke all on function public.get_home_social_feed_v3(integer, timestamptz, uuid) from public, anon;
grant execute on function public.get_home_social_feed_v3(integer, timestamptz, uuid)
  to authenticated, service_role;

comment on function public.get_home_social_feed_v3(integer, timestamptz, uuid) is
  'Home social feed (v2 rows and cursor) plus the viewer''s own like and save state.';
