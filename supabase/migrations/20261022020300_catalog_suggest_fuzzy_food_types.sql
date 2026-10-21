-- Round-two search fix (search-M10): "Did you mean" for empty results.
-- catalog_suggest is unchanged except for one fallback: when no label starts with the typed
-- text, it returns the closest food types by trigram similarity (kind 'food_type'), which the
-- results screen offers as a spelling suggestion. Body copied from
-- 20261021150200_catalog_suggest.sql; SECURITY DEFINER, stable, search_path and the grant
-- to anon and authenticated are unchanged.

create or replace function public.catalog_suggest(p_prefix text default null, p_limit integer default 8)
returns jsonb
language plpgsql
stable
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
    select 'food_type'::text as kind, c.food_type as label, count(*) as weight, 0 as kind_rank
    from public.catalog_raw_dish_cards c
    where c.release_id = v_release and c.food_type is not null
      and (c.food_type ilike v_escaped || '%' or c.food_type ilike '% ' || v_escaped || '%')
    group by c.food_type
    union all
    select 'place', c.building_name, count(*), 1
    from public.catalog_raw_venue_cards c
    where c.release_id = v_release and c.building_name is not null
      and (c.building_name ilike v_escaped || '%' or c.building_name ilike '% ' || v_escaped || '%')
    group by c.building_name
    union all
    select 'stall', c.name, count(*), 2
    from public.catalog_raw_venue_cards c
    where c.release_id = v_release
      and (c.name ilike v_escaped || '%' or c.name ilike '% ' || v_escaped || '%')
    group by c.name
  ), ranked as (
    select kind, label, kind_rank, weight, (label ilike v_escaped || '%') as starts_with
    from matches
    order by (label ilike v_escaped || '%') desc, kind_rank, weight desc, label
    limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'label', label)
    order by starts_with desc, kind_rank, weight desc, label), '[]'::jsonb)
  into v_items
  from ranked;

  -- Nothing starts with the text: offer the closest food types by trigram similarity, so a
  -- typo ("chikcen rice") still gets a "Did you mean" suggestion.
  if jsonb_array_length(v_items) = 0 then
    select coalesce(jsonb_agg(jsonb_build_object('kind', 'food_type', 'label', f.label)
      order by f.score desc, f.weight desc, f.label), '[]'::jsonb)
    into v_items
    from (
      select c.food_type as label, max(similarity(c.food_type, v_prefix)) as score, count(*) as weight
      from public.catalog_raw_dish_cards c
      where c.release_id = v_release and c.food_type is not null and c.food_type % v_prefix
      group by c.food_type
      order by max(similarity(c.food_type, v_prefix)) desc, count(*) desc, c.food_type
      limit v_limit
    ) f;
  end if;
  return v_items;
end;
$$;

revoke all on function public.catalog_suggest(text, integer) from public;
grant execute on function public.catalog_suggest(text, integer) to anon, authenticated;
