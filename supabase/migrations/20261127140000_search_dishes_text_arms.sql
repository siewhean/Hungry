-- smoke: supabase/smoke/search_dishes_text_arms.sql
-- Plain-text search such as "chicken rice" took 25s+ on prod. Three candidate arms of
-- search_dishes were slow: the cuisine/taste-tag arm had no index at all (a sequential scan of
-- every dish), the dish-name arm read ~20k heap pages (a loose trigram match) and also scanned
-- a partial index just to test "displayable", and the venue-name arm joined every match.
-- This keeps the exact same candidate set and ranking, and only changes how it is read:
--   * trigram indexes on the tag columns, so the tag arm becomes an index lookup;
--   * the dish-name arm reads the substring matches first. A substring match scores at least
--     0.65, so once 250 of them exist a fuzzy match below 0.65 can never reach the top 250 and
--     the fuzzy read is limited to similarity >= 0.65; with fewer than 250 it keeps the old 0.3.
-- Only the unscoped text arms change; venue-scoped and no-query paths are untouched.
set local lock_timeout = '2s';
set local statement_timeout = '10min';

-- array_to_string is only STABLE; for text[] it is safe to index.
create function app_private.catalog_tag_text(p_tags text[])
returns text
language sql
immutable
parallel safe
as $$ select array_to_string(p_tags, ' ') $$;

create index idx_dishes_food_type_trgm on public.dishes
  using gin ((coalesce(food_type, '')) gin_trgm_ops);
create index idx_dishes_taste_tags_trgm on public.dishes
  using gin ((app_private.catalog_tag_text(taste_tags)) gin_trgm_ops);
create index idx_dishes_cuisine_tags_trgm on public.dishes
  using gin ((app_private.catalog_tag_text(cuisine_tags)) gin_trgm_ops);
create index idx_venues_cuisine_tags_trgm on public.venues
  using gin ((app_private.catalog_tag_text(cuisine_tags)) gin_trgm_ops);

-- Helpers return what the heap row already holds, so the caller never joins back to dishes.
-- A SET clause keeps them from being inlined, so the query text reaches the index as a parameter.
create function app_private.search_dish_name_ilike_rows(q text)
returns table (id text, rating_avg numeric, name_sim real, shown boolean)
language sql
stable
strict
rows 500
security invoker
set search_path = pg_catalog, public, extensions
as $$
  select d.id, d.rating_avg, similarity(d.name, q),
    public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
  from public.dishes d
  where d.name ilike '%' || q || '%'
$$;

create function app_private.search_dish_name_fuzzy_rows(q text)
returns table (id text, rating_avg numeric, name_sim real, shown boolean, is_ilike boolean)
language sql
stable
strict
rows 500
security invoker
set search_path = pg_catalog, public, extensions
as $$
  select d.id, d.rating_avg, similarity(d.name, q),
    public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url),
    d.name ilike '%' || q || '%'
  from public.dishes d
  where d.name % q
$$;

create function app_private.search_dish_name_close_rows(q text)
returns table (id text, rating_avg numeric, name_sim real, shown boolean, is_ilike boolean)
language sql
stable
strict
rows 500
security invoker
set search_path = pg_catalog, public, extensions
-- float4(0.65) as a double: the operator compares a real similarity with this threshold, and a
-- candidate scoring exactly the substring floor must stay eligible (it ties and the rating decides).
set pg_trgm.similarity_threshold = '0.6499999761581421'
as $$
  select d.id, d.rating_avg, similarity(d.name, q),
    public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url),
    d.name ilike '%' || q || '%'
  from public.dishes d
  where d.name % q
$$;

create function app_private.search_dish_tag_ids(q text)
returns setof text
language sql
stable
strict
rows 500
security invoker
set search_path = pg_catalog, public, extensions
as $$
  select d.id from public.dishes d
  where coalesce(d.food_type, '') ilike '%' || q || '%'
    or app_private.catalog_tag_text(d.taste_tags) ilike '%' || q || '%'
    or app_private.catalog_tag_text(d.cuisine_tags) ilike '%' || q || '%'
  union
  select d.id from public.venues v
  join public.dishes d on d.venue_id = v.id
  where app_private.catalog_tag_text(v.cuisine_tags) ilike '%' || q || '%'
$$;

revoke all on function app_private.catalog_tag_text(text[]) from public, anon, authenticated;
revoke all on function app_private.search_dish_name_ilike_rows(text) from public, anon, authenticated;
revoke all on function app_private.search_dish_name_fuzzy_rows(text) from public, anon, authenticated;
revoke all on function app_private.search_dish_name_close_rows(text) from public, anon, authenticated;
revoke all on function app_private.search_dish_tag_ids(text) from public, anon, authenticated;
grant execute on function app_private.catalog_tag_text(text[]) to anon, authenticated, service_role;
grant execute on function app_private.search_dish_name_ilike_rows(text) to anon, authenticated, service_role;
grant execute on function app_private.search_dish_name_fuzzy_rows(text) to anon, authenticated, service_role;
grant execute on function app_private.search_dish_name_close_rows(text) to anon, authenticated, service_role;
grant execute on function app_private.search_dish_tag_ids(text) to anon, authenticated, service_role;

-- Swap the three unscoped text arms (name, venue name, tags) in search_dishes. The old text is
-- checked by hash first, so a changed definition stops the migration instead of being guessed at.
do $patch$
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
  v_new constant text := $new$      (
        with a_ok as materialized (
          select r.id, r.rating_avg, greatest(r.name_sim, 0.65::real) as score
          from params
          cross join lateral app_private.search_dish_name_ilike_rows(params.query) r
          where nullif(trim(coalesce(p_query, '')), '') is not null
            and params.query is not null
            and nullif(p_venue_id, '') is null
            and r.shown
        ),
        gate as materialized (
          select count(*) >= 250 as many from (select 1 from a_ok limit 250) g
        ),
        b_ok as (
          select r.id, r.rating_avg, r.name_sim as score
          from params
          cross join lateral app_private.search_dish_name_fuzzy_rows(params.query) r
          where nullif(trim(coalesce(p_query, '')), '') is not null
            and params.query is not null
            and nullif(p_venue_id, '') is null
            and r.shown and not r.is_ilike
            and not (select many from gate)
          union all
          select r.id, r.rating_avg, r.name_sim
          from params
          cross join lateral app_private.search_dish_name_close_rows(params.query) r
          where nullif(trim(coalesce(p_query, '')), '') is not null
            and params.query is not null
            and nullif(p_venue_id, '') is null
            and r.shown and not r.is_ilike
            and (select many from gate)
        )
        select u.id as dish_id
        from (select * from a_ok union all select * from b_ok) u
        order by u.score desc, u.rating_avg desc, u.id
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
        from params
        cross join lateral app_private.search_dish_tag_ids(params.query) as t(id)
        join dishes d on d.id = t.id
        where nullif(trim(coalesce(p_query, '')), '') is not null
            and params.query is not null
            and nullif(p_venue_id, '') is null
          and public.catalog_menu_is_displayable(d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url)
        order by d.rating_avg desc, d.id
        limit 250
      )$new$;
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
    or md5(substr(v_def, v_at, v_to - v_at)) <> 'ac26730221016f1071b4d031852f35d5'
  then
    raise exception 'search_dishes unscoped text arms differ from the expected definition';
  end if;
  execute overlay(v_def placing v_new from v_at for v_to - v_at);
end;
$patch$;

notify pgrst, 'reload schema';
