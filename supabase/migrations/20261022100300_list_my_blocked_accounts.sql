-- Blocked accounts list (round-two settings M5).
--
-- Settings > Privacy > Blocked accounts needs the name and avatar of each person
-- the viewer blocked. A block hides the other person's profile from the blocker
-- (app_user_block_exists is checked in both directions), so the normal
-- public_profiles read returns nothing for them. This function lets the
-- blocker, and only the blocker, read name, avatar and block date for their own
-- block rows. Unblocking is a plain delete of the viewer's own user_blocks row
-- (policy user_blocks_delete_own, 0017).
--
-- New: app_private.list_my_blocked_accounts() (SECURITY DEFINER body) and
-- public.list_my_blocked_accounts() (SECURITY INVOKER wrapper). Redefines nothing.

create schema if not exists app_private;
grant usage on schema app_private to anon, authenticated, service_role;

create or replace function app_private.list_my_blocked_accounts()
returns table (
  blocked_user_id uuid,
  display_name text,
  avatar_url text,
  blocked_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    ub.blocked_user_key::uuid,
    up.display_name,
    up.avatar_url,
    ub.created_at
  from public.user_blocks ub
  left join public.user_profiles up on up.id::text = ub.blocked_user_key
  where ub.blocker_id = auth.uid()
  order by ub.created_at desc, ub.blocked_user_key;
$$;

revoke all on function app_private.list_my_blocked_accounts() from public, anon, authenticated;
grant execute on function app_private.list_my_blocked_accounts() to authenticated, service_role;

create or replace function public.list_my_blocked_accounts()
returns table (
  blocked_user_id uuid,
  display_name text,
  avatar_url text,
  blocked_at timestamptz
)
language sql
stable
security invoker
set search_path = public, app_private
as $$
  select * from app_private.list_my_blocked_accounts();
$$;

revoke all on function public.list_my_blocked_accounts() from public, anon;
grant execute on function public.list_my_blocked_accounts() to authenticated, service_role;

comment on function public.list_my_blocked_accounts() is
  'The caller''s own blocked accounts with name and avatar, for the Blocked accounts screen.';
