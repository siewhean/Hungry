-- Undo 20261029140000_merchant_archived_dishes_and_insight_facts: the feed and the dish page go
-- back to the bodies without the archived-dish filter (and the feed loses the featured-first
-- preference), the dashboard summary counts archived dishes again, and the insight facts
-- function is dropped. Nothing is stored, so no data is lost.

do $$
declare
  v_sig constant regprocedure :=
    'public.get_discovery_feed_by_location(text,double precision,double precision,integer,integer,text)'::regprocedure;
  v_def text := pg_get_functiondef(v_sig);
  v_menu constant text := E'where d.venue_id = v.id\n            and d.archived_at is null\n            and d.price > 0\n';
  v_menu_old constant text := E'where d.venue_id = v.id\n            and d.price > 0\n';
  v_top constant text := E'where d.venue_id = cv.id\n        and d.archived_at is null\n        and d.price > 0\n';
  v_top_old constant text := E'where d.venue_id = cv.id\n        and d.price > 0\n';
  v_order constant text := E'        coalesce(''featured'' = any(d.availability_flags), false) desc,\n        d.must_order desc,\n        d.is_featured desc,';
  v_order_old constant text := E'        d.must_order desc,\n        d.is_featured desc,';
  v_sold constant text := E'      order by\n        exists (\n          select 1\n          from unnest(coalesce(d.availability_flags, ''{}''::text[])) f\n          where public.merchant_normalize_availability_flag(f) = ''sold_out''\n        ) asc,\n        exists (\n          select 1\n          from dish_images di';
  v_sold_old constant text := E'      order by\n        exists (\n          select 1\n          from dish_images di';
begin
  if position('d.archived_at is null' in v_def) = 0 then
    return;
  end if;
  execute replace(
    replace(replace(replace(v_def, v_menu, v_menu_old), v_top, v_top_old), v_order, v_order_old),
    v_sold, v_sold_old
  );
end;
$$;

do $$
declare
  v_sig constant regprocedure := 'public.get_dish_detail(text)'::regprocedure;
  v_def text := pg_get_functiondef(v_sig);
begin
  if position('d.archived_at is null' in v_def) = 0 then
    return;
  end if;
  execute replace(v_def, E'where d.id = p_dish_id\n    and d.archived_at is null\n', E'where d.id = p_dish_id\n');
end;
$$;

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
      select count(*)::integer from public.dishes d where d.venue_id = v_venue_id
    ),
    'dishesWithoutImages', (
      select count(*)::integer
      from public.dishes d
      where d.venue_id = v_venue_id
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

drop function if exists public.get_merchant_insight_facts(uuid);
