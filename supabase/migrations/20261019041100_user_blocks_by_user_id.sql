-- Make user blocks take effect on the server.
--
-- The app used to write user_blocks.blocked_user_key as the blocked author's
-- display name (lowercased, spaces to hyphens). Every server check
-- (app_user_block_exists, can_read_author_content, can_read_post, the Home
-- feed RPC and send_chat_message) compares blocked_user_key with the author's
-- auth user id as text, so those rows never matched and blocked users' content
-- kept arriving. The client now writes the author's user id.
--
-- This migration:
--   1. Converts old name-keyed rows to user ids where the name matches exactly
--      one profile, and drops the rest (they never blocked anything).
--   2. Only allows user-id keys from now on, and no self-blocks.
--   3. Hides reviews from blocked users, and reviews the viewer reported, on
--      every authenticated review read (Review feed, dish reviews).
--   4. Hides post comments written by blocked users.

-- 1. Convert name-keyed rows.
with legacy_blocks as (
  select ub.blocker_id, ub.blocked_user_key, ub.reason, ub.created_at
  from public.user_blocks ub
  where ub.blocked_user_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
),
profile_keys as (
  select
    up.id,
    left(regexp_replace(lower(btrim(up.display_name)), '\s+', '-', 'g'), 80) as author_key
  from public.user_profiles up
  where nullif(btrim(coalesce(up.display_name, '')), '') is not null
),
unique_matches as (
  select lb.blocker_id, min(pk.id::text)::uuid as blocked_user_id, lb.reason, lb.created_at
  from legacy_blocks lb
  join profile_keys pk on pk.author_key = lb.blocked_user_key
  group by lb.blocker_id, lb.blocked_user_key, lb.reason, lb.created_at
  having count(*) = 1
)
insert into public.user_blocks (blocker_id, blocked_user_key, reason, created_at)
select um.blocker_id, um.blocked_user_id::text, um.reason, um.created_at
from unique_matches um
where um.blocked_user_id <> um.blocker_id
on conflict (blocker_id, blocked_user_key) do nothing;

delete from public.user_blocks
where blocked_user_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or blocked_user_key = blocker_id::text;

-- 2. Only user-id keys from now on. Lowercase so text comparisons with
-- uuid::text always match.
update public.user_blocks
set blocked_user_key = lower(blocked_user_key)
where blocked_user_key <> lower(blocked_user_key)
  and not exists (
    select 1
    from public.user_blocks existing
    where existing.blocker_id = user_blocks.blocker_id
      and existing.blocked_user_key = lower(user_blocks.blocked_user_key)
  );

delete from public.user_blocks
where blocked_user_key <> lower(blocked_user_key);

alter table public.user_blocks
  drop constraint if exists user_blocks_blocked_user_key_is_user_id;
alter table public.user_blocks
  add constraint user_blocks_blocked_user_key_is_user_id
  check (blocked_user_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

alter table public.user_blocks
  drop constraint if exists user_blocks_no_self_block;
alter table public.user_blocks
  add constraint user_blocks_no_self_block
  check (blocked_user_key <> blocker_id::text);

create or replace function public.user_blocks_normalize_key()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.blocked_user_key := lower(btrim(new.blocked_user_key));
  return new;
end;
$$;

revoke all on function public.user_blocks_normalize_key() from public, anon, authenticated;

drop trigger if exists user_blocks_normalize_key on public.user_blocks;
create trigger user_blocks_normalize_key
before insert or update of blocked_user_key on public.user_blocks
for each row execute function public.user_blocks_normalize_key();

-- 3. Review reads: hide blocked authors (either direction) and reviews the
-- viewer reported. Authors always see their own reviews.
create or replace function app_private.can_read_review(
  p_review_id uuid,
  p_author_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() is null
    or p_author_id = auth.uid()
    or (
      (
        p_author_id is null
        or not app_private.app_user_block_exists(auth.uid(), p_author_id)
      )
      and not exists (
        select 1
        from public.content_reports cr
        where cr.reporter_id = auth.uid()
          and cr.target_type = 'review'
          and cr.target_id = p_review_id::text
      )
    );
$$;

revoke all on function app_private.can_read_review(uuid, uuid) from public, anon, authenticated;
grant execute on function app_private.can_read_review(uuid, uuid) to authenticated, service_role;

drop policy if exists reviews_select_hide_blocked_or_reported on public.reviews;
create policy reviews_select_hide_blocked_or_reported
on public.reviews
as restrictive
for select
to authenticated
using (app_private.can_read_review(id, user_id));

-- 4. Post comments: hide comments written by users the viewer blocked (or who
-- blocked the viewer). Commenters always see their own comments.
drop policy if exists post_comments_select_hide_blocked on public.post_comments;
create policy post_comments_select_hide_blocked
on public.post_comments
as restrictive
for select
to authenticated
using (
  user_id = (select auth.uid())
  or not app_private.app_user_block_exists((select auth.uid()), user_id)
);

comment on constraint user_blocks_blocked_user_key_is_user_id on public.user_blocks is
  'Blocks are keyed by the blocked author''s auth user id so server block checks match.';
