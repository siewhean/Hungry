-- Merchant Centre live-service linkage.
-- Connects merchant-owned outlet/menu actions to the same venue/dish/review rows
-- consumed by the non-merchant app.

alter table merchant_roles
  alter column user_id drop not null;

alter table merchant_roles
  add column if not exists email citext,
  add column if not exists display_name text;

alter table reviews
  add column if not exists merchant_reply_text text,
  add column if not exists merchant_replied_at timestamptz;

create table if not exists merchant_promotions (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references merchant_outlets(id) on delete cascade,
  title text not null,
  description text not null default '',
  target_dish_id text references dishes(id) on delete set null,
  start_date timestamptz not null,
  end_date timestamptz not null,
  target_audience text[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'active', 'ended')),
  impressions integer not null default 0,
  clicks integer not null default 0,
  saves integer not null default 0,
  profile_visits integer not null default 0,
  dish_views integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_merchant_promotions_outlet_status
  on merchant_promotions(outlet_id, status, created_at desc);

create table if not exists customer_interaction_reports (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null references reviews(id) on delete cascade,
  reason text not null,
  reported_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists merchant_notification_preferences (
  merchant_account_id uuid primary key references merchant_accounts(id) on delete cascade,
  new_reviews boolean not null default true,
  low_rating_alerts boolean not null default true,
  new_comments boolean not null default true,
  promotion_updates boolean not null default true,
  weekly_digest boolean not null default true,
  ai_insights boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table merchant_promotions enable row level security;
alter table customer_interaction_reports enable row level security;
alter table merchant_notification_preferences enable row level security;

drop policy if exists "venues_update_merchant_owner_or_manager" on venues;
create policy "venues_update_merchant_owner_or_manager"
on venues for update to authenticated
using (
  exists (
    select 1
    from merchant_outlets mo
    left join merchant_accounts ma on ma.id = mo.merchant_account_id
    left join merchant_roles mr on mr.merchant_account_id = mo.merchant_account_id
    where mo.venue_id = venues.id
      and (
        ma.user_id = auth.uid()
        or (mr.user_id = auth.uid() and mr.role in ('owner', 'manager'))
      )
  )
)
with check (
  exists (
    select 1
    from merchant_outlets mo
    left join merchant_accounts ma on ma.id = mo.merchant_account_id
    left join merchant_roles mr on mr.merchant_account_id = mo.merchant_account_id
    where mo.venue_id = venues.id
      and (
        ma.user_id = auth.uid()
        or (mr.user_id = auth.uid() and mr.role in ('owner', 'manager'))
      )
  )
);

drop policy if exists "dishes_write_merchant_owner_or_manager" on dishes;
create policy "dishes_write_merchant_owner_or_manager"
on dishes for all to authenticated
using (
  exists (
    select 1
    from merchant_outlets mo
    left join merchant_accounts ma on ma.id = mo.merchant_account_id
    left join merchant_roles mr on mr.merchant_account_id = mo.merchant_account_id
    where mo.venue_id = dishes.venue_id
      and (
        ma.user_id = auth.uid()
        or (mr.user_id = auth.uid() and mr.role in ('owner', 'manager'))
      )
  )
)
with check (
  exists (
    select 1
    from merchant_outlets mo
    left join merchant_accounts ma on ma.id = mo.merchant_account_id
    left join merchant_roles mr on mr.merchant_account_id = mo.merchant_account_id
    where mo.venue_id = dishes.venue_id
      and (
        ma.user_id = auth.uid()
        or (mr.user_id = auth.uid() and mr.role in ('owner', 'manager'))
      )
  )
);

drop policy if exists "reviews_update_merchant_reply_owner_or_manager" on reviews;
create policy "reviews_update_merchant_reply_owner_or_manager"
on reviews for update to authenticated
using (
  exists (
    select 1
    from merchant_outlets mo
    left join merchant_accounts ma on ma.id = mo.merchant_account_id
    left join merchant_roles mr on mr.merchant_account_id = mo.merchant_account_id
    where mo.venue_id = reviews.venue_id
      and (
        ma.user_id = auth.uid()
        or (mr.user_id = auth.uid() and mr.role in ('owner', 'manager'))
      )
  )
)
with check (
  exists (
    select 1
    from merchant_outlets mo
    left join merchant_accounts ma on ma.id = mo.merchant_account_id
    left join merchant_roles mr on mr.merchant_account_id = mo.merchant_account_id
    where mo.venue_id = reviews.venue_id
      and (
        ma.user_id = auth.uid()
        or (mr.user_id = auth.uid() and mr.role in ('owner', 'manager'))
      )
  )
);

drop policy if exists "merchant_promotions_member_select" on merchant_promotions;
create policy "merchant_promotions_member_select"
on merchant_promotions for select to authenticated
using (
  exists (
    select 1
    from merchant_outlets mo
    left join merchant_accounts ma on ma.id = mo.merchant_account_id
    left join merchant_roles mr on mr.merchant_account_id = mo.merchant_account_id
    where mo.id = merchant_promotions.outlet_id
      and (ma.user_id = auth.uid() or mr.user_id = auth.uid())
  )
);

drop policy if exists "merchant_promotions_write_owner_or_manager" on merchant_promotions;
create policy "merchant_promotions_write_owner_or_manager"
on merchant_promotions for all to authenticated
using (
  exists (
    select 1
    from merchant_outlets mo
    left join merchant_accounts ma on ma.id = mo.merchant_account_id
    left join merchant_roles mr on mr.merchant_account_id = mo.merchant_account_id
    where mo.id = merchant_promotions.outlet_id
      and (
        ma.user_id = auth.uid()
        or (mr.user_id = auth.uid() and mr.role in ('owner', 'manager'))
      )
  )
)
with check (
  exists (
    select 1
    from merchant_outlets mo
    left join merchant_accounts ma on ma.id = mo.merchant_account_id
    left join merchant_roles mr on mr.merchant_account_id = mo.merchant_account_id
    where mo.id = merchant_promotions.outlet_id
      and (
        ma.user_id = auth.uid()
        or (mr.user_id = auth.uid() and mr.role in ('owner', 'manager'))
      )
  )
);

drop policy if exists "interaction_reports_insert_authenticated" on customer_interaction_reports;
create policy "interaction_reports_insert_authenticated"
on customer_interaction_reports for insert to authenticated
with check (auth.uid() = reported_by or reported_by is null);

drop policy if exists "notification_prefs_member" on merchant_notification_preferences;
create policy "notification_prefs_member"
on merchant_notification_preferences for all to authenticated
using (
  exists (
    select 1
    from merchant_accounts ma
    left join merchant_roles mr on mr.merchant_account_id = ma.id
    where ma.id = merchant_notification_preferences.merchant_account_id
      and (ma.user_id = auth.uid() or mr.user_id = auth.uid())
  )
)
with check (
  exists (
    select 1
    from merchant_accounts ma
    left join merchant_roles mr on mr.merchant_account_id = ma.id
    where ma.id = merchant_notification_preferences.merchant_account_id
      and (ma.user_id = auth.uid() or mr.user_id = auth.uid())
  )
);
