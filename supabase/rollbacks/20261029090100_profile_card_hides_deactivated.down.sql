-- Down for 20261029090100_profile_card_hides_deactivated: puts app_private.get_profile_card back
-- to the 20261021132000 body (a pending-deletion profile shows again). No data is touched.

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
