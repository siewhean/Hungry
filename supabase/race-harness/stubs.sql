\set ON_ERROR_STOP on
create schema auth; create schema app_private; create schema extensions;
do $$ begin
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
exception when duplicate_object then null; end $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated') $$;
create table auth.users (id uuid primary key, created_at timestamptz default now());
create table user_profiles (id uuid primary key, reviewed_dish_ids text[] default '{}');

-- portfolios
create table portfolios (id uuid primary key default gen_random_uuid(), owner_id uuid not null, type text default 'list', visibility text default 'private', published_at timestamptz, updated_at timestamptz not null default now());
create table portfolio_collaborators (portfolio_id uuid, user_id uuid, role text);
create table portfolio_items (id uuid primary key default gen_random_uuid(), portfolio_id uuid not null references portfolios(id) on delete cascade, item_type text not null, dish_id text, stall_id text, score int, public_notes text, private_notes text, position int not null default 0, created_at timestamptz default now(), updated_at timestamptz default now());
create unique index idx_portfolio_items_unique_stall on portfolio_items(portfolio_id, stall_id) where item_type='stall';
create table checklists (id uuid primary key, user_id uuid);
create table checklist_items (id uuid primary key, checklist_id uuid, position int, updated_at timestamptz);
create function record_passport_progress(a text, b text, c text default null) returns void language sql as $$ select $$;
create function catalog_menu_is_displayable(a boolean, b text, c text) returns boolean language sql as $$ select true $$;
create table dishes (id text primary key, venue_id text, review_count int default 0, rating_avg numeric default 0, menu_approved_for_display boolean, menu_rights_status text, menu_source_url text);
-- posts
create table posts (id uuid primary key default gen_random_uuid(), like_count int default 0, save_count int default 0, share_count int default 0, updated_at timestamptz default now());
create table post_likes (post_id uuid references posts(id), user_id uuid, primary key(post_id,user_id));
create table post_saves (post_id uuid references posts(id), user_id uuid, primary key(post_id,user_id));
create table post_shares (post_id uuid references posts(id), user_id uuid);
create table post_reports (id uuid primary key default gen_random_uuid(), reporter_id uuid, post_id uuid references posts(id), reason_code text, details text, status text, created_at timestamptz, resolved_at timestamptz, resolved_by uuid, unique(reporter_id, post_id, reason_code));
create table moderation_actions (id uuid primary key default gen_random_uuid(), target_type text, target_id uuid, actor_id uuid, action text, reason_code text, metadata jsonb);
create table post_moderation_states (post_id uuid primary key, state text, reason_code text, latest_action_id uuid, updated_at timestamptz);
create table home_feed_items (id uuid primary key default gen_random_uuid(), post_id uuid);
create function can_read_post(p uuid) returns boolean language sql as $$ select true $$;
-- catalog corrections
create table venues (id text primary key, building_id text);
create table catalog_corrections (id uuid primary key default gen_random_uuid(), venue_id text, dish_id text, reporter_id uuid, kind text, note text, status text default 'open', created_at timestamptz default now());
-- food cred
create table food_cred_events (id uuid primary key default gen_random_uuid(), user_id uuid, source_action text, points int, related_entity_id text, related_entity_type text, created_at timestamptz default now());
create table user_food_cred (user_id uuid primary key, total_points int, level_index int, updated_at timestamptz);
create function food_cred_default_points(a text) returns int language sql as $$ select 10 $$;
create function food_cred_daily_cap(a text) returns int language sql as $$ select 1 $$;
create function food_cred_level_index(a int) returns int language sql as $$ select a/100 $$;
create table weekly_missions (id text primary key);
create table user_mission_progress (user_id uuid, mission_id text);
-- pins
create table merchant_outlets (id uuid primary key);
create table reviews (id uuid primary key default gen_random_uuid(), dish_id text, user_id uuid, rating numeric, text text, venue_id text);
create table merchant_popular_visitor_pins (id uuid primary key default gen_random_uuid(), outlet_id uuid not null, venue_id text, review_id uuid not null, sort_order int not null default 0, is_active boolean not null default true, unique(outlet_id, review_id));
-- chat
create table conversation_participants (conversation_id uuid, participant_user_id uuid, last_read_at timestamptz);
create table messages (id uuid primary key default gen_random_uuid(), conversation_id uuid, sender_user_id uuid, deleted_at timestamptz);
create table read_receipts (message_id uuid references messages(id), conversation_id uuid, reader_user_id uuid, reader_merchant_account_id uuid, read_at timestamptz);
create unique index idx_read_receipts_user_once on read_receipts(message_id, reader_user_id) where reader_user_id is not null;
-- dish stats
create function app_private.dish_review_stats(p_dish_id text) returns table(review_count int, rating_avg numeric) language sql stable as $$
  select count(*)::int, coalesce(round(avg(rating),2),0) from reviews where dish_id = p_dish_id $$;
-- account deletion
create table account_deletion_requests (id uuid primary key default gen_random_uuid(), user_id uuid, reason text, status text not null default 'requested', scheduled_for timestamptz default now() + interval '30 days', created_at timestamptz default now());
create unique index uniq_account_deletion_requests_active_user on account_deletion_requests(user_id) where status in ('requested','processing');
create function app_private.account_deletion_blocker(u uuid) returns text language sql as $$ select null::text $$;
-- dishes_draft
create table dishes_draft (id uuid primary key default gen_random_uuid(), extraction_confidence numeric default 0, confidence_bumps int default 0, updated_at timestamptz default now());
