-- smoke: supabase/smoke/catalog_search_relevance.sql
-- Search relevance (round-four Search audit SR4-1, SR4-2, SR4-5).
--   * SR4-1: a stall's name no longer ranks its whole menu. "chicken rice" used to list "Pandan Cake"
--     because the stall is called "Tian Tian Chicken Rice". A dish is now admitted on its own name or
--     food type; a dish that only matches through its stall or building is admitted only when no dish
--     of that stall matches by name (searching a stall name still lists the stall's menu, ranked lower).
--   * SR4-2: every word of the query must match (name, food type, stall or building), and the score is
--     the mean of the per-word scores. "maxwell laksa" is now laksa at Maxwell, not every laksa nearby.
--   * SR4-5: Singapore shorthand and spellings through a small alias table (ckt, bcm, cai png, kopi,
--     chendol/cendol ...), and "Did you mean" for typos, including swapped letters ("laska").
-- Stall results follow the same rule: every word must match the stall name, its building, or one of
-- its dishes.
-- Bodies of catalog_raw_dishes_page, catalog_raw_venues_page and catalog_suggest are copied from
-- 20261022110000_catalog_relevance_cursor_rounding.sql / 20261022020300_catalog_suggest_fuzzy_food_types.sql
-- (including p_building_id and the cursor rounding); signatures, SECURITY DEFINER, search_path and
-- grants are unchanged. catalog_suggest stays VOLATILE (20261022130000).
-- The alias table is read only through these SECURITY DEFINER functions: no client grants, RLS on, so
-- it adds no rate-limited route.
-- Rollback: supabase/rollbacks/20261029113000_catalog_search_relevance.down.sql.

-- ---------------------------------------------------------------------------
-- Alias table
-- ---------------------------------------------------------------------------
create table if not exists public.catalog_food_aliases (
  alias text not null check (alias ~ '^[a-z0-9]+( [a-z0-9]+)*$'),
  canonical text not null check (canonical ~ '^[a-z0-9]+( [a-z0-9]+)*$'),
  primary key (alias, canonical),
  check (alias <> canonical)
);

alter table public.catalog_food_aliases enable row level security;
revoke all on table public.catalog_food_aliases from public, anon, authenticated;

insert into public.catalog_food_aliases (alias, canonical)
select pair.a, pair.b
from (
  values
    ('ckt', 'char kway teow'), ('char kway teow', 'ckt'),
    ('bcm', 'bak chor mee'), ('bcm', 'minced meat noodles'),
    ('bak chor mee', 'minced meat noodles'), ('minced meat noodles', 'bak chor mee'),
    ('cai png', 'economy rice'), ('cai png', 'mixed rice'), ('cai fan', 'economy rice'),
    ('economy rice', 'mixed rice'), ('mixed rice', 'economy rice'),
    ('prata', 'roti prata'), ('roti prata', 'roti canai'), ('roti canai', 'roti prata'),
    ('mee goreng', 'fried noodles'),
    ('chendol', 'cendol'), ('cendol', 'chendol'),
    ('kopi', 'coffee'), ('teh', 'tea'), ('teh tarik', 'milk tea'),
    ('hokkien mee', 'hokkien prawn mee'), ('hokkien prawn mee', 'hokkien mee'),
    ('wanton mee', 'wonton noodles'), ('wonton mee', 'wonton noodles'),
    ('wanton noodles', 'wonton noodles'), ('wonton noodles', 'wanton mee'),
    ('yong tau foo', 'yong tau fu'), ('yong tau fu', 'yong tau foo'),
    ('ytf', 'yong tau foo'), ('ytf', 'yong tau fu'),
    ('satay', 'sate'), ('sate', 'satay'),
    ('carrot cake', 'chai tow kway'), ('chai tow kway', 'carrot cake'),
    ('orh luak', 'oyster omelette'), ('oyster omelette', 'orh luak'),
    ('ice kachang', 'ice kacang'), ('ice kacang', 'ice kachang'),
    ('boba', 'bubble tea'), ('bubble tea', 'boba'), ('pearl milk tea', 'bubble tea'),
    ('hor fun', 'ho fun'), ('ho fun', 'hor fun'),
    ('bbq', 'barbecue'), ('barbecue', 'bbq'),
    ('tau huay', 'beancurd'), ('tau huey', 'tau huay'),
    ('xlb', 'xiao long bao'),
    ('tom yum', 'tom yam'), ('tom yam', 'tom yum'),
    ('porridge', 'congee'), ('congee', 'porridge'),
    ('fish ball', 'fishball'), ('fishball', 'fish ball'),
    ('chilli', 'chili'), ('chili', 'chilli')
) as pair(a, b)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Helpers (internal: only the SECURITY DEFINER read RPCs call them)
-- ---------------------------------------------------------------------------

-- Breaks a typed query into at most four "terms". A term is one word, or a known alias phrase such
-- as "bak chor mee". Each term lists the spellings that satisfy it: the word itself (weight 1), its
-- singular form, and the aliases' canonical names (weight 0.9). Filler words are dropped unless they
-- are all there is.
create or replace function app_private.catalog_search_terms(p_query text)
returns table (slot integer, variant text, weight double precision, pattern text, is_token boolean)
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  c_max_terms constant integer := 4;
  c_stop constant text[] := array[
    'near', 'nearby', 'me', 'the', 'a', 'an', 'and', 'of', 'in', 'at', 'with', 'for',
    'best', 'good', 'stall', 'stalls', 'shop', 'shops', 'restaurant', 'restaurants', 'around', 'here', 'my'
  ];
  v_q text;
  v_slot integer := 0;
  v_alias record;
  v_canonical text;
  v_tokens text[];
  v_kept text[];
  v_token text;
  v_stem text;
begin
  -- Punctuation and LIKE wildcards become spaces; what is left is words and digits.
  v_q := btrim(regexp_replace(
    lower(coalesce(p_query, '')),
    '[%_\\().,;:!?"''*+=|~^$@#&/\[\]{}<>-]+', ' ', 'g'
  ));
  v_q := regexp_replace(v_q, '\s+', ' ', 'g');
  if v_q = '' then
    return;
  end if;

  -- Alias phrases first, longest first, so "bak chor mee" wins over "mee".
  for v_alias in
    select a.alias
    from public.catalog_food_aliases a
    where position(' ' || a.alias || ' ' in ' ' || v_q || ' ') > 0
    group by a.alias
    order by length(a.alias) desc, a.alias
  loop
    exit when v_slot >= c_max_terms;
    if position(' ' || v_alias.alias || ' ' in ' ' || v_q || ' ') = 0 then
      continue;
    end if;
    v_slot := v_slot + 1;
    slot := v_slot; variant := v_alias.alias; weight := 1.0; is_token := true;
    pattern := '%' || v_alias.alias || '%';
    return next;
    for v_canonical in
      select a.canonical from public.catalog_food_aliases a where a.alias = v_alias.alias order by a.canonical
    loop
      slot := v_slot; variant := v_canonical; weight := 0.9; is_token := false;
      pattern := '%' || v_canonical || '%';
      return next;
    end loop;
    v_q := btrim(regexp_replace(' ' || v_q || ' ', ' ' || v_alias.alias || ' ', ' ', 'g'));
  end loop;

  if v_q <> '' then
    v_tokens := string_to_array(regexp_replace(v_q, '\s+', ' ', 'g'), ' ');
    select coalesce(array_agg(t.token order by t.ord), '{}') into v_kept
    from (select distinct on (u.token) u.token, u.ord
          from unnest(v_tokens) with ordinality as u(token, ord)
          where u.token <> all (c_stop)
          order by u.token, u.ord) t;
    -- Only filler words: keep them rather than search for nothing.
    if cardinality(v_kept) = 0 and v_slot = 0 then
      select coalesce(array_agg(t.token order by t.ord), '{}') into v_kept
      from (select distinct on (u.token) u.token, u.ord
            from unnest(v_tokens) with ordinality as u(token, ord)
            order by u.token, u.ord) t;
    end if;
    foreach v_token in array v_kept loop
      exit when v_slot >= c_max_terms;
      v_slot := v_slot + 1;
      slot := v_slot; variant := v_token; weight := 1.0; is_token := true;
      pattern := '%' || v_token || '%';
      return next;
      -- "noodles" also satisfies "noodle" and "burgers" "burger".
      if char_length(v_token) >= 4 and v_token like '%s' and v_token not like '%ss' then
        v_stem := left(v_token, char_length(v_token) - 1);
        slot := v_slot; variant := v_stem; weight := 1.0; is_token := false;
        pattern := '%' || v_stem || '%';
        return next;
      end if;
    end loop;
  end if;
end;
$$;

-- How well one spelling matches a text: 0 unless it is a trigram word match of at least 0.6 (the
-- pg_trgm default behind the <% operator the page queries pre-filter with) or a plain substring
-- ("noodle" in "noodles", worth at least 0.6). The three functions below inline this rule: they run
-- once per candidate row, and a call per field would dominate the query.

-- Scores one row against the terms of a query. Result: {dish_score, any_score}.
--   dish_score: every term matches the dish name or food type (0 otherwise)
--   any_score:  every term matches the dish name, food type, stall name or building (0 otherwise);
--               the stall counts 0.4 and the building 0.3
-- Both are the mean over terms of the best spelling's score.
-- True when p_needle begins a word of p_haystack ("tea" is in "Teh Tea" and "Iced Tea" but not "Steak",
-- "ice" is in "Iced Milo" but not "Rice"). Both are lower case; punctuation counts as a word break.
create or replace function app_private.catalog_starts_word(p_haystack text, p_needle text)
returns boolean
language sql
immutable
parallel safe
set search_path = public, extensions
as $$
  select strpos(
    ' ' || regexp_replace(p_haystack, '[^[:alnum:]]+', ' ', 'g'),
    ' ' || btrim(regexp_replace(p_needle, '[^[:alnum:]]+', ' ', 'g'))
  ) > 0
$$;

create or replace function app_private.catalog_text_match(
  p_slots integer[], p_variants text[], p_weights double precision[], p_n integer,
  p_dish_a text, p_dish_b text, p_other_a text, p_other_b text
) returns double precision[]
language plpgsql
immutable
parallel safe
set search_path = public, extensions
as $$
declare
  la text := lower(p_dish_a);
  lb text := lower(p_dish_b);
  lc text := lower(p_other_a);
  ld text := lower(p_other_b);
  v_d double precision[];
  v_a double precision[];
  i integer;
  s integer;
  v text;
  h double precision;
  x double precision;
  d_ok boolean := true;
  a_ok boolean := true;
  d_sum double precision := 0;
  a_sum double precision := 0;
begin
  if coalesce(p_n, 0) = 0 then
    return array[0, 0]::double precision[];
  end if;
  v_d := array_fill(0::double precision, array[p_n]);
  v_a := v_d;
  for i in 1..cardinality(p_variants) loop
    s := p_slots[i];
    v := p_variants[i];
    h := 0;
    if la is not null then
      x := word_similarity(v, la);
      if x < 0.6 and app_private.catalog_starts_word(la, v) then x := 0.6; end if;
      if x >= 0.6 and x > h then h := x; end if;
    end if;
    if lb is not null then
      x := word_similarity(v, lb);
      if x < 0.6 and app_private.catalog_starts_word(lb, v) then x := 0.6; end if;
      if x >= 0.6 and x > h then h := x; end if;
    end if;
    h := h * p_weights[i];
    if h > 0 then
      -- A dish-field hit (at least 0.6) always beats the stall (at most 0.4) and building (0.3).
      if h > v_d[s] then v_d[s] := h; end if;
      if h > v_a[s] then v_a[s] := h; end if;
    else
      if lc is not null then
        x := word_similarity(v, lc);
        if x < 0.6 and app_private.catalog_starts_word(lc, v) then x := 0.6; end if;
        if x >= 0.6 and 0.4 * x * p_weights[i] > v_a[s] then v_a[s] := 0.4 * x * p_weights[i]; end if;
      end if;
      if ld is not null then
        x := word_similarity(v, ld);
        if x < 0.6 and app_private.catalog_starts_word(ld, v) then x := 0.6; end if;
        if x >= 0.6 and 0.3 * x * p_weights[i] > v_a[s] then v_a[s] := 0.3 * x * p_weights[i]; end if;
      end if;
    end if;
  end loop;
  for s in 1..p_n loop
    if v_d[s] <= 0 then d_ok := false; end if;
    if v_a[s] <= 0 then a_ok := false; end if;
    d_sum := d_sum + v_d[s];
    a_sum := a_sum + v_a[s];
  end loop;
  return array[
    case when d_ok then d_sum / p_n else 0 end,
    case when a_ok then a_sum / p_n else 0 end
  ]::double precision[];
end;
$$;

-- The dish-field score of one dish for each of the (up to four) terms: {term 1, ..., term 4}.
-- A stall page takes the best of these over the stall's dishes.
create or replace function app_private.catalog_dish_term_scores(
  p_slots integer[], p_variants text[], p_weights double precision[], p_name text, p_food_type text
) returns double precision[]
language plpgsql
immutable
parallel safe
set search_path = public, extensions
as $$
declare
  la text := lower(p_name);
  lb text := lower(p_food_type);
  v_s double precision[] := array[0, 0, 0, 0]::double precision[];
  i integer;
  v text;
  h double precision;
  x double precision;
begin
  for i in 1..cardinality(p_variants) loop
    v := p_variants[i];
    h := 0;
    if la is not null then
      x := word_similarity(v, la);
      if x < 0.6 and app_private.catalog_starts_word(la, v) then x := 0.6; end if;
      if x >= 0.6 and x > h then h := x; end if;
    end if;
    if lb is not null then
      x := word_similarity(v, lb);
      if x < 0.6 and app_private.catalog_starts_word(lb, v) then x := 0.6; end if;
      if x >= 0.6 and x > h then h := x; end if;
    end if;
    h := h * p_weights[i];
    if h > v_s[p_slots[i]] then v_s[p_slots[i]] := h; end if;
  end loop;
  return v_s;
end;
$$;

-- Same for a stall: every term must match its name (1.0), its building (0.3), or one of its dishes
-- (0.8 times p_dish_scores[term], the best dish-field score of the stall's dishes for that term).
create or replace function app_private.catalog_venue_match(
  p_slots integer[], p_variants text[], p_weights double precision[], p_n integer,
  p_name text, p_building text, p_dish_scores double precision[]
) returns double precision
language plpgsql
immutable
parallel safe
set search_path = public, extensions
as $$
declare
  la text := lower(p_name);
  lb text := lower(p_building);
  v_b double precision[];
  i integer;
  s integer;
  v text;
  x double precision;
  b_sum double precision := 0;
begin
  if coalesce(p_n, 0) = 0 then
    return 0;
  end if;
  v_b := array_fill(0::double precision, array[p_n]);
  for s in 1..p_n loop
    v_b[s] := 0.8 * coalesce(p_dish_scores[s], 0);
  end loop;
  for i in 1..cardinality(p_variants) loop
    s := p_slots[i];
    v := p_variants[i];
    if la is not null then
      x := word_similarity(v, la);
      if x < 0.6 and app_private.catalog_starts_word(la, v) then x := 0.6; end if;
      if x >= 0.6 and x * p_weights[i] > v_b[s] then v_b[s] := x * p_weights[i]; end if;
    end if;
    if lb is not null then
      x := word_similarity(v, lb);
      if x < 0.6 and app_private.catalog_starts_word(lb, v) then x := 0.6; end if;
      if x >= 0.6 and 0.3 * x * p_weights[i] > v_b[s] then v_b[s] := 0.3 * x * p_weights[i]; end if;
    end if;
  end loop;
  for s in 1..p_n loop
    if v_b[s] <= 0 then return 0; end if;
    b_sum := b_sum + v_b[s];
  end loop;
  return b_sum / p_n;
end;
$$;

revoke all on function app_private.catalog_search_terms(text) from public, anon, authenticated;
revoke all on function app_private.catalog_starts_word(text, text) from public, anon, authenticated;
revoke all on function app_private.catalog_text_match(integer[], text[], double precision[], integer, text, text, text, text) from public, anon, authenticated;
revoke all on function app_private.catalog_dish_term_scores(integer[], text[], double precision[], text, text) from public, anon, authenticated;
revoke all on function app_private.catalog_venue_match(integer[], text[], double precision[], integer, text, text, double precision[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- catalog_raw_dishes_page
-- ---------------------------------------------------------------------------
create or replace function public.catalog_raw_dishes_page(
  p_query text default null, p_lat double precision default null, p_lng double precision default null,
  p_radius_meters integer default null, p_cuisine_tags text[] default '{}', p_dietary_flags text[] default '{}',
  p_max_price numeric default null, p_open_only boolean default false, p_sort text default 'quality',
  p_cursor text default null, p_release_id uuid default null, p_limit integer default 24, p_venue_id text default null,
  p_building_types text[] default '{}', p_food_keywords text[] default '{}', p_building_id text default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions set plan_cache_mode = force_custom_plan as $$
declare
  v_release uuid; v_cursor jsonb; v_fingerprint text; v_limit integer := least(greatest(coalesce(p_limit, 24), 1), 50);
  v_items jsonb; v_next text; v_count integer; v_match_count integer;
  v_query text := left(nullif(trim(coalesce(p_query, '')), ''), 80);
  v_like text;
  v_food_patterns text[];
  v_totals jsonb;
  v_slots integer[]; v_variants text[]; v_weights double precision[]; v_n integer := 0;
  v_tok1 text; v_tok2 text; v_tok3 text; v_tok4 text;
  v_pat1 text[]; v_pat2 text[]; v_pat3 text[]; v_pat4 text[];
begin
  perform public.catalog_raw_require_authenticated();
  v_release := public.catalog_raw_release_for_read(p_release_id);
  v_totals := (select jsonb_build_object('venues', venue_total, 'dishes', dish_total) from public.catalog_releases where id = v_release);
  -- One character matches most of the catalog; the app asks for at least two.
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
    -- Nothing but punctuation or wildcards ("%%", "__"): no words to match.
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
  v_fingerprint := md5(concat_ws('|', coalesce(lower(v_query), ''), coalesce(p_lat::text, ''), coalesce(p_lng::text, ''), coalesce(p_radius_meters::text, ''), array_to_string(coalesce(p_cuisine_tags, '{}'), ','), array_to_string(coalesce(p_dietary_flags, '{}'), ','), array_to_string(coalesce(p_building_types, '{}'), ','), array_to_string(v_food_patterns, ','), coalesce(p_max_price::text, ''), p_open_only::text, p_sort, coalesce(p_venue_id, ''), coalesce(p_building_id, '')));
  v_cursor := case when p_cursor is null then null else public.catalog_raw_cursor_value(p_cursor) end;
  if v_cursor is not null and (v_cursor->>'release_id')::uuid <> v_release then raise exception 'catalog cursor release mismatch' using errcode = '22023'; end if;
  if v_cursor is not null and v_cursor->>'fingerprint' <> v_fingerprint then raise exception 'catalog cursor query mismatch' using errcode = '22023'; end if;

  with name_hit_venues as materialized (
    -- Stalls with a dish that matches every word by its own name or food type. The same word filter
    -- the candidates use, so the indexes narrow it to the dishes that can match; scoring only those.
    select distinct d2.venue_id
    from public.catalog_raw_dish_cards d2
    where v_n > 0 and d2.release_id = v_release
      and (v_n < 1 or d2.name ilike any(v_pat1) or d2.food_type ilike any(v_pat1) or v_tok1 <% d2.name or v_tok1 <% d2.food_type)
      and (v_n < 2 or d2.name ilike any(v_pat2) or d2.food_type ilike any(v_pat2) or v_tok2 <% d2.name or v_tok2 <% d2.food_type)
      and (v_n < 3 or d2.name ilike any(v_pat3) or d2.food_type ilike any(v_pat3) or v_tok3 <% d2.name or v_tok3 <% d2.food_type)
      and (v_n < 4 or d2.name ilike any(v_pat4) or d2.food_type ilike any(v_pat4) or v_tok4 <% d2.name or v_tok4 <% d2.food_type)
      and (app_private.catalog_text_match(v_slots, v_variants, v_weights, v_n, d2.name, d2.food_type, null, null))[1] > 0
  ), candidates as materialized (
    select c.*, coalesce(st_distance(c.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)::integer, 2147483647) as computed_distance,
      coalesce(c.price, 1000000)::double precision as price_key,
      round((case when v_query is null then 0::double precision
           -- Text match first (the mean per-word score; an exact dish name or a name that contains the
           -- whole query adds a little), plus up to 0.15 for being close (half-weight at ~2 km), plus
           -- up to 0.10 for quality: reviews (log-scaled, full at 50), rating, verification, a photo.
           else m.scores[2]
             + case when lower(c.name) = lower(v_query) then 0.1 when c.name ilike v_like then 0.05 else 0 end
             + coalesce(0.15 * exp(-st_distance(c.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 3000.0), 0)
             + 0.04 * least(ln(1 + greatest(c.review_count, 0)::double precision) / ln(51::double precision), 1)
             + 0.03 * least(greatest(c.rating, 0)::double precision, 5) / 5
             + case when c.verification_status in ('verified', 'approved') then 0.02 else 0 end
             + case when c.image_url is not null then 0.01 else 0 end end)::numeric, 6)::double precision as relevance
    from public.catalog_raw_dish_cards c
    cross join lateral (
      select case when v_n = 0 then array[0, 0]::double precision[]
        else app_private.catalog_text_match(v_slots, v_variants, v_weights, v_n, c.name, c.food_type, c.venue_name, c.building_name) end as scores
      offset 0 -- keeps the planner from inlining the match once per use of m.scores
    ) m
    where c.release_id = v_release
      and (p_venue_id is null or c.venue_id = p_venue_id)
      and (p_building_id is null or c.building_id = p_building_id)
      and (cardinality(coalesce(p_building_types, '{}')) = 0 or c.building_type = any(p_building_types))
      and (p_open_only = false or c.is_open)
      and (p_max_price is null or c.price <= p_max_price)
      and (cardinality(coalesce(p_cuisine_tags, '{}')) = 0 or c.cuisine_tags && p_cuisine_tags)
      and (cardinality(coalesce(p_dietary_flags, '{}')) = 0 or c.dietary_flags @> p_dietary_flags)
      and (cardinality(v_food_patterns) = 0 or c.food_type ilike any(v_food_patterns) or c.name ilike any(v_food_patterns))
      and (p_lat is null or p_lng is null or p_radius_meters is null or st_dwithin(c.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_meters))
      and (v_n = 0 or (
        (v_n < 1 or c.name ilike any(v_pat1) or c.food_type ilike any(v_pat1) or c.venue_name ilike any(v_pat1) or c.building_name ilike any(v_pat1)
          or v_tok1 <% c.name or v_tok1 <% c.food_type or v_tok1 <% c.venue_name or v_tok1 <% c.building_name)
        and (v_n < 2 or c.name ilike any(v_pat2) or c.food_type ilike any(v_pat2) or c.venue_name ilike any(v_pat2) or c.building_name ilike any(v_pat2)
          or v_tok2 <% c.name or v_tok2 <% c.food_type or v_tok2 <% c.venue_name or v_tok2 <% c.building_name)
        and (v_n < 3 or c.name ilike any(v_pat3) or c.food_type ilike any(v_pat3) or c.venue_name ilike any(v_pat3) or c.building_name ilike any(v_pat3)
          or v_tok3 <% c.name or v_tok3 <% c.food_type or v_tok3 <% c.venue_name or v_tok3 <% c.building_name)
        and (v_n < 4 or c.name ilike any(v_pat4) or c.food_type ilike any(v_pat4) or c.venue_name ilike any(v_pat4) or c.building_name ilike any(v_pat4)
          or v_tok4 <% c.name or v_tok4 <% c.food_type or v_tok4 <% c.venue_name or v_tok4 <% c.building_name)
        -- Matches through the stall or building only count when none of the stall's dishes match by
        -- their own name or food type ("chicken rice" lists the dish, not the stall's Pandan Cake).
        and (m.scores[1] > 0 or (m.scores[2] > 0 and not exists (select 1 from name_hit_venues h where h.venue_id = c.venue_id)))
      ))
  ), page as materialized (
    select * from candidates c
    where v_cursor is null
      or (p_sort = 'nearby' and (c.computed_distance > coalesce((v_cursor->>'distance')::integer, -1) or (c.computed_distance = (v_cursor->>'distance')::integer and c.id > v_cursor->>'id')))
      or (p_sort = 'relevance' and (c.relevance < (v_cursor->>'score')::double precision or (c.relevance = (v_cursor->>'score')::double precision and c.id > v_cursor->>'id')))
      or (p_sort = 'price' and (c.price_key > (v_cursor->>'score')::double precision or (c.price_key = (v_cursor->>'score')::double precision and c.id > v_cursor->>'id')))
      or (p_sort not in ('nearby', 'relevance', 'price') and (
        c.rating < (v_cursor->>'score')::numeric
        or (c.rating = (v_cursor->>'score')::numeric and (
          c.review_count < coalesce((v_cursor->>'review_count')::integer, 0)
          or (c.review_count = coalesce((v_cursor->>'review_count')::integer, 0) and c.id > v_cursor->>'id')
        ))
      ))
    order by
      case when p_sort = 'nearby' then c.computed_distance end asc,
      case when p_sort = 'relevance' then c.relevance end desc,
      case when p_sort = 'price' then c.price_key end asc,
      case when p_sort not in ('nearby', 'relevance', 'price') then c.rating end desc,
      case when p_sort not in ('nearby', 'relevance', 'price') then c.review_count end desc,
      c.id asc
    limit v_limit + 1
  ), visible as (select * from page limit v_limit), tail as (select * from page offset v_limit limit 1), cursor_row as (
    select * from visible
    where exists (select 1 from tail)
    order by
      case when p_sort = 'nearby' then computed_distance end desc,
      case when p_sort = 'relevance' then relevance end asc,
      case when p_sort = 'price' then price_key end desc,
      case when p_sort not in ('nearby', 'relevance', 'price') then rating end asc,
      case when p_sort not in ('nearby', 'relevance', 'price') then review_count end asc,
      id desc
    limit 1
  )
  select
    coalesce(jsonb_agg(
      -- The real distance from the viewer replaces the stored distance_meters column.
      (to_jsonb(visible) - 'listing_location' - 'computed_distance' - 'relevance' - 'price_key')
        || jsonb_build_object('distance_meters', nullif(computed_distance, 2147483647))
      order by
        case when p_sort = 'nearby' then computed_distance end asc,
        case when p_sort = 'relevance' then relevance end desc,
        case when p_sort = 'price' then price_key end asc,
        case when p_sort not in ('nearby', 'relevance', 'price') then rating end desc,
        case when p_sort not in ('nearby', 'relevance', 'price') then review_count end desc,
        id asc
    ), '[]'::jsonb),
    count(*)::integer,
    (select public.catalog_raw_cursor(jsonb_build_object('release_id', v_release, 'fingerprint', v_fingerprint, 'id', id, 'distance', computed_distance, 'review_count', review_count, 'score', case when p_sort = 'nearby' then computed_distance else case when p_sort = 'relevance' then relevance else case when p_sort = 'price' then price_key else rating::double precision end end end)) from cursor_row),
    -- Capped at 100 so counting stays cheap; the candidate set is already materialised.
    (select count(*)::integer from (select 1 from candidates limit 100) capped)
  into v_items, v_count, v_next, v_match_count
  from visible;
  return jsonb_build_object('items', v_items, 'next_cursor', v_next, 'release_id', v_release, 'match_count', v_match_count, 'totals', v_totals);
end;
$$;

-- ---------------------------------------------------------------------------
-- catalog_raw_venues_page
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- catalog_suggest: a better "Did you mean"
-- ---------------------------------------------------------------------------
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

-- PostgREST caches function definitions with the rest of its schema.
notify pgrst, 'reload schema';
