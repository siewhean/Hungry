-- Merchant Centre verification schema.
-- Covers: merchant_accounts, merchant_roles, merchant_outlets,
-- merchant_verifications, merchant_verification_evidence.

create table if not exists merchant_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  display_name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_merchant_accounts_user_id
  on merchant_accounts(user_id);

create table if not exists merchant_roles (
  id uuid primary key default gen_random_uuid(),
  merchant_account_id uuid not null references merchant_accounts(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('owner', 'manager', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_account_id, user_id)
);

create index if not exists idx_merchant_roles_account_id
  on merchant_roles(merchant_account_id);
create index if not exists idx_merchant_roles_user_id
  on merchant_roles(user_id);

create table if not exists merchant_outlets (
  id uuid primary key default gen_random_uuid(),
  merchant_account_id uuid not null references merchant_accounts(id) on delete cascade,
  venue_id text references venues(id) on delete set null,
  name text not null,
  business_type text not null check (
    business_type in (
      'hawker_stall',
      'food_court_stall',
      'restaurant',
      'cafe',
      'mall_tenant',
      'home_based'
    )
  ),
  building_id text references buildings(id) on delete set null,
  unit_number text,
  floor text,
  location_privacy text not null default 'approximate'
    check (location_privacy in ('exact', 'approximate', 'hidden')),
  description text not null default '',
  operating_hours text not null default '',
  is_live boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_merchant_outlets_account_id
  on merchant_outlets(merchant_account_id);
create index if not exists idx_merchant_outlets_venue_id
  on merchant_outlets(venue_id);
create index if not exists idx_merchant_outlets_building_id
  on merchant_outlets(building_id);

create table if not exists merchant_verifications (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null unique references merchant_outlets(id) on delete cascade,
  status text not null default 'not_started'
    check (status in (
      'not_started',
      'draft',
      'submitted',
      'in_review',
      'verified',
      'rejected',
      'more_info_needed'
    )),
  method text check (method in (
    'video_walkaround',
    'licence_upload',
    'singpass_myinfo',
    'home_based_declaration'
  )),
  submitted_at timestamptz,
  verified_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_merchant_verifications_outlet_id
  on merchant_verifications(outlet_id);
create index if not exists idx_merchant_verifications_status
  on merchant_verifications(status);

create table if not exists merchant_verification_evidence (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references merchant_verifications(id) on delete cascade,
  method text not null check (method in (
    'video_walkaround',
    'licence_upload',
    'singpass_myinfo',
    'home_based_declaration'
  )),
  file_url text not null,
  uploaded_by uuid,
  uploaded_at timestamptz not null default now(),
  review_note text
);

create index if not exists idx_merchant_verification_evidence_verification_id
  on merchant_verification_evidence(verification_id);

alter table merchant_accounts enable row level security;
alter table merchant_roles enable row level security;
alter table merchant_outlets enable row level security;
alter table merchant_verifications enable row level security;
alter table merchant_verification_evidence enable row level security;

drop policy if exists "merchant_accounts_select_own" on merchant_accounts;
create policy "merchant_accounts_select_own"
on merchant_accounts for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "merchant_accounts_insert_own" on merchant_accounts;
create policy "merchant_accounts_insert_own"
on merchant_accounts for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "merchant_accounts_update_own" on merchant_accounts;
create policy "merchant_accounts_update_own"
on merchant_accounts for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "merchant_roles_select_member_or_owner" on merchant_roles;
create policy "merchant_roles_select_member_or_owner"
on merchant_roles for select to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from merchant_accounts ma
    where ma.id = merchant_roles.merchant_account_id
      and ma.user_id = auth.uid()
  )
);

drop policy if exists "merchant_roles_insert_owner" on merchant_roles;
create policy "merchant_roles_insert_owner"
on merchant_roles for insert to authenticated
with check (
  exists (
    select 1
    from merchant_accounts ma
    where ma.id = merchant_roles.merchant_account_id
      and ma.user_id = auth.uid()
  )
);

drop policy if exists "merchant_roles_update_owner" on merchant_roles;
create policy "merchant_roles_update_owner"
on merchant_roles for update to authenticated
using (
  exists (
    select 1
    from merchant_accounts ma
    where ma.id = merchant_roles.merchant_account_id
      and ma.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from merchant_accounts ma
    where ma.id = merchant_roles.merchant_account_id
      and ma.user_id = auth.uid()
  )
);

drop policy if exists "merchant_roles_delete_owner" on merchant_roles;
create policy "merchant_roles_delete_owner"
on merchant_roles for delete to authenticated
using (
  exists (
    select 1
    from merchant_accounts ma
    where ma.id = merchant_roles.merchant_account_id
      and ma.user_id = auth.uid()
  )
);

drop policy if exists "merchant_outlets_select_member" on merchant_outlets;
create policy "merchant_outlets_select_member"
on merchant_outlets for select to authenticated
using (
  exists (
    select 1
    from merchant_accounts ma
    where ma.id = merchant_outlets.merchant_account_id
      and ma.user_id = auth.uid()
  )
  or exists (
    select 1
    from merchant_roles mr
    where mr.merchant_account_id = merchant_outlets.merchant_account_id
      and mr.user_id = auth.uid()
  )
);

drop policy if exists "merchant_outlets_write_owner_or_manager" on merchant_outlets;
create policy "merchant_outlets_write_owner_or_manager"
on merchant_outlets for all to authenticated
using (
  exists (
    select 1
    from merchant_accounts ma
    where ma.id = merchant_outlets.merchant_account_id
      and ma.user_id = auth.uid()
  )
  or exists (
    select 1
    from merchant_roles mr
    where mr.merchant_account_id = merchant_outlets.merchant_account_id
      and mr.user_id = auth.uid()
      and mr.role in ('owner', 'manager')
  )
)
with check (
  exists (
    select 1
    from merchant_accounts ma
    where ma.id = merchant_outlets.merchant_account_id
      and ma.user_id = auth.uid()
  )
  or exists (
    select 1
    from merchant_roles mr
    where mr.merchant_account_id = merchant_outlets.merchant_account_id
      and mr.user_id = auth.uid()
      and mr.role in ('owner', 'manager')
  )
);

drop policy if exists "merchant_verifications_select_member" on merchant_verifications;
create policy "merchant_verifications_select_member"
on merchant_verifications for select to authenticated
using (
  exists (
    select 1
    from merchant_outlets mo
    left join merchant_accounts ma on ma.id = mo.merchant_account_id
    left join merchant_roles mr on mr.merchant_account_id = mo.merchant_account_id
    where mo.id = merchant_verifications.outlet_id
      and (
        ma.user_id = auth.uid()
        or mr.user_id = auth.uid()
      )
  )
);

drop policy if exists "merchant_verifications_write_owner_or_manager" on merchant_verifications;
create policy "merchant_verifications_write_owner_or_manager"
on merchant_verifications for all to authenticated
using (
  exists (
    select 1
    from merchant_outlets mo
    left join merchant_accounts ma on ma.id = mo.merchant_account_id
    left join merchant_roles mr on mr.merchant_account_id = mo.merchant_account_id
    where mo.id = merchant_verifications.outlet_id
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
    where mo.id = merchant_verifications.outlet_id
      and (
        ma.user_id = auth.uid()
        or (mr.user_id = auth.uid() and mr.role in ('owner', 'manager'))
      )
  )
);

drop policy if exists "merchant_verification_evidence_select_member" on merchant_verification_evidence;
create policy "merchant_verification_evidence_select_member"
on merchant_verification_evidence for select to authenticated
using (
  exists (
    select 1
    from merchant_verifications mv
    join merchant_outlets mo on mo.id = mv.outlet_id
    left join merchant_accounts ma on ma.id = mo.merchant_account_id
    left join merchant_roles mr on mr.merchant_account_id = mo.merchant_account_id
    where mv.id = merchant_verification_evidence.verification_id
      and (
        ma.user_id = auth.uid()
        or mr.user_id = auth.uid()
      )
  )
);

drop policy if exists "merchant_verification_evidence_write_owner_or_manager" on merchant_verification_evidence;
create policy "merchant_verification_evidence_write_owner_or_manager"
on merchant_verification_evidence for all to authenticated
using (
  exists (
    select 1
    from merchant_verifications mv
    join merchant_outlets mo on mo.id = mv.outlet_id
    left join merchant_accounts ma on ma.id = mo.merchant_account_id
    left join merchant_roles mr on mr.merchant_account_id = mo.merchant_account_id
    where mv.id = merchant_verification_evidence.verification_id
      and (
        ma.user_id = auth.uid()
        or (mr.user_id = auth.uid() and mr.role in ('owner', 'manager'))
      )
  )
)
with check (
  exists (
    select 1
    from merchant_verifications mv
    join merchant_outlets mo on mo.id = mv.outlet_id
    left join merchant_accounts ma on ma.id = mo.merchant_account_id
    left join merchant_roles mr on mr.merchant_account_id = mo.merchant_account_id
    where mv.id = merchant_verification_evidence.verification_id
      and (
        ma.user_id = auth.uid()
        or (mr.user_id = auth.uid() and mr.role in ('owner', 'manager'))
      )
  )
);
