-- Resolve Supabase Security Advisor findings:
-- 1) public.public_profiles must not be a security-definer view.
-- 2) public.spatial_ref_sys should have RLS when the extension owner permits it.
--
-- public_profiles becomes a safe-column table with RLS and a private trigger
-- sync from user_profiles. This avoids opening raw user_profiles columns while
-- removing the security-definer view.

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

do $$
declare
  public_profiles_kind "char";
begin
  select c.relkind
    into public_profiles_kind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'public_profiles';

  if public_profiles_kind = 'v' then
    execute 'drop view public.public_profiles';
  elsif public_profiles_kind is not null and public_profiles_kind <> 'r' then
    raise exception
      'public.public_profiles exists with unsupported relkind %',
      public_profiles_kind;
  end if;
end
$$;

create table if not exists public.public_profiles (
  id uuid primary key references public.user_profiles(id) on delete cascade,
  display_name text,
  avatar_url text,
  dishes_reviewed integer not null default 0,
  stalls_visited integer not null default 0,
  favourites_count integer not null default 0,
  created_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.public_profiles enable row level security;

revoke all on public.public_profiles from anon, authenticated;
grant select on public.public_profiles to anon, authenticated;

drop policy if exists public_profiles_select_visible on public.public_profiles;
create policy public_profiles_select_visible
on public.public_profiles for select
to anon, authenticated
using (public.can_read_author_content(id));

drop policy if exists public_profiles_service_role_all on public.public_profiles;
create policy public_profiles_service_role_all
on public.public_profiles for all
to service_role
using (true)
with check (true);

insert into public.public_profiles (
  id,
  display_name,
  avatar_url,
  dishes_reviewed,
  stalls_visited,
  favourites_count,
  created_at,
  updated_at
)
select
  up.id,
  up.display_name,
  up.avatar_url,
  up.dishes_reviewed,
  up.stalls_visited,
  up.favourites_count,
  up.created_at,
  now()
from public.user_profiles up
on conflict (id) do update set
  display_name = excluded.display_name,
  avatar_url = excluded.avatar_url,
  dishes_reviewed = excluded.dishes_reviewed,
  stalls_visited = excluded.stalls_visited,
  favourites_count = excluded.favourites_count,
  created_at = excluded.created_at,
  updated_at = now();

create or replace function app_private.sync_public_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.public_profiles where id = old.id;
    return old;
  end if;

  insert into public.public_profiles (
    id,
    display_name,
    avatar_url,
    dishes_reviewed,
    stalls_visited,
    favourites_count,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.display_name,
    new.avatar_url,
    new.dishes_reviewed,
    new.stalls_visited,
    new.favourites_count,
    new.created_at,
    now()
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    dishes_reviewed = excluded.dishes_reviewed,
    stalls_visited = excluded.stalls_visited,
    favourites_count = excluded.favourites_count,
    created_at = excluded.created_at,
    updated_at = now();

  return new;
end;
$$;

revoke all on function app_private.sync_public_profile() from public, anon, authenticated;

drop trigger if exists trg_sync_public_profiles on public.user_profiles;
create trigger trg_sync_public_profiles
after insert or update or delete on public.user_profiles
for each row
execute function app_private.sync_public_profile();

do $$
begin
  if to_regclass('public.spatial_ref_sys') is not null then
    begin
      execute 'alter table public.spatial_ref_sys enable row level security';
      execute 'drop policy if exists spatial_ref_sys_read_all on public.spatial_ref_sys';
      execute 'create policy spatial_ref_sys_read_all on public.spatial_ref_sys for select using (true)';
    exception
      when insufficient_privilege then
        raise notice
          'Skipping spatial_ref_sys RLS hardening because public.spatial_ref_sys is owned by the PostGIS extension owner.';
    end;
  end if;
end
$$;
