-- Corrective follow-up for DB-P0-05 after QA.
-- Keeps 0032 history immutable after remote apply.

drop policy if exists "hidden_posts_update_own" on hidden_posts;
create policy "hidden_posts_update_own"
on hidden_posts for update to authenticated
using (auth.uid() = viewer_id)
with check (auth.uid() = viewer_id and public.can_read_post(post_id));

drop policy if exists "post_reports_update_own_visible_post" on post_reports;
create policy "post_reports_update_own_visible_post"
on post_reports for update to authenticated
using (auth.uid() = reporter_id)
with check (auth.uid() = reporter_id and public.can_read_post(post_id));

create or replace function public.get_home_social_feed_v2(
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
  cursor_post_id uuid
)
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select
      least(greatest(coalesce(p_limit, 20), 1), 50) as result_limit,
      p_cursor_feed_created_at as cursor_feed_created_at,
      p_cursor_post_id as cursor_post_id
  ),
  visible_feed_items as (
    select
      hfi.feed_created_at,
      p.*
    from home_feed_items hfi
    join posts p on p.id = hfi.post_id
    cross join params
    where (hfi.viewer_id is null or hfi.viewer_id = auth.uid())
      and p.status = 'published'
      and p.deleted_at is null
      and public.can_read_post(p.id)
      and not exists (
        select 1
        from hidden_posts hp
        where hp.viewer_id = auth.uid()
          and hp.post_id = p.id
      )
      and not exists (
        select 1
        from post_moderation_states pms
        where pms.post_id = p.id
          and pms.state in ('hidden', 'removed')
      )
      and (
        params.cursor_feed_created_at is null
        or hfi.feed_created_at < params.cursor_feed_created_at
        or (
          hfi.feed_created_at = params.cursor_feed_created_at
          and params.cursor_post_id is not null
          and p.id < params.cursor_post_id
        )
      )
    order by hfi.feed_created_at desc, p.id desc
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
    p.feed_created_at,
    p.feed_created_at as cursor_feed_created_at,
    p.id as cursor_post_id
  from visible_feed_items p
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
  order by p.feed_created_at desc, p.id desc;
$$;

comment on function public.get_home_social_feed_v2(integer, timestamptz, uuid) is
  'Bounded Home social feed read model with hidden-post and moderation-state exclusions. Cursor order is feed_created_at desc, post_id desc.';
