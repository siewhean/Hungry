-- Profile bio (decision 20): an optional short bio of up to 150 characters.
-- user_profiles.bio is written by the owner through the existing
-- profile_update_own / users_update_own policies. public_profiles (the
-- safe-column copy readable under can_read_author_content) gets the same
-- column so other users and the public web profile page can show it.
-- No new grants: public_profiles already has its select grant.

alter table public.user_profiles
  add column if not exists bio text;

alter table public.user_profiles
  drop constraint if exists user_profiles_bio_length;
alter table public.user_profiles
  add constraint user_profiles_bio_length
  check (bio is null or char_length(bio) <= 150);

alter table public.public_profiles
  add column if not exists bio text;

alter table public.public_profiles
  drop constraint if exists public_profiles_bio_length;
alter table public.public_profiles
  add constraint public_profiles_bio_length
  check (bio is null or char_length(bio) <= 150);

-- Same trigger body as 20260522124728, plus bio.
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
    bio,
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
    new.bio,
    new.dishes_reviewed,
    new.stalls_visited,
    new.favourites_count,
    new.created_at,
    now()
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    bio = excluded.bio,
    dishes_reviewed = excluded.dishes_reviewed,
    stalls_visited = excluded.stalls_visited,
    favourites_count = excluded.favourites_count,
    created_at = excluded.created_at,
    updated_at = now();

  return new;
end;
$$;

revoke all on function app_private.sync_public_profile() from public, anon, authenticated;

-- Backfill any bio already present (none expected on first apply).
update public.public_profiles pp
set bio = up.bio
from public.user_profiles up
where up.id = pp.id
  and pp.bio is distinct from up.bio;
