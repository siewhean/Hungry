-- smoke: supabase/smoke/profile_stats_taste_match_favourites.sql
-- Profile rework, server pieces (round four, PROF4-12, PROF4-13, PROF4-14).
--
-- 1. get_my_review_stats(): your review count, average and 1-5 histogram over ALL your reviews,
--    not just the pages loaded on screen. Read-only SECURITY INVOKER (the reviews RLS applies);
--    declared VOLATILE only so the request rate limit can write its counter.
-- 2. get_taste_match(user): a 0-100 score for how close another diner's six taste levels are to
--    yours. Returns the score and nothing else, never their vector. Null for yourself, for a
--    blocked pair, for a private account you do not follow, for a pending-deletion account, and
--    while either of you has not built a taste fingerprint yet. The definer body lives in
--    app_private; public.get_taste_match is an invoker wrapper.
--      score = round(100 - 100 * mean(|your level - their level|) / 6), floored at 0
--    (identical tastes 100, an average gap of 3 levels 50, a gap of 6 or more 0).
-- 3. profile_favourite_dishes: up to four dishes pinned on a profile, picked from the dishes the
--    owner saved or reviewed. Readable wherever the owner's profile content is readable
--    (app_private.can_read_author_content); written only through
--    set_profile_favourite_dishes, which takes a per-user lock so two taps cannot interleave.
-- Rollback: supabase/rollbacks/20261028100000_profile_stats_taste_match_favourites.down.sql.

-- 1. Review stats ------------------------------------------------------------------------

create or replace function public.get_my_review_stats()
returns table (
  review_count integer,
  average_rating numeric,
  rating_1 integer,
  rating_2 integer,
  rating_3 integer,
  rating_4 integer,
  rating_5 integer
)
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select
    count(*)::integer,
    round(avg(r.rating), 1),
    (count(*) filter (where greatest(1, least(5, round(r.rating)::integer)) = 1))::integer,
    (count(*) filter (where greatest(1, least(5, round(r.rating)::integer)) = 2))::integer,
    (count(*) filter (where greatest(1, least(5, round(r.rating)::integer)) = 3))::integer,
    (count(*) filter (where greatest(1, least(5, round(r.rating)::integer)) = 4))::integer,
    (count(*) filter (where greatest(1, least(5, round(r.rating)::integer)) = 5))::integer
  from public.reviews r
  where r.user_id = (select auth.uid());
$$;

revoke all on function public.get_my_review_stats() from public, anon;
grant execute on function public.get_my_review_stats() to authenticated, service_role;

comment on function public.get_my_review_stats() is
  'Count, average and 1-5 histogram over all of the caller''s reviews.';

-- 2. Taste match -------------------------------------------------------------------------

create or replace function app_private.get_taste_match(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_viewer uuid := auth.uid();
  v_score integer;
begin
  if v_viewer is null or p_user_id is null or p_user_id = v_viewer then
    return null;
  end if;
  -- Blocked pairs, private accounts the viewer does not follow and pending-deletion accounts.
  if not app_private.can_read_author_content(p_user_id) then
    return null;
  end if;

  select
    case
      when greatest(
             abs(a.sweet - 5), abs(a.spicy - 5), abs(a.sour - 5),
             abs(a.salty - 5), abs(a.rich - 5), abs(a.aromatic - 5)
           ) >= 1
       and greatest(
             abs(b.sweet - 5), abs(b.spicy - 5), abs(b.sour - 5),
             abs(b.salty - 5), abs(b.rich - 5), abs(b.aromatic - 5)
           ) >= 1
      then greatest(
             0,
             round(
               100 - 100 * (
                 abs(a.sweet - b.sweet) + abs(a.spicy - b.spicy) + abs(a.sour - b.sour)
                 + abs(a.salty - b.salty) + abs(a.rich - b.rich) + abs(a.aromatic - b.aromatic)
               ) / 36.0
             )
           )::integer
    end
  into v_score
  from public.user_taste_vectors a
  join public.user_taste_vectors b on b.user_id = p_user_id
  where a.user_id = v_viewer;

  return v_score;
end;
$$;

revoke all on function app_private.get_taste_match(uuid) from public, anon, authenticated;
grant execute on function app_private.get_taste_match(uuid) to authenticated, service_role;

create or replace function public.get_taste_match(p_user_id uuid)
returns integer
language sql
volatile
security invoker
set search_path = public, app_private
as $$
  select app_private.get_taste_match(p_user_id);
$$;

revoke all on function public.get_taste_match(uuid) from public, anon;
grant execute on function public.get_taste_match(uuid) to authenticated, service_role;

comment on function public.get_taste_match(uuid) is
  '0-100 closeness of the caller''s taste to another diner''s. Score only; null when it cannot be shown.';

-- 3. Favourite dishes --------------------------------------------------------------------

create table if not exists public.profile_favourite_dishes (
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  dish_id text not null references public.dishes(id) on delete cascade,
  position smallint not null check (position between 1 and 4),
  created_at timestamptz not null default now(),
  primary key (user_id, position),
  unique (user_id, dish_id)
);

alter table public.profile_favourite_dishes enable row level security;

revoke all on public.profile_favourite_dishes from anon, authenticated;
grant select on public.profile_favourite_dishes to anon, authenticated;

drop policy if exists profile_favourite_dishes_select_visible on public.profile_favourite_dishes;
create policy profile_favourite_dishes_select_visible on public.profile_favourite_dishes
  for select to anon, authenticated
  using (app_private.can_read_author_content(user_id));

-- Replaces the caller's pinned dishes (at most four, in the order given). One lock per user
-- makes the delete-and-insert atomic against a second tap or a second device.
create or replace function app_private.set_profile_favourite_dishes(p_dish_ids text[])
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_ids text[];
begin
  if v_user is null then
    raise exception 'sign in to pin dishes' using errcode = '42501';
  end if;

  -- First occurrence of each id wins; blanks are dropped.
  select coalesce(array_agg(s.id order by s.first_position), '{}')
  into v_ids
  from (
    select t.id, min(t.position) as first_position
    from unnest(coalesce(p_dish_ids, '{}')) with ordinality as t(id, position)
    where t.id is not null and btrim(t.id) <> ''
    group by t.id
  ) s;

  if cardinality(v_ids) > 4 then
    raise exception 'pin at most 4 dishes' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('profile_favourite_dishes:' || v_user::text, 0));

  -- Only dishes the caller saved or reviewed can be pinned.
  if exists (
    select 1
    from unnest(v_ids) as d(id)
    where not exists (
            select 1 from public.user_favourite_dishes f
            where f.user_id = v_user and f.dish_id = d.id
          )
      and not exists (
            select 1 from public.reviews r
            where r.user_id = v_user and r.dish_id = d.id
          )
  ) then
    raise exception 'pin dishes you saved or reviewed' using errcode = '22023';
  end if;

  delete from public.profile_favourite_dishes where user_id = v_user;

  insert into public.profile_favourite_dishes (user_id, dish_id, position)
  select v_user, d.id, d.position::smallint
  from unnest(v_ids) with ordinality as d(id, position);
end;
$$;

revoke all on function app_private.set_profile_favourite_dishes(text[]) from public, anon, authenticated;
grant execute on function app_private.set_profile_favourite_dishes(text[]) to authenticated, service_role;

create or replace function public.set_profile_favourite_dishes(p_dish_ids text[])
returns void
language sql
volatile
security invoker
set search_path = public, app_private
as $$
  select app_private.set_profile_favourite_dishes(p_dish_ids);
$$;

revoke all on function public.set_profile_favourite_dishes(text[]) from public, anon;
grant execute on function public.set_profile_favourite_dishes(text[]) to authenticated, service_role;

comment on function public.set_profile_favourite_dishes(text[]) is
  'Pins up to four saved or reviewed dishes on the caller''s profile, replacing the previous pins.';

-- Rate limits (signed-in callers only; nothing here is callable by anon).
insert into app_private.request_rate_rules (route, anon_per_minute, user_per_minute, note) values
  ('rpc/get_my_review_stats', null, 30, 'own review stats on Review history'),
  ('rpc/get_taste_match', null, 30, 'taste match on another profile; score only'),
  ('rpc/set_profile_favourite_dishes', null, 20, 'pin or reorder favourite dishes')
on conflict (route) do nothing;

notify pgrst, 'reload schema';
