-- Undo 20261029120000_catalog_venue_card_logo_main_price: put back catalog_raw_venues_page and
-- catalog_suggest from 20261029113000_catalog_search_relevance, then drop the trigger and the two
-- venue card columns.
-- down-loses-data: logo_url and main_price on venue cards; the up migration (or the next publish) refills them

drop trigger if exists catalog_raw_venue_cards_fill_logo_main_price on public.catalog_raw_venue_cards;
drop function if exists app_private.catalog_raw_venue_cards_fill_logo_main_price();

create or replace function public.catalog_raw_venues_page(
  p_query text default null, p_lat double precision default null, p_lng double precision default null, p_radius_meters integer default null,
  p_cuisine_tags text[] default '{}', p_dietary_flags text[] default '{}', p_max_price numeric default null, p_open_only boolean default false,
  p_sort text default 'quality', p_cursor text default null, p_release_id uuid default null, p_limit integer default 24,
  p_building_types text[] default '{}', p_food_keywords text[] default '{}', p_building_id text default null
) returns jsonb language plpgsql security definer set search_path = public, extensions set plan_cache_mode = force_custom_plan as $$
declare
  v_release uuid; v_limit integer := least(greatest(coalesce(p_limit, 24), 1), 50); v_items jsonb; v_next text; v_fingerprint text; v_cursor jsonb;
  v_match_count integer;
  v_query text := left(nullif(trim(coalesce(p_query, '')), ''), 80);
  v_like text;
  v_food_patterns text[];
  v_totals jsonb;
  v_slots integer[]; v_variants text[]; v_weights double precision[]; v_n integer := 0;
  v_tok1 text; v_tok2 text; v_tok3 text; v_tok4 text;
  v_pat1 text[]; v_pat2 text[]; v_pat3 text[]; v_pat4 text[];
begin
  perform public.catalog_raw_require_authenticated(); v_release := public.catalog_raw_release_for_read(p_release_id);
  v_totals := (select jsonb_build_object('venues', venue_total, 'dishes', dish_total) from public.catalog_releases where id = v_release);
  if v_query is not null and char_length(v_query) < 2 then
    return jsonb_build_object('items', '[]'::jsonb, 'next_cursor', null, 'release_id', v_release, 'match_count', 0, 'totals', v_totals);
  end if;
  v_like := '%' || replace(replace(replace(coalesce(v_query, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  if v_query is not null then
    select coalesce(array_agg(t.slot order by t.slot, t.variant), '{}'), coalesce(array_agg(t.variant order by t.slot, t.variant), '{}'),
      coalesce(array_agg(t.weight order by t.slot, t.variant), '{}'), coalesce(max(t.slot), 0),
      max(t.variant) filter (where t.slot = 1 and t.is_token), max(t.variant) filter (where t.slot = 2 and t.is_token),
      max(t.variant) filter (where t.slot = 3 and t.is_token), max(t.variant) filter (where t.slot = 4 and t.is_token),
      array_agg(t.pattern) filter (where t.slot = 1), array_agg(t.pattern) filter (where t.slot = 2),
      array_agg(t.pattern) filter (where t.slot = 3), array_agg(t.pattern) filter (where t.slot = 4)
    into v_slots, v_variants, v_weights, v_n, v_tok1, v_tok2, v_tok3, v_tok4, v_pat1, v_pat2, v_pat3, v_pat4
    from app_private.catalog_search_terms(v_query) t;
    if v_n = 0 then
      return jsonb_build_object('items', '[]'::jsonb, 'next_cursor', null, 'release_id', v_release, 'match_count', 0, 'totals', v_totals);
    end if;
  end if;
  v_food_patterns := coalesce((
    select array_agg('%' || replace(replace(replace(k.keyword, '\', '\\'), '%', '\%'), '_', '\_') || '%')
    from (
      select left(trim(raw.keyword), 40) as keyword
      from unnest(coalesce(p_food_keywords, '{}')) as raw(keyword)
      where nullif(trim(raw.keyword), '') is not null
      limit 12
    ) k
  ), '{}');
  v_fingerprint := md5(concat_ws('|', coalesce(lower(v_query), ''), coalesce(p_lat::text, ''), coalesce(p_lng::text, ''), coalesce(p_radius_meters::text, ''), array_to_string(coalesce(p_cuisine_tags, '{}'), ','), array_to_string(coalesce(p_dietary_flags, '{}'), ','), array_to_string(coalesce(p_building_types, '{}'), ','), array_to_string(v_food_patterns, ','), coalesce(p_max_price::text, ''), p_open_only::text, p_sort, coalesce(p_building_id, '')));
  v_cursor := case when p_cursor is null then null else public.catalog_raw_cursor_value(p_cursor) end;
  if v_cursor is not null and ((v_cursor->>'release_id')::uuid <> v_release or v_cursor->>'fingerprint' <> v_fingerprint) then raise exception 'catalog cursor mismatch' using errcode = '22023'; end if;
  with dish_term_hits as materialized (
    -- For each stall and query word: how well its best dish (name or food type) answers that word.
    select dc.venue_id, array[max(t.s[1]), max(t.s[2]), max(t.s[3]), max(t.s[4])] as scores
    from public.catalog_raw_dish_cards dc
    cross join lateral (
      select app_private.catalog_dish_term_scores(v_slots, v_variants, v_weights, dc.name, dc.food_type) as s
      offset 0 -- evaluated once per dish
    ) t
    where v_n > 0 and dc.release_id = v_release
      and (
        (v_n >= 1 and (dc.name ilike any(v_pat1) or dc.food_type ilike any(v_pat1) or v_tok1 <% dc.name or v_tok1 <% dc.food_type))
        or (v_n >= 2 and (dc.name ilike any(v_pat2) or dc.food_type ilike any(v_pat2) or v_tok2 <% dc.name or v_tok2 <% dc.food_type))
        or (v_n >= 3 and (dc.name ilike any(v_pat3) or dc.food_type ilike any(v_pat3) or v_tok3 <% dc.name or v_tok3 <% dc.food_type))
        or (v_n >= 4 and (dc.name ilike any(v_pat4) or dc.food_type ilike any(v_pat4) or v_tok4 <% dc.name or v_tok4 <% dc.food_type))
      )
    group by dc.venue_id
  ), food_matches as materialized (
    -- Stalls that sell a dish of the requested food types (Noodles, Rice chips), near the viewer when a radius is set.
    select distinct dc.venue_id
    from public.catalog_raw_dish_cards dc
    where cardinality(v_food_patterns) > 0
      and dc.release_id = v_release
      and (dc.food_type ilike any(v_food_patterns) or dc.name ilike any(v_food_patterns))
      and (p_lat is null or p_lng is null or p_radius_meters is null or st_dwithin(dc.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_meters))
  ), candidates as materialized (
    select c.*, coalesce(st_distance(c.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)::integer, 2147483647) as computed_distance,
      coalesce(c.min_price, 1000000)::double precision as price_key,
      round((case when v_query is null then 0::double precision
           else m.score
             + case when lower(c.name) = lower(v_query) then 0.1 when c.name ilike v_like then 0.05 else 0 end
             + coalesce(0.15 * exp(-st_distance(c.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 3000.0), 0)
             + 0.04 * least(ln(1 + greatest(c.quality_review_count, 0)::double precision) / ln(51::double precision), 1)
             + 0.03 * least(greatest(c.quality_rating, 0)::double precision, 5) / 5
             + case when c.verification_status in ('verified', 'approved') then 0.02 else 0 end
             + case when c.image_url is not null then 0.01 else 0 end end)::numeric, 6)::double precision as relevance
    from public.catalog_raw_venue_cards c
    left join dish_term_hits dth on dth.venue_id = c.id
    left join food_matches fm on fm.venue_id = c.id
    cross join lateral (
      select case when v_n = 0 then 0::double precision
        else app_private.catalog_venue_match(v_slots, v_variants, v_weights, v_n, c.name, c.building_name, dth.scores) end as score
      offset 0 -- keeps the planner from inlining the match once per use of m.score
    ) m
    where c.release_id = v_release and (p_open_only = false or c.is_open)
      and (p_building_id is null or c.building_id = p_building_id)
      and (cardinality(coalesce(p_building_types, '{}')) = 0 or c.building_type = any(p_building_types))
      and (cardinality(coalesce(p_cuisine_tags, '{}')) = 0 or c.cuisine_tags && p_cuisine_tags)
      and (cardinality(coalesce(p_dietary_flags, '{}')) = 0 or c.dietary_flags @> p_dietary_flags)
      and (cardinality(v_food_patterns) = 0 or fm.venue_id is not null)
      and (p_max_price is null or c.min_price <= p_max_price)
      and (p_lat is null or p_lng is null or p_radius_meters is null or st_dwithin(c.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_meters))
      -- Cheap word filter first, so the scoring function only runs for stalls that can match: each word
      -- must be near the stall name or building, or hit one of the stall's dishes (dish_term_hits).
      and (v_n = 0 or (
        (v_n < 1 or coalesce(dth.scores[1], 0) > 0 or c.name ilike any(v_pat1) or c.building_name ilike any(v_pat1) or v_tok1 <% c.name or v_tok1 <% c.building_name)
        and (v_n < 2 or coalesce(dth.scores[2], 0) > 0 or c.name ilike any(v_pat2) or c.building_name ilike any(v_pat2) or v_tok2 <% c.name or v_tok2 <% c.building_name)
        and (v_n < 3 or coalesce(dth.scores[3], 0) > 0 or c.name ilike any(v_pat3) or c.building_name ilike any(v_pat3) or v_tok3 <% c.name or v_tok3 <% c.building_name)
        and (v_n < 4 or coalesce(dth.scores[4], 0) > 0 or c.name ilike any(v_pat4) or c.building_name ilike any(v_pat4) or v_tok4 <% c.name or v_tok4 <% c.building_name)
      ))
      and (v_n = 0 or m.score > 0)
  ), page as materialized (
    select * from candidates c where v_cursor is null
      or (p_sort = 'nearby' and (c.computed_distance > (v_cursor->>'distance')::integer or (c.computed_distance = (v_cursor->>'distance')::integer and (lower(c.name) > v_cursor->>'name' or (lower(c.name) = v_cursor->>'name' and c.id > v_cursor->>'id')))))
      or (p_sort = 'relevance' and (c.relevance < (v_cursor->>'score')::double precision or (c.relevance = (v_cursor->>'score')::double precision and (lower(c.name) > v_cursor->>'name' or (lower(c.name) = v_cursor->>'name' and c.id > v_cursor->>'id')))))
      or (p_sort = 'price' and (c.price_key > (v_cursor->>'score')::double precision or (c.price_key = (v_cursor->>'score')::double precision and (lower(c.name) > v_cursor->>'name' or (lower(c.name) = v_cursor->>'name' and c.id > v_cursor->>'id')))))
      or (p_sort not in ('nearby', 'relevance', 'price') and (c.quality_rating < (v_cursor->>'score')::numeric or (c.quality_rating = (v_cursor->>'score')::numeric and (c.quality_review_count < (v_cursor->>'review_count')::integer or (c.quality_review_count = (v_cursor->>'review_count')::integer and (lower(c.name) > v_cursor->>'name' or (lower(c.name) = v_cursor->>'name' and c.id > v_cursor->>'id')))))))
    order by case when p_sort = 'nearby' then c.computed_distance end asc, case when p_sort = 'relevance' then c.relevance end desc, case when p_sort = 'price' then c.price_key end asc, case when p_sort not in ('nearby', 'relevance', 'price') then c.quality_rating end desc, case when p_sort not in ('nearby', 'relevance', 'price') then c.quality_review_count end desc, lower(c.name) asc, c.id asc limit v_limit + 1
  ), visible as (select * from page limit v_limit), tail as (select * from page offset v_limit limit 1), cursor_row as (
    select * from visible
    where exists (select 1 from tail)
    order by
      case when p_sort = 'nearby' then computed_distance end desc,
      case when p_sort = 'relevance' then relevance end asc,
      case when p_sort = 'price' then price_key end desc,
      case when p_sort not in ('nearby', 'relevance', 'price') then quality_rating end asc,
      case when p_sort not in ('nearby', 'relevance', 'price') then quality_review_count end asc,
      lower(name) desc,
      id desc
    limit 1
  )
  select
    coalesce(jsonb_agg(
      -- Venue cards have no stored distance; report the real one from the viewer.
      (to_jsonb(visible) - 'listing_location' - 'computed_distance' - 'relevance' - 'price_key')
        || jsonb_build_object('distance_meters', nullif(computed_distance, 2147483647))
      order by
        case when p_sort = 'nearby' then computed_distance end asc,
        case when p_sort = 'relevance' then relevance end desc,
        case when p_sort = 'price' then price_key end asc,
        case when p_sort not in ('nearby', 'relevance', 'price') then quality_rating end desc,
        case when p_sort not in ('nearby', 'relevance', 'price') then quality_review_count end desc,
        lower(name) asc,
        id asc
    ), '[]'::jsonb),
    (select public.catalog_raw_cursor(jsonb_build_object('release_id', v_release, 'fingerprint', v_fingerprint, 'id', id, 'name', lower(name), 'distance', computed_distance, 'review_count', quality_review_count, 'score', case when p_sort = 'nearby' then computed_distance else case when p_sort = 'relevance' then relevance else case when p_sort = 'price' then price_key else quality_rating::double precision end end end)) from cursor_row),
    (select count(*)::integer from (select 1 from candidates limit 100) capped)
  into v_items, v_next, v_match_count
  from visible;
  return jsonb_build_object('items', v_items, 'next_cursor', v_next, 'release_id', v_release, 'match_count', v_match_count, 'totals', v_totals);
end;
$$;

create or replace function public.catalog_suggest(p_prefix text default null, p_limit integer default 8)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_release uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 8), 1), 8);
  v_prefix text := left(nullif(trim(coalesce(p_prefix, '')), ''), 64);
  v_escaped text;
  v_items jsonb;
begin
  perform public.catalog_raw_require_authenticated();
  v_release := public.catalog_raw_release_for_read(null);

  if v_prefix is null or char_length(v_prefix) < 2 then
    select coalesce(jsonb_agg(jsonb_build_object('kind', 'food_type', 'label', t.food_type) order by t.weight desc, t.food_type), '[]'::jsonb)
    into v_items
    from (
      select c.food_type, count(*) as weight
      from public.catalog_raw_dish_cards c
      where c.release_id = v_release and c.food_type is not null
      group by c.food_type
      order by count(*) desc, c.food_type
      limit v_limit
    ) t;
    return v_items;
  end if;

  -- Typed text is matched literally, never as a LIKE pattern.
  v_escaped := replace(replace(replace(v_prefix, '\', '\\'), '%', '\%'), '_', '\_');

  with matches as (
    select 'food_type'::text as kind, c.food_type as label, count(*) as weight, 0 as kind_rank, null::text as ref
    from public.catalog_raw_dish_cards c
    where c.release_id = v_release and c.food_type is not null
      and (c.food_type ilike v_escaped || '%' or c.food_type ilike '% ' || v_escaped || '%')
    group by c.food_type
    union all
    -- Places are buildings with several stalls (malls, hawker centres, food courts); the id
    -- lets the app scope results to that building (20261021190000).
    select 'place', max(c.building_name), count(*), 1, c.building_id
    from public.catalog_raw_venue_cards c
    where c.release_id = v_release and c.building_name is not null
      and (c.building_name ilike v_escaped || '%' or c.building_name ilike '% ' || v_escaped || '%')
    group by c.building_id
    having count(*) >= 3
    union all
    select 'stall', c.name, count(*), 2, null::text
    from public.catalog_raw_venue_cards c
    where c.release_id = v_release
      and (c.name ilike v_escaped || '%' or c.name ilike '% ' || v_escaped || '%')
    group by c.name
  ), ranked as (
    select kind, label, kind_rank, weight, ref, (label ilike v_escaped || '%') as starts_with
    from matches
    order by (label ilike v_escaped || '%') desc, kind_rank, weight desc, label
    limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'label', label) || case when ref is null then '{}'::jsonb else jsonb_build_object('id', ref) end
    order by starts_with desc, kind_rank, weight desc, label), '[]'::jsonb)
  into v_items
  from ranked;

  -- Nothing starts with the text: offer the closest food types (and the canonical names of the
  -- aliases) so a typo still gets a "Did you mean". Two letters swapped ("laska" for "laksa") is
  -- an exact hit; otherwise trigram similarity of at least 0.2 or a match on the whole text.
  if jsonb_array_length(v_items) = 0 then
    with swaps as (
      select substr(lower(v_prefix), 1, i - 1) || substr(lower(v_prefix), i + 1, 1) || substr(lower(v_prefix), i, 1) || substr(lower(v_prefix), i + 2) as swapped
      from generate_series(1, char_length(v_prefix) - 1) as i
    ), cand as (
      select c.food_type as label, count(*) as weight
      from public.catalog_raw_dish_cards c
      where c.release_id = v_release and c.food_type is not null
      group by c.food_type
      union all
      select initcap(a.canonical), 0
      from public.catalog_food_aliases a
    ), scored as (
      select cand.label, max(cand.weight) as weight,
        max(case when lower(cand.label) in (select swapped from swaps) then 1.0 else similarity(cand.label, v_prefix) end) as score
      from cand
      group by cand.label
    ), best as (
      select s.label, s.weight, s.score from scored s where s.score >= 0.2
      order by s.score desc, s.weight desc, s.label
      limit v_limit
    )
    select coalesce(jsonb_agg(jsonb_build_object('kind', 'food_type', 'label', b.label) order by b.score desc, b.weight desc, b.label), '[]'::jsonb)
    into v_items
    from best b;
  end if;
  return v_items;
end;
$$;
revoke all on function public.catalog_suggest(text, integer) from public;
grant execute on function public.catalog_suggest(text, integer) to anon, authenticated;

alter table public.catalog_raw_venue_cards
  drop column if exists logo_url,
  drop column if exists main_price;

notify pgrst, 'reload schema';
