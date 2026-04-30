-- Store policy safety controls.
-- Supports App Store / Google Play account deletion and UGC moderation requirements.

create table if not exists account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  reason text,
  status text not null default 'requested'
    check (status in ('requested', 'processing', 'completed', 'rejected')),
  retention_notice text not null default
    'Hungry will delete account data unless retention is required for security, fraud prevention, or legal obligations.',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_account_deletion_requests_user_id
  on account_deletion_requests(user_id);

alter table account_deletion_requests enable row level security;

drop policy if exists "account_deletion_insert_own" on account_deletion_requests;
create policy "account_deletion_insert_own"
on account_deletion_requests for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "account_deletion_select_own" on account_deletion_requests;
create policy "account_deletion_select_own"
on account_deletion_requests for select to authenticated
using (auth.uid() = user_id);

create table if not exists content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null,
  target_type text not null
    check (target_type in ('review', 'bite', 'reply', 'profile')),
  target_id text not null,
  target_author_key text,
  reason text not null,
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_content_reports_target
  on content_reports(target_type, target_id);
create index if not exists idx_content_reports_reporter
  on content_reports(reporter_id);

alter table content_reports enable row level security;

drop policy if exists "content_reports_insert_own" on content_reports;
create policy "content_reports_insert_own"
on content_reports for insert to authenticated
with check (auth.uid() = reporter_id);

drop policy if exists "content_reports_select_own" on content_reports;
create policy "content_reports_select_own"
on content_reports for select to authenticated
using (auth.uid() = reporter_id);

create table if not exists user_blocks (
  blocker_id uuid not null,
  blocked_user_key text not null,
  reason text,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_user_key)
);

alter table user_blocks enable row level security;

drop policy if exists "user_blocks_insert_own" on user_blocks;
create policy "user_blocks_insert_own"
on user_blocks for insert to authenticated
with check (auth.uid() = blocker_id);

drop policy if exists "user_blocks_select_own" on user_blocks;
create policy "user_blocks_select_own"
on user_blocks for select to authenticated
using (auth.uid() = blocker_id);

drop policy if exists "user_blocks_delete_own" on user_blocks;
create policy "user_blocks_delete_own"
on user_blocks for delete to authenticated
using (auth.uid() = blocker_id);
