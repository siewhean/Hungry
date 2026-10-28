-- smoke: supabase/smoke/profile_card_hides_deactivated.sql
-- SET-X3: while an account has a pending deletion request (deactivated), other viewers must not
-- see its name or avatar on a profile header. Reviews, posts and portfolios already hide
-- (20261022100000); get_profile_card was missed. The owner still gets their own card.
-- Same body as 20261021132000 plus the deactivation check.

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
    )
    and (
      up.id = auth.uid()
      or not app_private.account_is_deactivated(up.id)
    );
$$;

revoke all on function app_private.get_profile_card(uuid) from public, anon, authenticated;
grant execute on function app_private.get_profile_card(uuid) to anon, authenticated, service_role;
