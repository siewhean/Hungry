-- smoke: supabase/smoke/portfolio_picks.sql
-- Food Portfolio Phase 2, server side (roadmap 2.1, 2.2, 2.6; owner decisions D1 to D4).
--
-- The portfolio is a diner's best dish of each dish type, an optional top three, and a diary of
-- everything they posted. A previous favourite stays in the diary when it is replaced.
--
-- 1. public.portfolio_picks: one row per (diner, kind, slot). kind 'dish_type' has the dish's
--    food type as its slot; kind 'overall' has slots 1 to 3. Rows point at the diner's own public
--    published posts and go when the post is deleted, made private or removed. Readable where the
--    post is readable; written only through set_portfolio_pick and remove_portfolio_pick.
-- 2. set_portfolio_pick(post, kind, place): one INSERT .. ON CONFLICT DO UPDATE per slot, under a
--    per-diner lock (an overall pick moving between places frees its old place first). Returns
--    the post it replaced, so the app can say what it replaced.
-- 3. Read functions, one batched call per screen, same card shape as get_food_portfolio_top_posts:
--    get_portfolio_picks(user) (bests and top three), get_portfolio_diary(user, page) and
--    get_review_portfolio_labels(reviews) ("X's best <dish type>", "#N" for the top three, only
--    once the diner has 5 dishes).
-- 4. Private entries: posts.visibility 'private' ("Only me"). publish_post and submit_review take
--    visibility; set_post_visibility switches it. A private entry earns no board points (its
--    credits are voided when it goes private), is read by nobody else (app_private.can_read_post
--    already says so), and cannot be a pick.
-- 5. The first three ranked posts in pinned_post_ids become the overall picks. Nothing writes
--    pinned_post_ids from here on except the old rank_portfolio_post, kept for builds already out
--    (dropped in a later migration, roadmap 2.7).
--
-- Bodies live in app_private (SECURITY DEFINER); public.* are SECURITY INVOKER wrappers.
-- Signed-in only, VOLATILE so the request hook counts them, each with a rate rule.
-- 6. app_private.export_my_data also exports portfolioPicks.
--
-- Rollback: supabase/rollbacks/20261111090000_portfolio_picks.down.sql.

create schema if not exists app_private;
grant usage on schema app_private to authenticated, service_role;

-- Replaces one exact piece of a live function body. Already patched (p_replace present and
-- p_find gone) is a no-op; anything else that does not find exactly one copy stops the migration.
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

-- 1. Picks.
create table if not exists public.portfolio_picks (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('dish_type', 'overall')),
  slot text not null,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, slot),
  unique (user_id, kind, post_id),
  constraint portfolio_picks_overall_slot check (kind <> 'overall' or slot in ('1', '2', '3')),
  constraint portfolio_picks_slot_length check (char_length(slot) between 1 and 80)
);

create index if not exists idx_portfolio_picks_post on public.portfolio_picks (post_id);

alter table public.portfolio_picks enable row level security;

drop policy if exists portfolio_picks_select_readable on public.portfolio_picks;
create policy portfolio_picks_select_readable on public.portfolio_picks
for select to authenticated
using (user_id = (select auth.uid()) or app_private.can_read_post(post_id));

revoke all on table public.portfolio_picks from public, anon, authenticated;
grant select on table public.portfolio_picks to authenticated;
grant all on table public.portfolio_picks to service_role;

-- A post that is deleted, made private or no longer published leaves every pick it held.
create or replace function app_private.drop_portfolio_picks_for_post()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.deleted_at is not null or new.status <> 'published' or new.visibility = 'private' then
    delete from portfolio_picks where post_id = new.id;
  end if;
  return null;
end;
$$;

revoke all on function app_private.drop_portfolio_picks_for_post() from public, anon, authenticated;

drop trigger if exists trg_posts_drop_portfolio_picks on public.posts;
create trigger trg_posts_drop_portfolio_picks
after update of status, deleted_at, visibility on public.posts
for each row execute function app_private.drop_portfolio_picks_for_post();

-- Moderation hiding or removing a post takes it off the portfolio too.
create or replace function app_private.drop_portfolio_picks_for_moderation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.state in ('hidden', 'removed') then
    delete from portfolio_picks where post_id = new.post_id;
  end if;
  return null;
end;
$$;

revoke all on function app_private.drop_portfolio_picks_for_moderation() from public, anon, authenticated;

drop trigger if exists trg_post_moderation_drop_portfolio_picks on public.post_moderation_states;
create trigger trg_post_moderation_drop_portfolio_picks
after insert or update of state on public.post_moderation_states
for each row execute function app_private.drop_portfolio_picks_for_moderation();

-- 2. Writing picks.
create or replace function app_private.set_portfolio_pick(
  p_post_id uuid,
  p_kind text,
  p_place integer default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_post posts%rowtype;
  v_slot text;
  v_food_type text;
  v_replaced uuid;
begin
  if v_user is null then
    raise exception 'Sign in to choose your bests.' using errcode = '42501';
  end if;
  if p_kind not in ('dish_type', 'overall') then
    raise exception 'Choose a best of its dish type or a top three place.' using errcode = '22023';
  end if;
  if p_kind = 'overall' and (p_place is null or p_place not between 1 and 3) then
    raise exception 'Choose a place from 1 to 3.' using errcode = '22023';
  end if;

  -- race:portfolio-picks (one change to a diner's picks at a time, so a move and a replace
  -- cannot interleave; the slot upsert below is atomic on its own)
  perform pg_advisory_xact_lock(hashtextextended('portfolio_picks:' || v_user::text, 0));

  select * into v_post from posts p where p.id = p_post_id;
  if not found
     or v_post.author_id <> v_user
     or v_post.status <> 'published'
     or v_post.deleted_at is not null
     or exists (
       select 1 from post_moderation_states pms
       where pms.post_id = v_post.id and pms.state in ('hidden', 'removed')
     ) then
    raise exception 'Only your own live dishes can be your bests.' using errcode = '42501';
  end if;
  if v_post.visibility = 'private' then
    raise exception 'Make this dish public before choosing it as a best.' using errcode = '22023';
  end if;

  if p_kind = 'dish_type' then
    select nullif(trim(d.food_type), '') into v_food_type from dishes d where d.id = v_post.dish_id;
    if v_food_type is null then
      raise exception 'This dish has no dish type yet.' using errcode = '22023';
    end if;
    v_slot := left(v_food_type, 80);
  else
    v_slot := p_place::text;
    -- Moving within the top three frees the old place first.
    delete from portfolio_picks
    where user_id = v_user and kind = 'overall' and post_id = v_post.id and slot <> v_slot;
  end if;

  select pk.post_id into v_replaced
  from portfolio_picks pk
  where pk.user_id = v_user and pk.kind = p_kind and pk.slot = v_slot;

  insert into portfolio_picks (user_id, kind, slot, post_id)
  values (v_user, p_kind, v_slot, v_post.id)
  on conflict (user_id, kind, slot)
  do update set post_id = excluded.post_id, updated_at = now();

  return jsonb_build_object(
    'kind', p_kind,
    'slot', v_slot,
    'post_id', v_post.id,
    'replaced_post_id', case when v_replaced = v_post.id then null else v_replaced end
  );
end;
$$;

create or replace function app_private.remove_portfolio_pick(p_post_id uuid, p_kind text)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_removed integer;
begin
  if v_user is null then
    raise exception 'Sign in to change your bests.' using errcode = '42501';
  end if;
  delete from portfolio_picks
  where user_id = v_user and post_id = p_post_id and (p_kind is null or kind = p_kind);
  get diagnostics v_removed = row_count;
  return v_removed;
end;
$$;

-- "Public" or "Only me" on an entry the caller owns. Going private drops its picks and voids its
-- board points (the triggers on posts do both).
create or replace function app_private.set_post_visibility(p_post_id uuid, p_visibility text)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_visibility text;
begin
  if v_user is null then
    raise exception 'Sign in to change who sees this dish.' using errcode = '42501';
  end if;
  if p_visibility not in ('public', 'private') then
    raise exception 'Choose Public or Only me.' using errcode = '22023';
  end if;
  update posts p
  set visibility = p_visibility, updated_at = now()
  where p.id = p_post_id and p.author_id = v_user and p.deleted_at is null
  returning p.visibility into v_visibility;
  if v_visibility is null then
    raise exception 'Only your own dishes can be changed.' using errcode = '42501';
  end if;
  return v_visibility;
end;
$$;

-- 3. Reading. One card per readable post, same shape as get_food_portfolio_top_posts.
create or replace function app_private.portfolio_post_cards(p_post_ids uuid[])
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
  dish_food_type text,
  viewer_has_liked boolean,
  viewer_has_saved boolean
)
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
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
    d.food_type as dish_food_type,
    exists (
      select 1 from public.post_likes pl where pl.post_id = p.id and pl.user_id = auth.uid()
    ) as viewer_has_liked,
    exists (
      select 1 from public.post_saves ps where ps.post_id = p.id and ps.user_id = auth.uid()
    ) as viewer_has_saved
  from public.posts p
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
  where auth.uid() is not null
    and p.id = any (p_post_ids)
    and p.status = 'published'
    and p.deleted_at is null
    and not exists (
      select 1 from public.hidden_posts hp
      where hp.viewer_id = auth.uid() and hp.post_id = p.id
    )
    and app_private.can_read_post(p.id);
$$;

-- A diner's bests by dish type and their top three, in one read.
create or replace function app_private.get_portfolio_picks(p_user_id uuid)
returns table (
  kind text,
  slot text,
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
  dish_food_type text,
  viewer_has_liked boolean,
  viewer_has_saved boolean
)
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  with picks as (
    select pk.kind, pk.slot, pk.post_id
    from public.portfolio_picks pk
    where auth.uid() is not null and pk.user_id = p_user_id
  )
  select picks.kind, picks.slot, c.*
  from picks
  join app_private.portfolio_post_cards(array(select post_id from picks)) c on c.id = picks.post_id
  where c.author_id = p_user_id
  order by picks.kind desc, -- overall first
           case when picks.kind = 'overall' then picks.slot::integer end,
           lower(picks.slot);
$$;

-- Every entry, newest first, keyset paged on (published_at, id). The owner sees private ones.
create or replace function app_private.get_portfolio_diary(
  p_user_id uuid,
  p_limit integer default 30,
  p_before_published_at timestamptz default null,
  p_before_id uuid default null
)
returns table (
  pick_kinds text[],
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
  dish_food_type text,
  viewer_has_liked boolean,
  viewer_has_saved boolean
)
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  with page as (
    select p.id
    from public.posts p
    where auth.uid() is not null
      and p.author_id = p_user_id
      and p.status = 'published'
      and p.deleted_at is null
      and (
        p_before_published_at is null
        or (p.published_at, p.id) < (p_before_published_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
      )
      and app_private.can_read_post(p.id)
    order by p.published_at desc nulls last, p.id desc
    limit least(greatest(coalesce(p_limit, 30), 1), 60)
  )
  select
    coalesce((
      select array_agg(pk.kind order by pk.kind)
      from public.portfolio_picks pk
      where pk.post_id = c.id
    ), '{}') as pick_kinds,
    c.*
  from app_private.portfolio_post_cards(array(select id from page)) c
  order by c.published_at desc nulls last, c.id desc;
$$;

-- The label beside a review: the author's best of that dish's type, and the place when it is in
-- their top three. Only once the author has 5 dishes (D4), and only where the pick is readable.
create or replace function app_private.get_review_portfolio_labels(p_review_ids uuid[])
returns table (
  review_id uuid,
  food_type text,
  overall_place integer,
  dish_count integer
)
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
  counts as (
    select a.user_id, count(distinct p.dish_id)::integer as dish_count
    from (select distinct user_id from wanted) a
    join public.posts p
      on p.author_id = a.user_id
     and p.status = 'published'
     and p.deleted_at is null
     and p.visibility <> 'private'
     and p.dish_id is not null
    group by a.user_id
  ),
  matched as (
    select
      w.review_id,
      max(case when pk.kind = 'dish_type' then pk.slot end) as food_type,
      min(case when pk.kind = 'overall' then pk.slot::integer end) as overall_place
    from wanted w
    join public.portfolio_picks pk on pk.user_id = w.user_id
    join public.posts p on p.id = pk.post_id and p.dish_id = w.dish_id
    where app_private.can_read_post(p.id)
    group by w.review_id
  )
  select m.review_id, m.food_type, m.overall_place, c.dish_count
  from matched m
  join wanted w on w.review_id = m.review_id
  join counts c on c.user_id = w.user_id and c.dish_count >= 5;
$$;

revoke all on function app_private.set_portfolio_pick(uuid, text, integer) from public, anon, authenticated;
revoke all on function app_private.remove_portfolio_pick(uuid, text) from public, anon, authenticated;
revoke all on function app_private.set_post_visibility(uuid, text) from public, anon, authenticated;
revoke all on function app_private.portfolio_post_cards(uuid[]) from public, anon, authenticated;
revoke all on function app_private.get_portfolio_picks(uuid) from public, anon, authenticated;
revoke all on function app_private.get_portfolio_diary(uuid, integer, timestamptz, uuid) from public, anon, authenticated;
revoke all on function app_private.get_review_portfolio_labels(uuid[]) from public, anon, authenticated;
grant execute on function app_private.set_portfolio_pick(uuid, text, integer) to authenticated, service_role;
grant execute on function app_private.remove_portfolio_pick(uuid, text) to authenticated, service_role;
grant execute on function app_private.set_post_visibility(uuid, text) to authenticated, service_role;
grant execute on function app_private.portfolio_post_cards(uuid[]) to authenticated, service_role;
grant execute on function app_private.get_portfolio_picks(uuid) to authenticated, service_role;
grant execute on function app_private.get_portfolio_diary(uuid, integer, timestamptz, uuid) to authenticated, service_role;
grant execute on function app_private.get_review_portfolio_labels(uuid[]) to authenticated, service_role;

create or replace function public.set_portfolio_pick(p_post_id uuid, p_kind text, p_place integer default null)
returns jsonb
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select app_private.set_portfolio_pick(p_post_id, p_kind, p_place);
$$;

create or replace function public.remove_portfolio_pick(p_post_id uuid, p_kind text default null)
returns integer
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select app_private.remove_portfolio_pick(p_post_id, p_kind);
$$;

create or replace function public.set_post_visibility(p_post_id uuid, p_visibility text)
returns text
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select app_private.set_post_visibility(p_post_id, p_visibility);
$$;

create or replace function public.get_portfolio_picks(p_user_id uuid)
returns table (
  kind text, slot text, id uuid, author_id uuid, venue_id text, building_id text, dish_id text,
  visibility text, caption text, generated_content jsonb, like_count integer, comment_count integer,
  save_count integer, share_count integer, published_at timestamptz, created_at timestamptz,
  media jsonb, author_display_name text, author_avatar_url text, venue_name text,
  venue_unit_number text, venue_building_id text, building_name text, dish_name text,
  dish_price numeric, dish_rating numeric, dish_image_url text, dish_food_type text,
  viewer_has_liked boolean, viewer_has_saved boolean
)
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select * from app_private.get_portfolio_picks(p_user_id);
$$;

create or replace function public.get_portfolio_diary(
  p_user_id uuid,
  p_limit integer default 30,
  p_before_published_at timestamptz default null,
  p_before_id uuid default null
)
returns table (
  pick_kinds text[], id uuid, author_id uuid, venue_id text, building_id text, dish_id text,
  visibility text, caption text, generated_content jsonb, like_count integer, comment_count integer,
  save_count integer, share_count integer, published_at timestamptz, created_at timestamptz,
  media jsonb, author_display_name text, author_avatar_url text, venue_name text,
  venue_unit_number text, venue_building_id text, building_name text, dish_name text,
  dish_price numeric, dish_rating numeric, dish_image_url text, dish_food_type text,
  viewer_has_liked boolean, viewer_has_saved boolean
)
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select * from app_private.get_portfolio_diary(p_user_id, p_limit, p_before_published_at, p_before_id);
$$;

create or replace function public.get_review_portfolio_labels(p_review_ids uuid[])
returns table (review_id uuid, food_type text, overall_place integer, dish_count integer)
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select * from app_private.get_review_portfolio_labels(p_review_ids);
$$;

revoke all on function public.set_portfolio_pick(uuid, text, integer) from public, anon;
revoke all on function public.remove_portfolio_pick(uuid, text) from public, anon;
revoke all on function public.set_post_visibility(uuid, text) from public, anon;
revoke all on function public.get_portfolio_picks(uuid) from public, anon;
revoke all on function public.get_portfolio_diary(uuid, integer, timestamptz, uuid) from public, anon;
revoke all on function public.get_review_portfolio_labels(uuid[]) from public, anon;
grant execute on function public.set_portfolio_pick(uuid, text, integer) to authenticated, service_role;
grant execute on function public.remove_portfolio_pick(uuid, text) to authenticated, service_role;
grant execute on function public.set_post_visibility(uuid, text) to authenticated, service_role;
grant execute on function public.get_portfolio_picks(uuid) to authenticated, service_role;
grant execute on function public.get_portfolio_diary(uuid, integer, timestamptz, uuid) to authenticated, service_role;
grant execute on function public.get_review_portfolio_labels(uuid[]) to authenticated, service_role;

-- 4. Private entries: publish_post (and so submit_review's entry) takes "visibility".
select pg_temp.patch_function(
  'app_private.publish_post_core(jsonb, jsonb, uuid)',
  $f$      v_id, v_user, 'text', 'draft', 'public', v_caption, v_content,$f$,
  $f$      v_id, v_user, 'text', 'draft',
      case when p_post ->> 'visibility' = 'private' then 'private' else 'public' end,
      v_caption, v_content,$f$
);

-- No board credit for a private entry; one made public again is paid like a new post (the
-- unvoided-credit check stops a second payment).
select pg_temp.patch_function(
  'app_private.credit_post_board_points()',
  $f$  if new.status <> 'published' or new.deleted_at is not null then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.status = 'published' then
    return null;
  end if;$f$,
  $f$  if new.status <> 'published' or new.deleted_at is not null or new.visibility = 'private' then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.status = 'published' and old.visibility <> 'private' then
    return null;
  end if;$f$
);

-- An entry that goes private has every credit it earned voided, like a deleted one.
select pg_temp.patch_function(
  'app_private.void_post_board_points()',
  $f$    if not (new.status = 'deleted' or new.deleted_at is not null) then
      return null;
    end if;
    if old.status = 'deleted' or old.deleted_at is not null then
      return null;
    end if;
    v_post_id := new.id;
    v_reason := 'post_deleted';$f$,
  $f$    if new.visibility = 'private' and old.visibility <> 'private'
       and new.status <> 'deleted' and new.deleted_at is null then
      v_post_id := new.id;
      v_reason := 'post_private';
    else
      if not (new.status = 'deleted' or new.deleted_at is not null) then
        return null;
      end if;
      if old.status = 'deleted' or old.deleted_at is not null then
        return null;
      end if;
      v_post_id := new.id;
      v_reason := 'post_deleted';
    end if;$f$
);

drop trigger if exists trg_posts_credit_board_points on public.posts;
create trigger trg_posts_credit_board_points
after insert or update of status, visibility on public.posts
for each row execute function app_private.credit_post_board_points();

drop trigger if exists trg_posts_void_board_points on public.posts;
create trigger trg_posts_void_board_points
after update of status, deleted_at, visibility on public.posts
for each row execute function app_private.void_post_board_points();

-- 5. The first three ranked posts become the overall picks.
insert into public.portfolio_picks (user_id, kind, slot, post_id)
select ranked.user_id, 'overall', ranked.place::text, ranked.post_id
from (
  select
    up.id as user_id,
    p.id as post_id,
    row_number() over (partition by up.id order by pin.ord) as place
  from public.user_profiles up
  cross join lateral unnest(up.pinned_post_ids) with ordinality as pin(post_id, ord)
  join public.posts p
    on p.id = pin.post_id
   and p.author_id = up.id
   and p.status = 'published'
   and p.deleted_at is null
   and p.visibility <> 'private'
  join auth.users u on u.id = up.id
  where not exists (
    select 1 from public.post_moderation_states pms
    where pms.post_id = p.id and pms.state in ('hidden', 'removed')
  )
) ranked
where ranked.place <= 3
on conflict do nothing;

insert into app_private.request_rate_rules (route, anon_per_minute, user_per_minute, note) values
  ('rpc/set_portfolio_pick', null, 30, 'choose a best of a dish type or a top three place'),
  ('rpc/remove_portfolio_pick', null, 30, 'take a dish off the bests'),
  ('rpc/set_post_visibility', null, 30, 'Public or Only me on an entry'),
  ('rpc/get_portfolio_picks', null, 120, 'a diner''s bests and top three'),
  ('rpc/get_portfolio_diary', null, 120, 'a diner''s diary page'),
  ('rpc/get_review_portfolio_labels', null, 120, 'best-of labels beside reviews')
on conflict (route) do nothing;

-- The PDPA export includes your picks: 20261107120000's export_my_data plus portfolioPicks.
create or replace function app_private.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_data jsonb;
begin
  if v_user is null then
    raise exception 'export_my_data requires a signed-in user' using errcode = '42501';
  end if;

  v_data := jsonb_build_object(
    'profile',
      (select to_jsonb(t) from public.user_profiles t where t.id = v_user),
    'privacySettings',
      (select to_jsonb(t) from public.privacy_settings t where t.user_id = v_user),
    'appSettings',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_settings t where t.user_id = v_user), '[]'::jsonb),
    'notificationPreferences',
      (select to_jsonb(t) from public.notification_preferences t where t.user_id = v_user),
    'tasteVector',
      (select to_jsonb(t) from public.user_taste_vectors t where t.user_id = v_user),
    'quizResponses',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.quiz_responses t where t.user_id = v_user), '[]'::jsonb),
    'tasteEvents',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.taste_interaction_events t where t.user_id = v_user), '[]'::jsonb),
    'favouriteDishes',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_favourite_dishes t where t.user_id = v_user), '[]'::jsonb),
    'foodHistory',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_dish_affinities t where t.user_id = v_user), '[]'::jsonb),
    'reviews',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.reviews t where t.user_id = v_user), '[]'::jsonb),
    'posts',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.posts t where t.author_id = v_user), '[]'::jsonb),
    'postComments',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.post_comments t where t.user_id = v_user), '[]'::jsonb),
    'postLikes',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.post_likes t where t.user_id = v_user), '[]'::jsonb),
    'savedPosts',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.post_saves t where t.user_id = v_user), '[]'::jsonb),
    'postShares',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.post_shares t where t.user_id = v_user), '[]'::jsonb),
    'hiddenPosts',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.hidden_posts t where t.viewer_id = v_user), '[]'::jsonb),
    'bites',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.bites t where t.author_id = v_user), '[]'::jsonb),
    'biteReactions',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.bite_reactions t where t.user_id = v_user), '[]'::jsonb),
    'follows',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.follows t where t.follower_id = v_user or t.followee_id = v_user), '[]'::jsonb),
    'followedStalls',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.stall_follows t where t.user_id = v_user), '[]'::jsonb),
    'activityDays',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_activity_days t where t.user_id = v_user), '[]'::jsonb),
    'blocks',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_blocks t where t.blocker_id = v_user), '[]'::jsonb),
    'contentReports',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.content_reports t where t.reporter_id = v_user), '[]'::jsonb),
    'postReports',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.post_reports t where t.reporter_id = v_user), '[]'::jsonb),
    'checklists',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.checklists t where t.user_id = v_user), '[]'::jsonb),
    'checklistItems',
      coalesce((
        select jsonb_agg(to_jsonb(i))
        from public.checklist_items i
        join public.checklists c on c.id = i.checklist_id
        where c.user_id = v_user
      ), '[]'::jsonb),
    'portfolios',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.portfolios t where t.owner_id = v_user), '[]'::jsonb),
    'passportStamps',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.passport_stamps t where t.user_id = v_user), '[]'::jsonb),
    'foodCred',
      (select to_jsonb(t) from public.user_food_cred t where t.user_id = v_user),
    'foodCredEvents',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.food_cred_events t where t.user_id = v_user), '[]'::jsonb),
    'stallSubmissions',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_stall_submissions t where t.user_id = v_user), '[]'::jsonb),
    'menuPhotoSubmissions',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.menu_photo_submissions t where t.submitted_by = v_user), '[]'::jsonb),
    'conversations',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.conversation_participants t where t.participant_user_id = v_user), '[]'::jsonb),
    'messagesSent',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.messages t where t.sender_user_id = v_user), '[]'::jsonb),
    'activity',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.activity_events t where t.recipient_id = v_user), '[]'::jsonb),
    'merchantAccounts',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.merchant_accounts t where t.user_id = v_user), '[]'::jsonb),
    'accountDeletionRequests',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.account_deletion_requests t where t.user_id = v_user), '[]'::jsonb),
    'reviewHelpfulVotes',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.review_helpful_votes t where t.user_id = v_user), '[]'::jsonb),
    'portfolioItems',
      coalesce((
        select jsonb_agg(to_jsonb(i))
        from public.portfolio_items i
        join public.portfolios p on p.id = i.portfolio_id
        where p.owner_id = v_user
      ), '[]'::jsonb),
    'portfolioCollaborations',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.portfolio_collaborators t where t.user_id = v_user), '[]'::jsonb),
    'portfolioFollows',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.portfolio_follows t where t.user_id = v_user), '[]'::jsonb),
    'recommendationImpressions',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.recommendation_impressions t where t.user_id = v_user), '[]'::jsonb),
    'passportProgressEvents',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.passport_progress_events t where t.user_id = v_user), '[]'::jsonb),
    'stallInteractions',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_stall_interactions t where t.user_id = v_user), '[]'::jsonb),
    'missionProgress',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_mission_progress t where t.user_id = v_user), '[]'::jsonb),
    'moodSearchQueries',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.mood_search_queries t where t.user_id = v_user), '[]'::jsonb),
    'merchantMemberships',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.merchant_members t where t.user_id = v_user), '[]'::jsonb),
    'merchantClaimInterests',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.merchant_claim_interests t where t.claimed_by = v_user), '[]'::jsonb)
  ) || jsonb_build_object(
    'profileFavouriteDishes',
      coalesce((select jsonb_agg(to_jsonb(t) order by t.position) from public.profile_favourite_dishes t where t.user_id = v_user), '[]'::jsonb),
    'tasteRatings',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.dish_taste_ratings t where t.user_id = v_user), '[]'::jsonb),
    'catalogCorrections',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.catalog_corrections t where t.reporter_id = v_user), '[]'::jsonb),
    'notificationJobs',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.notification_jobs t where t.user_id = v_user), '[]'::jsonb)
  ) || jsonb_build_object(
    'portfolioPoints',
      coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.leaderboard_events t where t.user_id = v_user), '[]'::jsonb),
    'achievementUnlocks',
      coalesce((select jsonb_agg(to_jsonb(t) order by t.unlocked_at) from public.achievement_unlocks t where t.user_id = v_user), '[]'::jsonb),
    'leaderboardWeekResults',
      coalesce((select jsonb_agg(to_jsonb(t) order by t.week_start) from public.leaderboard_week_results t where t.user_id = v_user), '[]'::jsonb),
    'portfolioPicks',
      coalesce((select jsonb_agg(to_jsonb(t) order by t.kind, t.slot) from public.portfolio_picks t where t.user_id = v_user), '[]'::jsonb)
  );

  return jsonb_build_object(
    'exportVersion', 2,
    'generatedAt', now(),
    'categories', (select jsonb_agg(k order by k) from jsonb_object_keys(v_data) as k),
    'notIncluded', jsonb_build_array(
      'Push notification tokens (device identifiers that are only used to deliver alerts).',
      'Security, moderation and legal records. Email support to request these.',
      'Rate-limit counters and abuse-protection logs (security records, not personal content).',
      'Lists you reported (list reports are moderation records).'
    ),
    'data', v_data
  );
end;
$$;

notify pgrst, 'reload schema';
