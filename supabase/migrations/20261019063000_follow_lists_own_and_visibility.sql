-- Follow-up to 20261019060000_follow_user_rpc_and_counts.sql.
--
-- 1. A user's OWN follower/following lists are no longer filtered by blocks.
--    get_follow_counts never filtered blocked rows, so the own lists disagreed
--    with the own counts, and the personal data export (which reads these
--    lists) silently dropped follows with blocked users. Lists for OTHER
--    users keep the per-row block filter.
-- 2. can_view_follow_lists(p_user_id): whether the viewer may see that
--    user's follower/following lists, so the app can say "private" instead
--    of "no followers yet" when the lists are hidden.

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
      p_user_id = auth.uid()
      or up.id = auth.uid()
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
      p_user_id = auth.uid()
      or up.id = auth.uid()
      or not app_private.app_user_block_exists(auth.uid(), up.id)
    )
  order by f.approved_at desc nulls last, f.requested_at desc, up.id
  limit least(greatest(coalesce(p_limit, 100), 1), 500)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function app_private.can_view_follow_lists(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_user_id is not null
    and (
      p_user_id = auth.uid()
      or (
        app_private.can_read_author_content(p_user_id)
        and not app_private.app_user_block_exists(auth.uid(), p_user_id)
      )
    );
$$;

revoke all on function app_private.can_view_follow_lists(uuid) from public, anon, authenticated;
grant execute on function app_private.can_view_follow_lists(uuid) to authenticated, service_role;

create or replace function public.can_view_follow_lists(p_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, app_private
as $$
  select app_private.can_view_follow_lists(p_user_id);
$$;

revoke all on function public.can_view_follow_lists(uuid) from public, anon;
grant execute on function public.can_view_follow_lists(uuid) to authenticated, service_role;
