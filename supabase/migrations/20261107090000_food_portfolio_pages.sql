-- smoke: supabase/smoke/food_portfolio_pages.sql
-- Food Portfolio pages (plan approved by the owner 2026-11-07, PR A).
--
-- A person's profile becomes their Food Portfolio: the dishes they posted, their top three, the
-- stalls they posted from, and a feed of new dishes from the people they follow.
--
-- 1. user_profiles.pinned_post_ids: up to three of the owner's own posts, in order, shown as the
--    portfolio's top three. Written only through set_pinned_posts.
-- 2. get_food_portfolio_top_posts(user): the pinned posts that are still readable, then the most
--    liked readable posts, three in all. One read, same row shape as get_post_by_id.
-- 3. get_food_portfolio_stalls(user): the stalls a person posted from, with how many dishes they
--    posted at each. One grouped read.
-- 4. get_following_dish_feed(limit, cursor): newest readable posts by the people the caller
--    follows (approved follows only), keyset paged on (published_at, id).
-- 5. set_pinned_posts(ids): one UPDATE that keeps only the caller's own published posts.
--
-- Readable means what get_post_by_id means: published, not deleted, not hidden or removed by
-- moderation, not hidden by the viewer, and app_private.can_read_post (private accounts and
-- blocks). Bodies live in app_private (SECURITY DEFINER, so another person's pinned ids can be
-- read without opening user_profiles); public.* are SECURITY INVOKER wrappers. Signed-in only.
-- Every RPC is VOLATILE so the request hook can count it, and each has a rate rule.
--
-- Rollback: supabase/rollbacks/20261107090000_food_portfolio_pages.down.sql.

alter table public.user_profiles
  add column if not exists pinned_post_ids uuid[] not null default '{}';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_pinned_post_ids_max_three'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_pinned_post_ids_max_three
      check (cardinality(pinned_post_ids) <= 3);
  end if;
end $$;

-- The owner's portfolio grid and stall list read published posts by author; this index exists
-- since 20261019110000 (idx_posts_author_published). The following feed reads by author too.

create schema if not exists app_private;
grant usage on schema app_private to authenticated, service_role;

-- 2. Top three.
create or replace function app_private.get_food_portfolio_top_posts(p_user_id uuid)
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
  viewer_has_saved boolean,
  is_pinned boolean
)
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  with pins as (
    select pin.post_id, pin.ord
    from public.user_profiles owner_profile
    cross join lateral unnest(owner_profile.pinned_post_ids) with ordinality as pin(post_id, ord)
    where owner_profile.id = p_user_id
  ),
  top_posts as (
    select p.*, pins.ord as pin_order
    from public.posts p
    left join pins on pins.post_id = p.id
    where auth.uid() is not null
      and p.author_id = p_user_id
      and p.status = 'published'
      and p.deleted_at is null
      and not exists (
        select 1 from public.post_moderation_states pms
        where pms.post_id = p.id and pms.state in ('hidden', 'removed')
      )
      and not exists (
        select 1 from public.hidden_posts hp
        where hp.viewer_id = auth.uid() and hp.post_id = p.id
      )
      and app_private.can_read_post(p.id)
    order by pins.ord asc nulls last, p.like_count desc, p.published_at desc nulls last, p.id desc
    limit 3
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
    exists (
      select 1 from public.post_likes pl where pl.post_id = p.id and pl.user_id = auth.uid()
    ) as viewer_has_liked,
    exists (
      select 1 from public.post_saves ps where ps.post_id = p.id and ps.user_id = auth.uid()
    ) as viewer_has_saved,
    p.pin_order is not null as is_pinned
  from top_posts p
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
  order by p.pin_order asc nulls last, p.like_count desc, p.published_at desc nulls last, p.id desc;
$$;

revoke all on function app_private.get_food_portfolio_top_posts(uuid) from public, anon, authenticated;
grant execute on function app_private.get_food_portfolio_top_posts(uuid) to authenticated, service_role;

create or replace function public.get_food_portfolio_top_posts(p_user_id uuid)
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
  viewer_has_saved boolean,
  is_pinned boolean
)
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select * from app_private.get_food_portfolio_top_posts(p_user_id);
$$;

revoke all on function public.get_food_portfolio_top_posts(uuid) from public, anon;
grant execute on function public.get_food_portfolio_top_posts(uuid) to authenticated, service_role;

-- 3. Stalls a person posted from.
create or replace function app_private.get_food_portfolio_stalls(p_user_id uuid, p_limit integer default 60)
returns table (
  venue_id text,
  venue_name text,
  building_id text,
  building_name text,
  dish_count integer,
  last_posted_at timestamptz
)
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  with readable as (
    select p.venue_id, coalesce(p.published_at, p.created_at) as posted_at
    from public.posts p
    where auth.uid() is not null
      and p.author_id = p_user_id
      and p.venue_id is not null
      and p.status = 'published'
      and p.deleted_at is null
      and not exists (
        select 1 from public.post_moderation_states pms
        where pms.post_id = p.id and pms.state in ('hidden', 'removed')
      )
      and not exists (
        select 1 from public.hidden_posts hp
        where hp.viewer_id = auth.uid() and hp.post_id = p.id
      )
      and app_private.can_read_post(p.id)
  ),
  grouped as (
    select r.venue_id, count(*)::integer as dish_count, max(r.posted_at) as last_posted_at
    from readable r
    group by r.venue_id
    order by count(*) desc, max(r.posted_at) desc, r.venue_id
    limit least(greatest(coalesce(p_limit, 60), 1), 200)
  )
  select
    g.venue_id,
    v.name as venue_name,
    v.building_id,
    b.name as building_name,
    g.dish_count,
    g.last_posted_at
  from grouped g
  left join public.venues v on v.id = g.venue_id
  left join public.buildings b on b.id = v.building_id
  order by g.dish_count desc, g.last_posted_at desc, g.venue_id;
$$;

revoke all on function app_private.get_food_portfolio_stalls(uuid, integer) from public, anon, authenticated;
grant execute on function app_private.get_food_portfolio_stalls(uuid, integer) to authenticated, service_role;

create or replace function public.get_food_portfolio_stalls(p_user_id uuid, p_limit integer default 60)
returns table (
  venue_id text,
  venue_name text,
  building_id text,
  building_name text,
  dish_count integer,
  last_posted_at timestamptz
)
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select * from app_private.get_food_portfolio_stalls(p_user_id, p_limit);
$$;

revoke all on function public.get_food_portfolio_stalls(uuid, integer) from public, anon;
grant execute on function public.get_food_portfolio_stalls(uuid, integer) to authenticated, service_role;

-- 4. New dishes from the people you follow.
create or replace function app_private.get_following_dish_feed(
  p_limit integer default 20,
  p_cursor_published_at timestamptz default null,
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
  viewer_has_liked boolean,
  viewer_has_saved boolean
)
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  with feed as (
    select p.*
    from public.follows f
    join public.posts p on p.author_id = f.followee_id
    where auth.uid() is not null
      and f.follower_id = auth.uid()
      and f.status = 'approved'
      and p.status = 'published'
      and p.deleted_at is null
      and p.published_at is not null
      and not exists (
        select 1 from public.post_moderation_states pms
        where pms.post_id = p.id and pms.state in ('hidden', 'removed')
      )
      and not exists (
        select 1 from public.hidden_posts hp
        where hp.viewer_id = auth.uid() and hp.post_id = p.id
      )
      and app_private.can_read_post(p.id)
      and (
        p_cursor_published_at is null
        or p.published_at < p_cursor_published_at
        or (p.published_at = p_cursor_published_at and p_cursor_post_id is not null and p.id < p_cursor_post_id)
      )
    order by p.published_at desc, p.id desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
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
    exists (
      select 1 from public.post_likes pl where pl.post_id = p.id and pl.user_id = auth.uid()
    ) as viewer_has_liked,
    exists (
      select 1 from public.post_saves ps where ps.post_id = p.id and ps.user_id = auth.uid()
    ) as viewer_has_saved
  from feed p
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
  order by p.published_at desc, p.id desc;
$$;

revoke all on function app_private.get_following_dish_feed(integer, timestamptz, uuid) from public, anon, authenticated;
grant execute on function app_private.get_following_dish_feed(integer, timestamptz, uuid) to authenticated, service_role;

create or replace function public.get_following_dish_feed(
  p_limit integer default 20,
  p_cursor_published_at timestamptz default null,
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
  viewer_has_liked boolean,
  viewer_has_saved boolean
)
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select * from app_private.get_following_dish_feed(p_limit, p_cursor_published_at, p_cursor_post_id);
$$;

revoke all on function public.get_following_dish_feed(integer, timestamptz, uuid) from public, anon;
grant execute on function public.get_following_dish_feed(integer, timestamptz, uuid) to authenticated, service_role;

-- 5. Pin up to three of your own posts. One UPDATE: the kept ids are computed from committed
--    rows in the same statement, so there is no read in the app followed by a write.
create or replace function app_private.set_pinned_posts(p_post_ids uuid[])
returns uuid[]
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_kept uuid[];
begin
  if v_user is null then
    raise exception 'Sign in to pin dishes.' using errcode = '42501';
  end if;
  if cardinality(coalesce(p_post_ids, '{}')) > 3 then
    raise exception 'Pin up to three dishes.' using errcode = '22023';
  end if;

  update public.user_profiles up
  set pinned_post_ids = coalesce((
    select array_agg(requested.post_id order by requested.ord)
    from (
      select distinct on (input.post_id) input.post_id, input.ord
      from unnest(coalesce(p_post_ids, '{}')) with ordinality as input(post_id, ord)
      order by input.post_id, input.ord
    ) requested
    join public.posts p on p.id = requested.post_id
    where p.author_id = v_user
      and p.status = 'published'
      and p.deleted_at is null
  ), '{}')
  where up.id = v_user
  returning up.pinned_post_ids into v_kept;

  return coalesce(v_kept, '{}');
end;
$$;

revoke all on function app_private.set_pinned_posts(uuid[]) from public, anon, authenticated;
grant execute on function app_private.set_pinned_posts(uuid[]) to authenticated, service_role;

create or replace function public.set_pinned_posts(p_post_ids uuid[])
returns uuid[]
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select app_private.set_pinned_posts(p_post_ids);
$$;

revoke all on function public.set_pinned_posts(uuid[]) from public, anon;
grant execute on function public.set_pinned_posts(uuid[]) to authenticated, service_role;

-- Rate rules (signed-in callers only; anon cannot execute these).
insert into app_private.request_rate_rules (route, anon_per_minute, user_per_minute, note) values
  ('rpc/get_food_portfolio_top_posts', null, 90, 'food portfolio top three'),
  ('rpc/get_food_portfolio_stalls', null, 90, 'food portfolio stalls tab'),
  ('rpc/get_following_dish_feed', null, 60, 'following dishes feed'),
  ('rpc/set_pinned_posts', null, 10, 'food portfolio pin top three')
on conflict (route) do nothing;

notify pgrst, 'reload schema';
