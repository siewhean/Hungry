-- auth-L3: the owner could still PATCH user_profiles.favourites_count.
--
-- 20261021131000_profile_public_counters.sql made dishes_reviewed and stalls_visited
-- server-owned with a BEFORE INSERT/UPDATE trigger, but favourites_count (copied to the
-- public public_profiles table by the sync trigger) was left writable through
-- users_update_own. Nothing in the app writes it, so client roles now keep it unchanged
-- too. Definer code (account deletion resets it to 0) runs as its owner and is unaffected.
--
-- Redefines app_private.guard_user_profile_counters(); the trigger already points at it.

create or replace function app_private.guard_user_profile_counters()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.dishes_reviewed := 0;
      new.stalls_visited := 0;
      new.favourites_count := 0;
    else
      new.dishes_reviewed := old.dishes_reviewed;
      new.stalls_visited := old.stalls_visited;
      new.favourites_count := old.favourites_count;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app_private.guard_user_profile_counters()
  from public, anon, authenticated;
