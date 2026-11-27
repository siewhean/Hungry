-- down-loses-data: none; drops only the indexes and helper functions this migration created.
set local lock_timeout = '2s';

do $rollback$
declare
  v_sig constant regprocedure :=
    'public.search_dishes(text,double precision,double precision,integer,text[],integer,
      double precision,text,text,text,text[],numeric,boolean,text[],text[])'::regprocedure;
  v_old constant text := $old$      (
        select d.id as dish_id
        from dishes d
        cross join params
        where nullif(trim(coalesce(p_query, '')), '') is not null
          and params.query is not null
          and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
          and nullif(p_venue_id, '') is null
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
        where nullif(trim(coalesce(p_query, '')), '') is not null
          and params.query is not null
          and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
          and nullif(p_venue_id, '') is null
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
        where nullif(trim(coalesce(p_query, '')), '') is not null
          and params.query is not null
          and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
          and nullif(p_venue_id, '') is null
          and (
            coalesce(d.food_type, '') ilike '%' || params.query || '%'
            or array_to_string(d.taste_tags, ' ') ilike '%' || params.query || '%'
            or array_to_string(d.cuisine_tags, ' ') ilike '%' || params.query || '%'
            or array_to_string(v.cuisine_tags, ' ') ilike '%' || params.query || '%'
          )
        order by d.rating_avg desc, d.id
        limit 250
      )$old$;
  v_open constant text := '    from (' || chr(10) || '      (' || chr(10);
  v_close constant text := 'limit 250' || chr(10) || '      )' || chr(10) || chr(10) ||
    '      union all' || chr(10) || chr(10) || '      (' || chr(10) ||
    '        select d.id as dish_id' || chr(10) || '        from dishes d' || chr(10) ||
    '        join venues v on v.id = d.venue_id' || chr(10) || '        join buildings b on b.id = d.building_id';
  v_def text := pg_get_functiondef(v_sig);
  v_at integer;
  v_to integer;
begin
  v_at := strpos(v_def, v_open) + length('    from (' || chr(10));
  v_to := strpos(v_def, v_close) + length('limit 250' || chr(10) || '      )');
  if v_at <= length('    from (' || chr(10)) or v_to <= v_at
    or md5(substr(v_def, v_at, v_to - v_at)) <> '600bba861457ddf41557e42e7241c350'
  then
    raise exception 'search_dishes unscoped text arms differ from what this migration installed';
  end if;
  execute overlay(v_def placing v_old from v_at for v_to - v_at);
end;
$rollback$;

drop function app_private.search_dish_tag_ids(text);
drop function app_private.search_dish_name_close_rows(text);
drop function app_private.search_dish_name_fuzzy_rows(text);
drop function app_private.search_dish_name_ilike_rows(text);
drop index public.idx_venues_cuisine_tags_trgm;
drop index public.idx_dishes_cuisine_tags_trgm;
drop index public.idx_dishes_taste_tags_trgm;
drop index public.idx_dishes_food_type_trgm;
drop function app_private.catalog_tag_text(text[]);

notify pgrst, 'reload schema';
