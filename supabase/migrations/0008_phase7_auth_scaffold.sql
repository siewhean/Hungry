-- Phase 7 auth scaffold: guest sessions + order/chat tables + baseline RLS.
-- These are minimum viable foundations for the guest-session endpoint and V2 auth hardening.

create table if not exists guest_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  device_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  upgraded_to_user_id uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  revoked_at timestamptz
);

create index if not exists idx_guest_sessions_expires_at on guest_sessions(expires_at);
update guest_sessions set device_id = 'legacy-' || id::text where device_id is null;
alter table guest_sessions alter column device_id set not null;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_profiles(id) on delete set null,
  guest_session_id uuid references guest_sessions(id) on delete set null,
  venue_id text references venues(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'placed', 'accepted', 'preparing', 'ready', 'collected', 'cancelled')),
  subtotal_amount numeric(10, 2) not null default 0,
  total_amount numeric(10, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or guest_session_id is not null)
);

create index if not exists idx_orders_user_id_created_at on orders(user_id, created_at desc);
create index if not exists idx_orders_guest_session_id on orders(guest_session_id);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  sender_user_id uuid not null references user_profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_thread_time on chat_messages(thread_id, created_at desc);

alter table guest_sessions enable row level security;
alter table orders enable row level security;
alter table chat_messages enable row level security;

-- "users" in roadmap docs maps to user_profiles in this repo schema.
drop policy if exists "profile_select_own" on user_profiles;
drop policy if exists "profile_insert_own" on user_profiles;
drop policy if exists "profile_update_own" on user_profiles;

drop policy if exists "users_select_own" on user_profiles;
create policy "users_select_own" on user_profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "users_insert_own" on user_profiles;
create policy "users_insert_own" on user_profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "users_update_own" on user_profiles;
create policy "users_update_own" on user_profiles
for update
to authenticated
using (auth.uid() = id);

drop policy if exists "reviews_select_public" on reviews;
drop policy if exists "public_select_reviews" on reviews;
create policy "reviews_select_public" on reviews
for select
using (true);

drop policy if exists "reviews_insert_own" on reviews;
drop policy if exists "reviews_insert_authenticated" on reviews;
create policy "reviews_insert_authenticated" on reviews
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "reviews_update_own" on reviews;
drop policy if exists "reviews_update_authenticated" on reviews;
create policy "reviews_update_authenticated" on reviews
for update
to authenticated
using (auth.uid() = user_id);

drop policy if exists "reviews_delete_own" on reviews;
drop policy if exists "reviews_delete_authenticated" on reviews;
create policy "reviews_delete_authenticated" on reviews
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "orders_select_own" on orders;
create policy "orders_select_own" on orders
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "orders_insert_own" on orders;
create policy "orders_insert_own" on orders
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "orders_update_own" on orders;
create policy "orders_update_own" on orders
for update
to authenticated
using (auth.uid() = user_id);

drop policy if exists "chat_messages_select_own" on chat_messages;
create policy "chat_messages_select_own" on chat_messages
for select
to authenticated
using (auth.uid() = sender_user_id);

drop policy if exists "chat_messages_insert_own" on chat_messages;
create policy "chat_messages_insert_own" on chat_messages
for insert
to authenticated
with check (auth.uid() = sender_user_id);
