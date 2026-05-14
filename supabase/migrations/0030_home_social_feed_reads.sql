-- Phase 2 follow-up: bounded server-side reads for the Home social feed.
-- This is deliberately read-only and does not add moderation, partitions,
-- feed-ranking read models, or background ranking jobs.

create index if not exists idx_posts_home_feed_cursor
  on posts ((coalesce(published_at, created_at)) desc, id desc)
  where status = 'published' and deleted_at is null;

create or replace function public.get_home_social_feed(
  p_limit integer default 20,
  p_cursor_published_at timestamptz default null,
  p_cursor_id uuid default null
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
  cursor_published_at timestamptz,
  cursor_id uuid
)
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select
      least(greatest(coalesce(p_limit, 20), 1), 50) as result_limit,
      p_cursor_published_at as cursor_published_at,
      p_cursor_id as cursor_id
  ),
  visible_posts as (
    select
      p.*,
      coalesce(p.published_at, p.created_at) as feed_cursor_at
    from posts p
    cross join params
    where p.status = 'published'
      and p.deleted_at is null
      and public.can_read_post(p.id)
      and (
        params.cursor_published_at is null
        or coalesce(p.published_at, p.created_at) < params.cursor_published_at
        or (
          coalesce(p.published_at, p.created_at) = params.cursor_published_at
          and params.cursor_id is not null
          and p.id < params.cursor_id
        )
      )
    order by feed_cursor_at desc, p.id desc
    limit (select result_limit from params)
  )
  select
    p.id,
    p.author_id,
    p.venue_id,
    coalesce(p.building_id, v.building_id, d.building_id) as building_id,
    p.dish_id,
    p.visibility,
    p.caption,
    p.generated_content,
    p.like_count,
    p.comment_count,
    p.save_count,
    p.share_count,
    p.published_at,
    p.created_at,
    coalesce(media_items.media, '[]'::jsonb) as media,
    up.display_name as author_display_name,
    up.avatar_url as author_avatar_url,
    v.name as venue_name,
    v.unit_number as venue_unit_number,
    v.building_id as venue_building_id,
    b.name as building_name,
    d.name as dish_name,
    d.price as dish_price,
    d.rating_avg as dish_rating,
    d.image_url as dish_image_url,
    p.feed_cursor_at as cursor_published_at,
    p.id as cursor_id
  from visible_posts p
  left join user_profiles up on up.id = p.author_id
  left join venues v on v.id = p.venue_id
  left join dishes d on d.id = p.dish_id
  left join buildings b on b.id = coalesce(p.building_id, v.building_id, d.building_id)
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', pm.id,
        'post_id', pm.post_id,
        'media_type', pm.media_type,
        'storage_bucket', pm.storage_bucket,
        'storage_path', pm.storage_path,
        'public_url', pm.public_url,
        'sort_order', pm.sort_order
      )
      order by pm.sort_order, pm.id
    ) as media
    from post_media pm
    where pm.post_id = p.id
  ) media_items on true
  order by p.feed_cursor_at desc, p.id desc;
$$;

revoke execute on function public.get_home_social_feed(integer, timestamptz, uuid) from public;
grant execute on function public.get_home_social_feed(integer, timestamptz, uuid) to authenticated;

comment on function public.get_home_social_feed(integer, timestamptz, uuid) is
  'Bounded Home social feed read path. Uses existing post visibility checks and cursor pagination; ranking/materialized feed models are deferred.';
