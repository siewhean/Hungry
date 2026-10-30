-- smoke: supabase/smoke/merchant_archived_dishes_and_insight_facts.sql
-- Merchant Centre round-four phase 1 (MERCH-1, MERCH-12, MERCH-R4-2, MERCH-R4-3).
--
-- 1. A dish the merchant removed (dishes.archived_at, 20261021090000) stayed reachable: the Home
--    feed still counted it for has_menu and could name it as the stall's top dish, and
--    get_dish_detail still returned it to anyone holding the link. Both now skip archived dishes.
-- 2. The feed's top dish never names a dish that is sold out right now, and prefers a dish the
--    merchant marked Featured (availability flag "featured"), after the photo checks and before
--    must_order, so "Stall's pick" and the Home card agree.
-- 3. get_merchant_dashboard_summary counted archived dishes in menuCount and dishesWithoutImages.
-- 4. get_merchant_insight_facts(outlet) returns the counts behind the Insights screen in one
--    call, so the screen builds its tips from real data instead of a single line.
--
-- The feed and get_dish_detail are patched in place from their live bodies (as 20261025090000
-- did for the feed) so this file does not restate them; each patch checks its hit count.
-- Rollback: supabase/rollbacks/20261029140000_merchant_archived_dishes_and_insight_facts.down.sql.

-- 1+2. Home feed: archived dishes out of has_menu (three candidate queries) and the top dish,
-- featured dishes first.
do $$
declare
  v_sig constant regprocedure :=
    'public.get_discovery_feed_by_location(text,double precision,double precision,integer,integer,text)'::regprocedure;
  v_def text := pg_get_functiondef(v_sig);
  v_find_menu constant text := E'where d.venue_id = v.id\n            and d.price > 0\n';
  v_repl_menu constant text := E'where d.venue_id = v.id\n            and d.archived_at is null\n            and d.price > 0\n';
  v_find_top constant text := E'where d.venue_id = cv.id\n        and d.price > 0\n';
  v_repl_top constant text := E'where d.venue_id = cv.id\n        and d.archived_at is null\n        and d.price > 0\n';
  v_find_order constant text := E'        d.must_order desc,\n        d.is_featured desc,';
  v_repl_order constant text := E'        coalesce(''featured'' = any(d.availability_flags), false) desc,\n        d.must_order desc,\n        d.is_featured desc,';
  v_find_sold constant text := E'      order by\n        exists (\n          select 1\n          from dish_images di';
  v_repl_sold constant text := E'      order by\n        exists (\n          select 1\n          from unnest(coalesce(d.availability_flags, ''{}''::text[])) f\n          where public.merchant_normalize_availability_flag(f) = ''sold_out''\n        ) asc,\n        exists (\n          select 1\n          from dish_images di';
  v_hits integer;
begin
  if position('d.archived_at is null' in v_def) > 0 then
    return;
  end if;
  v_hits := (length(v_def) - length(replace(v_def, v_find_menu, ''))) / length(v_find_menu);
  if v_hits <> 3 then
    raise exception 'get_discovery_feed_by_location: expected 3 has_menu subqueries, found %', v_hits;
  end if;
  v_hits := (length(v_def) - length(replace(v_def, v_find_top, ''))) / length(v_find_top);
  if v_hits <> 1 then
    raise exception 'get_discovery_feed_by_location: expected 1 top dish query, found %', v_hits;
  end if;
  v_hits := (length(v_def) - length(replace(v_def, v_find_order, ''))) / length(v_find_order);
  if v_hits <> 1 then
    raise exception 'get_discovery_feed_by_location: expected 1 top dish ordering, found %', v_hits;
  end if;
  v_hits := (length(v_def) - length(replace(v_def, v_find_sold, ''))) / length(v_find_sold);
  if v_hits <> 1 then
    raise exception 'get_discovery_feed_by_location: expected 1 top dish photo ordering, found %', v_hits;
  end if;
  execute replace(
    replace(replace(replace(v_def, v_find_menu, v_repl_menu), v_find_top, v_repl_top), v_find_order, v_repl_order),
    v_find_sold, v_repl_sold
  );
end;
$$;

-- 1. Dish page: an archived dish is gone for everyone with the link.
do $$
declare
  v_sig constant regprocedure := 'public.get_dish_detail(text)'::regprocedure;
  v_def text := pg_get_functiondef(v_sig);
  v_find constant text := E'where d.id = p_dish_id\n';
  v_repl constant text := E'where d.id = p_dish_id\n    and d.archived_at is null\n';
  v_hits integer;
begin
  if position('d.archived_at is null' in v_def) > 0 then
    return;
  end if;
  v_hits := (length(v_def) - length(replace(v_def, v_find, ''))) / length(v_find);
  if v_hits <> 1 then
    raise exception 'get_dish_detail: expected 1 dish lookup, found %', v_hits;
  end if;
  execute replace(v_def, v_find, v_repl);
end;
$$;

-- 3. Dashboard counts: archived dishes are not on the menu.
create or replace function public.get_merchant_dashboard_summary(p_outlet_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_venue_id text;
begin
  select mo.venue_id into v_venue_id
  from public.merchant_outlets mo
  where mo.id = p_outlet_id;

  if not found then
    raise exception 'not authorized to read this outlet' using errcode = '42501';
  end if;

  if v_venue_id is null then
    return jsonb_build_object(
      'menuCount', 0,
      'dishesWithoutImages', 0,
      'unrepliedReviews', 0,
      'latestReview', null
    );
  end if;

  return jsonb_build_object(
    'menuCount', (
      select count(*)::integer
      from public.dishes d
      where d.venue_id = v_venue_id and d.archived_at is null
    ),
    'dishesWithoutImages', (
      select count(*)::integer
      from public.dishes d
      where d.venue_id = v_venue_id
        and d.archived_at is null
        and coalesce(trim(d.image_url), '') = ''
        and not exists (select 1 from public.dish_images di where di.dish_id = d.id)
    ),
    'unrepliedReviews', (
      select count(*)::integer
      from public.reviews r
      where r.venue_id = v_venue_id
        and r.merchant_reply_text is null
    ),
    'latestReview', (
      select jsonb_build_object(
        'id', r.id,
        'authorName', r.author_name,
        'rating', r.rating,
        'text', r.text,
        'createdAt', r.created_at
      )
      from public.reviews r
      where r.venue_id = v_venue_id
      order by r.created_at desc, r.id
      limit 1
    )
  );
end;
$$;

revoke all on function public.get_merchant_dashboard_summary(uuid) from public, anon;
grant execute on function public.get_merchant_dashboard_summary(uuid)
  to authenticated, service_role;

-- 4. Insight facts: one read, under the caller's own RLS (the outlet's team only), like the
-- dashboard summary. Sold-out counts are today's state: no history is stored.
create or replace function public.get_merchant_insight_facts(p_outlet_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_venue_id text;
begin
  select mo.venue_id into v_venue_id
  from public.merchant_outlets mo
  where mo.id = p_outlet_id;

  if not found then
    raise exception 'not authorized to read this outlet' using errcode = '42501';
  end if;

  if v_venue_id is null then
    return jsonb_build_object(
      'dishCount', 0,
      'dishesWithoutPhoto', 0,
      'soldOutCount', 0,
      'soldOutNames', '[]'::jsonb,
      'unrepliedReviews', 0,
      'oldestUnrepliedAt', null,
      'reviewsLast7Days', 0,
      'ratingLast7Days', null,
      'reviewsPrevious7Days', 0,
      'ratingPrevious7Days', null
    );
  end if;

  return (
    with live as (
      select
        d.name,
        coalesce(trim(d.image_url), '') = ''
          and not exists (select 1 from public.dish_images di where di.dish_id = d.id) as no_photo,
        exists (
          select 1
          from unnest(coalesce(d.availability_flags, '{}'::text[])) f
          where public.merchant_normalize_availability_flag(f) = 'sold_out'
        ) as sold_out
      from public.dishes d
      where d.venue_id = v_venue_id and d.archived_at is null
    ),
    recent as (
      select
        count(*) filter (where r.created_at >= now() - interval '7 days') as n_now,
        avg(r.rating) filter (where r.created_at >= now() - interval '7 days') as avg_now,
        count(*) filter (
          where r.created_at < now() - interval '7 days' and r.created_at >= now() - interval '14 days'
        ) as n_prev,
        avg(r.rating) filter (
          where r.created_at < now() - interval '7 days' and r.created_at >= now() - interval '14 days'
        ) as avg_prev,
        count(*) filter (where r.merchant_reply_text is null) as unreplied,
        min(r.created_at) filter (where r.merchant_reply_text is null) as oldest_unreplied
      from public.reviews r
      where r.venue_id = v_venue_id
    )
    select jsonb_build_object(
      'dishCount', (select count(*)::integer from live),
      'dishesWithoutPhoto', (select count(*)::integer from live where no_photo),
      'soldOutCount', (select count(*)::integer from live where sold_out),
      'soldOutNames', coalesce(
        (select jsonb_agg(s.name) from (select name from live where sold_out order by name limit 3) s),
        '[]'::jsonb
      ),
      'unrepliedReviews', recent.unreplied::integer,
      'oldestUnrepliedAt', recent.oldest_unreplied,
      'reviewsLast7Days', recent.n_now::integer,
      'ratingLast7Days', round(recent.avg_now, 2),
      'reviewsPrevious7Days', recent.n_prev::integer,
      'ratingPrevious7Days', round(recent.avg_prev, 2)
    )
    from recent
  );
end;
$$;

revoke all on function public.get_merchant_insight_facts(uuid) from public, anon;
grant execute on function public.get_merchant_insight_facts(uuid)
  to authenticated, service_role;
