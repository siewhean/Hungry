-- Undo 20261114110000_rank_menuless_stalls_lower: Home's feed orders "has a picture" before "has a
-- dish" again, and Search's relevance sort drops the menu tier. Nothing is stored, so no data is lost.

do $$
declare
  v_feed constant regprocedure :=
    'public.get_discovery_feed_by_location(text,double precision,double precision,integer,integer,text)'::regprocedure;
  v_def text := pg_get_functiondef(v_feed);
  v_new_rank constant text := E'\n          (candidates.top_dish_id is not null) desc,\n          (nullif(trim(candidates.top_dish_image), \'\') is not null) desc,\n';
  v_old_rank constant text := E'\n          (nullif(trim(candidates.top_dish_image), \'\') is not null) desc,\n          (candidates.top_dish_id is not null) desc,\n';
  v_new_final constant text := E'\n    (candidates.top_dish_id is not null) desc,\n    (nullif(trim(candidates.top_dish_image), \'\') is not null) desc,\n';
  v_old_final constant text := E'\n    (nullif(trim(candidates.top_dish_image), \'\') is not null) desc,\n    (candidates.top_dish_id is not null) desc,\n';
begin
  if position(v_new_final in v_def) = 0 then
    return;
  end if;
  execute replace(replace(v_def, v_new_rank, v_old_rank), v_new_final, v_old_final);
end;
$$;

do $$
declare
  v_page constant regprocedure :=
    'public.catalog_raw_venues_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text[],text[],text)'::regprocedure;
  v_def text := pg_get_functiondef(v_page);
  v_tier constant text := E'\n             + case when c.menu_count > 0 or lower(c.name) = lower(v_query) then 1 else 0 end as relevance\n';
begin
  if position(v_tier in v_def) = 0 then
    return;
  end if;
  execute replace(v_def, v_tier, E' as relevance\n');
end;
$$;
