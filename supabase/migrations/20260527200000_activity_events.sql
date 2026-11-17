-- Activity events table for social notifications inbox.
-- Populated via triggers on post_likes, post_comments, and follows.

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.user_profiles(id) on delete cascade,
  actor_id uuid not null references public.user_profiles(id) on delete cascade,
  event_type text not null check (event_type in (
    'new_like',
    'new_comment',
    'new_reply',
    'new_follower'
  )),
  target_type text not null check (target_type in ('post', 'comment', 'profile')),
  target_id uuid not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_events_recipient_created
  on public.activity_events(recipient_id, created_at desc);

create index if not exists idx_activity_events_unread
  on public.activity_events(recipient_id, read_at)
  where read_at is null;

alter table public.activity_events enable row level security;

create policy "activity_events_select_own"
on public.activity_events for select to authenticated
using (recipient_id = auth.uid());

create policy "activity_events_update_own"
on public.activity_events for update to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

create policy "activity_events_service_role_all"
on public.activity_events for all to service_role
using (true)
with check (true);

-- Trigger: new_like on post_likes insert
create or replace function public.trg_activity_on_post_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
begin
  select author_id into v_author_id from posts where id = NEW.post_id;
  -- Don't notify users of their own likes
  if v_author_id is not null and v_author_id <> NEW.user_id then
    insert into activity_events (recipient_id, actor_id, event_type, target_type, target_id)
    values (v_author_id, NEW.user_id, 'new_like', 'post', NEW.post_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_activity_on_post_like on public.post_likes;
create trigger trg_activity_on_post_like
  after insert on public.post_likes
  for each row execute function public.trg_activity_on_post_like();

-- Trigger: new_comment on post_comments insert
create or replace function public.trg_activity_on_post_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
  v_parent_author_id uuid;
begin
  if NEW.parent_comment_id is null then
    -- Top-level comment: notify post author
    select author_id into v_author_id from posts where id = NEW.post_id;
    if v_author_id is not null and v_author_id <> NEW.user_id then
      insert into activity_events (recipient_id, actor_id, event_type, target_type, target_id)
      values (v_author_id, NEW.user_id, 'new_comment', 'post', NEW.post_id);
    end if;
  else
    -- Reply: notify parent comment author
    select user_id into v_parent_author_id from post_comments where id = NEW.parent_comment_id;
    if v_parent_author_id is not null and v_parent_author_id <> NEW.user_id then
      insert into activity_events (recipient_id, actor_id, event_type, target_type, target_id)
      values (v_parent_author_id, NEW.user_id, 'new_reply', 'comment', NEW.parent_comment_id);
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_activity_on_post_comment on public.post_comments;
create trigger trg_activity_on_post_comment
  after insert on public.post_comments
  for each row execute function public.trg_activity_on_post_comment();

-- Trigger: new_follower on follows insert
create or replace function public.trg_activity_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into activity_events (recipient_id, actor_id, event_type, target_type, target_id)
  values (NEW.followee_id, NEW.follower_id, 'new_follower', 'profile', NEW.followee_id);
  return NEW;
end;
$$;

drop trigger if exists trg_activity_on_follow on public.follows;
create trigger trg_activity_on_follow
  after insert on public.follows
  for each row execute function public.trg_activity_on_follow();

-- Helper RPC: mark activity event as read
create or replace function public.mark_activity_read(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update activity_events
  set read_at = now()
  where id = p_event_id
    and recipient_id = auth.uid()
    and read_at is null;
end;
$$;

revoke execute on function public.mark_activity_read(uuid) from public, anon;
grant execute on function public.mark_activity_read(uuid) to authenticated, service_role;
