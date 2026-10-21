-- H39: a private account's profile hides its review list and says it is private.
--
-- Rule (product default): reviews stay public on dish pages (the reviews
-- table keeps its public select policy, so dish ratings and review lists are
-- unchanged), but a private account's profile Reviews tab is shown only to
-- the account itself and approved followers, like its posts.
--
-- 1. get_user_profile_reviews(user): the profile review list, empty unless
--    app_private.can_read_author_content allows the viewer (SECURITY INVOKER,
--    so the existing review RLS for blocks, reports and moderation still applies).
-- 2. get_profile_card(user): the minimal public card for any account the
--    viewer has not blocked (and is not blocked by): name, avatar, whether the
--    account is private, and whether the viewer may see its content. The
--    follower/following lists already show these two fields for private
--    accounts. Definer body in app_private, invoker wrapper in public.

create schema if not exists app_private;
grant usage on schema app_private to anon, authenticated, service_role;

create or replace function public.get_user_profile_reviews(p_user_id uuid)
returns setof public.reviews
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select r.*
  from public.reviews r
  where r.user_id = p_user_id
    and app_private.can_read_author_content(p_user_id)
  order by r.created_at desc, r.id desc;
$$;

revoke all on function public.get_user_profile_reviews(uuid) from public;
grant execute on function public.get_user_profile_reviews(uuid)
  to anon, authenticated, service_role;

comment on function public.get_user_profile_reviews(uuid) is
  'A user''s profile review list; empty for a private account unless the viewer is the owner or an approved follower. Dish pages are unaffected.';

create or replace function app_private.get_profile_card(p_user_id uuid)
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  is_private boolean,
  can_view_content boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    up.id,
    up.display_name,
    up.avatar_url,
    coalesce(ps.account_visibility = 'private', false) as is_private,
    app_private.can_read_author_content(up.id) as can_view_content
  from public.user_profiles up
  left join public.privacy_settings ps on ps.user_id = up.id
  where up.id = p_user_id
    and (
      auth.uid() is null
      or up.id = auth.uid()
      or not app_private.app_user_block_exists(auth.uid(), up.id)
    );
$$;

revoke all on function app_private.get_profile_card(uuid) from public, anon, authenticated;
grant execute on function app_private.get_profile_card(uuid) to anon, authenticated, service_role;

create or replace function public.get_profile_card(p_user_id uuid)
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  is_private boolean,
  can_view_content boolean
)
language sql
stable
security invoker
set search_path = public, app_private
as $$
  select * from app_private.get_profile_card(p_user_id);
$$;

revoke all on function public.get_profile_card(uuid) from public;
grant execute on function public.get_profile_card(uuid) to anon, authenticated, service_role;

comment on function public.get_profile_card(uuid) is
  'Name, avatar and privacy flags for a profile header, including private accounts (never for a blocked pair).';
