-- Merchants archive dishes instead of deleting them (round-two page review, merchant critical).
--
-- A hard DELETE on dishes cascaded to reviews, user_favourite_dishes,
-- checklist_items and portfolio_items, so removing a dish from the menu erased
-- diner content, and a merchant could wipe bad reviews by deleting and
-- re-creating a dish.
--
-- 1. dishes.archived_at marks a dish the merchant took off the menu. The row,
--    and everything diners attached to it, stays.
-- 2. Merchants (any authenticated non-ops user) may hard-delete drafts only.
--    Ops, service role and migrations are unchanged.
-- 3. merchant_remove_dish deletes a draft, or archives any other dish.
-- 4. Archived dishes are left out of the raw catalog (cards, media, venue card
--    counts/prices/tags/representative dish) the same way drafts are, and out
--    of search_dishes.
--
-- Full catalog publishes: p_expected_dishes counts must leave drafts AND
-- archived dishes out.

begin;

alter table public.dishes
  add column if not exists archived_at timestamptz;

create index if not exists idx_dishes_archived_venue
  on public.dishes (venue_id)
  where archived_at is not null;

-- 2. Delete scope
create or replace function app_private.enforce_merchant_dish_draft_scope()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_verified boolean;
begin
  -- Service role, migrations and SECURITY DEFINER jobs are not merchant writes.
  if current_user not in ('authenticated', 'anon') or public.app_is_current_user_ops_admin() then
    return coalesce(new, old);
  end if;

  v_verified := public.merchant_venue_is_verified(
    case when tg_op = 'DELETE' then old.venue_id else new.venue_id end
  );

  if tg_op = 'INSERT' then
    new.merchant_draft := not v_verified;
    return new;
  end if;

  -- Only drafts can be deleted. A dish diners could see may carry reviews,
  -- favourites and list items (all ON DELETE CASCADE), so it is archived instead.
  if tg_op = 'DELETE' and not old.merchant_draft then
    raise exception 'Remove this dish from your menu instead; its diner reviews are kept.'
      using errcode = '42501';
  end if;

  if v_verified then
    if tg_op = 'UPDATE' then
      -- A verified merchant's save publishes the dish (the write guard approves it).
      new.merchant_draft := false;
      return new;
    end if;
    return old;
  end if;

  if not old.merchant_draft then
    raise exception 'Verify your stall to change dishes diners can already see.'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    new.merchant_draft := true;
    return new;
  end if;
  return old;
end;
$$;

-- 3. Remove = delete a draft, archive anything else
create or replace function public.merchant_remove_dish(p_dish_id text, p_venue_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.dishes d
  where d.id = p_dish_id
    and d.venue_id = p_venue_id
    and d.merchant_draft;
  if found then
    return;
  end if;

  update public.dishes d
  set archived_at = coalesce(d.archived_at, now())
  where d.id = p_dish_id
    and d.venue_id = p_venue_id;
  if not found then
    raise exception 'dish not found or not editable' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.merchant_remove_dish(text, text) from public, anon;
grant execute on function public.merchant_remove_dish(text, text) to authenticated, service_role;

-- 4. Archived dishes stay out of the raw catalog
create or replace function app_private.catalog_raw_skip_merchant_draft_dish()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_dish_id text;
begin
  if tg_table_name = 'catalog_raw_dish_cards' then
    v_dish_id := new.id;
  else
    v_dish_id := new.dish_id;
  end if;
  if exists (select 1 from public.dishes d where d.id = v_dish_id and (d.merchant_draft or d.archived_at is not null)) then
    return null;
  end if;
  return new;
end;
$$;

create or replace function app_private.catalog_raw_venue_card_without_drafts()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if not exists (select 1 from public.dishes d where d.venue_id = new.id and (d.merchant_draft or d.archived_at is not null)) then
    return new;
  end if;

  select coalesce(count(*)::integer, 0), min(d.price)
  into new.menu_count, new.min_price
  from public.dishes d
  where d.venue_id = new.id and not d.merchant_draft and d.archived_at is null;

  select coalesce(array_remove(array_agg(distinct tag), null), '{}')
  into new.cuisine_tags
  from public.dishes d
  left join lateral unnest(d.cuisine_tags) tag on true
  where d.venue_id = new.id and not d.merchant_draft and d.archived_at is null;

  select coalesce(array_agg(distinct dfl.slug order by dfl.slug), '{}')
  into new.dietary_flags
  from public.dishes d
  join public.dish_dietary_flags ddf on ddf.dish_id = d.id
  join public.dietary_flags dfl on dfl.id = ddf.dietary_flag_id
  where d.venue_id = new.id and not d.merchant_draft and d.archived_at is null;

  if exists (
    select 1 from public.dishes d
    where d.id = new.representative_dish ->> 'id' and (d.merchant_draft or d.archived_at is not null)
  ) then
    select
      jsonb_build_object(
        'id', d.id, 'name', d.name, 'image_url', d.image_url, 'price', d.price,
        'verification_status', case when d.menu_approved_for_display and d.media_approved_for_display then 'approved'
          when d.source_confidence >= 0.85 then 'verified' else 'raw' end
      ),
      coalesce(d.rating_avg, 0),
      coalesce(d.review_count, 0)
    into new.representative_dish, new.quality_rating, new.quality_review_count
    from public.dishes d
    where d.venue_id = new.id and not d.merchant_draft and d.archived_at is null
    order by d.rating_avg desc nulls last, d.review_count desc nulls last, d.id
    limit 1;
    if not found then
      new.representative_dish := null;
      new.quality_rating := 0;
      new.quality_review_count := 0;
    end if;
  end if;

  return new;
end;
$$;

-- 4. ...and out of search_dishes (unchanged apart from the archived_at filter)
create or replace function public.search_dishes(
  p_query text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_meters integer default null,
  p_dietary_flags text[] default '{}'::text[],
  p_limit integer default 20,
  p_cursor_score double precision default null,
  p_cursor_id text default null,
  p_venue_id text default null,
  p_area_name text default null,
  p_cuisine_tags text[] default null,
  p_max_price numeric default null,
  p_open_only boolean default false
)
returns table (
  dish_id text,
  venue_id text,
  building_id text,
  venue_name text,
  unit_number text,
  floor text,
  name text,
  image_url text,
  blurhash text,
  distance_meters integer,
  rating numeric,
  review_count integer,
  price numeric,
  price_range text,
  live_crowd text,
  taste_tags text[],
  taste_vector jsonb,
  dietary_flags text[],
  gallery text[],
  description text,
  must_order boolean,
  availability_flags text[],
  rank_score double precision,
  cursor_score double precision,
  cursor_id text
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with query_area_match as (
    select a.name, a.center_lat, a.center_lng
    from areas a
    where nullif(trim(coalesce(p_area_name, p_query, '')), '') is not null
      and a.name_normalized = lower(trim(coalesce(p_area_name, p_query)))
    limit 1
  ),
  params as (
    select
      case
        when exists (select 1 from query_area_match)
          and nullif(trim(coalesce(p_area_name, '')), '') is null
          then null
        else nullif(trim(coalesce(p_query, '')), '')
      end as query,
      coalesce((select center_lat from query_area_match), p_lat) as lat,
      coalesce((select center_lng from query_area_match), p_lng) as lng,
      case
        when (select center_lat from query_area_match) is not null then greatest(coalesce(p_radius_meters, 3000), 1)
        else nullif(p_radius_meters, 0)
      end as radius_meters,
      coalesce(p_dietary_flags, '{}'::text[]) as dietary_flags,
      coalesce(p_cuisine_tags, '{}'::text[]) as cuisine_tags,
      p_max_price as max_price,
      coalesce(p_open_only, false) as open_only,
      nullif(trim(coalesce(p_area_name, '')), '') is not null as area_requested,
      exists (select 1 from query_area_match) as area_found,
      least(greatest(coalesce(p_limit, 20), 1), 50) as result_limit,
      p_cursor_score as cursor_score,
      nullif(p_cursor_id, '') as cursor_id,
      nullif(p_venue_id, '') as venue_id
  ),
  candidate_ids as materialized (
    select distinct dish_id
    from (
      (
        select d.id as dish_id
        from dishes d
        cross join params
        where params.query is not null
          and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
          and (params.venue_id is null or d.venue_id = params.venue_id)
          and (
            d.name ilike '%' || params.query || '%'
            or d.name % params.query
          )
        order by greatest(
          similarity(d.name, params.query),
          case when d.name ilike '%' || params.query || '%' then 0.65 else 0 end
        ) desc, d.rating_avg desc, d.id
        limit 250
      )

      union all

      (
        select d.id as dish_id
        from dishes d
        join venues v on v.id = d.venue_id
        cross join params
        where params.query is not null
          and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
          and (params.venue_id is null or d.venue_id = params.venue_id)
          and (
            v.name ilike '%' || params.query || '%'
            or v.name % params.query
          )
        order by greatest(
          similarity(v.name, params.query),
          case when v.name ilike '%' || params.query || '%' then 0.55 else 0 end
        ) desc, d.rating_avg desc, d.id
        limit 250
      )

      union all

      (
        select d.id as dish_id
        from dishes d
        join venues v on v.id = d.venue_id
        cross join params
        where params.query is not null
          and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
          and (params.venue_id is null or d.venue_id = params.venue_id)
          and (
            coalesce(d.food_type, '') ilike '%' || params.query || '%'
            or array_to_string(d.taste_tags, ' ') ilike '%' || params.query || '%'
            or array_to_string(d.cuisine_tags, ' ') ilike '%' || params.query || '%'
            or array_to_string(v.cuisine_tags, ' ') ilike '%' || params.query || '%'
          )
        order by d.rating_avg desc, d.id
        limit 250
      )

      union all

      (
        select d.id as dish_id
        from dishes d
        join venues v on v.id = d.venue_id
        join buildings b on b.id = d.building_id
        cross join params
        where params.query is null
          and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
          and (not params.area_requested or params.area_found)
          and (params.venue_id is null or d.venue_id = params.venue_id)
          and (
            params.radius_meters is null
            or (
              params.lat is not null
              and params.lng is not null
              and st_dwithin(
                coalesce(v.location, b.location),
                st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography,
                params.radius_meters
              )
            )
            or (
              (params.lat is null or params.lng is null)
              and d.distance_meters <= params.radius_meters
            )
          )
        order by d.rating_avg desc, d.review_count desc, d.id
        limit 750
      )
    ) matched
    limit 750
  ),
  lean_candidates as (
    select
      d.id as dish_id,
      d.venue_id,
      d.building_id,
      v.name as venue_name,
      v.unit_number,
      v.floor,
      d.name,
      coalesce(
        public.catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url),
        public.catalog_display_image_url(v.image_url, v.media_approved_for_display, v.media_rights_status, v.media_source_url)
      ) as image_url,
      d.blurhash,
      case
        when params.lat is not null and params.lng is not null then
          st_distance(
            coalesce(v.location, b.location),
            st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography
          )::integer
        else d.distance_meters
      end as distance_meters,
      d.rating_avg as rating,
      d.review_count,
      d.price,
      d.price_range,
      d.live_crowd,
      d.taste_tags,
      d.description,
      d.must_order,
      d.availability_flags,
      case
        when params.query is null then 1::double precision
        else greatest(
          similarity(d.name, params.query),
          similarity(v.name, params.query),
          case
            when d.name ilike '%' || params.query || '%'
              or v.name ilike '%' || params.query || '%'
              or coalesce(d.food_type, '') ilike '%' || params.query || '%'
              or array_to_string(d.taste_tags, ' ') ilike '%' || params.query || '%'
              or array_to_string(d.cuisine_tags, ' ') ilike '%' || params.query || '%'
              or array_to_string(v.cuisine_tags, ' ') ilike '%' || params.query || '%'
              then 0.55
            else 0
          end
        )
      end as text_score,
      least(greatest(d.rating_avg::double precision / 5, 0), 1) as rating_score,
      case
        when params.radius_meters is null then greatest(0, 1 - (d.distance_meters::double precision / 2500))
        else greatest(0, 1 - (
          case
            when params.lat is not null and params.lng is not null then
              st_distance(
                coalesce(v.location, b.location),
                st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography
              )
            else d.distance_meters::double precision
          end / greatest(params.radius_meters, 1)
        ))
      end as distance_score
    from candidate_ids ci
    join dishes d on d.id = ci.dish_id
    join venues v on v.id = d.venue_id
    join buildings b on b.id = d.building_id
    cross join params
    where public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
      and d.archived_at is null
      and (not params.area_requested or params.area_found)
      and (params.venue_id is null or d.venue_id = params.venue_id)
      and (not params.open_only or (v.is_open = true and b.is_closed_today = false))
      and (params.max_price is null or d.price <= params.max_price)
      and (
        cardinality(params.cuisine_tags) = 0
        or d.cuisine_tags && params.cuisine_tags
        or v.cuisine_tags && params.cuisine_tags
      )
      and (
        cardinality(params.dietary_flags) = 0
        or d.availability_flags && params.dietary_flags
        or v.dietary_tags && params.dietary_flags
        or not exists (
          select 1
          from unnest(params.dietary_flags) as requested(flag)
          where not exists (
            select 1
            from dish_dietary_flags ddf
            join dietary_flags df on df.id = ddf.dietary_flag_id
            where ddf.dish_id = d.id
              and df.slug::text = requested.flag
          )
        )
      )
      and (
        params.radius_meters is null
        or (
          params.lat is not null
          and params.lng is not null
          and st_dwithin(
            coalesce(v.location, b.location),
            st_setsrid(st_makepoint(params.lng, params.lat), 4326)::geography,
            params.radius_meters
          )
        )
        or (
          (params.lat is null or params.lng is null)
          and d.distance_meters <= params.radius_meters
        )
      )
  ),
  scored as (
    select
      lean_candidates.*,
      (
        (0.55 * lean_candidates.text_score)
        + (0.25 * lean_candidates.rating_score)
        + (0.20 * lean_candidates.distance_score)
      )::double precision as rank_score
    from lean_candidates
  ),
  limited as materialized (
    select scored.*
    from scored
    cross join params
    where (
      params.cursor_score is null
      or scored.rank_score < params.cursor_score
      or (scored.rank_score = params.cursor_score and scored.dish_id > params.cursor_id)
    )
    order by scored.rank_score desc, scored.dish_id
    limit (select result_limit from params)
  )
  select
    limited.dish_id,
    limited.venue_id,
    limited.building_id,
    limited.venue_name,
    limited.unit_number,
    limited.floor,
    limited.name,
    limited.image_url,
    limited.blurhash,
    limited.distance_meters,
    limited.rating,
    limited.review_count,
    limited.price,
    limited.price_range,
    limited.live_crowd,
    limited.taste_tags,
    jsonb_build_object(
      'sweet', coalesce(dtv.sweet, 5),
      'spicy', coalesce(dtv.spicy, 5),
      'sour', coalesce(dtv.sour, 5),
      'salty', coalesce(dtv.salty, 5),
      'rich', coalesce(dtv.rich, 5),
      'aromatic', coalesce(dtv.aromatic, 5)
    ) as taste_vector,
    coalesce((
      select array_agg(df.slug::text order by df.slug::text)
      from dish_dietary_flags ddf
      join dietary_flags df on df.id = ddf.dietary_flag_id
      where ddf.dish_id = limited.dish_id
    ), '{}'::text[]) as dietary_flags,
    coalesce((
      select array_agg(safe_image.url order by safe_image.sort_order)
      from (
        select
          di.sort_order,
          public.catalog_display_image_url(di.url, di.media_approved_for_display, di.media_rights_status, di.media_source_url) as url
        from dish_images di
        where di.dish_id = limited.dish_id
      ) safe_image
      where safe_image.url is not null
    ), case
      when limited.image_url is null then '{}'::text[]
      else array[limited.image_url]
    end) as gallery,
    limited.description,
    limited.must_order,
    limited.availability_flags,
    limited.rank_score,
    limited.rank_score as cursor_score,
    limited.dish_id as cursor_id
  from limited
  left join dish_taste_vectors dtv on dtv.dish_id = limited.dish_id
  order by limited.rank_score desc, limited.dish_id;
$$;


commit;
