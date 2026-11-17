-- Merchant organization compatibility foundation.
-- Adds organization/member structure beside the legacy merchant account model.
-- Existing merchant_accounts, merchant_roles, merchant_outlets, and merchant
-- service writes remain the active app-facing path for this slice.

create table if not exists merchant_organizations (
  id uuid primary key default gen_random_uuid(),
  legacy_merchant_account_id uuid unique references merchant_accounts(id) on delete set null,
  display_name text not null check (length(btrim(display_name)) > 0),
  legal_name text,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists merchant_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references merchant_organizations(id) on delete cascade,
  user_id uuid,
  email citext,
  display_name text,
  role text not null check (
    role in ('owner', 'manager', 'staff', 'ops', 'accountant', 'viewer')
  ),
  status text not null default 'invited'
    check (status in ('invited', 'active', 'removed')),
  invited_by uuid,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or email is not null)
);

create table if not exists merchant_organization_outlets (
  organization_id uuid not null references merchant_organizations(id) on delete cascade,
  outlet_id uuid not null references merchant_outlets(id) on delete cascade,
  source text not null default 'manual'
    check (source in ('legacy_account_backfill', 'manual', 'claim_conversion', 'admin')),
  created_at timestamptz not null default now(),
  primary key (organization_id, outlet_id)
);

create index if not exists idx_merchant_organizations_legacy_account
  on merchant_organizations(legacy_merchant_account_id)
  where legacy_merchant_account_id is not null;
create index if not exists idx_merchant_organizations_status_created
  on merchant_organizations(status, created_at desc);

create unique index if not exists merchant_members_org_user_unique
  on merchant_members(organization_id, user_id)
  where user_id is not null;
create unique index if not exists merchant_members_org_email_unique
  on merchant_members(organization_id, email)
  where email is not null;
create index if not exists idx_merchant_members_org_role_status
  on merchant_members(organization_id, role, status);
create index if not exists idx_merchant_members_user_status
  on merchant_members(user_id, status)
  where user_id is not null;
create index if not exists idx_merchant_members_email_status
  on merchant_members(email, status)
  where email is not null;

create index if not exists idx_merchant_organization_outlets_outlet
  on merchant_organization_outlets(outlet_id);
create index if not exists idx_merchant_organization_outlets_org_source
  on merchant_organization_outlets(organization_id, source);

drop trigger if exists trg_merchant_organizations_updated_at on merchant_organizations;
create trigger trg_merchant_organizations_updated_at
  before update on merchant_organizations
  for each row execute function public.set_updated_at();

drop trigger if exists trg_merchant_members_updated_at on merchant_members;
create trigger trg_merchant_members_updated_at
  before update on merchant_members
  for each row execute function public.set_updated_at();

insert into merchant_organizations (
  legacy_merchant_account_id,
  display_name,
  status,
  metadata,
  created_by
)
select
  merchant_accounts.id,
  merchant_accounts.display_name,
  'active',
  jsonb_build_object('source', '0035_legacy_account_backfill'),
  merchant_accounts.user_id
from merchant_accounts
on conflict (legacy_merchant_account_id) do update
set
  display_name = excluded.display_name,
  metadata = merchant_organizations.metadata || excluded.metadata,
  updated_at = now();

insert into merchant_members (
  organization_id,
  user_id,
  email,
  display_name,
  role,
  status,
  accepted_at
)
select
  merchant_organizations.id,
  merchant_accounts.user_id,
  merchant_accounts.email::citext,
  merchant_accounts.display_name,
  'owner',
  'active',
  now()
from merchant_organizations
join merchant_accounts
  on merchant_accounts.id = merchant_organizations.legacy_merchant_account_id
where merchant_accounts.user_id is not null
on conflict (organization_id, user_id) where user_id is not null do update
set
  role = 'owner',
  status = 'active',
  email = coalesce(excluded.email, merchant_members.email),
  display_name = coalesce(excluded.display_name, merchant_members.display_name),
  accepted_at = coalesce(merchant_members.accepted_at, excluded.accepted_at),
  updated_at = now();

insert into merchant_members (
  organization_id,
  user_id,
  email,
  display_name,
  role,
  status,
  accepted_at
)
select
  merchant_organizations.id,
  merchant_roles.user_id,
  merchant_roles.email,
  coalesce(merchant_roles.display_name, merchant_accounts.display_name),
  merchant_roles.role,
  case when merchant_roles.user_id is null then 'invited' else 'active' end,
  case when merchant_roles.user_id is null then null else now() end
from merchant_organizations
join merchant_accounts
  on merchant_accounts.id = merchant_organizations.legacy_merchant_account_id
join merchant_roles
  on merchant_roles.merchant_account_id = merchant_accounts.id
where merchant_roles.user_id is not null
on conflict (organization_id, user_id) where user_id is not null do update
set
  role = case
    when merchant_members.role = 'owner' then merchant_members.role
    else excluded.role
  end,
  status = case
    when merchant_members.status = 'removed' then merchant_members.status
    else excluded.status
  end,
  email = coalesce(excluded.email, merchant_members.email),
  display_name = coalesce(excluded.display_name, merchant_members.display_name),
  accepted_at = coalesce(merchant_members.accepted_at, excluded.accepted_at),
  updated_at = now();

insert into merchant_members (
  organization_id,
  email,
  display_name,
  role,
  status
)
select
  merchant_organizations.id,
  merchant_roles.email,
  coalesce(merchant_roles.display_name, merchant_accounts.display_name),
  merchant_roles.role,
  'invited'
from merchant_organizations
join merchant_accounts
  on merchant_accounts.id = merchant_organizations.legacy_merchant_account_id
join merchant_roles
  on merchant_roles.merchant_account_id = merchant_accounts.id
where merchant_roles.user_id is null
  and merchant_roles.email is not null
on conflict (organization_id, email) where email is not null do update
set
  role = case
    when merchant_members.role = 'owner' then merchant_members.role
    else excluded.role
  end,
  status = case
    when merchant_members.status = 'removed' then merchant_members.status
    else excluded.status
  end,
  display_name = coalesce(excluded.display_name, merchant_members.display_name),
  updated_at = now();

insert into merchant_organization_outlets (
  organization_id,
  outlet_id,
  source
)
select
  merchant_organizations.id,
  merchant_outlets.id,
  'legacy_account_backfill'
from merchant_organizations
join merchant_outlets
  on merchant_outlets.merchant_account_id = merchant_organizations.legacy_merchant_account_id
on conflict (organization_id, outlet_id) do nothing;

create or replace function public.merchant_is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from merchant_members
    where merchant_members.organization_id = p_organization_id
      and merchant_members.status = 'active'
      and (
        merchant_members.user_id = auth.uid()
        or (
          merchant_members.user_id is null
          and merchant_members.email is not null
          and merchant_members.email = nullif(auth.jwt() ->> 'email', '')::citext
        )
      )
  );
$$;

create or replace function public.merchant_can_view_organization(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from merchant_organizations
    left join merchant_accounts
      on merchant_accounts.id = merchant_organizations.legacy_merchant_account_id
    left join merchant_roles
      on merchant_roles.merchant_account_id = merchant_organizations.legacy_merchant_account_id
    where merchant_organizations.id = p_organization_id
      and (
        merchant_accounts.user_id = auth.uid()
        or merchant_roles.user_id = auth.uid()
        or public.merchant_is_org_member(merchant_organizations.id)
      )
  );
$$;

create or replace function public.merchant_can_manage_organization(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from merchant_organizations
    left join merchant_accounts
      on merchant_accounts.id = merchant_organizations.legacy_merchant_account_id
    left join merchant_roles
      on merchant_roles.merchant_account_id = merchant_organizations.legacy_merchant_account_id
        and merchant_roles.role in ('owner', 'manager')
    where merchant_organizations.id = p_organization_id
      and (
        merchant_accounts.user_id = auth.uid()
        or merchant_roles.user_id = auth.uid()
        or exists (
          select 1
          from merchant_members
          where merchant_members.organization_id = merchant_organizations.id
            and merchant_members.status = 'active'
            and merchant_members.role in ('owner', 'manager', 'ops')
            and (
              merchant_members.user_id = auth.uid()
              or (
                merchant_members.user_id is null
                and merchant_members.email is not null
                and merchant_members.email = nullif(auth.jwt() ->> 'email', '')::citext
              )
            )
        )
      )
  );
$$;

create or replace function public.merchant_can_manage_legacy_outlet(p_outlet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from merchant_outlets
    left join merchant_accounts
      on merchant_accounts.id = merchant_outlets.merchant_account_id
    left join merchant_roles
      on merchant_roles.merchant_account_id = merchant_outlets.merchant_account_id
        and merchant_roles.role in ('owner', 'manager')
    where merchant_outlets.id = p_outlet_id
      and (
        merchant_accounts.user_id = auth.uid()
        or merchant_roles.user_id = auth.uid()
      )
  );
$$;

create or replace function public.merchant_can_manage_outlet_v2(p_outlet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.merchant_can_manage_legacy_outlet(p_outlet_id)
    or exists (
      select 1
      from merchant_organization_outlets
      where merchant_organization_outlets.outlet_id = p_outlet_id
        and public.merchant_can_manage_organization(
          merchant_organization_outlets.organization_id
        )
    );
$$;

alter table merchant_organizations enable row level security;
alter table merchant_members enable row level security;
alter table merchant_organization_outlets enable row level security;

drop policy if exists "merchant_organizations_service_role_all" on merchant_organizations;
create policy "merchant_organizations_service_role_all"
on merchant_organizations for all to service_role
using (true)
with check (true);

drop policy if exists "merchant_members_service_role_all" on merchant_members;
create policy "merchant_members_service_role_all"
on merchant_members for all to service_role
using (true)
with check (true);

drop policy if exists "merchant_organization_outlets_service_role_all" on merchant_organization_outlets;
create policy "merchant_organization_outlets_service_role_all"
on merchant_organization_outlets for all to service_role
using (true)
with check (true);

drop policy if exists "merchant_organizations_select_member" on merchant_organizations;
create policy "merchant_organizations_select_member"
on merchant_organizations for select to authenticated
using (public.merchant_can_view_organization(id));

drop policy if exists "merchant_members_select_org_member" on merchant_members;
create policy "merchant_members_select_org_member"
on merchant_members for select to authenticated
using (public.merchant_can_view_organization(organization_id));

drop policy if exists "merchant_members_insert_manager" on merchant_members;
create policy "merchant_members_insert_manager"
on merchant_members for insert to authenticated
with check (
  public.merchant_can_manage_organization(organization_id)
  and role in ('manager', 'staff', 'ops', 'accountant', 'viewer')
  and status in ('invited', 'active')
);

drop policy if exists "merchant_members_update_manager" on merchant_members;
create policy "merchant_members_update_manager"
on merchant_members for update to authenticated
using (
  public.merchant_can_manage_organization(organization_id)
  and role <> 'owner'
)
with check (
  public.merchant_can_manage_organization(organization_id)
  and role <> 'owner'
);

drop policy if exists "merchant_members_delete_manager" on merchant_members;
create policy "merchant_members_delete_manager"
on merchant_members for delete to authenticated
using (
  public.merchant_can_manage_organization(organization_id)
  and role <> 'owner'
);

drop policy if exists "merchant_organization_outlets_select_member" on merchant_organization_outlets;
create policy "merchant_organization_outlets_select_member"
on merchant_organization_outlets for select to authenticated
using (public.merchant_can_view_organization(organization_id));

drop policy if exists "merchant_organization_outlets_insert_manager" on merchant_organization_outlets;
create policy "merchant_organization_outlets_insert_manager"
on merchant_organization_outlets for insert to authenticated
with check (
  public.merchant_can_manage_organization(organization_id)
  and public.merchant_can_manage_legacy_outlet(outlet_id)
);

drop policy if exists "merchant_organization_outlets_delete_manager" on merchant_organization_outlets;
create policy "merchant_organization_outlets_delete_manager"
on merchant_organization_outlets for delete to authenticated
using (
  public.merchant_can_manage_organization(organization_id)
  and public.merchant_can_manage_legacy_outlet(outlet_id)
);

revoke all on table merchant_organizations from anon, authenticated;
revoke all on table merchant_members from anon, authenticated;
revoke all on table merchant_organization_outlets from anon, authenticated;
grant select on table merchant_organizations to authenticated;
grant select, insert, update, delete on table merchant_members to authenticated;
grant select, insert, delete on table merchant_organization_outlets to authenticated;
grant all on table merchant_organizations to service_role;
grant all on table merchant_members to service_role;
grant all on table merchant_organization_outlets to service_role;

revoke execute on function public.merchant_is_org_member(uuid) from public;
revoke execute on function public.merchant_can_view_organization(uuid) from public;
revoke execute on function public.merchant_can_manage_organization(uuid) from public;
revoke execute on function public.merchant_can_manage_legacy_outlet(uuid) from public;
revoke execute on function public.merchant_can_manage_outlet_v2(uuid) from public;
grant execute on function public.merchant_is_org_member(uuid) to authenticated, service_role;
grant execute on function public.merchant_can_view_organization(uuid) to authenticated, service_role;
grant execute on function public.merchant_can_manage_organization(uuid) to authenticated, service_role;
grant execute on function public.merchant_can_manage_legacy_outlet(uuid) to authenticated, service_role;
grant execute on function public.merchant_can_manage_outlet_v2(uuid) to authenticated, service_role;

comment on table merchant_organizations is
  'Organization compatibility root for future multi-outlet merchant readiness; legacy merchant_accounts remains the app-facing root in this slice.';
comment on table merchant_members is
  'Organization members with expanded merchant roles. Existing merchant_roles remains supported for app compatibility.';
comment on table merchant_organization_outlets is
  'Bridge between organization membership and existing merchant_outlets.';
comment on function public.merchant_can_manage_outlet_v2(uuid) is
  'Compatibility helper for future outlet policies. Existing merchant_can_manage_venue remains unchanged in DB-P0-06.';
