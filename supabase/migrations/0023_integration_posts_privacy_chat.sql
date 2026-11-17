-- Integration readiness for production-like social, privacy, media, and chat flows.
-- This migration intentionally coexists with the existing `bites` and legacy
-- `chat_messages` scaffold so mobile screens can migrate incrementally.

create table if not exists privacy_settings (
  user_id uuid primary key references user_profiles(id) on delete cascade,
  account_visibility text not null default 'public'
    check (account_visibility in ('public', 'private')),
  updated_at timestamptz not null default now()
);

create table if not exists follows (
  follower_id uuid not null references user_profiles(id) on delete cascade,
  followee_id uuid not null references user_profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'blocked')),
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index if not exists idx_follows_followee_status
  on follows(followee_id, status);
create index if not exists idx_follows_follower_status
  on follows(follower_id, status);

create or replace function public.can_read_author_content(p_author_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() = p_author_id
    or coalesce((
      select ps.account_visibility = 'public'
      from privacy_settings ps
      where ps.user_id = p_author_id
    ), true)
    or exists (
      select 1
      from follows f
      where f.followee_id = p_author_id
        and f.follower_id = auth.uid()
        and f.status = 'approved'
    );
$$;

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references user_profiles(id) on delete cascade,
  post_type text not null default 'text'
    check (post_type in ('text', 'image', 'multi_image', 'video', 'review', 'ai_edited')),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'deleted')),
  visibility text not null default 'public'
    check (visibility in ('public', 'followers', 'private')),
  caption text not null default '',
  generated_content jsonb not null default '{}'::jsonb,
  dish_id text references dishes(id) on delete set null,
  venue_id text references venues(id) on delete set null,
  building_id text references buildings(id) on delete set null,
  review_id uuid references reviews(id) on delete set null,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  save_count integer not null default 0,
  share_count integer not null default 0,
  published_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_posts_author_status_created
  on posts(author_id, status, created_at desc);
create index if not exists idx_posts_feed_published
  on posts(status, published_at desc nulls last, created_at desc)
  where status = 'published' and deleted_at is null;
create index if not exists idx_posts_dish_id on posts(dish_id);
create index if not exists idx_posts_venue_id on posts(venue_id);

create or replace function public.can_read_post(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from posts p
    where p.id = p_post_id
      and p.deleted_at is null
      and (
        p.author_id = auth.uid()
        or (
          p.status = 'published'
          and (
            p.visibility = 'public'
            or (
              p.visibility = 'followers'
              and exists (
                select 1
                from follows f
                where f.followee_id = p.author_id
                  and f.follower_id = auth.uid()
                  and f.status = 'approved'
              )
            )
          )
          and public.can_read_author_content(p.author_id)
        )
      )
  );
$$;

create table if not exists post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video')),
  storage_bucket text not null default 'post-media',
  storage_path text not null,
  public_url text,
  mime_type text,
  size_bytes integer,
  width integer,
  height integer,
  duration_ms integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (post_id, sort_order)
);

create index if not exists idx_post_media_post_order
  on post_media(post_id, sort_order);

create table if not exists post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0),
  parent_comment_id uuid references post_comments(id) on delete cascade,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_post_comments_post_created
  on post_comments(post_id, created_at);

create table if not exists post_likes (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists post_saves (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists post_shares (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,
  target_user_id uuid references user_profiles(id) on delete set null,
  target_conversation_id uuid,
  share_channel text not null default 'in_app'
    check (share_channel in ('in_app', 'system_share', 'copy_link')),
  created_at timestamptz not null default now()
);

create index if not exists idx_post_shares_post_id on post_shares(post_id);
create index if not exists idx_post_shares_user_id on post_shares(user_id);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  conversation_type text not null default 'user'
    check (conversation_type in ('user', 'merchant')),
  dedupe_key text not null unique,
  subject_merchant_account_id uuid references merchant_accounts(id) on delete set null,
  created_by_user_id uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  participant_kind text not null check (participant_kind in ('user', 'merchant')),
  participant_user_id uuid references user_profiles(id) on delete cascade,
  participant_merchant_account_id uuid references merchant_accounts(id) on delete cascade,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  unique (conversation_id, participant_user_id),
  unique (conversation_id, participant_merchant_account_id),
  check (
    (participant_kind = 'user' and participant_user_id is not null and participant_merchant_account_id is null)
    or
    (participant_kind = 'merchant' and participant_user_id is null and participant_merchant_account_id is not null)
  )
);

create index if not exists idx_conversation_participants_user
  on conversation_participants(participant_user_id);
create index if not exists idx_conversation_participants_merchant
  on conversation_participants(participant_merchant_account_id);

create or replace function public.is_merchant_member(p_merchant_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from merchant_accounts ma
    where ma.id = p_merchant_account_id
      and ma.user_id = auth.uid()
  )
  or exists (
    select 1
    from merchant_roles mr
    where mr.merchant_account_id = p_merchant_account_id
      and mr.user_id = auth.uid()
  );
$$;

create or replace function public.can_access_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and (
        cp.participant_user_id = auth.uid()
        or (
          cp.participant_merchant_account_id is not null
          and public.is_merchant_member(cp.participant_merchant_account_id)
        )
      )
  );
$$;

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_user_id uuid references user_profiles(id) on delete cascade,
  sender_merchant_account_id uuid references merchant_accounts(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 4000),
  client_nonce text,
  delivered_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (conversation_id, client_nonce),
  check (
    (sender_user_id is not null and sender_merchant_account_id is null)
    or
    (sender_user_id is null and sender_merchant_account_id is not null)
  )
);

create index if not exists idx_messages_conversation_created
  on messages(conversation_id, created_at);

create table if not exists read_receipts (
  message_id uuid not null references messages(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  reader_user_id uuid references user_profiles(id) on delete cascade,
  reader_merchant_account_id uuid references merchant_accounts(id) on delete cascade,
  read_at timestamptz not null default now(),
  check (
    (reader_user_id is not null and reader_merchant_account_id is null)
    or
    (reader_user_id is null and reader_merchant_account_id is not null)
  )
);

create index if not exists idx_read_receipts_conversation
  on read_receipts(conversation_id, read_at desc);
create unique index if not exists idx_messages_id_conversation
  on messages(id, conversation_id);
create unique index if not exists idx_read_receipts_user_once
  on read_receipts(message_id, reader_user_id)
  where reader_user_id is not null;
create unique index if not exists idx_read_receipts_merchant_once
  on read_receipts(message_id, reader_merchant_account_id)
  where reader_merchant_account_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'post_shares_target_conversation_id_fkey'
  ) then
    alter table post_shares
      add constraint post_shares_target_conversation_id_fkey
      foreign key (target_conversation_id) references conversations(id) on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'read_receipts_message_conversation_fkey'
  ) then
    alter table read_receipts
      add constraint read_receipts_message_conversation_fkey
      foreign key (message_id, conversation_id) references messages(id, conversation_id)
      on delete cascade;
  end if;
end
$$;

alter table privacy_settings enable row level security;
alter table follows enable row level security;
alter table posts enable row level security;
alter table post_media enable row level security;
alter table post_comments enable row level security;
alter table post_likes enable row level security;
alter table post_saves enable row level security;
alter table post_shares enable row level security;
alter table conversations enable row level security;
alter table conversation_participants enable row level security;
alter table messages enable row level security;
alter table read_receipts enable row level security;

drop policy if exists "profile_select_public_or_followed" on user_profiles;
drop policy if exists "users_select_own" on user_profiles;
create policy "profile_select_public_or_followed"
on user_profiles for select to authenticated
using (public.can_read_author_content(id));

drop policy if exists "privacy_settings_select_own" on privacy_settings;
create policy "privacy_settings_select_own"
on privacy_settings for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "privacy_settings_write_own" on privacy_settings;
create policy "privacy_settings_write_own"
on privacy_settings for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "follows_select_participant" on follows;
create policy "follows_select_participant"
on follows for select to authenticated
using (auth.uid() in (follower_id, followee_id));

drop policy if exists "follows_insert_requester" on follows;
create policy "follows_insert_requester"
on follows for insert to authenticated
with check (auth.uid() = follower_id and status = 'pending' and approved_at is null);

drop policy if exists "follows_update_participant" on follows;
create policy "follows_update_participant"
on follows for update to authenticated
using (auth.uid() = followee_id)
with check (
  auth.uid() = followee_id
  and status in ('pending', 'approved', 'rejected', 'blocked')
);

drop policy if exists "follows_delete_participant" on follows;
create policy "follows_delete_participant"
on follows for delete to authenticated
using (auth.uid() in (follower_id, followee_id));

drop policy if exists "posts_select_visible" on posts;
create policy "posts_select_visible"
on posts for select to authenticated
using (public.can_read_post(id));

drop policy if exists "posts_insert_own" on posts;
create policy "posts_insert_own"
on posts for insert to authenticated
with check (auth.uid() = author_id);

drop policy if exists "posts_update_own" on posts;
create policy "posts_update_own"
on posts for update to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

drop policy if exists "posts_delete_own" on posts;
create policy "posts_delete_own"
on posts for delete to authenticated
using (auth.uid() = author_id);

drop policy if exists "post_media_select_visible_post" on post_media;
create policy "post_media_select_visible_post"
on post_media for select to authenticated
using (public.can_read_post(post_id));

drop policy if exists "post_media_write_own_post" on post_media;
create policy "post_media_write_own_post"
on post_media for all to authenticated
using (exists (select 1 from posts p where p.id = post_media.post_id and p.author_id = auth.uid()))
with check (exists (select 1 from posts p where p.id = post_media.post_id and p.author_id = auth.uid()));

drop policy if exists "post_comments_select_visible_post" on post_comments;
create policy "post_comments_select_visible_post"
on post_comments for select to authenticated
using (public.can_read_post(post_id) and deleted_at is null);

drop policy if exists "post_comments_insert_visible_post" on post_comments;
create policy "post_comments_insert_visible_post"
on post_comments for insert to authenticated
with check (auth.uid() = user_id and public.can_read_post(post_id));

drop policy if exists "post_comments_update_own" on post_comments;
create policy "post_comments_update_own"
on post_comments for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "post_comments_delete_own" on post_comments;
create policy "post_comments_delete_own"
on post_comments for delete to authenticated
using (auth.uid() = user_id);

drop policy if exists "post_likes_select_visible_post" on post_likes;
create policy "post_likes_select_visible_post"
on post_likes for select to authenticated
using (public.can_read_post(post_id));

drop policy if exists "post_likes_insert_own_visible_post" on post_likes;
create policy "post_likes_insert_own_visible_post"
on post_likes for insert to authenticated
with check (auth.uid() = user_id and public.can_read_post(post_id));

drop policy if exists "post_likes_delete_own" on post_likes;
create policy "post_likes_delete_own"
on post_likes for delete to authenticated
using (auth.uid() = user_id);

drop policy if exists "post_saves_select_own" on post_saves;
create policy "post_saves_select_own"
on post_saves for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "post_saves_insert_own_visible_post" on post_saves;
create policy "post_saves_insert_own_visible_post"
on post_saves for insert to authenticated
with check (auth.uid() = user_id and public.can_read_post(post_id));

drop policy if exists "post_saves_delete_own" on post_saves;
create policy "post_saves_delete_own"
on post_saves for delete to authenticated
using (auth.uid() = user_id);

drop policy if exists "post_shares_select_own_or_target" on post_shares;
create policy "post_shares_select_own_or_target"
on post_shares for select to authenticated
using (auth.uid() = user_id or auth.uid() = target_user_id);

drop policy if exists "post_shares_insert_own_visible_post" on post_shares;
create policy "post_shares_insert_own_visible_post"
on post_shares for insert to authenticated
with check (auth.uid() = user_id and public.can_read_post(post_id));

drop policy if exists "conversations_select_participant" on conversations;
create policy "conversations_select_participant"
on conversations for select to authenticated
using (public.can_access_conversation(id));

drop policy if exists "conversations_insert_creator" on conversations;
create policy "conversations_insert_creator"
on conversations for insert to authenticated
with check (auth.uid() = created_by_user_id);

drop policy if exists "conversations_update_participant" on conversations;
create policy "conversations_update_participant"
on conversations for update to authenticated
using (public.can_access_conversation(id))
with check (public.can_access_conversation(id));

drop policy if exists "conversation_participants_select_participant" on conversation_participants;
create policy "conversation_participants_select_participant"
on conversation_participants for select to authenticated
using (public.can_access_conversation(conversation_id));

drop policy if exists "conversation_participants_insert_creator_or_self" on conversation_participants;
create policy "conversation_participants_insert_creator_or_self"
on conversation_participants for insert to authenticated
with check (
  exists (
    select 1 from conversations c
    where c.id = conversation_participants.conversation_id
      and c.created_by_user_id = auth.uid()
  )
  or (
    participant_merchant_account_id is not null
    and public.is_merchant_member(participant_merchant_account_id)
    and exists (
      select 1 from conversations c
      where c.id = conversation_participants.conversation_id
        and c.created_by_user_id = auth.uid()
    )
  )
);

drop policy if exists "conversation_participants_update_self" on conversation_participants;
create policy "conversation_participants_update_self"
on conversation_participants for update to authenticated
using (
  participant_user_id = auth.uid()
  or (
    participant_merchant_account_id is not null
    and public.is_merchant_member(participant_merchant_account_id)
  )
)
with check (
  participant_user_id = auth.uid()
  or (
    participant_merchant_account_id is not null
    and public.is_merchant_member(participant_merchant_account_id)
  )
);

drop policy if exists "messages_select_participant" on messages;
create policy "messages_select_participant"
on messages for select to authenticated
using (public.can_access_conversation(conversation_id) and deleted_at is null);

drop policy if exists "messages_insert_sender_participant" on messages;
create policy "messages_insert_sender_participant"
on messages for insert to authenticated
with check (
  public.can_access_conversation(conversation_id)
  and (
    sender_user_id = auth.uid()
    or (
      sender_merchant_account_id is not null
      and public.is_merchant_member(sender_merchant_account_id)
    )
  )
);

drop policy if exists "messages_update_sender" on messages;
create policy "messages_update_sender"
on messages for update to authenticated
using (
  sender_user_id = auth.uid()
  or (
    sender_merchant_account_id is not null
    and public.is_merchant_member(sender_merchant_account_id)
  )
)
with check (
  sender_user_id = auth.uid()
  or (
    sender_merchant_account_id is not null
    and public.is_merchant_member(sender_merchant_account_id)
  )
);

drop policy if exists "read_receipts_select_participant" on read_receipts;
create policy "read_receipts_select_participant"
on read_receipts for select to authenticated
using (public.can_access_conversation(conversation_id));

drop policy if exists "read_receipts_upsert_reader" on read_receipts;
create policy "read_receipts_upsert_reader"
on read_receipts for all to authenticated
using (
  reader_user_id = auth.uid()
  or (
    reader_merchant_account_id is not null
    and public.is_merchant_member(reader_merchant_account_id)
  )
)
with check (
  public.can_access_conversation(conversation_id)
  and (
    reader_user_id = auth.uid()
    or (
      reader_merchant_account_id is not null
      and public.is_merchant_member(reader_merchant_account_id)
    )
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('post-media', 'post-media', false, 52428800, array[
    'image/jpeg', 'image/png', 'image/heic', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]),
  ('merchant-dish-images', 'merchant-dish-images', true, 10485760, array[
    'image/jpeg', 'image/png', 'image/heic', 'image/webp'
  ]),
  ('merchant-stall-images', 'merchant-stall-images', true, 10485760, array[
    'image/jpeg', 'image/png', 'image/heic', 'image/webp'
  ])
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "integration_media_select_public" on storage.objects;
create policy "integration_media_select_public"
on storage.objects for select
using (bucket_id in ('merchant-dish-images', 'merchant-stall-images'));

drop policy if exists "post_media_select_author_prefix" on storage.objects;
create policy "post_media_select_author_prefix"
on storage.objects for select to authenticated
using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "integration_media_insert_authenticated_own_prefix" on storage.objects;
create policy "integration_media_insert_authenticated_own_prefix"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('post-media', 'merchant-dish-images', 'merchant-stall-images')
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "integration_media_update_authenticated_own_prefix" on storage.objects;
create policy "integration_media_update_authenticated_own_prefix"
on storage.objects for update to authenticated
using (
  bucket_id in ('post-media', 'merchant-dish-images', 'merchant-stall-images')
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id in ('post-media', 'merchant-dish-images', 'merchant-stall-images')
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "integration_media_delete_authenticated_own_prefix" on storage.objects;
create policy "integration_media_delete_authenticated_own_prefix"
on storage.objects for delete to authenticated
using (
  bucket_id in ('post-media', 'merchant-dish-images', 'merchant-stall-images')
  and (storage.foldername(name))[1] = auth.uid()::text
);

do $$
begin
  alter publication supabase_realtime add table conversations;
exception
  when duplicate_object then null;
  when undefined_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table conversation_participants;
exception
  when duplicate_object then null;
  when undefined_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table read_receipts;
exception
  when duplicate_object then null;
  when undefined_object then null;
end
$$;
