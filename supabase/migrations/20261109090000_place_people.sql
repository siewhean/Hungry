-- smoke: supabase/smoke/place_people.sql
-- People here (connection plan PR D, approved by the owner 2026-11-08).
--
-- get_place_people(p_venue_id, p_dish_id, p_limit): the diners who reviewed or posted at one
-- stall (p_venue_id) or one dish (p_dish_id), for the "People here" row on the stall and dish
-- pages. People the caller follows come first, then the most reviews and posts there, then the
-- newest. Each row also carries how many people there are in all, so the row can say "and 12
-- others".
--
-- Who is left out: the caller, anyone the caller blocked or who blocked the caller, deactivated
-- accounts, reviews hidden or removed by moderation, and posts the caller cannot read
-- (can_read_post: private accounts, followers-only posts, removed posts). Reviews are public on
-- dish and stall pages already, so a reviewer from a private account is listed by name like on
-- those pages; their profile stays locked.
--
-- Read only, signed in only, VOLATILE (so the rate check runs on every call), rate rule 60 a
-- minute. Exactly one of p_venue_id and p_dish_id: otherwise it returns nothing. p_limit is held
-- to 1..10.
--
-- Rollback: supabase/rollbacks/20261109090000_place_people.down.sql.

create schema if not exists app_private;

create or replace function app_private.get_place_people(
  p_venue_id text default null,
  p_dish_id text default null,
  p_limit integer default 5
)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  is_followed boolean,
  contributions integer,
  total_people integer
)
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  with viewer as (
    select auth.uid() as id
  ),
  place as (
    select nullif(btrim(p_venue_id), '') as venue_id, nullif(btrim(p_dish_id), '') as dish_id
  ),
  signals as (
    select r.user_id as person_id, r.created_at as at
    from public.reviews r
    left join public.dishes d on d.id = r.dish_id
    cross join place pl
    where (
        (pl.dish_id is not null and pl.venue_id is null and r.dish_id = pl.dish_id)
        or (pl.venue_id is not null and pl.dish_id is null
            and coalesce(r.venue_id, d.venue_id) = pl.venue_id)
      )
      and not exists (
        select 1 from public.review_moderation_states rms
        where rms.review_id = r.id and rms.state in ('hidden', 'removed')
      )
    union all
    select p.author_id, p.published_at
    from public.posts p
    left join public.dishes d on d.id = p.dish_id
    cross join place pl
    where (
        (pl.dish_id is not null and pl.venue_id is null and p.dish_id = pl.dish_id)
        or (pl.venue_id is not null and pl.dish_id is null
            and coalesce(p.venue_id, d.venue_id) = pl.venue_id)
      )
      and p.status = 'published'
      and p.deleted_at is null
      and not exists (
        select 1 from public.post_moderation_states pms
        where pms.post_id = p.id and pms.state in ('hidden', 'removed')
      )
      and app_private.can_read_post(p.id)
  ),
  people as (
    select s.person_id, count(*)::integer as contributions, max(s.at) as last_at
    from signals s, viewer v
    where v.id is not null
      and s.person_id is not null
      and s.person_id <> v.id
      and not app_private.app_user_block_exists(v.id, s.person_id)
      and not app_private.account_is_deactivated(s.person_id)
    group by s.person_id
  ),
  ranked as (
    select
      pe.person_id,
      pe.contributions,
      pe.last_at,
      exists (
        select 1 from public.follows f, viewer v
        where f.follower_id = v.id and f.followee_id = pe.person_id and f.status = 'approved'
      ) as is_followed,
      count(*) over ()::integer as total_people
    from people pe
  )
  select
    rk.person_id,
    coalesce(nullif(btrim(up.display_name), ''), 'Hungry User'),
    up.avatar_url,
    rk.is_followed,
    rk.contributions,
    rk.total_people
  from ranked rk
  join public.user_profiles up on up.id = rk.person_id
  order by rk.is_followed desc, rk.contributions desc, rk.last_at desc, rk.person_id
  limit greatest(1, least(coalesce(p_limit, 5), 10));
$$;

revoke all on function app_private.get_place_people(text, text, integer)
  from public, anon, authenticated;
grant execute on function app_private.get_place_people(text, text, integer)
  to authenticated, service_role;

create or replace function public.get_place_people(
  p_venue_id text default null,
  p_dish_id text default null,
  p_limit integer default 5
)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  is_followed boolean,
  contributions integer,
  total_people integer
)
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select * from app_private.get_place_people(p_venue_id, p_dish_id, p_limit);
$$;

revoke all on function public.get_place_people(text, text, integer) from public, anon;
grant execute on function public.get_place_people(text, text, integer)
  to authenticated, service_role;

insert into app_private.request_rate_rules (route, anon_per_minute, user_per_minute, note) values
  ('rpc/get_place_people', null, 60, 'people who reviewed or posted at a stall or dish')
on conflict (route) do nothing;

notify pgrst, 'reload schema';
