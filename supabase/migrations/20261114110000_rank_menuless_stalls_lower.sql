-- smoke: supabase/smoke/rank_menuless_stalls_lower.sql
-- Stalls with no dishes rank lower on Home and in Search (sh, 2026-11-14: "Do not hide them but
-- rank them down"). Nothing is filtered out; only the order changes.
--
-- 1. get_discovery_feed_by_location (Home): the feed put "has a picture" before "has a dish", and
--    the picture falls back to the stall's or the building's photo, so a stall with no dishes in a
--    mall with a photo ranked above a stall with dishes and no photo. "Has a dish" now comes first,
--    in the per-building rank and in the final order; the picture still orders within each group.
-- 2. catalog_raw_venues_page (Search Stalls tab and the Map cards): the relevance sort (Search's
--    default) gains 1 for a stall with a menu, so those stalls lead and the rest follow in their old
--    order. A stall whose name is exactly what was typed keeps its place, so searching a stall by
--    name still finds it first. The keyset cursor reads the same relevance column, so paging stays
--    consistent. Nearby, price and top rated sorts are unchanged (the diner picked them).
-- Patched in place from the live bodies (as 20261101090000 did); each patch checks its hit count.
-- Rollback: supabase/rollbacks/20261114110000_rank_menuless_stalls_lower.down.sql.

do $$
declare
  v_feed constant regprocedure :=
    'public.get_discovery_feed_by_location(text,double precision,double precision,integer,integer,text)'::regprocedure;
  v_def text := pg_get_functiondef(v_feed);
  v_find_rank constant text := E'\n          (nullif(trim(candidates.top_dish_image), \'\') is not null) desc,\n          (candidates.top_dish_id is not null) desc,\n';
  v_repl_rank constant text := E'\n          (candidates.top_dish_id is not null) desc,\n          (nullif(trim(candidates.top_dish_image), \'\') is not null) desc,\n';
  v_find_final constant text := E'\n    (nullif(trim(candidates.top_dish_image), \'\') is not null) desc,\n    (candidates.top_dish_id is not null) desc,\n';
  v_repl_final constant text := E'\n    (candidates.top_dish_id is not null) desc,\n    (nullif(trim(candidates.top_dish_image), \'\') is not null) desc,\n';
  v_hits integer;
begin
  if position(v_repl_final in v_def) > 0 then
    return;
  end if;
  v_hits := (length(v_def) - length(replace(v_def, v_find_rank, ''))) / length(v_find_rank);
  if v_hits <> 1 then
    raise exception 'get_discovery_feed_by_location: expected 1 place_rank order, found %', v_hits;
  end if;
  v_hits := (length(v_def) - length(replace(v_def, v_find_final, ''))) / length(v_find_final);
  if v_hits <> 1 then
    raise exception 'get_discovery_feed_by_location: expected 1 final order, found %', v_hits;
  end if;
  execute replace(replace(v_def, v_find_rank, v_repl_rank), v_find_final, v_repl_final);
end;
$$;

do $$
declare
  v_page constant regprocedure :=
    'public.catalog_raw_venues_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text[],text[],text)'::regprocedure;
  v_def text := pg_get_functiondef(v_page);
  v_find constant text := E' + case when c.image_url is not null then 0.01 else 0 end end)::numeric, 6)::double precision as relevance\n';
  v_repl constant text := E' + case when c.image_url is not null then 0.01 else 0 end end)::numeric, 6)::double precision\n             + case when c.menu_count > 0 or lower(c.name) = lower(v_query) then 1 else 0 end as relevance\n';
  v_hits integer;
begin
  if position('c.menu_count > 0 or lower(c.name) = lower(v_query)' in v_def) > 0 then
    return;
  end if;
  v_hits := (length(v_def) - length(replace(v_def, v_find, ''))) / length(v_find);
  if v_hits <> 1 then
    raise exception 'catalog_raw_venues_page: expected 1 relevance expression, found %', v_hits;
  end if;
  execute replace(v_def, v_find, v_repl);
end;
$$;
