-- Profile mediums M10 and M8.
--
-- M10: guests may open a profile (UserProfile is not a protected route) but
-- get_follow_counts was revoked from anon, so the app turned the error into
-- 0 followers and 0 following. The counts are already visible to every
-- signed-in user, so signed-out visitors get them too. The body already
-- copes with auth.uid() = null (app_user_block_exists is false for a null
-- viewer), and it still returns no row for an unknown user.
--
-- M8: a user could not remove a follower; the only way was Block.
-- remove_follower(follower) deletes the approved follow row where the caller
-- is the followee. Pending requests are answered with decline_follow_request,
-- and blocked rows are left alone. Idempotent: removing someone who does not
-- follow you is not an error. Body in app_private (SECURITY DEFINER); the
-- public name is a SECURITY INVOKER wrapper, matching the follow RPCs.

create schema if not exists app_private;
grant usage on schema app_private to anon, authenticated, service_role;

-- M10 ------------------------------------------------------------------------
grant execute on function app_private.get_follow_counts(uuid)
  to anon, authenticated, service_role;
grant execute on function public.get_follow_counts(uuid)
  to anon, authenticated, service_role;

-- M8 -------------------------------------------------------------------------
create or replace function app_private.remove_follower(p_follower_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_viewer uuid := auth.uid();
begin
  if v_viewer is null then
    raise exception 'You must be signed in to remove a follower.' using errcode = '28000';
  end if;

  if p_follower_id is null or p_follower_id = v_viewer then
    raise exception 'You cannot remove yourself.' using errcode = '22023';
  end if;

  delete from public.follows f
  where f.follower_id = p_follower_id
    and f.followee_id = v_viewer
    and f.status = 'approved';
end;
$$;

revoke all on function app_private.remove_follower(uuid) from public, anon, authenticated;
grant execute on function app_private.remove_follower(uuid) to authenticated, service_role;

create or replace function public.remove_follower(p_follower_id uuid)
returns void
language sql
volatile
security invoker
set search_path = public, app_private
as $$
  select app_private.remove_follower(p_follower_id);
$$;

revoke all on function public.remove_follower(uuid) from public, anon;
grant execute on function public.remove_follower(uuid) to authenticated, service_role;

comment on function public.remove_follower(uuid) is
  'Removes an approved follower of the signed-in user. Does nothing when that person does not follow them.';
