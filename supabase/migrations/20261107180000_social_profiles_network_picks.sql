-- smoke: supabase/smoke/social_profiles_network_picks.sql
-- Social profiles and network picks (thread "Close gaps with rival food apps", 2026-11-07).
--
-- Read-only functions for the follows rollout and friend-aware recommendations. No new tables.
--
-- 1. get_profile_relationship(user): how the caller and one other person are connected. Whether
--    they follow the caller ("Follows you"), and up to three of the caller's approved followees
--    who follow them, with the total ("Followed by Mei and 2 others you follow"). The mutuals are
--    left out when the caller may not see that person's lists (private account, blocked pair).
-- 2. get_taste_matches(users[]): the 0-100 taste match (same formula as get_taste_match) for up
--    to 200 people in one call, so a Followers or Following page never asks once per row.
-- 3. get_people_suggestions(limit): public accounts the caller does not follow yet, ranked by
--    taste match, people the caller's follows follow, and recent reviews or posts. Never the
--    caller, a blocked pair, a deactivated account or someone already followed or requested.
-- 4. get_network_stall_picks(limit): the stalls the caller's approved followees reviewed 4 or
--    more, or posted a dish from, in the last 90 days, with how many of them and up to two
--    names. When the caller follows nobody (or they have no picks), the caller's closest public
--    taste twins (match 75+) stand in, marked source = 'taste_twin'. Reviews hidden or removed
--    by moderation and unreadable posts never count.
-- 5. get_taste_comparison(user): the other diner's six taste levels beside the caller's, for the
--    "Compare palates" page. Only when get_taste_match would show a score (both palates set, the
--    account readable by the caller); otherwise no row.
--
-- Bodies live in app_private (SECURITY DEFINER: they read follows, taste vectors and profiles
-- across users); public.* are SECURITY INVOKER wrappers granted to signed-in users only. Every
-- RPC is VOLATILE so the request hook can count it, and each has a rate rule.
--
-- Rollback: supabase/rollbacks/20261107180000_social_profiles_network_picks.down.sql.

create schema if not exists app_private;
grant usage on schema app_private to authenticated, service_role;

-- 0. Shared taste-match score -----------------------------------------------------------------
-- 0-100 from two sets of six levels; null when either side is still neutral (every level within
-- 1 of 5), which is how get_taste_match treats a skipped quiz.
create or replace function app_private.taste_match_score(
  a_sweet numeric, a_spicy numeric, a_sour numeric, a_salty numeric, a_rich numeric, a_aromatic numeric,
  b_sweet numeric, b_spicy numeric, b_sour numeric, b_salty numeric, b_rich numeric, b_aromatic numeric
)
returns integer
language sql
immutable
set search_path = pg_temp
as $$
  select case
    when greatest(abs(a_sweet - 5), abs(a_spicy - 5), abs(a_sour - 5),
                  abs(a_salty - 5), abs(a_rich - 5), abs(a_aromatic - 5)) >= 1
     and greatest(abs(b_sweet - 5), abs(b_spicy - 5), abs(b_sour - 5),
                  abs(b_salty - 5), abs(b_rich - 5), abs(b_aromatic - 5)) >= 1
    then greatest(0, round(100 - 100 * (
           abs(a_sweet - b_sweet) + abs(a_spicy - b_spicy) + abs(a_sour - b_sour)
           + abs(a_salty - b_salty) + abs(a_rich - b_rich) + abs(a_aromatic - b_aromatic)
         ) / 36.0))::integer
  end;
$$;

revoke all on function app_private.taste_match_score(
  numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric, numeric
) from public, anon, authenticated;
grant execute on function app_private.taste_match_score(
  numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric, numeric
) to authenticated, service_role;

-- 1. Relationship with one person ---------------------------------------------------------------
create or replace function app_private.get_profile_relationship(p_user_id uuid)
returns table (
  follows_you boolean,
  mutual_count integer,
  mutual_user_ids uuid[],
  mutual_names text[]
)
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  with viewer as (
    select auth.uid() as id
  ),
  allowed as (
    select v.id as viewer_id
    from viewer v
    where v.id is not null
      and p_user_id is not null
      and p_user_id <> v.id
      and not app_private.app_user_block_exists(v.id, p_user_id)
      and not app_private.account_is_deactivated(p_user_id)
  ),
  mutuals as (
    select up.id, up.display_name, f_them.approved_at
    from allowed a
    join public.follows f_me
      on f_me.follower_id = a.viewer_id and f_me.status = 'approved'
    join public.follows f_them
      on f_them.follower_id = f_me.followee_id
     and f_them.followee_id = p_user_id
     and f_them.status = 'approved'
    join public.user_profiles up on up.id = f_me.followee_id
    where app_private.can_read_author_content(p_user_id)
      and up.id <> p_user_id
      and not app_private.app_user_block_exists(a.viewer_id, up.id)
      and not app_private.account_is_deactivated(up.id)
  ),
  sample as (
    select m.id, m.display_name
    from mutuals m
    order by m.approved_at desc nulls last, m.id
    limit 3
  )
  select
    exists (
      select 1 from public.follows f
      where f.follower_id = p_user_id
        and f.followee_id = a.viewer_id
        and f.status = 'approved'
    ),
    (select count(*)::integer from mutuals),
    coalesce((select array_agg(s.id) from sample s), '{}'::uuid[]),
    coalesce((select array_agg(coalesce(nullif(btrim(s.display_name), ''), 'Hungry User')) from sample s), '{}'::text[])
  from allowed a;
$$;

revoke all on function app_private.get_profile_relationship(uuid) from public, anon, authenticated;
grant execute on function app_private.get_profile_relationship(uuid) to authenticated, service_role;

create or replace function public.get_profile_relationship(p_user_id uuid)
returns table (
  follows_you boolean,
  mutual_count integer,
  mutual_user_ids uuid[],
  mutual_names text[]
)
language sql
volatile
security invoker
set search_path = public, app_private
as $$
  select * from app_private.get_profile_relationship(p_user_id);
$$;

revoke all on function public.get_profile_relationship(uuid) from public, anon;
grant execute on function public.get_profile_relationship(uuid) to authenticated, service_role;

comment on function public.get_profile_relationship(uuid) is
  'Whether a person follows the caller, and which of the caller''s follows follow them (up to 3 named, with the total).';

-- 2. Taste match for a list of people -----------------------------------------------------------
create or replace function app_private.get_taste_matches(p_user_ids uuid[])
returns table (user_id uuid, score integer)
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  with ids as (
    select distinct u.id
    from unnest(coalesce(p_user_ids, '{}'::uuid[])) with ordinality as u(id, n)
    where u.n <= 200 and u.id is not null
  )
  select b.user_id,
         app_private.taste_match_score(
           a.sweet, a.spicy, a.sour, a.salty, a.rich, a.aromatic,
           b.sweet, b.spicy, b.sour, b.salty, b.rich, b.aromatic
         )
  from public.user_taste_vectors a
  join ids on true
  join public.user_taste_vectors b on b.user_id = ids.id
  where auth.uid() is not null
    and a.user_id = auth.uid()
    and b.user_id <> auth.uid()
    and app_private.can_read_author_content(b.user_id)
    and app_private.taste_match_score(
          a.sweet, a.spicy, a.sour, a.salty, a.rich, a.aromatic,
          b.sweet, b.spicy, b.sour, b.salty, b.rich, b.aromatic
        ) is not null;
$$;

revoke all on function app_private.get_taste_matches(uuid[]) from public, anon, authenticated;
grant execute on function app_private.get_taste_matches(uuid[]) to authenticated, service_role;

create or replace function public.get_taste_matches(p_user_ids uuid[])
returns table (user_id uuid, score integer)
language sql
volatile
security invoker
set search_path = public, app_private
as $$
  select * from app_private.get_taste_matches(p_user_ids);
$$;

revoke all on function public.get_taste_matches(uuid[]) from public, anon;
grant execute on function public.get_taste_matches(uuid[]) to authenticated, service_role;

comment on function public.get_taste_matches(uuid[]) is
  'Taste match 0-100 between the caller and up to 200 people in one call; people without a palate or hidden from the caller are left out.';

-- 3. Suggested people ---------------------------------------------------------------------------
create or replace function app_private.get_people_suggestions(p_limit integer default 20)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  taste_match integer,
  mutual_count integer,
  recent_activity integer,
  reason text
)
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  with viewer as (
    select auth.uid() as id
  ),
  my_follows as (
    select f.followee_id as id
    from public.follows f, viewer v
    where f.follower_id = v.id and f.status = 'approved'
  ),
  -- People the caller's follows follow ("friends of friends"), with how many of them.
  fof as (
    select f.followee_id as id, count(distinct f.follower_id)::integer as mutuals
    from public.follows f
    join my_follows mf on mf.id = f.follower_id
    where f.status = 'approved'
    group by f.followee_id
  ),
  -- Recently active diners: reviews or published posts in the last 60 days.
  active as (
    select x.user_id as id, count(*)::integer as actions
    from (
      select r.user_id from public.reviews r
      where r.created_at > now() - interval '60 days' and r.user_id is not null
      union all
      select p.author_id from public.posts p
      where p.status = 'published' and p.deleted_at is null
        and p.published_at > now() - interval '60 days'
    ) x
    group by x.user_id
  ),
  -- Diners with a palate, most recently updated first (bounded so the scan stays small).
  palates as (
    select t.user_id as id
    from public.user_taste_vectors t
    order by t.updated_at desc nulls last
    limit 1000
  ),
  pool as (
    select id from fof
    union
    select id from (select id from active order by actions desc limit 500) a
    union
    select id from palates
  ),
  scored as (
    select
      up.id,
      up.display_name,
      up.avatar_url,
      app_private.taste_match_score(
        me.sweet, me.spicy, me.sour, me.salty, me.rich, me.aromatic,
        t.sweet, t.spicy, t.sour, t.salty, t.rich, t.aromatic
      ) as match,
      coalesce(fof.mutuals, 0) as mutuals,
      coalesce(active.actions, 0) as actions
    from pool
    cross join viewer v
    join public.user_profiles up on up.id = pool.id
    left join public.privacy_settings ps on ps.user_id = up.id
    left join public.user_taste_vectors t on t.user_id = up.id
    left join public.user_taste_vectors me on me.user_id = v.id
    left join fof on fof.id = up.id
    left join active on active.id = up.id
    where v.id is not null
      and up.id <> v.id
      and coalesce(ps.account_visibility, 'public') = 'public'
      and not app_private.account_is_deactivated(up.id)
      and not app_private.app_user_block_exists(v.id, up.id)
      and not exists (
        select 1 from public.follows f
        where f.follower_id = v.id and f.followee_id = up.id
      )
  )
  select
    s.id,
    coalesce(nullif(btrim(s.display_name), ''), 'Hungry User'),
    s.avatar_url,
    s.match,
    s.mutuals,
    s.actions,
    case
      when s.mutuals > 0 then 'mutual'
      when coalesce(s.match, 0) >= 75 then 'taste'
      else 'active'
    end
  from scored s
  -- Someone with nothing in common and no recent activity is not a suggestion.
  where s.mutuals > 0 or coalesce(s.match, 0) >= 60 or s.actions > 0
  order by
    (0.6 * coalesce(s.match, 50) + 8 * least(s.mutuals, 5) + 4 * least(s.actions, 5)) desc,
    s.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke all on function app_private.get_people_suggestions(integer) from public, anon, authenticated;
grant execute on function app_private.get_people_suggestions(integer) to authenticated, service_role;

create or replace function public.get_people_suggestions(p_limit integer default 20)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  taste_match integer,
  mutual_count integer,
  recent_activity integer,
  reason text
)
language sql
volatile
security invoker
set search_path = public, app_private
as $$
  select * from app_private.get_people_suggestions(p_limit);
$$;

revoke all on function public.get_people_suggestions(integer) from public, anon;
grant execute on function public.get_people_suggestions(integer) to authenticated, service_role;

comment on function public.get_people_suggestions(integer) is
  'People to follow: public accounts ranked by taste match, follows of follows and recent activity; never self, blocked, deactivated or already followed.';

-- 4. Network stall picks ------------------------------------------------------------------------
create or replace function app_private.get_network_stall_picks(p_limit integer default 30)
returns table (
  venue_id text,
  source text,
  people_count integer,
  sample_user_ids uuid[],
  sample_names text[],
  last_at timestamptz
)
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  with viewer as (
    select auth.uid() as id
  ),
  followees as (
    select f.followee_id as id
    from public.follows f, viewer v
    where v.id is not null
      and f.follower_id = v.id
      and f.status = 'approved'
      and not app_private.app_user_block_exists(v.id, f.followee_id)
      and not app_private.account_is_deactivated(f.followee_id)
  ),
  twins as (
    select t.user_id as id
    from viewer v
    join public.user_taste_vectors me on me.user_id = v.id
    join public.user_taste_vectors t on t.user_id <> v.id
    left join public.privacy_settings ps on ps.user_id = t.user_id
    where coalesce(ps.account_visibility, 'public') = 'public'
      and not app_private.app_user_block_exists(v.id, t.user_id)
      and not app_private.account_is_deactivated(t.user_id)
      and coalesce(app_private.taste_match_score(
            me.sweet, me.spicy, me.sour, me.salty, me.rich, me.aromatic,
            t.sweet, t.spicy, t.sour, t.salty, t.rich, t.aromatic
          ), 0) >= 75
    order by app_private.taste_match_score(
            me.sweet, me.spicy, me.sour, me.salty, me.rich, me.aromatic,
            t.sweet, t.spicy, t.sour, t.salty, t.rich, t.aromatic
          ) desc, t.user_id
    limit 20
  ),
  -- One row per loved stall per person, newest signal kept.
  signals as (
    select x.person_id, x.venue_id, max(x.at) as at, x.source
    from (
      select r.user_id as person_id, coalesce(r.venue_id, d.venue_id) as venue_id,
             r.created_at as at, 'following'::text as source
      from public.reviews r
      join followees fe on fe.id = r.user_id
      left join public.dishes d on d.id = r.dish_id
      where r.rating >= 4
        and r.created_at > now() - interval '90 days'
        and not exists (
          select 1 from public.review_moderation_states rms
          where rms.review_id = r.id and rms.state in ('hidden', 'removed')
        )
      union all
      select p.author_id, coalesce(p.venue_id, d.venue_id), p.published_at, 'following'
      from public.posts p
      join followees fe on fe.id = p.author_id
      left join public.dishes d on d.id = p.dish_id
      where p.status = 'published'
        and p.deleted_at is null
        and p.published_at > now() - interval '90 days'
        and not exists (
          select 1 from public.post_moderation_states pms
          where pms.post_id = p.id and pms.state in ('hidden', 'removed')
        )
        and app_private.can_read_post(p.id)
      union all
      select r.user_id, coalesce(r.venue_id, d.venue_id), r.created_at, 'taste_twin'
      from public.reviews r
      join twins tw on tw.id = r.user_id
      left join public.dishes d on d.id = r.dish_id
      where r.rating >= 4
        and r.created_at > now() - interval '90 days'
        and not exists (
          select 1 from public.review_moderation_states rms
          where rms.review_id = r.id and rms.state in ('hidden', 'removed')
        )
    ) x
    where x.venue_id is not null
    group by x.person_id, x.venue_id, x.source
  ),
  -- Follows win: taste twins only stand in when the follows have no picks at all.
  chosen as (
    select s.* from signals s
    where s.source = 'following'
       or not exists (select 1 from signals s2 where s2.source = 'following')
  ),
  ranked as (
    select c.venue_id, c.source, c.person_id, c.at,
           row_number() over (partition by c.venue_id, c.source order by c.at desc, c.person_id) as rn
    from chosen c
  )
  select
    r.venue_id,
    r.source,
    count(*)::integer,
    array_agg(r.person_id order by r.at desc, r.person_id) filter (where r.rn <= 2),
    array_agg(coalesce(nullif(btrim(up.display_name), ''), 'Hungry User') order by r.at desc, r.person_id)
      filter (where r.rn <= 2),
    max(r.at)
  from ranked r
  join public.venues ve on ve.id = r.venue_id
  left join public.user_profiles up on up.id = r.person_id
  group by r.venue_id, r.source
  order by count(*) desc, max(r.at) desc, r.venue_id
  limit least(greatest(coalesce(p_limit, 30), 1), 60);
$$;

revoke all on function app_private.get_network_stall_picks(integer) from public, anon, authenticated;
grant execute on function app_private.get_network_stall_picks(integer) to authenticated, service_role;

create or replace function public.get_network_stall_picks(p_limit integer default 30)
returns table (
  venue_id text,
  source text,
  people_count integer,
  sample_user_ids uuid[],
  sample_names text[],
  last_at timestamptz
)
language sql
volatile
security invoker
set search_path = public, app_private
as $$
  select * from app_private.get_network_stall_picks(p_limit);
$$;

revoke all on function public.get_network_stall_picks(integer) from public, anon;
grant execute on function public.get_network_stall_picks(integer) to authenticated, service_role;

comment on function public.get_network_stall_picks(integer) is
  'Stalls the caller''s follows reviewed 4+ or posted from in the last 90 days (taste twins stand in when there are none).';

-- 5. Taste comparison ---------------------------------------------------------------------------
create or replace function app_private.get_taste_comparison(p_user_id uuid)
returns table (
  score integer,
  sweet numeric, spicy numeric, sour numeric, salty numeric, rich numeric, aromatic numeric,
  my_sweet numeric, my_spicy numeric, my_sour numeric, my_salty numeric, my_rich numeric, my_aromatic numeric
)
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  select
    app_private.taste_match_score(
      a.sweet, a.spicy, a.sour, a.salty, a.rich, a.aromatic,
      b.sweet, b.spicy, b.sour, b.salty, b.rich, b.aromatic
    ),
    b.sweet, b.spicy, b.sour, b.salty, b.rich, b.aromatic,
    a.sweet, a.spicy, a.sour, a.salty, a.rich, a.aromatic
  from public.user_taste_vectors a
  join public.user_taste_vectors b on b.user_id = p_user_id
  where auth.uid() is not null
    and a.user_id = auth.uid()
    and p_user_id <> auth.uid()
    and app_private.can_read_author_content(p_user_id)
    and app_private.taste_match_score(
          a.sweet, a.spicy, a.sour, a.salty, a.rich, a.aromatic,
          b.sweet, b.spicy, b.sour, b.salty, b.rich, b.aromatic
        ) is not null;
$$;

revoke all on function app_private.get_taste_comparison(uuid) from public, anon, authenticated;
grant execute on function app_private.get_taste_comparison(uuid) to authenticated, service_role;

create or replace function public.get_taste_comparison(p_user_id uuid)
returns table (
  score integer,
  sweet numeric, spicy numeric, sour numeric, salty numeric, rich numeric, aromatic numeric,
  my_sweet numeric, my_spicy numeric, my_sour numeric, my_salty numeric, my_rich numeric, my_aromatic numeric
)
language sql
volatile
security invoker
set search_path = public, app_private
as $$
  select * from app_private.get_taste_comparison(p_user_id);
$$;

revoke all on function public.get_taste_comparison(uuid) from public, anon;
grant execute on function public.get_taste_comparison(uuid) to authenticated, service_role;

comment on function public.get_taste_comparison(uuid) is
  'Another diner''s six taste levels beside the caller''s, when a taste match can be shown.';

-- 6. Rate rules ---------------------------------------------------------------------------------
insert into app_private.request_rate_rules (route, anon_per_minute, user_per_minute, note) values
  ('rpc/get_profile_relationship', null, 120, 'profile follows-you and mutual followers line'),
  ('rpc/get_taste_matches', null, 60, 'taste match for a page of people'),
  ('rpc/get_people_suggestions', null, 30, 'people with your taste suggestions'),
  ('rpc/get_network_stall_picks', null, 30, 'Home loved by people you follow'),
  ('rpc/get_taste_comparison', null, 60, 'compare palates page')
on conflict (route) do nothing;

notify pgrst, 'reload schema';
