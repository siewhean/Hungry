-- smoke: supabase/smoke/price_basis_halal_status.sql
-- Price and halal labels (build plan package 1.4). The counter price is the true price; delivery
-- app prices are inflated. Diners now see where each price came from, when it was checked, and
-- (on the dish page only) whether the dish is halal, not halal, or not confirmed.
--
--   * dishes.price_checked_at: when the price was last checked. Set to now() when a dish is added
--     and whenever its price changes (trigger), unless the writer sets it. Existing rows stay null
--     and read as "first seen" (created_at).
--   * dishes.price_confidence (text) and dishes.dietary_status (jsonb) are owned by the menu
--     import, which added them on staging. They are added here only if missing, with the same
--     types and no constraints, so this file runs on prod before or after the import's migration.
--     The rollback drops them only if this file created them and the import's migration
--     (dishes_price_confidence_check) has not been applied since.
--   * get_dish_detail returns price_basis ('counter' | 'menu' | 'delivery' | null),
--     price_checked_at and halal_status ('yes' | 'no' | 'unknown').
--   * catalog_raw_dish_cards.price_basis (Search result cards, through catalog_raw_dishes_page's
--     c.* rows): filled on insert from the dish (as food_type is), backfilled for the active
--     release in one set-based update.
--   * search_dishes (dish search, stall menus through get_venue_detail) returns price_basis and
--     price_checked_at. get_discovery_feed_by_location (Home) returns top_dish_price_basis.
--     No halal on these: sh's rule is that the halal tag shows on the dish page only.
--
-- search_dishes and the feed are patched in place from their live bodies (as 20261029140000
-- does), because their bodies are long and other open migrations patch them too. A changed
-- RETURNS TABLE needs the old function dropped first, so each is dropped and recreated with the
-- same signature, volatility, security, search_path and grants. Every patch asserts that its
-- anchor text occurs exactly once.
-- Rollback: supabase/rollbacks/20261114130000_price_basis_halal_status.down.sql.

-- When this file creates them it marks them (column comment), so the rollback can drop exactly
-- what it created, and keeps them once the menu import's migration has claimed them.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dishes' and column_name = 'price_confidence'
  ) then
    alter table public.dishes add column price_confidence text;
    comment on column public.dishes.price_confidence is 'created-by:20261114130000';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dishes' and column_name = 'dietary_status'
  ) then
    alter table public.dishes add column dietary_status jsonb;
    comment on column public.dishes.dietary_status is 'created-by:20261114130000';
  end if;
end;
$$;

-- Added without a default first, so existing rows stay null ("first seen" = created_at) instead
-- of all reading as checked today.
alter table public.dishes add column if not exists price_checked_at timestamptz;
alter table public.dishes alter column price_checked_at set default now();

create or replace function public.dishes_touch_price_checked_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.price is distinct from old.price
     and new.price_checked_at is not distinct from old.price_checked_at then
    new.price_checked_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.dishes_touch_price_checked_at() from public, anon, authenticated;

drop trigger if exists dishes_touch_price_checked_at on public.dishes;
create trigger dishes_touch_price_checked_at
  before update of price on public.dishes
  for each row
  execute function public.dishes_touch_price_checked_at();

-- 1. Dish page.
drop function if exists public.get_dish_detail(text);

create function public.get_dish_detail(p_dish_id text)
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
  reviews jsonb,
  taste_confidence numeric,
  updated_at timestamp with time zone,
  price_basis text,
  price_checked_at timestamp with time zone,
  halal_status text
)
language sql
volatile
set search_path to 'public', 'extensions'
as $function$
  select
    d.id as dish_id,
    d.venue_id,
    d.building_id,
    v.name as venue_name,
    v.unit_number,
    v.floor,
    d.name,
    public.catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url) as image_url,
    d.blurhash,
    d.distance_meters,
    d.rating_avg as rating,
    d.review_count,
    d.price,
    d.price_range,
    d.live_crowd,
    d.taste_tags,
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
      where ddf.dish_id = d.id
    ), '{}'::text[]) as dietary_flags,
    coalesce((
      select array_agg(safe_image.url order by safe_image.sort_order)
      from (
        select
          di.sort_order,
          public.catalog_display_image_url(di.url, di.media_approved_for_display, di.media_rights_status, di.media_source_url) as url
        from dish_images di
        where di.dish_id = d.id
      ) safe_image
      where safe_image.url is not null
    ), case
      when public.catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url) is null
        then '{}'::text[]
      else array[
        public.catalog_display_image_url(d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url)
      ]
    end) as gallery,
    d.description,
    d.must_order,
    d.availability_flags,
    -- Reviews load through listRecentReviews (paged, signed photos, owner replies).
    -- The column stays for older clients but is always empty: no unbounded list.
    '[]'::jsonb as reviews,
    -- Confidence only describes AI-tagged vectors; seed/curated vectors are fully trusted.
    case
      when dtv.confidence is null or dtv.source = 'default' then null
      else dtv.confidence
    end as taste_confidence,
    d.updated_at,
    case d.price_confidence
      when 'counter_price' then 'counter'
      when 'listed_price' then 'menu'
      when 'delivery_price' then 'delivery'
    end as price_basis,
    coalesce(d.price_checked_at, d.created_at) as price_checked_at,
    case
      when exists (
        select 1
        from dish_dietary_flags ddf
        join dietary_flags df on df.id = ddf.dietary_flag_id
        where ddf.dish_id = d.id
          and df.slug::text = 'halal'
      ) then 'yes'
      when d.dietary_status->'flags'->>'halal' in ('yes', 'no') then d.dietary_status->'flags'->>'halal'
      else 'unknown'
    end as halal_status
  from dishes d
  join venues v on v.id = d.venue_id
  left join dish_taste_vectors dtv on dtv.dish_id = d.id
  where d.id = p_dish_id
    and d.archived_at is null
    and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
  limit 1;
$function$;

grant execute on function public.get_dish_detail(text) to anon, authenticated, service_role;

-- 2. Search and stall menus: price basis on every dish row (one primary-key join, no per-row query).
do $$
declare
  v_sig constant regprocedure :=
    'public.search_dishes(text,double precision,double precision,integer,text[],integer,double precision,text,text,text,text[],numeric,boolean,text[],text[])'::regprocedure;
  v_def text := pg_get_functiondef(v_sig);
  v_find_ret constant text := 'cursor_id text)';
  v_repl_ret constant text := 'cursor_id text, price_basis text, price_checked_at timestamp with time zone)';
  v_find_tail constant text := E'    limited.dish_id as cursor_id\n  from limited\n  left join dish_taste_vectors dtv on dtv.dish_id = limited.dish_id\n';
  v_repl_tail constant text := E'    limited.dish_id as cursor_id,\n    case price_dish.price_confidence\n      when ''counter_price'' then ''counter''\n      when ''listed_price'' then ''menu''\n      when ''delivery_price'' then ''delivery''\n    end as price_basis,\n    coalesce(price_dish.price_checked_at, price_dish.created_at) as price_checked_at\n  from limited\n  left join dish_taste_vectors dtv on dtv.dish_id = limited.dish_id\n  left join dishes price_dish on price_dish.id = limited.dish_id\n';
  v_hits integer;
begin
  if position('price_dish.price_confidence' in v_def) > 0 then
    return;
  end if;
  v_hits := (length(v_def) - length(replace(v_def, v_find_ret, ''))) / length(v_find_ret);
  if v_hits <> 1 then
    raise exception 'search_dishes: expected 1 returns anchor, found %', v_hits;
  end if;
  v_hits := (length(v_def) - length(replace(v_def, v_find_tail, ''))) / length(v_find_tail);
  if v_hits <> 1 then
    raise exception 'search_dishes: expected 1 final select anchor, found %', v_hits;
  end if;
  execute format('drop function %s', v_sig);
  execute replace(replace(v_def, v_find_ret, v_repl_ret), v_find_tail, v_repl_tail);
end;
$$;

grant execute on function public.search_dishes(
  text, double precision, double precision, integer, text[], integer,
  double precision, text, text, text, text[], numeric, boolean, text[], text[]
) to anon, authenticated, service_role;

-- 3. Home feed: price basis of each stall's top dish (top_dish is already a d.* lateral row).
do $$
declare
  v_sig constant regprocedure :=
    'public.get_discovery_feed_by_location(text,double precision,double precision,integer,integer,text)'::regprocedure;
  v_def text := pg_get_functiondef(v_sig);
  v_find_ret constant text := 'top_dish_price numeric, ';
  v_repl_ret constant text := 'top_dish_price numeric, top_dish_price_basis text, ';
  v_find_inner constant text := E'      top_dish.price as top_dish_price,\n';
  v_repl_inner constant text := E'      top_dish.price as top_dish_price,\n      case top_dish.price_confidence\n        when ''counter_price'' then ''counter''\n        when ''listed_price'' then ''menu''\n        when ''delivery_price'' then ''delivery''\n      end as top_dish_price_basis,\n';
  v_find_outer constant text := E'    candidates.top_dish_price,\n';
  v_repl_outer constant text := E'    candidates.top_dish_price,\n    candidates.top_dish_price_basis,\n';
  v_hits integer;
begin
  if position('top_dish_price_basis' in v_def) > 0 then
    return;
  end if;
  v_hits := (length(v_def) - length(replace(v_def, v_find_ret, ''))) / length(v_find_ret);
  if v_hits <> 1 then
    raise exception 'feed: expected 1 returns anchor, found %', v_hits;
  end if;
  v_hits := (length(v_def) - length(replace(v_def, v_find_inner, ''))) / length(v_find_inner);
  if v_hits <> 1 then
    raise exception 'feed: expected 1 top dish price column, found %', v_hits;
  end if;
  v_hits := (length(v_def) - length(replace(v_def, v_find_outer, ''))) / length(v_find_outer);
  if v_hits <> 1 then
    raise exception 'feed: expected 1 outer price column, found %', v_hits;
  end if;
  execute format('drop function %s', v_sig);
  execute replace(replace(replace(v_def, v_find_ret, v_repl_ret), v_find_inner, v_repl_inner), v_find_outer, v_repl_outer);
end;
$$;

grant execute on function public.get_discovery_feed_by_location(
  text, double precision, double precision, integer, integer, text
) to anon, authenticated, service_role;

-- 4. Search result cards (versioned catalog). Same mapping as above.
alter table public.catalog_raw_dish_cards add column if not exists price_basis text;

create or replace function public.catalog_raw_dish_cards_fill_price_basis()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.price_basis is null then
    select case d.price_confidence
             when 'counter_price' then 'counter'
             when 'listed_price' then 'menu'
             when 'delivery_price' then 'delivery'
           end
      into new.price_basis
    from public.dishes d
    where d.id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.catalog_raw_dish_cards_fill_price_basis() from public, anon, authenticated;

drop trigger if exists catalog_raw_dish_cards_fill_price_basis on public.catalog_raw_dish_cards;
create trigger catalog_raw_dish_cards_fill_price_basis
  before insert on public.catalog_raw_dish_cards
  for each row execute function public.catalog_raw_dish_cards_fill_price_basis();

update public.catalog_raw_dish_cards c
set price_basis = case d.price_confidence
                    when 'counter_price' then 'counter'
                    when 'listed_price' then 'menu'
                    when 'delivery_price' then 'delivery'
                  end
from public.dishes d, public.catalog_releases r
where d.id = c.id
  and r.id = c.release_id
  and r.status = 'active'
  and c.price_basis is null
  and d.price_confidence in ('counter_price', 'listed_price', 'delivery_price');
