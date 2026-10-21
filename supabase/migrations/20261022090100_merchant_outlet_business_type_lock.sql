-- merchant-M2: business_type (hawker stall, home-based, ...) is part of what verification
-- checked. Once an outlet is verified, only ops (or a service job) may change it; a merchant who
-- needs a different type resubmits verification.
-- New trigger only: public.enforce_merchant_outlet_link_guard() is not redefined.

create schema if not exists app_private;

create or replace function app_private.enforce_merchant_outlet_business_type_lock()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if new.business_type is not distinct from old.business_type then
    return new;
  end if;

  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if public.app_is_current_user_ops_admin() then
    return new;
  end if;

  if app_private.merchant_outlet_is_verified_for_caller(old.id) then
    raise exception 'business type cannot be changed on a verified outlet' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function app_private.enforce_merchant_outlet_business_type_lock() from public, anon;

drop trigger if exists trg_enforce_merchant_outlet_business_type_lock on public.merchant_outlets;
create trigger trg_enforce_merchant_outlet_business_type_lock
before update of business_type on public.merchant_outlets
for each row
execute function app_private.enforce_merchant_outlet_business_type_lock();
