-- smoke: supabase/smoke/portfolio_ranking.sql
-- Food Portfolio ranking beyond the top three, and the rank label on reviews (owner ask
-- 2026-11-09).
--
-- 1. user_profiles.pinned_post_ids is now a full ranking: up to 200 of the owner's own posts, best
--    first. The first three are still the portfolio's top three (get_food_portfolio_top_posts is
--    unchanged and still reads three). The "at most three" check becomes "at most 200", and
--    set_pinned_posts now sets only the top three and keeps the dishes ranked below it.
-- 2. rank_portfolio_post(post, position): puts one of the caller's own published posts at a place
--    in the ranking (1 = first; a place past the end goes last), moving it if it was already
--    ranked. One UPDATE that rebuilds the array from the committed row, so two overlapping calls
--    cannot lose each other's change and the phone never reads the list and writes it back.
-- 3. get_review_portfolio_ranks(review ids): for up to 50 reviews at once, the place (1-3) the
--    review's dish holds in its author's ranking, and how many dishes that portfolio has. Only
--    reviews whose author has at least 5 dishes and ranks that dish in their top three come
--    back, and only when the viewer can read the ranked post (private accounts and blocks).
--
-- get_my_portfolio_ranking() returns the caller's own ranking for the review editor.
--
-- The new RPCs are SECURITY DEFINER bodies in app_private with SECURITY INVOKER public wrappers,
-- signed-in only, VOLATILE so the request hook counts them, each with a rate rule.
--
-- Rollback: supabase/rollbacks/20261109150000_portfolio_ranking.down.sql.

alter table public.user_profiles
  drop constraint if exists user_profiles_pinned_post_ids_max_three;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_pinned_post_ids_max'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_pinned_post_ids_max
      check (cardinality(pinned_post_ids) <= 200);
  end if;
end $$;

create schema if not exists app_private;
grant usage on schema app_private to authenticated, service_role;

-- 1. set_pinned_posts sets the TOP THREE and keeps everything ranked below it. Up to three ids,
--    one UPDATE: the new top three, then the old fourth place onwards (minus any dish that just
--    moved up).
create or replace function app_private.set_pinned_posts(p_post_ids uuid[])
returns uuid[]
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_kept uuid[];
begin
  if v_user is null then
    raise exception 'Sign in to pin dishes.' using errcode = '42501';
  end if;
  if cardinality(coalesce(p_post_ids, '{}')) > 3 then
    raise exception 'Pin up to three dishes.' using errcode = '22023';
  end if;

  update public.user_profiles up
  set pinned_post_ids = coalesce((
    with requested as (
      select distinct on (input.post_id) input.post_id, input.ord
      from unnest(coalesce(p_post_ids, '{}')) with ordinality as input(post_id, ord)
      order by input.post_id, input.ord
    ),
    new_top as (
      select requested.post_id, requested.ord
      from requested
      join public.posts p on p.id = requested.post_id
      where p.author_id = v_user
        and p.status = 'published'
        and p.deleted_at is null
    )
    select array_agg(x.post_id order by x.grp, x.ord)
    from (
      select new_top.post_id, 0 as grp, new_top.ord from new_top
      union all
      select t.id, 1, t.ord
      from unnest(up.pinned_post_ids) with ordinality as t(id, ord)
      where t.ord > 3
        and not exists (select 1 from new_top where new_top.post_id = t.id)
    ) x
  ), '{}')
  where up.id = v_user
  returning up.pinned_post_ids into v_kept;

  return coalesce(v_kept, '{}');
end;
$$;

-- 2. Put one post at a place in the ranking.
create or replace function app_private.rank_portfolio_post(p_post_id uuid, p_position integer)
returns uuid[]
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_ranked uuid[];
begin
  if v_user is null then
    raise exception 'Sign in to rank dishes.' using errcode = '42501';
  end if;
  if p_post_id is null or p_position is null or p_position < 1 then
    raise exception 'Choose a place from 1 up.' using errcode = '22023';
  end if;

  -- The new post sorts just before whatever sits at p_position once it is taken out of the list.
  update public.user_profiles up
  set pinned_post_ids = (
    select array_agg(x.id order by x.sort_key)
    from (
      select t.id, row_number() over (order by t.ord)::numeric as sort_key
      from unnest(up.pinned_post_ids) with ordinality as t(id, ord)
      where t.id <> p_post_id
      union all
      select p_post_id, p_position::numeric - 0.5
    ) x
  )
  where up.id = v_user
    and cardinality(array_remove(up.pinned_post_ids, p_post_id)) < 200
    and exists (
      select 1 from public.posts p
      where p.id = p_post_id
        and p.author_id = v_user
        and p.status = 'published'
        and p.deleted_at is null
    )
  returning up.pinned_post_ids into v_ranked;

  if v_ranked is null then
    raise exception 'Only your own published dishes can be ranked, up to 200.'
      using errcode = '22023';
  end if;
  return v_ranked;
end;
$$;

-- Your own full ranking, best first, only dishes that are still published.
create or replace function app_private.get_my_portfolio_ranking()
returns uuid[]
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(pin.post_id order by pin.ord), '{}')
  from public.user_profiles up
  cross join lateral unnest(up.pinned_post_ids) with ordinality as pin(post_id, ord)
  join public.posts p
    on p.id = pin.post_id
   and p.author_id = up.id
   and p.status = 'published'
   and p.deleted_at is null
  where up.id = auth.uid();
$$;

-- 3. The rank label on reviews.
create or replace function app_private.get_review_portfolio_ranks(p_review_ids uuid[])
returns table (review_id uuid, portfolio_rank integer, dish_count integer)
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  with wanted as (
    select r.id as review_id, r.user_id, r.dish_id
    from public.reviews r
    where auth.uid() is not null
      and r.user_id is not null
      and r.id = any (p_review_ids[1:50])
  ),
  authors as (
    select distinct user_id from wanted
  ),
  ranked as (
    select
      a.user_id,
      p.id as post_id,
      p.dish_id,
      row_number() over (partition by a.user_id order by pin.ord) as place
    from authors a
    join public.user_profiles up on up.id = a.user_id
    cross join lateral unnest(up.pinned_post_ids) with ordinality as pin(post_id, ord)
    join public.posts p
      on p.id = pin.post_id
     and p.author_id = a.user_id
     and p.status = 'published'
     and p.deleted_at is null
    where not exists (
      select 1 from public.post_moderation_states pms
      where pms.post_id = p.id and pms.state in ('hidden', 'removed')
    )
  ),
  counts as (
    select a.user_id, count(distinct p.dish_id)::integer as dish_count
    from authors a
    join public.posts p
      on p.author_id = a.user_id
     and p.status = 'published'
     and p.deleted_at is null
     and p.dish_id is not null
    group by a.user_id
  )
  select distinct on (w.review_id)
    w.review_id,
    ranked.place::integer as portfolio_rank,
    counts.dish_count
  from wanted w
  join ranked on ranked.user_id = w.user_id and ranked.dish_id = w.dish_id and ranked.place <= 3
  join counts on counts.user_id = w.user_id and counts.dish_count >= 5
  where app_private.can_read_post(ranked.post_id)
  order by w.review_id, ranked.place;
$$;

revoke all on function app_private.set_pinned_posts(uuid[]) from public, anon, authenticated;
grant execute on function app_private.set_pinned_posts(uuid[]) to authenticated, service_role;
revoke all on function app_private.rank_portfolio_post(uuid, integer) from public, anon, authenticated;
grant execute on function app_private.rank_portfolio_post(uuid, integer) to authenticated, service_role;
revoke all on function app_private.get_my_portfolio_ranking() from public, anon, authenticated;
grant execute on function app_private.get_my_portfolio_ranking() to authenticated, service_role;
revoke all on function app_private.get_review_portfolio_ranks(uuid[]) from public, anon, authenticated;
grant execute on function app_private.get_review_portfolio_ranks(uuid[]) to authenticated, service_role;

create or replace function public.rank_portfolio_post(p_post_id uuid, p_position integer)
returns uuid[]
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select app_private.rank_portfolio_post(p_post_id, p_position);
$$;

create or replace function public.get_my_portfolio_ranking()
returns uuid[]
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select app_private.get_my_portfolio_ranking();
$$;

create or replace function public.get_review_portfolio_ranks(p_review_ids uuid[])
returns table (review_id uuid, portfolio_rank integer, dish_count integer)
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select * from app_private.get_review_portfolio_ranks(p_review_ids);
$$;

revoke all on function public.rank_portfolio_post(uuid, integer) from public, anon;
grant execute on function public.rank_portfolio_post(uuid, integer) to authenticated, service_role;
revoke all on function public.get_my_portfolio_ranking() from public, anon;
grant execute on function public.get_my_portfolio_ranking() to authenticated, service_role;
revoke all on function public.get_review_portfolio_ranks(uuid[]) from public, anon;
grant execute on function public.get_review_portfolio_ranks(uuid[]) to authenticated, service_role;

-- Rate rules (signed-in callers only; anon cannot execute these).
insert into app_private.request_rate_rules (route, anon_per_minute, user_per_minute, note) values
  ('rpc/rank_portfolio_post', null, 30, 'food portfolio rank one dish'),
  ('rpc/get_my_portfolio_ranking', null, 60, 'own portfolio ranking for the review editor'),
  ('rpc/get_review_portfolio_ranks', null, 90, 'portfolio rank label on reviews')
on conflict (route) do nothing;

notify pgrst, 'reload schema';
