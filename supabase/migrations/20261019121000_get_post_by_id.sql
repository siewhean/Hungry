-- Shared post links: read one post by id, signed in or not.
--
-- post/:postId used to look the post up in local caches only, so a friend who
-- opened a shared link saw "This post is no longer available" unless the post
-- had already been hydrated, and a visitor without an account was sent to
-- Login. get_post_by_id returns one readable post with its media, author,
-- dish, venue and the viewer's like/save state.
--
-- Readable means: published, not deleted, not hidden or removed by moderation,
-- and either the viewer's own post, or a post the viewer may read
-- (app_private.can_read_post), or, for a visitor without a session, a public
-- post by an author with a public account. Posts the viewer hid are excluded.
--
-- The body lives in app_private (SECURITY DEFINER, so anon can read the one
-- public post without a posts SELECT grant); public.get_post_by_id is a
-- SECURITY INVOKER wrapper.

create schema if not exists app_private;
grant usage on schema app_private to anon, authenticated, service_role;

create or replace function app_private.get_post_by_id(p_post_id uuid)
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
  viewer_has_liked boolean,
  viewer_has_saved boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
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
    auth.uid() is not null and exists (
      select 1 from public.post_likes pl
      where pl.post_id = p.id and pl.user_id = auth.uid()
    ) as viewer_has_liked,
    auth.uid() is not null and exists (
      select 1 from public.post_saves ps
      where ps.post_id = p.id and ps.user_id = auth.uid()
    ) as viewer_has_saved
  from public.posts p
  left join public.user_profiles up on up.id = p.author_id
  left join public.venues v on v.id = p.venue_id
  left join public.dishes d on d.id = p.dish_id
  left join public.buildings b on b.id = coalesce(p.building_id, v.building_id, d.building_id)
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
    from public.post_media pm
    where pm.post_id = p.id
  ) media_items on true
  where p.id = p_post_id
    and p.status = 'published'
    and p.deleted_at is null
    and not exists (
      select 1
      from public.post_moderation_states pms
      where pms.post_id = p.id
        and pms.state in ('hidden', 'removed')
    )
    and not exists (
      select 1
      from public.hidden_posts hp
      where hp.viewer_id = auth.uid()
        and hp.post_id = p.id
    )
    and (
      (auth.uid() is not null and app_private.can_read_post(p.id))
      or (
        auth.uid() is null
        and p.visibility = 'public'
        and app_private.can_read_author_content(p.author_id)
      )
    );
$$;

revoke all on function app_private.get_post_by_id(uuid) from public, anon, authenticated;
grant execute on function app_private.get_post_by_id(uuid) to anon, authenticated, service_role;

create or replace function public.get_post_by_id(p_post_id uuid)
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
  viewer_has_liked boolean,
  viewer_has_saved boolean
)
language sql
stable
security invoker
set search_path = public, app_private
as $$
  select * from app_private.get_post_by_id(p_post_id);
$$;

revoke all on function public.get_post_by_id(uuid) from public;
grant execute on function public.get_post_by_id(uuid) to anon, authenticated, service_role;

comment on function public.get_post_by_id(uuid) is
  'One readable post for shared links (anon: public posts by public accounts only), with the viewer''s like/save state.';
