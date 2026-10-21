-- Guests can browse: a public Home feed and readable photos on shared posts.
--
-- H9: get_home_social_feed_v2 / v3 are granted to authenticated only, and the
-- posts select policy is to authenticated, so a visitor without an account saw
-- an empty "No posts yet" feed. get_public_home_feed returns the same columns
-- as v3 for public posts by authors with a public account (the rule
-- get_post_by_id already applies to visitors), newest first, with the same
-- moderation and hidden-post exclusions.
--
-- H10: post photos live in the private post-media bucket, whose storage select
-- policies are to authenticated, so a visitor could not sign the photo of a
-- shared public post and saw a broken image. Visitors may now read (and so
-- sign) post-media objects that belong to a post they can already read.
--
-- Both definer bodies live in app_private; public.get_public_home_feed is a
-- SECURITY INVOKER wrapper.

create schema if not exists app_private;
grant usage on schema app_private to anon, authenticated, service_role;

create or replace function app_private.get_public_home_feed(
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
security definer
set search_path = public, pg_temp
as $$
  with params as (
    select
      least(greatest(coalesce(p_limit, 20), 1), 50) as result_limit,
      p_cursor_feed_created_at as cursor_feed_created_at,
      p_cursor_post_id as cursor_post_id
  ),
  public_posts as (
    select
      coalesce(p.published_at, p.created_at) as feed_created_at,
      p.*
    from public.posts p
    cross join params
    where p.status = 'published'
      and p.deleted_at is null
      and p.visibility = 'public'
      and app_private.can_read_author_content(p.author_id)
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
        params.cursor_feed_created_at is null
        or coalesce(p.published_at, p.created_at) < params.cursor_feed_created_at
        or (
          coalesce(p.published_at, p.created_at) = params.cursor_feed_created_at
          and params.cursor_post_id is not null
          and p.id < params.cursor_post_id
        )
      )
    order by coalesce(p.published_at, p.created_at) desc, p.id desc
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
    p.id as cursor_post_id,
    auth.uid() is not null and exists (
      select 1 from public.post_likes pl
      where pl.post_id = p.id and pl.user_id = auth.uid()
    ) as viewer_has_liked,
    auth.uid() is not null and exists (
      select 1 from public.post_saves ps
      where ps.post_id = p.id and ps.user_id = auth.uid()
    ) as viewer_has_saved
  from public_posts p
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
  order by p.feed_created_at desc, p.id desc;
$$;

revoke all on function app_private.get_public_home_feed(integer, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function app_private.get_public_home_feed(integer, timestamptz, uuid)
  to anon, authenticated, service_role;

create or replace function public.get_public_home_feed(
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
set search_path = public, app_private
as $$
  select * from app_private.get_public_home_feed(p_limit, p_cursor_feed_created_at, p_cursor_post_id);
$$;

revoke all on function public.get_public_home_feed(integer, timestamptz, uuid) from public;
grant execute on function public.get_public_home_feed(integer, timestamptz, uuid)
  to anon, authenticated, service_role;

comment on function public.get_public_home_feed(integer, timestamptz, uuid) is
  'Guest Home feed: public posts by public accounts, newest first, same columns and cursor as get_home_social_feed_v3.';

-- H10: visitors may read post-media objects of a public post by a public account.
create or replace function app_private.can_read_public_post_media_object(
  p_bucket text,
  p_name text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.post_media pm
    join public.posts p on p.id = pm.post_id
    where pm.storage_bucket = p_bucket
      and pm.storage_path = p_name
      and p.status = 'published'
      and p.deleted_at is null
      and p.visibility = 'public'
      and app_private.can_read_author_content(p.author_id)
      and not exists (
        select 1
        from public.post_moderation_states pms
        where pms.post_id = p.id
          and pms.state in ('hidden', 'removed')
      )
  );
$$;

revoke all on function app_private.can_read_public_post_media_object(text, text)
  from public, anon, authenticated;
grant execute on function app_private.can_read_public_post_media_object(text, text)
  to anon, service_role;

create index if not exists idx_post_media_storage_object
  on public.post_media (storage_bucket, storage_path);

drop policy if exists "post_media_select_public_post_objects_anon" on storage.objects;
create policy "post_media_select_public_post_objects_anon"
on storage.objects for select to anon
using (
  bucket_id = 'post-media'
  and app_private.can_read_public_post_media_object(bucket_id, name)
);
