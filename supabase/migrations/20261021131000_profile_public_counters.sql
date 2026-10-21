-- H38: keep user_profiles.dishes_reviewed / stalls_visited true, and server-owned.
--
-- The shared web profile (usehungry.com/user/:id) shows both counters from
-- public_profiles, which copies them from user_profiles. Nothing ever wrote
-- them, so every shared profile said 0 and 0. And users_update_own has no
-- column limit, so a signed-in user could PATCH their own counters to any
-- number and the sync trigger would publish it.
--
-- 1. app_private.refresh_user_profile_counters(user) recomputes both:
--    dishes_reviewed = distinct dishes the user reviewed;
--    stalls_visited  = distinct stalls marked tried (user_stall_interactions)
--                      plus the stalls of reviewed dishes (the app's
--                      "visited stalls" rule, src/features/profile/visitedStalls.ts).
-- 2. Triggers on reviews and user_stall_interactions call it.
-- 3. A BEFORE INSERT/UPDATE trigger on user_profiles keeps client roles
--    (anon, authenticated) from writing the counters; definer code, which runs
--    as the function owner, still can.
-- 4. One-off backfill.

create schema if not exists app_private;

create or replace function app_private.refresh_user_profile_counters(p_user_id uuid)
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  with counts as (
    select
      (
        select count(distinct r.dish_id)::integer
        from public.reviews r
        where r.user_id = p_user_id
      ) as dishes_reviewed,
      (
        select count(distinct visited.stall_id)::integer
        from (
          select usi.stall_id
          from public.user_stall_interactions usi
          where usi.user_id = p_user_id
            and usi.is_tried
          union
          select coalesce(r.venue_id, d.venue_id)
          from public.reviews r
          left join public.dishes d on d.id = r.dish_id
          where r.user_id = p_user_id
        ) visited
        where visited.stall_id is not null
      ) as stalls_visited
  )
  update public.user_profiles up
  set
    dishes_reviewed = counts.dishes_reviewed,
    stalls_visited = counts.stalls_visited
  from counts
  where up.id = p_user_id
    and (
      up.dishes_reviewed is distinct from counts.dishes_reviewed
      or up.stalls_visited is distinct from counts.stalls_visited
    );
$$;

revoke all on function app_private.refresh_user_profile_counters(uuid)
  from public, anon, authenticated;
grant execute on function app_private.refresh_user_profile_counters(uuid) to service_role;

create or replace function app_private.refresh_profile_counters_from_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.user_id is not null then
    perform app_private.refresh_user_profile_counters(old.user_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE')
    and new.user_id is not null
    and (tg_op = 'INSERT' or new.user_id is distinct from old.user_id)
  then
    perform app_private.refresh_user_profile_counters(new.user_id);
  end if;
  return null;
end;
$$;

revoke all on function app_private.refresh_profile_counters_from_review()
  from public, anon, authenticated;

drop trigger if exists trg_reviews_refresh_profile_counters on public.reviews;
create trigger trg_reviews_refresh_profile_counters
  after insert or delete or update of user_id, dish_id, venue_id on public.reviews
  for each row
  execute function app_private.refresh_profile_counters_from_review();

create or replace function app_private.refresh_profile_counters_from_stall_interaction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform app_private.refresh_user_profile_counters(old.user_id);
    return null;
  end if;
  if tg_op = 'INSERT' or new.is_tried is distinct from old.is_tried then
    perform app_private.refresh_user_profile_counters(new.user_id);
  end if;
  return null;
end;
$$;

revoke all on function app_private.refresh_profile_counters_from_stall_interaction()
  from public, anon, authenticated;

drop trigger if exists trg_user_stall_interactions_refresh_profile_counters
  on public.user_stall_interactions;
create trigger trg_user_stall_interactions_refresh_profile_counters
  after insert or delete or update of is_tried on public.user_stall_interactions
  for each row
  execute function app_private.refresh_profile_counters_from_stall_interaction();

-- Client roles cannot set the counters. Definer functions (the refresh above,
-- account deletion) run as their owner, so current_user is not a client role.
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
    else
      new.dishes_reviewed := old.dishes_reviewed;
      new.stalls_visited := old.stalls_visited;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app_private.guard_user_profile_counters()
  from public, anon, authenticated;

drop trigger if exists trg_user_profiles_guard_counters on public.user_profiles;
create trigger trg_user_profiles_guard_counters
  before insert or update on public.user_profiles
  for each row
  execute function app_private.guard_user_profile_counters();

-- Backfill every profile once (only rows whose counters change are written).
do $$
declare
  v_user_id uuid;
begin
  for v_user_id in select id from public.user_profiles loop
    perform app_private.refresh_user_profile_counters(v_user_id);
  end loop;
end $$;
