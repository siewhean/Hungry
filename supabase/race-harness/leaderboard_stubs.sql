\set ON_ERROR_STOP on
-- Stand-in tables for 20261107120000_food_portfolio_leaderboards.sql: just the columns its
-- triggers and functions read, so the whole migration (and its down file) can be applied.
create schema auth; create schema app_private;
do $$ begin
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
exception when duplicate_object then null; end $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table auth.users (id uuid primary key, email text);
create table user_profiles (id uuid primary key references auth.users(id), display_name text, avatar_url text, created_at timestamptz not null default now() - interval '30 days');
create table venues (id text primary key, name text);
create table dishes (id text primary key, name text);
create table posts (id uuid primary key default gen_random_uuid(), author_id uuid not null references user_profiles(id) on delete cascade, status text not null default 'draft', visibility text not null default 'public', caption text not null default '', generated_content jsonb not null default '{}', dish_id text, venue_id text, published_at timestamptz, deleted_at timestamptz, created_at timestamptz not null default now());
create table post_media (id uuid primary key default gen_random_uuid(), post_id uuid not null references posts(id) on delete cascade, media_type text not null default 'image', storage_path text, sort_order int not null default 0);
create table post_likes (post_id uuid references posts(id) on delete cascade, user_id uuid references user_profiles(id), created_at timestamptz default now(), primary key (post_id, user_id));
create table post_saves (post_id uuid references posts(id) on delete cascade, user_id uuid references user_profiles(id), created_at timestamptz default now(), primary key (post_id, user_id));
create table post_shares (id uuid primary key default gen_random_uuid(), post_id uuid references posts(id) on delete cascade, user_id uuid references user_profiles(id), created_at timestamptz default now());
create table follows (follower_id uuid references user_profiles(id), followee_id uuid references user_profiles(id), status text not null default 'pending', approved_at timestamptz, primary key (follower_id, followee_id));
create table reviews (id uuid primary key default gen_random_uuid(), user_id uuid, dish_id text, rating numeric, text text);
create table post_reports (id uuid primary key default gen_random_uuid(), reporter_id uuid, post_id uuid references posts(id) on delete cascade, status text not null default 'open');
create table post_moderation_states (post_id uuid primary key references posts(id) on delete cascade, state text not null default 'visible');
create table user_blocks (blocker_id uuid not null, blocked_user_key text not null, primary key (blocker_id, blocked_user_key));
create table privacy_settings (user_id uuid primary key, account_visibility text not null default 'public');
create table app_private.request_rate_rules (route text primary key, anon_per_minute int, user_per_minute int, note text);
create function public.app_user_block_exists(a uuid, b uuid) returns boolean language sql stable as $$
  select coalesce(a <> b, false) and exists (select 1 from user_blocks ub
    where (ub.blocker_id = a and ub.blocked_user_key = b::text) or (ub.blocker_id = b and ub.blocked_user_key = a::text)) $$;
create function app_private.can_read_author_content(p uuid) returns boolean language sql stable as $$
  select p = auth.uid() or (not public.app_user_block_exists(auth.uid(), p) and (
    coalesce((select ps.account_visibility = 'public' from privacy_settings ps where ps.user_id = p), true)
    or exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p and f.status = 'approved'))) $$;
-- can_read_post (private accounts and blocks) as the real one reads a post's author.
create function app_private.can_read_post(p uuid) returns boolean language sql stable as $$
  select app_private.can_read_author_content((select po.author_id from posts po where po.id = p)) $$;
grant usage on schema public, app_private to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
insert into venues select 'v' || g, 'Stall ' || g from generate_series(1, 9) g;
insert into dishes values ('d1', 'Chicken rice'), ('d2', 'Laksa');
