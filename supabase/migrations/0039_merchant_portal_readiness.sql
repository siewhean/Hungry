-- Merchant portal production-readiness additions.
-- Adds invite state, richer promotion pricing, dish-view analytics, and
-- merchant notification records used by the mobile merchant portal.

alter table merchant_roles
  add column if not exists invite_status text not null default 'accepted'
    check (invite_status in ('pending', 'accepted', 'declined', 'removed')),
  add column if not exists invited_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists removed_at timestamptz;

alter table merchant_outlets
  add column if not exists temporary_closure text,
  add column if not exists profile_photo_url text,
  add column if not exists cover_photo_url text,
  add column if not exists contact_phone text,
  add column if not exists contact_email text;

alter table merchant_promotions
  add column if not exists promotion_item_type text not null default 'new_item'
    check (promotion_item_type in ('new_item', 'existing_menu_item')),
  add column if not exists original_price numeric(10, 2),
  add column if not exists promotional_price numeric(10, 2),
  add column if not exists final_price numeric(10, 2),
  add column if not exists discount_percentage numeric(5, 2),
  add column if not exists is_available boolean not null default true;

create table if not exists merchant_dish_view_events (
  id uuid primary key default gen_random_uuid(),
  merchant_account_id uuid not null references merchant_accounts(id) on delete cascade,
  outlet_id uuid not null references merchant_outlets(id) on delete cascade,
  venue_id text not null references venues(id) on delete cascade,
  dish_id text not null references dishes(id) on delete cascade,
  user_id uuid,
  session_id text not null,
  dedupe_key text not null unique,
  viewed_at timestamptz not null default now()
);

create index if not exists idx_merchant_dish_view_events_outlet_viewed
  on merchant_dish_view_events(outlet_id, viewed_at desc);
create index if not exists idx_merchant_dish_view_events_dish_viewed
  on merchant_dish_view_events(dish_id, viewed_at desc);

create table if not exists merchant_notifications (
  id uuid primary key default gen_random_uuid(),
  merchant_account_id uuid not null references merchant_accounts(id) on delete cascade,
  outlet_id uuid references merchant_outlets(id) on delete cascade,
  recipient_user_id uuid,
  recipient_email citext,
  kind text not null
    check (kind in ('team_invite', 'team_added', 'low_rating', 'weekly_summary', 'ai_insight')),
  title text not null,
  body text not null default '',
  status text not null default 'unread'
    check (status in ('unread', 'read', 'sent')),
  dedupe_key text not null unique,
  deep_link text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists merchant_email_outbox (
  id uuid primary key default gen_random_uuid(),
  merchant_account_id uuid not null references merchant_accounts(id) on delete cascade,
  outlet_id uuid references merchant_outlets(id) on delete cascade,
  recipient_email citext not null,
  template text not null
    check (template in ('team_invite', 'weekly_summary', 'low_rating')),
  subject text not null,
  body text not null default '',
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed', 'cancelled')),
  dedupe_key text not null unique,
  metadata jsonb,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  error_message text
);

create index if not exists idx_merchant_notifications_account_created
  on merchant_notifications(merchant_account_id, created_at desc);
create index if not exists idx_merchant_notifications_outlet_created
  on merchant_notifications(outlet_id, created_at desc);
create index if not exists idx_merchant_email_outbox_status_queued
  on merchant_email_outbox(status, queued_at);
create index if not exists idx_merchant_email_outbox_account_queued
  on merchant_email_outbox(merchant_account_id, queued_at desc);

alter table merchant_dish_view_events enable row level security;
alter table merchant_notifications enable row level security;
alter table merchant_email_outbox enable row level security;

drop policy if exists "merchant_dish_views_public_insert" on merchant_dish_view_events;
create policy "merchant_dish_views_public_insert"
on merchant_dish_view_events for insert to anon, authenticated
with check (
  exists (
    select 1
    from merchant_outlets mo
    where mo.id = merchant_dish_view_events.outlet_id
      and mo.merchant_account_id = merchant_dish_view_events.merchant_account_id
      and mo.venue_id = merchant_dish_view_events.venue_id
  )
);

drop policy if exists "merchant_dish_views_member_select" on merchant_dish_view_events;
create policy "merchant_dish_views_member_select"
on merchant_dish_view_events for select to authenticated
using (
  exists (
    select 1
    from merchant_accounts ma
    left join merchant_roles mr on mr.merchant_account_id = ma.id
    where ma.id = merchant_dish_view_events.merchant_account_id
      and (ma.user_id = auth.uid() or mr.user_id = auth.uid())
  )
);

drop policy if exists "merchant_notifications_member_select" on merchant_notifications;
create policy "merchant_notifications_member_select"
on merchant_notifications for select to authenticated
using (
  exists (
    select 1
    from merchant_accounts ma
    left join merchant_roles mr on mr.merchant_account_id = ma.id
    where ma.id = merchant_notifications.merchant_account_id
      and (ma.user_id = auth.uid() or mr.user_id = auth.uid())
  )
);

drop policy if exists "merchant_notifications_owner_manager_write" on merchant_notifications;
create policy "merchant_notifications_owner_manager_write"
on merchant_notifications for all to authenticated
using (
  exists (
    select 1
    from merchant_accounts ma
    left join merchant_roles mr on mr.merchant_account_id = ma.id
    where ma.id = merchant_notifications.merchant_account_id
      and (
        ma.user_id = auth.uid()
        or (mr.user_id = auth.uid() and mr.role in ('owner', 'manager'))
      )
  )
)
with check (
  exists (
    select 1
    from merchant_accounts ma
    left join merchant_roles mr on mr.merchant_account_id = ma.id
    where ma.id = merchant_notifications.merchant_account_id
      and (
        ma.user_id = auth.uid()
        or (mr.user_id = auth.uid() and mr.role in ('owner', 'manager'))
      )
  )
);

drop policy if exists "merchant_email_outbox_owner_manager_select" on merchant_email_outbox;
create policy "merchant_email_outbox_owner_manager_select"
on merchant_email_outbox for select to authenticated
using (
  exists (
    select 1
    from merchant_accounts ma
    left join merchant_roles mr on mr.merchant_account_id = ma.id
    where ma.id = merchant_email_outbox.merchant_account_id
      and (
        ma.user_id = auth.uid()
        or (mr.user_id = auth.uid() and mr.role in ('owner', 'manager'))
      )
  )
);

drop policy if exists "merchant_email_outbox_owner_manager_insert" on merchant_email_outbox;
create policy "merchant_email_outbox_owner_manager_insert"
on merchant_email_outbox for insert to authenticated
with check (
  exists (
    select 1
    from merchant_accounts ma
    left join merchant_roles mr on mr.merchant_account_id = ma.id
    where ma.id = merchant_email_outbox.merchant_account_id
      and (
        ma.user_id = auth.uid()
        or (mr.user_id = auth.uid() and mr.role in ('owner', 'manager'))
      )
  )
);
