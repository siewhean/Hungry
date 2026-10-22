-- Home and feed social fixes (round-two mediums and lows, group G3).
--
-- M6  Like and follow events no longer repeat. like, unlike, like again used to
--     write two "liked your post" rows (follow, unfollow, follow the same). A
--     partial unique index allows one new_like / new_follower / follow_request
--     per (recipient, actor, target); the triggers insert with ON CONFLICT DO
--     NOTHING, and removing the like or the follow removes the author's unread
--     item.
-- M7  mark_all_activity_read(): one call clears the viewer's unread inbox.
-- L1  block_user(): blocking removes follows (and follow requests) in both
--     directions in the same transaction, so follower counts and lists stop
--     including the blocked person and a follow does not return after an
--     unblock.
-- M5  list_my_blocked_users() / list_my_hidden_posts(): the lists behind
--     Settings > Blocked and hidden. Blocked users cannot be read through
--     public_profiles (it hides blocked pairs), so the name comes from a
--     SECURITY DEFINER body.
-- L16 Activity from a user the viewer has since blocked (either direction) no
--     longer shows in the inbox (restrictive select policy).
--
-- Bodies that need definer rights live in app_private; the public names are
-- SECURITY INVOKER wrappers. The two activity trigger functions keep their
-- existing SECURITY DEFINER setting (table triggers need it).

create schema if not exists app_private;
grant usage on schema app_private to anon, authenticated, service_role;

-- 1. One event per actor and target -------------------------------------------
-- Keep the oldest row of any existing duplicates.
delete from public.activity_events ae
using (
  select
    id,
    row_number() over (
      partition by recipient_id, actor_id, event_type, target_id
      order by created_at, id
    ) as rn
  from public.activity_events
  where event_type in ('new_like', 'new_follower', 'follow_request')
) duplicates
where ae.id = duplicates.id
  and duplicates.rn > 1;

create unique index if not exists idx_activity_events_once_per_actor_target
  on public.activity_events (recipient_id, actor_id, event_type, target_id)
  where event_type in ('new_like', 'new_follower', 'follow_request');

-- Like trigger: latest definition is 20260527200000 (search_path set to
-- public, pg_catalog by 20260619110000). Adds ON CONFLICT DO NOTHING.
create or replace function public.trg_activity_on_post_like()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_author_id uuid;
begin
  select author_id into v_author_id from posts where id = NEW.post_id;
  -- Don't notify users of their own likes
  if v_author_id is not null and v_author_id <> NEW.user_id then
    insert into activity_events (recipient_id, actor_id, event_type, target_type, target_id)
    values (v_author_id, NEW.user_id, 'new_like', 'post', NEW.post_id)
    on conflict do nothing;
  end if;
  return NEW;
end;
$$;

revoke execute on function public.trg_activity_on_post_like()
  from public, anon, authenticated;

-- Follow trigger: latest definition is 20261019074000. Adds ON CONFLICT DO NOTHING.
create or replace function public.trg_activity_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if NEW.status = 'approved'
    and (TG_OP = 'INSERT' or OLD.status is distinct from 'approved') then
    insert into activity_events (recipient_id, actor_id, event_type, target_type, target_id)
    values (NEW.followee_id, NEW.follower_id, 'new_follower', 'profile', NEW.followee_id)
    on conflict do nothing;
  elsif NEW.status = 'pending'
    and (TG_OP = 'INSERT' or OLD.status is distinct from 'pending') then
    insert into activity_events (recipient_id, actor_id, event_type, target_type, target_id)
    values (NEW.followee_id, NEW.follower_id, 'follow_request', 'profile', NEW.followee_id)
    on conflict do nothing;
  end if;
  return NEW;
end;
$$;

revoke execute on function public.trg_activity_on_follow()
  from public, anon, authenticated;

-- Unlike removes the author's unread "liked your post" item.
create or replace function public.trg_activity_on_post_unlike()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  delete from activity_events
  where actor_id = OLD.user_id
    and event_type = 'new_like'
    and target_type = 'post'
    and target_id = OLD.post_id
    and read_at is null;
  return OLD;
end;
$$;

revoke execute on function public.trg_activity_on_post_unlike()
  from public, anon, authenticated;

drop trigger if exists trg_activity_on_post_unlike on public.post_likes;
create trigger trg_activity_on_post_unlike
  after delete on public.post_likes
  for each row execute function public.trg_activity_on_post_unlike();

-- Unfollow (or a block, which deletes follows) removes the unread follow items.
create or replace function public.trg_activity_on_unfollow()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  delete from activity_events
  where actor_id = OLD.follower_id
    and recipient_id = OLD.followee_id
    and event_type in ('new_follower', 'follow_request')
    and read_at is null;
  return OLD;
end;
$$;

revoke execute on function public.trg_activity_on_unfollow()
  from public, anon, authenticated;

drop trigger if exists trg_activity_on_unfollow on public.follows;
create trigger trg_activity_on_unfollow
  after delete on public.follows
  for each row execute function public.trg_activity_on_unfollow();

-- 2. Mark every unread update read (one call) ---------------------------------
-- Invoker: the activity_events_update_own policy limits it to the caller's rows.
create or replace function public.mark_all_activity_read()
returns integer
language sql
volatile
security invoker
set search_path = public, pg_catalog
as $$
  with updated as (
    update public.activity_events
    set read_at = now()
    where recipient_id = (select auth.uid())
      and read_at is null
    returning 1
  )
  select count(*)::integer from updated;
$$;

revoke all on function public.mark_all_activity_read() from public, anon;
grant execute on function public.mark_all_activity_read() to authenticated, service_role;

-- 3. Inbox hides activity from blocked users (either direction) ---------------
drop policy if exists activity_events_select_hide_blocked on public.activity_events;
create policy activity_events_select_hide_blocked
on public.activity_events
as restrictive
for select
to authenticated
using (not app_private.app_user_block_exists((select auth.uid()), actor_id));

-- 4. Block removes follows in both directions ---------------------------------
create or replace function app_private.block_user(
  p_blocked_user_id uuid,
  p_reason text default null
)
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
    raise exception 'You must be signed in to block users.' using errcode = '28000';
  end if;
  if p_blocked_user_id is null then
    raise exception 'Blocking requires a valid user id.' using errcode = '22023';
  end if;
  if p_blocked_user_id = v_viewer then
    raise exception 'You cannot block yourself.' using errcode = '22023';
  end if;

  insert into public.user_blocks (blocker_id, blocked_user_key, reason)
  values (
    v_viewer,
    lower(p_blocked_user_id::text),
    left(coalesce(nullif(btrim(p_reason), ''), 'user_initiated_block'), 200)
  )
  on conflict (blocker_id, blocked_user_key) do nothing;

  -- Follows and pending requests, both directions (counters follow the delete).
  delete from public.follows f
  where (f.follower_id = v_viewer and f.followee_id = p_blocked_user_id)
     or (f.follower_id = p_blocked_user_id and f.followee_id = v_viewer);
end;
$$;

revoke all on function app_private.block_user(uuid, text) from public, anon, authenticated;
grant execute on function app_private.block_user(uuid, text) to authenticated, service_role;

create or replace function public.block_user(
  p_blocked_user_id uuid,
  p_reason text default null
)
returns void
language sql
volatile
security invoker
set search_path = public, app_private
as $$
  select app_private.block_user(p_blocked_user_id, p_reason);
$$;

revoke all on function public.block_user(uuid, text) from public, anon;
grant execute on function public.block_user(uuid, text) to authenticated, service_role;

-- 5. Lists behind Settings > Blocked and hidden -------------------------------
create or replace function app_private.list_my_blocked_users()
returns table (
  blocked_user_id uuid,
  display_name text,
  avatar_url text,
  reason text,
  created_at timestamptz
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
    ub.reason,
    ub.created_at
  from public.user_blocks ub
  left join public.user_profiles up on up.id = ub.blocked_user_key::uuid
  where auth.uid() is not null
    and ub.blocker_id = auth.uid()
  order by ub.created_at desc;
$$;

revoke all on function app_private.list_my_blocked_users() from public, anon, authenticated;
grant execute on function app_private.list_my_blocked_users() to authenticated, service_role;

create or replace function public.list_my_blocked_users()
returns table (
  blocked_user_id uuid,
  display_name text,
  avatar_url text,
  reason text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public, app_private
as $$
  select * from app_private.list_my_blocked_users();
$$;

revoke all on function public.list_my_blocked_users() from public, anon;
grant execute on function public.list_my_blocked_users() to authenticated, service_role;

create or replace function app_private.list_my_hidden_posts()
returns table (
  post_id uuid,
  caption text,
  author_id uuid,
  author_display_name text,
  dish_name text,
  venue_name text,
  hidden_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    hp.post_id,
    p.caption,
    p.author_id,
    up.display_name,
    d.name,
    v.name,
    hp.created_at
  from public.hidden_posts hp
  left join public.posts p on p.id = hp.post_id
  left join public.user_profiles up on up.id = p.author_id
  left join public.dishes d on d.id = p.dish_id
  left join public.venues v on v.id = p.venue_id
  where auth.uid() is not null
    and hp.viewer_id = auth.uid()
  order by hp.created_at desc
  limit 200;
$$;

revoke all on function app_private.list_my_hidden_posts() from public, anon, authenticated;
grant execute on function app_private.list_my_hidden_posts() to authenticated, service_role;

create or replace function public.list_my_hidden_posts()
returns table (
  post_id uuid,
  caption text,
  author_id uuid,
  author_display_name text,
  dish_name text,
  venue_name text,
  hidden_at timestamptz
)
language sql
stable
security invoker
set search_path = public, app_private
as $$
  select * from app_private.list_my_hidden_posts();
$$;

revoke all on function public.list_my_hidden_posts() from public, anon;
grant execute on function public.list_my_hidden_posts() to authenticated, service_role;
