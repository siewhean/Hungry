-- Profile medium M11: finding people, and a length limit on display names.
--
-- 1. search_profiles(query, limit, offset): signed-in people search by display
--    name. Needs at least two characters, returns only people with a public
--    account, never yourself, and never anyone you are blocked from or who
--    blocked you. Private accounts are left out on purpose (their name stays
--    unlisted until a unique handle and an opt-in exist). The body is in
--    app_private (SECURITY DEFINER, so it can read user_profiles); the public
--    name is a SECURITY INVOKER wrapper, granted to signed-in users only.
-- 2. A display name is cut to 40 characters on insert and whenever it changes.
--    A trigger rather than a check constraint, so sign-up from a provider with
--    a long name is never refused and old long names do not make unrelated
--    row updates (counters, avatar) fail. The app limits the field to 40.
--
-- Handles (unique usernames) are not built here: that needs a product decision.

create schema if not exists app_private;
grant usage on schema app_private to anon, authenticated, service_role;

-- 1. search_profiles ---------------------------------------------------------
create index if not exists idx_user_profiles_display_name_trgm
  on public.user_profiles using gin (display_name gin_trgm_ops);

create or replace function app_private.search_profiles(
  p_query text,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (user_id uuid, display_name text, avatar_url text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with q as (
    select btrim(coalesce(p_query, '')) as term
  )
  select up.id, up.display_name, up.avatar_url
  from public.user_profiles up
  cross join q
  left join public.privacy_settings ps on ps.user_id = up.id
  where auth.uid() is not null
    and char_length(q.term) >= 2
    and up.id <> auth.uid()
    and coalesce(ps.account_visibility, 'public') = 'public'
    and up.display_name ilike
      '%' || replace(replace(replace(q.term, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    and not app_private.app_user_block_exists(auth.uid(), up.id)
  order by
    (lower(up.display_name) = lower(q.term)) desc,
    (lower(up.display_name) like lower(
      replace(replace(replace(q.term, '\', '\\'), '%', '\%'), '_', '\_')
    ) || '%') desc,
    up.display_name,
    up.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function app_private.search_profiles(text, integer, integer)
  from public, anon, authenticated;
grant execute on function app_private.search_profiles(text, integer, integer)
  to authenticated, service_role;

create or replace function public.search_profiles(
  p_query text,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (user_id uuid, display_name text, avatar_url text)
language sql
stable
security invoker
set search_path = public, app_private
as $$
  select * from app_private.search_profiles(p_query, p_limit, p_offset);
$$;

revoke all on function public.search_profiles(text, integer, integer) from public, anon;
grant execute on function public.search_profiles(text, integer, integer)
  to authenticated, service_role;

comment on function public.search_profiles(text, integer, integer) is
  'People search by display name for signed-in users: public accounts only, minus self and blocked pairs.';

-- 2. Display name length -----------------------------------------------------
create or replace function app_private.limit_user_profile_display_name()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.display_name is not null then
    new.display_name := left(btrim(new.display_name), 40);
  end if;
  return new;
end;
$$;

revoke all on function app_private.limit_user_profile_display_name()
  from public, anon, authenticated;

drop trigger if exists trg_user_profiles_limit_display_name on public.user_profiles;
create trigger trg_user_profiles_limit_display_name
  before insert or update of display_name on public.user_profiles
  for each row execute function app_private.limit_user_profile_display_name();
