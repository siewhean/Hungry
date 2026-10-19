-- Merchant dish writes in one statement or one transaction.
--
-- 1. merchant_set_dish_availability_flag: sets or toggles one availability
--    flag (sold_out, featured) with a single UPDATE. The app used to read the
--    flags and write them back, so two quick taps (or two staff phones) could
--    overwrite each other.
-- 2. merchant_save_dish: creates or edits a dish together with its photos,
--    dietary labels and taste vector in one transaction. The app used to make
--    four separate calls, so a failure half-way left a live dish without its
--    dietary labels. A retried create with the same id edits the row the first
--    try made instead of failing or duplicating it.
--
-- Both are SECURITY INVOKER: the merchant's own RLS policies on dishes,
-- dish_images, dish_dietary_flags and dish_taste_vectors decide what they can
-- write, and the existing write-guard triggers still run.

create or replace function public.merchant_normalize_availability_flag(p_flag text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(trim(coalesce(p_flag, '')), '[[:space:]-]+', '_', 'g'));
$$;

create or replace function public.merchant_set_dish_availability_flag(
  p_dish_id text,
  p_venue_id text,
  p_flag text,
  p_enabled boolean default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_flag text := public.merchant_normalize_availability_flag(p_flag);
  v_enabled boolean;
begin
  if v_flag = '' then
    raise exception 'availability flag is required' using errcode = '22023';
  end if;

  update public.dishes d
  set availability_flags = (
    select coalesce(array_agg(f.flag order by f.ord), '{}'::text[])
    from unnest(d.availability_flags) with ordinality as f(flag, ord)
    where public.merchant_normalize_availability_flag(f.flag) <> v_flag
  ) || case
    when coalesce(
      p_enabled,
      not exists (
        select 1
        from unnest(d.availability_flags) as existing(flag)
        where public.merchant_normalize_availability_flag(existing.flag) = v_flag
      )
    ) then array[v_flag]
    else '{}'::text[]
  end
  where d.id = p_dish_id
    and d.venue_id = p_venue_id
  returning v_flag = any(d.availability_flags) into v_enabled;

  if not found then
    raise exception 'dish not found or not editable' using errcode = '42501';
  end if;
  return v_enabled;
end;
$$;

revoke all on function public.merchant_set_dish_availability_flag(text, text, text, boolean)
  from public, anon;
grant execute on function public.merchant_set_dish_availability_flag(text, text, text, boolean)
  to authenticated, service_role;

-- p_fields uses dishes column names (name, description, image_url, blurhash,
-- price, price_range, taste_tags, must_order, availability_flags, building_id).
-- On edit only the keys present change. p_gallery_urls, p_dietary_slugs and
-- p_taste_vector replace the dish's photos, labels and vector when not null.
create or replace function public.merchant_save_dish(
  p_dish_id text,
  p_venue_id text,
  p_building_id text,
  p_fields jsonb default '{}'::jsonb,
  p_gallery_urls text[] default null,
  p_dietary_slugs text[] default null,
  p_taste_vector jsonb default null
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_fields jsonb := coalesce(p_fields, '{}'::jsonb);
  v_inserted boolean := false;
  v_slugs text[];
  v_missing text[];
  v_price numeric;
begin
  if coalesce(trim(p_dish_id), '') = '' or coalesce(trim(p_venue_id), '') = '' then
    raise exception 'dish id and venue id are required' using errcode = '22023';
  end if;

  v_price := coalesce((v_fields->>'price')::numeric, 0);

  insert into public.dishes (
    id, venue_id, building_id, name, description, image_url, blurhash, price, price_range,
    taste_tags, must_order, availability_flags
  )
  values (
    p_dish_id,
    p_venue_id,
    coalesce(v_fields->>'building_id', p_building_id),
    coalesce(nullif(trim(v_fields->>'name'), ''), 'New dish'),
    nullif(v_fields->>'description', ''),
    nullif(v_fields->>'image_url', ''),
    nullif(v_fields->>'blurhash', ''),
    v_price,
    coalesce(v_fields->>'price_range', 'S$' || to_char(v_price, 'FM999990.00')),
    coalesce(array(select jsonb_array_elements_text(v_fields->'taste_tags')), '{}'::text[]),
    coalesce((v_fields->>'must_order')::boolean, false),
    coalesce(array(select jsonb_array_elements_text(v_fields->'availability_flags')), '{}'::text[])
  )
  on conflict (id) do nothing
  returning true into v_inserted;

  if not coalesce(v_inserted, false) then
    update public.dishes d
    set
      building_id = case when v_fields ? 'building_id' then v_fields->>'building_id' else d.building_id end,
      name = case when v_fields ? 'name' then v_fields->>'name' else d.name end,
      description = case when v_fields ? 'description' then nullif(v_fields->>'description', '') else d.description end,
      image_url = case when v_fields ? 'image_url' then nullif(v_fields->>'image_url', '') else d.image_url end,
      blurhash = case when v_fields ? 'blurhash' then nullif(v_fields->>'blurhash', '') else d.blurhash end,
      price = case when v_fields ? 'price' then (v_fields->>'price')::numeric else d.price end,
      price_range = case when v_fields ? 'price_range' then v_fields->>'price_range' else d.price_range end,
      taste_tags = case
        when v_fields ? 'taste_tags'
          then coalesce(array(select jsonb_array_elements_text(v_fields->'taste_tags')), '{}'::text[])
        else d.taste_tags
      end,
      must_order = case when v_fields ? 'must_order' then (v_fields->>'must_order')::boolean else d.must_order end,
      availability_flags = case
        when v_fields ? 'availability_flags'
          then coalesce(array(select jsonb_array_elements_text(v_fields->'availability_flags')), '{}'::text[])
        else d.availability_flags
      end
    where d.id = p_dish_id
      and d.venue_id = p_venue_id;

    if not found then
      raise exception 'dish not found or not editable' using errcode = '42501';
    end if;
  end if;

  if p_gallery_urls is not null then
    delete from public.dish_images where dish_id = p_dish_id;
    insert into public.dish_images (dish_id, url, sort_order)
    select p_dish_id, g.url, (g.ord - 1)::integer
    from unnest(p_gallery_urls) with ordinality as g(url, ord)
    where coalesce(trim(g.url), '') <> '';
  end if;

  if p_dietary_slugs is not null then
    select coalesce(array_agg(distinct s), '{}'::text[]) into v_slugs
    from unnest(p_dietary_slugs) as s
    where coalesce(trim(s), '') <> '';

    select array_agg(s order by s) into v_missing
    from unnest(v_slugs) as s
    where not exists (select 1 from public.dietary_flags f where f.slug = s);
    if v_missing is not null then
      raise exception 'Unknown dietary flags: %', array_to_string(v_missing, ', ')
        using errcode = '22023';
    end if;

    delete from public.dish_dietary_flags where dish_id = p_dish_id;
    insert into public.dish_dietary_flags (dish_id, dietary_flag_id)
    select p_dish_id, f.id
    from public.dietary_flags f
    where f.slug = any(v_slugs);
  end if;

  if p_taste_vector is not null then
    insert into public.dish_taste_vectors (
      dish_id, sweet, spicy, sour, salty, rich, aromatic, vector, updated_at
    )
    values (
      p_dish_id,
      (p_taste_vector->>'sweet')::numeric,
      (p_taste_vector->>'spicy')::numeric,
      (p_taste_vector->>'sour')::numeric,
      (p_taste_vector->>'salty')::numeric,
      (p_taste_vector->>'rich')::numeric,
      (p_taste_vector->>'aromatic')::numeric,
      (
        '[' || concat_ws(',',
          p_taste_vector->>'sweet', p_taste_vector->>'spicy', p_taste_vector->>'sour',
          p_taste_vector->>'salty', p_taste_vector->>'rich', p_taste_vector->>'aromatic'
        ) || ']'
      )::extensions.vector,
      now()
    )
    on conflict (dish_id) do update
    set sweet = excluded.sweet,
        spicy = excluded.spicy,
        sour = excluded.sour,
        salty = excluded.salty,
        rich = excluded.rich,
        aromatic = excluded.aromatic,
        vector = excluded.vector,
        updated_at = excluded.updated_at;
  end if;

  return p_dish_id;
end;
$$;

revoke all on function public.merchant_save_dish(text, text, text, jsonb, text[], text[], jsonb)
  from public, anon;
grant execute on function public.merchant_save_dish(text, text, text, jsonb, text[], text[], jsonb)
  to authenticated, service_role;
