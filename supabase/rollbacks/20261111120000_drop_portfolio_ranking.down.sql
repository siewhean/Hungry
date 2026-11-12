-- Undo 20261111120000_drop_portfolio_ranking: puts user_profiles.pinned_post_ids back (values from
-- rollback_archive), recreates set_pinned_posts, rank_portfolio_post, get_my_portfolio_ranking,
-- get_review_portfolio_ranks and get_food_portfolio_top_posts exactly as 20261107090000 and
-- 20261109150000 left them, with their grants and rate rules, and gives submit_review its rank
-- branch back.

-- 3. The column, its check and its values.
alter table public.user_profiles
  add column if not exists pinned_post_ids uuid[] not null default '{}';

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
  if to_regclass('rollback_archive.user_profiles_pinned_post_ids_20261111120000') is not null then
    update public.user_profiles up
    set pinned_post_ids = a.pinned_post_ids
    from rollback_archive.user_profiles_pinned_post_ids_20261111120000 a
    where a.id = up.id;
    drop table rollback_archive.user_profiles_pinned_post_ids_20261111120000;
  end if;
end $$;

-- 2. The ranking RPCs, bodies first.
create or replace function app_private.get_food_portfolio_top_posts(p_user_id uuid)
returns table (
  id uuid,
  author_id uuid,
  venue_id text,
  building_id text,
  dish_id text,
  visibility text,
  caption text,
  generated_content jsonb,
  like_count integer,
  comment_count integer,
  save_count integer,
  share_count integer,
  published_at timestamptz,
  created_at timestamptz,
  media jsonb,
  author_display_name text,
  author_avatar_url text,
  venue_name text,
  venue_unit_number text,
  venue_building_id text,
  building_name text,
  dish_name text,
  dish_price numeric,
  dish_rating numeric,
  dish_image_url text,
  viewer_has_liked boolean,
  viewer_has_saved boolean,
  is_pinned boolean
)
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  with pins as (
    select pin.post_id, pin.ord
    from public.user_profiles owner_profile
    cross join lateral unnest(owner_profile.pinned_post_ids) with ordinality as pin(post_id, ord)
    where owner_profile.id = p_user_id
  ),
  top_posts as (
    select p.*, pins.ord as pin_order
    from public.posts p
    left join pins on pins.post_id = p.id
    where auth.uid() is not null
      and p.author_id = p_user_id
      and p.status = 'published'
      and p.deleted_at is null
      and not exists (
        select 1 from public.post_moderation_states pms
        where pms.post_id = p.id and pms.state in ('hidden', 'removed')
      )
      and not exists (
        select 1 from public.hidden_posts hp
        where hp.viewer_id = auth.uid() and hp.post_id = p.id
      )
      and app_private.can_read_post(p.id)
    order by pins.ord asc nulls last, p.like_count desc, p.published_at desc nulls last, p.id desc
    limit 3
  )
  select
    p.id,
    p.author_id,
    p.venue_id,
    coalesce(p.building_id, v.building_id, d.building_id) as building_id,
    p.dish_id,
    p.visibility,
    p.caption,
    p.generated_content,
    p.like_count,
    p.comment_count,
    p.save_count,
    p.share_count,
    p.published_at,
    p.created_at,
    coalesce(media_items.media, '[]'::jsonb) as media,
    up.display_name as author_display_name,
    up.avatar_url as author_avatar_url,
    v.name as venue_name,
    v.unit_number as venue_unit_number,
    v.building_id as venue_building_id,
    b.name as building_name,
    d.name as dish_name,
    d.price as dish_price,
    d.rating_avg as dish_rating,
    d.image_url as dish_image_url,
    exists (
      select 1 from public.post_likes pl where pl.post_id = p.id and pl.user_id = auth.uid()
    ) as viewer_has_liked,
    exists (
      select 1 from public.post_saves ps where ps.post_id = p.id and ps.user_id = auth.uid()
    ) as viewer_has_saved,
    p.pin_order is not null as is_pinned
  from top_posts p
  left join public.user_profiles up on up.id = p.author_id
  left join public.venues v on v.id = p.venue_id
  left join public.dishes d on d.id = p.dish_id
  left join public.buildings b on b.id = coalesce(p.building_id, v.building_id, d.building_id)
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', pm.id,
        'post_id', pm.post_id,
        'media_type', pm.media_type,
        'storage_bucket', pm.storage_bucket,
        'storage_path', pm.storage_path,
        'public_url', pm.public_url,
        'sort_order', pm.sort_order
      )
      order by pm.sort_order, pm.id
    ) as media
    from public.post_media pm
    where pm.post_id = p.id
  ) media_items on true
  order by p.pin_order asc nulls last, p.like_count desc, p.published_at desc nulls last, p.id desc;
$$;

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

revoke all on function app_private.get_food_portfolio_top_posts(uuid) from public, anon, authenticated;
grant execute on function app_private.get_food_portfolio_top_posts(uuid) to authenticated, service_role;
revoke all on function app_private.set_pinned_posts(uuid[]) from public, anon, authenticated;
grant execute on function app_private.set_pinned_posts(uuid[]) to service_role;
grant execute on function app_private.set_pinned_posts(uuid[]) to authenticated;
revoke all on function app_private.rank_portfolio_post(uuid, integer) from public, anon, authenticated;
grant execute on function app_private.rank_portfolio_post(uuid, integer) to authenticated, service_role;
revoke all on function app_private.get_my_portfolio_ranking() from public, anon, authenticated;
grant execute on function app_private.get_my_portfolio_ranking() to authenticated, service_role;
revoke all on function app_private.get_review_portfolio_ranks(uuid[]) from public, anon, authenticated;
grant execute on function app_private.get_review_portfolio_ranks(uuid[]) to authenticated, service_role;

create or replace function public.get_food_portfolio_top_posts(p_user_id uuid)
returns table (
  id uuid,
  author_id uuid,
  venue_id text,
  building_id text,
  dish_id text,
  visibility text,
  caption text,
  generated_content jsonb,
  like_count integer,
  comment_count integer,
  save_count integer,
  share_count integer,
  published_at timestamptz,
  created_at timestamptz,
  media jsonb,
  author_display_name text,
  author_avatar_url text,
  venue_name text,
  venue_unit_number text,
  venue_building_id text,
  building_name text,
  dish_name text,
  dish_price numeric,
  dish_rating numeric,
  dish_image_url text,
  viewer_has_liked boolean,
  viewer_has_saved boolean,
  is_pinned boolean
)
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select * from app_private.get_food_portfolio_top_posts(p_user_id);
$$;

create or replace function public.set_pinned_posts(p_post_ids uuid[])
returns uuid[]
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select app_private.set_pinned_posts(p_post_ids);
$$;

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

revoke all on function public.get_food_portfolio_top_posts(uuid) from public, anon;
grant execute on function public.get_food_portfolio_top_posts(uuid) to authenticated, service_role;
revoke all on function public.set_pinned_posts(uuid[]) from public, anon;
grant execute on function public.set_pinned_posts(uuid[]) to authenticated, service_role;
revoke all on function public.rank_portfolio_post(uuid, integer) from public, anon;
grant execute on function public.rank_portfolio_post(uuid, integer) to authenticated, service_role;
revoke all on function public.get_my_portfolio_ranking() from public, anon;
grant execute on function public.get_my_portfolio_ranking() to authenticated, service_role;
revoke all on function public.get_review_portfolio_ranks(uuid[]) from public, anon;
grant execute on function public.get_review_portfolio_ranks(uuid[]) to authenticated, service_role;

insert into app_private.request_rate_rules (route, anon_per_minute, user_per_minute, note) values
  ('rpc/get_food_portfolio_top_posts', null, 90, 'food portfolio top three'),
  ('rpc/set_pinned_posts', null, 10, 'food portfolio pin top three'),
  ('rpc/rank_portfolio_post', null, 30, 'food portfolio rank one dish'),
  ('rpc/get_my_portfolio_ranking', null, 60, 'own portfolio ranking for the review editor'),
  ('rpc/get_review_portfolio_ranks', null, 90, 'portfolio rank label on reviews')
on conflict (route) do nothing;

-- 1. submit_review ranks the entry again when p_portfolio has a rank.
create or replace function pg_temp.patch_function(p_oid regprocedure, p_find text, p_replace text)
returns void
language plpgsql
as $patch$
declare
  v_src text := (select prosrc from pg_proc where oid = p_oid);
  v_count integer := (length(v_src) - length(replace(v_src, p_find, ''))) / length(p_find);
begin
  if v_count = 0 and position(p_replace in v_src) > 0 then
    return;
  end if;
  if v_count <> 1 then
    raise exception 'patch_function: % has % copies of the expected text', p_oid, v_count;
  end if;
  execute replace(pg_get_functiondef(p_oid), p_find, p_replace);
end;
$patch$;

select pg_temp.patch_function(
  'public.submit_review(jsonb, jsonb, jsonb)'::regprocedure,
  $find$    v_post_resumed := coalesce((v_entry ->> 'resumed')::boolean, false);
  end if;$find$,
  $replace$    v_post_resumed := coalesce((v_entry ->> 'resumed')::boolean, false);
    if not v_post_resumed and jsonb_typeof(p_portfolio -> 'rank') = 'number' then
      perform app_private.rank_portfolio_post(v_post_id, (p_portfolio ->> 'rank')::integer);
    end if;
  end if;$replace$
);
