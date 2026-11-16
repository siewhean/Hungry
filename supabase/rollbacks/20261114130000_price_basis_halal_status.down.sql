-- down-loses-data: price_checked_at and catalog_raw_dish_cards.price_basis are derived (a check date and a copy of dishes.price_confidence); price_confidence/dietary_status are dropped only when this up created them and the menu import has not claimed them, so they hold no imported data.
-- Undo 20261114130000_price_basis_halal_status: get_dish_detail, search_dishes and the Home feed
-- go back to their bodies without price basis and halal status, and the price-checked trigger and
-- column go, and so does catalog_raw_dish_cards.price_basis. Lost on rollback: those values
-- (only this migration wrote them; price_basis is copied from dishes.price_confidence).
-- dishes.price_confidence and dishes.dietary_status go only if the up created them (column
-- comment) and the menu import migration (dishes_price_confidence_check) has not claimed them.

-- 1. Home feed.
do $$
declare
  v_sig constant regprocedure :=
    'public.get_discovery_feed_by_location(text,double precision,double precision,integer,integer,text)'::regprocedure;
  v_def text := pg_get_functiondef(v_sig);
begin
  if position('top_dish_price_basis' in v_def) = 0 then
    return;
  end if;
  execute format('drop function %s', v_sig);
  execute replace(replace(replace(v_def,
    'top_dish_price numeric, top_dish_price_basis text, ', 'top_dish_price numeric, '),
    E'      top_dish.price as top_dish_price,\n      case top_dish.price_confidence\n        when ''counter_price'' then ''counter''\n        when ''listed_price'' then ''menu''\n        when ''delivery_price'' then ''delivery''\n      end as top_dish_price_basis,\n',
    E'      top_dish.price as top_dish_price,\n'),
    E'    candidates.top_dish_price,\n    candidates.top_dish_price_basis,\n',
    E'    candidates.top_dish_price,\n');
end;
$$;

grant execute on function public.get_discovery_feed_by_location(
  text, double precision, double precision, integer, integer, text
) to anon, authenticated, service_role;

-- 2. Search and stall menus.
do $$
declare
  v_sig constant regprocedure :=
    'public.search_dishes(text,double precision,double precision,integer,text[],integer,double precision,text,text,text,text[],numeric,boolean,text[],text[])'::regprocedure;
  v_def text := pg_get_functiondef(v_sig);
begin
  if position('price_dish.price_confidence' in v_def) = 0 then
    return;
  end if;
  execute format('drop function %s', v_sig);
  execute replace(replace(v_def,
    'cursor_id text, price_basis text, price_checked_at timestamp with time zone)', 'cursor_id text)'),
    E'    limited.dish_id as cursor_id,\n    case price_dish.price_confidence\n      when ''counter_price'' then ''counter''\n      when ''listed_price'' then ''menu''\n      when ''delivery_price'' then ''delivery''\n    end as price_basis,\n    coalesce(price_dish.price_checked_at, price_dish.created_at) as price_checked_at\n  from limited\n  left join dish_taste_vectors dtv on dtv.dish_id = limited.dish_id\n  left join dishes price_dish on price_dish.id = limited.dish_id\n',
    E'    limited.dish_id as cursor_id\n  from limited\n  left join dish_taste_vectors dtv on dtv.dish_id = limited.dish_id\n');
end;
$$;

grant execute on function public.search_dishes(
  text, double precision, double precision, integer, text[], integer,
  double precision, text, text, text, text[], numeric, boolean, text[], text[]
) to anon, authenticated, service_role;

-- 3. Dish page: the body before this migration (as live on prod 2026-11-14).
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
  updated_at timestamp with time zone
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
    d.updated_at
  from dishes d
  join venues v on v.id = d.venue_id
  left join dish_taste_vectors dtv on dtv.dish_id = d.id
  where d.id = p_dish_id
    and d.archived_at is null
    and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
  limit 1;
$function$;

grant execute on function public.get_dish_detail(text) to anon, authenticated, service_role;

-- 4. Search result cards.
drop trigger if exists catalog_raw_dish_cards_fill_price_basis on public.catalog_raw_dish_cards;
drop function if exists public.catalog_raw_dish_cards_fill_price_basis();
alter table public.catalog_raw_dish_cards drop column if exists price_basis;

-- 5. Price-checked date.
drop trigger if exists dishes_touch_price_checked_at on public.dishes;
drop function if exists public.dishes_touch_price_checked_at();
alter table public.dishes drop column if exists price_checked_at;

-- 6. The menu import's columns, only when this migration created them and the import has not
--    been applied on top (it would then own them).
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.dishes'::regclass and conname = 'dishes_price_confidence_check'
  ) then
    return;
  end if;
  if col_description('public.dishes'::regclass, (
       select attnum from pg_attribute
       where attrelid = 'public.dishes'::regclass and attname = 'price_confidence' and not attisdropped
     )) = 'created-by:20261114130000' then
    alter table public.dishes drop column price_confidence;
  end if;
  if col_description('public.dishes'::regclass, (
       select attnum from pg_attribute
       where attrelid = 'public.dishes'::regclass and attname = 'dietary_status' and not attisdropped
     )) = 'created-by:20261114130000' then
    alter table public.dishes drop column dietary_status;
  end if;
end;
$$;
