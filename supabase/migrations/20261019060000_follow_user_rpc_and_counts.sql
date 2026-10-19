-- Make user follows work in Supabase mode and give profiles real follow data.
--
-- 1. follow_user(target): the only follows INSERT policy requires
--    status = 'pending', and only the followee may UPDATE, so the app's direct
--    upsert of status = 'approved' always failed RLS. This RPC writes
--    'approved' for public accounts and 'pending' for private accounts, and
--    refuses self-follows, blocked pairs and unknown users.
-- 2. get_follow_counts(user): approved follower/following counts for any
--    profile the viewer is not blocked from. No rows means hidden.
-- 3. list_user_followers / list_user_following(user, limit, offset): the
--    follows SELECT policy only shows rows the viewer is part of, so another
--    user's lists were always empty. These return the approved list when the
--    viewer may read that user's content (public, own, or an approved
--    follower of a private account), minus users blocked either way.
--
-- Bodies live in app_private (SECURITY DEFINER); public names are SECURITY
-- INVOKER wrappers, matching the advisor private-wrapper pattern.

create schema if not exists app_private;
grant usage on schema app_private to anon, authenticated, service_role;

-- 1. follow_user -------------------------------------------------------------
create or replace function app_private.follow_user(p_target_user_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_viewer uuid := auth.uid();
  v_existing text;
  v_status text;
begin
  if v_viewer is null then
    raise exception 'You must be signed in to follow users.' using errcode = '28000';
  end if;

  if p_target_user_id is null or p_target_user_id = v_viewer then
    raise exception 'You cannot follow yourself.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.user_profiles up where up.id = p_target_user_id) then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;

  if app_private.app_user_block_exists(v_viewer, p_target_user_id) then
    raise exception 'You cannot follow this user.' using errcode = '42501';
  end if;

  select f.status
  into v_existing
  from public.follows f
  where f.follower_id = v_viewer
    and f.followee_id = p_target_user_id
  for update;

  if v_existing = 'approved' then
    return 'approved';
  end if;

  if v_existing = 'blocked' then
    raise exception 'You cannot follow this user.' using errcode = '42501';
  end if;

  v_status := case
    when coalesce((
      select ps.account_visibility
      from public.privacy_settings ps
      where ps.user_id = p_target_user_id
    ), 'public') = 'private' then 'pending'
    else 'approved'
  end;

  if v_existing is null then
    insert into public.follows (follower_id, followee_id, status, approved_at)
    values (
      v_viewer,
      p_target_user_id,
      v_status,
      case when v_status = 'approved' then now() end
    )
    on conflict (follower_id, followee_id) do nothing;
  else
    update public.follows
    set status = v_status,
        approved_at = case when v_status = 'approved' then now() end,
        updated_at = now()
    where follower_id = v_viewer
      and followee_id = p_target_user_id;
  end if;

  return v_status;
end;
$$;

revoke all on function app_private.follow_user(uuid) from public, anon, authenticated;
grant execute on function app_private.follow_user(uuid) to authenticated, service_role;

create or replace function public.follow_user(p_target_user_id uuid)
returns text
language sql
volatile
security invoker
set search_path = public, app_private
as $$
  select app_private.follow_user(p_target_user_id);
$$;

revoke all on function public.follow_user(uuid) from public, anon;
grant execute on function public.follow_user(uuid) to authenticated, service_role;

-- 2. get_follow_counts -------------------------------------------------------
create or replace function app_private.get_follow_counts(p_user_id uuid)
returns table (followers_count integer, following_count integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (
      select count(*)::integer
      from public.follows f
      where f.followee_id = p_user_id
        and f.status = 'approved'
    ) as followers_count,
    (
      select count(*)::integer
      from public.follows f
      where f.follower_id = p_user_id
        and f.status = 'approved'
    ) as following_count
  where p_user_id is not null
    and exists (select 1 from public.user_profiles up where up.id = p_user_id)
    and (
      auth.uid() = p_user_id
      or not app_private.app_user_block_exists(auth.uid(), p_user_id)
    );
$$;

revoke all on function app_private.get_follow_counts(uuid) from public, anon, authenticated;
grant execute on function app_private.get_follow_counts(uuid) to authenticated, service_role;

create or replace function public.get_follow_counts(p_user_id uuid)
returns table (followers_count integer, following_count integer)
language sql
stable
security invoker
set search_path = public, app_private
as $$
  select * from app_private.get_follow_counts(p_user_id);
$$;

revoke all on function public.get_follow_counts(uuid) from public, anon;
grant execute on function public.get_follow_counts(uuid) to authenticated, service_role;

-- 3. list_user_followers / list_user_following -------------------------------
create or replace function app_private.list_user_followers(
  p_user_id uuid,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (user_id uuid, display_name text, avatar_url text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select up.id, up.display_name, up.avatar_url
  from public.follows f
  join public.user_profiles up on up.id = f.follower_id
  where f.followee_id = p_user_id
    and f.status = 'approved'
    and app_private.can_read_author_content(p_user_id)
    and (
      up.id = auth.uid()
      or not app_private.app_user_block_exists(auth.uid(), up.id)
    )
  order by f.approved_at desc nulls last, f.requested_at desc, up.id
  limit least(greatest(coalesce(p_limit, 100), 1), 500)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function app_private.list_user_following(
  p_user_id uuid,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (user_id uuid, display_name text, avatar_url text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select up.id, up.display_name, up.avatar_url
  from public.follows f
  join public.user_profiles up on up.id = f.followee_id
  where f.follower_id = p_user_id
    and f.status = 'approved'
    and app_private.can_read_author_content(p_user_id)
    and (
      up.id = auth.uid()
      or not app_private.app_user_block_exists(auth.uid(), up.id)
    )
  order by f.approved_at desc nulls last, f.requested_at desc, up.id
  limit least(greatest(coalesce(p_limit, 100), 1), 500)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function app_private.list_user_followers(uuid, integer, integer)
  from public, anon, authenticated;
revoke all on function app_private.list_user_following(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function app_private.list_user_followers(uuid, integer, integer)
  to authenticated, service_role;
grant execute on function app_private.list_user_following(uuid, integer, integer)
  to authenticated, service_role;

create or replace function public.list_user_followers(
  p_user_id uuid,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (user_id uuid, display_name text, avatar_url text)
language sql
stable
security invoker
set search_path = public, app_private
as $$
  select * from app_private.list_user_followers(p_user_id, p_limit, p_offset);
$$;

create or replace function public.list_user_following(
  p_user_id uuid,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (user_id uuid, display_name text, avatar_url text)
language sql
stable
security invoker
set search_path = public, app_private
as $$
  select * from app_private.list_user_following(p_user_id, p_limit, p_offset);
$$;

revoke all on function public.list_user_followers(uuid, integer, integer) from public, anon;
revoke all on function public.list_user_following(uuid, integer, integer) from public, anon;
grant execute on function public.list_user_followers(uuid, integer, integer)
  to authenticated, service_role;
grant execute on function public.list_user_following(uuid, integer, integer)
  to authenticated, service_role;
