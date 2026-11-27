-- smoke: supabase/smoke/split_stall_detail_reads.sql
-- Keep stall identity independent from its menu and viewer-specific merchant reads.
set local lock_timeout = '2s';

create function public.get_stall_header(p_venue_id text)
returns table (
  venue_id text,
  building_id text,
  name text,
  unit_number text,
  floor text,
  is_open boolean,
  live_crowd text,
  top_dish_id text,
  operating_hours text,
  closure_notice text,
  logo_url text,
  building jsonb,
  delivery_links jsonb,
  display_image_url text,
  opening_schedule jsonb,
  latitude double precision,
  longitude double precision
)
language sql
volatile
security invoker
set search_path = pg_catalog, public
as $$
  select s.*
  from public.get_venue_summaries(array[p_venue_id]) s
  where not exists (
    select 1 from app_private.catalog_excluded_venues e where e.venue_id = s.venue_id
  );
$$;

-- The unfiltered venue branch of search_dishes orders candidates by rating, reviews and ID,
-- then computes its score on no-query/no-location inputs. Legacy pages are restricted to
-- that same candidate window because installed apps continue with search_dishes.
-- New pages share the score and tie-break but may cover the entire venue.
create function app_private.stall_menu_rows(
  p_venue_id text,
  p_after_score double precision,
  p_after_id text,
  p_limit integer,
  p_legacy boolean
)
returns table (dish_id text, rank_score double precision, item jsonb)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with candidates as materialized (
    select
      d.id,
      d.archived_at,
      d.merchant_draft,
      d.food_type,
      d.course,
      d.cuisine_tags,
      -- The score must round-trip through JSON under the pooler's float settings.
      round((0.55::double precision
        + 0.25 * least(greatest(d.rating_avg::double precision / 5, 0), 1)
        + 0.20 * greatest(0, 1 - d.distance_meters::double precision / 2500)
      )::numeric, 6)::double precision as score
    from public.dishes d
    join public.buildings b on b.id = d.building_id
    where d.venue_id = p_venue_id
      and (p_legacy or d.archived_at is null)
      and public.catalog_menu_is_displayable(
        d.menu_approved_for_display, d.menu_rights_status, d.menu_source_url
      )
    order by d.rating_avg desc, d.review_count desc, d.id
    limit case when p_legacy then 750 end
  ),
  page as materialized (
    select c.*
    from candidates c
    where c.archived_at is null
      and not c.merchant_draft
      and (p_after_score is null
        or c.score < p_after_score
        or (c.score = p_after_score and c.id > p_after_id))
    order by c.score desc, c.id
    limit least(greatest(p_limit, 1), 51)
  )
  select
    p.id,
    p.score,
    to_jsonb(d) || jsonb_build_object(
      'id', d.dish_id,
      'rating_avg', d.rating,
      'food_type', p.food_type,
      'course', p.course,
      'cuisine_tags', (
        select coalesce(array_agg(distinct tag order by tag), '{}'::text[])
        from unnest(p.cuisine_tags || v.cuisine_tags) as tag
      ),
      'rank_score', p.score,
      'cursor_score', p.score,
      'cursor_id', p.id
    )
  from page p
  join public.venues v on v.id = p_venue_id
  cross join lateral public.get_dish_detail(p.id) d
  order by p.score desc, p.id;
$$;

create function public.get_stall_menu_page(
  p_venue_id text,
  p_cursor text default null,
  p_limit integer default 20
)
returns table (dishes jsonb, next_cursor text)
language plpgsql
volatile
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_cursor jsonb;
  v_after_score double precision;
  v_after_id text;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  if p_cursor is not null then
    if octet_length(p_cursor) > 4096 then
      raise invalid_parameter_value using message = 'Invalid stall menu cursor';
    end if;
    begin
      v_cursor := p_cursor::jsonb;
      if jsonb_typeof(v_cursor) is distinct from 'object'
        or v_cursor->'v' is distinct from '1'::jsonb
        or jsonb_typeof(v_cursor->'venue') is distinct from 'string'
        or (v_cursor->>'venue') is distinct from p_venue_id
        or jsonb_typeof(v_cursor->'score') is distinct from 'number'
        or jsonb_typeof(v_cursor->'id') is distinct from 'string'
        or nullif(v_cursor->>'id', '') is null
      then
        raise invalid_parameter_value using message = 'Invalid stall menu cursor';
      end if;
      v_after_score := (v_cursor->>'score')::double precision;
      v_after_id := v_cursor->>'id';
    exception
      when invalid_text_representation or numeric_value_out_of_range or untranslatable_character then
        raise invalid_parameter_value using message = 'Invalid stall menu cursor';
    end;
  end if;

  if not exists (
    select 1 from public.venues v
    join public.buildings b on b.id = v.building_id
    where v.id = p_venue_id
      and not exists (
        select 1 from app_private.catalog_excluded_venues e where e.venue_id = v.id
      )
  ) then
    return;
  end if;

  return query
  with page as (
    select m.*, row_number() over (order by m.rank_score desc, m.dish_id) as row_num
    from app_private.stall_menu_rows(p_venue_id, v_after_score, v_after_id, v_limit + 1, false) m
  )
  select
    coalesce(jsonb_agg(p.item order by p.row_num) filter (where p.row_num <= v_limit), '[]'::jsonb),
    case when count(*) > v_limit then
      max(jsonb_build_object('v', 1, 'venue', p_venue_id, 'score', p.rank_score, 'id', p.dish_id)::text)
        filter (where p.row_num = v_limit)
    end
  from page p;
end;
$$;

revoke all on function public.get_stall_header(text) from public, anon, authenticated;
revoke all on function public.get_stall_menu_page(text, text, integer) from public, anon, authenticated;
revoke all on function app_private.stall_menu_rows(text, double precision, text, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.get_stall_header(text) to anon, authenticated, service_role;
grant execute on function public.get_stall_menu_page(text, text, integer) to anon, authenticated, service_role;
grant execute on function app_private.stall_menu_rows(text, double precision, text, integer, boolean)
  to anon, authenticated, service_role;

insert into app_private.request_rate_rules (route, anon_per_minute, user_per_minute, note)
values
  ('rpc/get_stall_header', 120, 180, 'stall header'),
  ('rpc/get_stall_menu_page', 90, 120, 'stall menu paging');

-- A clean main replay has the canonical volatile 50-item legacy menu already. A known
-- hosted definition used an incompatible cursor. Record what was changed on the new
-- helper so the down migration restores the exact pre-up definition in either case.
do $$
declare
  v_sig constant regprocedure := 'public.get_venue_detail(text)'::regprocedure;
  v_search_sig constant regprocedure :=
    'public.search_venues_by_location(text,text,double precision,double precision,integer,integer)'::regprocedure;
  v_dishes_sig constant regprocedure :=
    'public.search_dishes(text,double precision,double precision,integer,text[],integer,
      double precision,text,text,text,text[],numeric,boolean,text[],text[])'::regprocedure;
  v_original_rank constant text := $rank$      (
        (0.55 * lean_candidates.text_score)
        + (0.25 * lean_candidates.rating_score)
        + (0.20 * lean_candidates.distance_score)
      )::double precision as rank_score
    from lean_candidates$rank$;
  v_menu_rank constant text := $rank$      case
        when nullif(p_venue_id, '') is not null
          and nullif(trim(p_query), '') is null
          and nullif(trim(p_area_name), '') is null
          and p_lat is null and p_lng is null
        then round(raw.rank_score::numeric, 6)::double precision
        else raw.rank_score
      end as rank_score
    from lean_candidates
    cross join lateral (
      select (
        (0.55 * lean_candidates.text_score)
        + (0.25 * lean_candidates.rating_score)
        + (0.20 * lean_candidates.distance_score)
      )::double precision as rank_score
    ) raw$rank$;
  v_known_dishes_bodies constant text[] := array[
    'fe1769da5ecd86bed8a40582c87367b2', -- main replay
    '24d872ef2579a833102f207ccfe1b732'  -- hosted
  ];
  v_archived_filter constant text := '      and d.archived_at is null';
  v_menu_visibility constant text := $filter$      and d.archived_at is null
      and not (
        d.merchant_draft
        and nullif(p_venue_id, '') is not null
        and nullif(trim(p_query), '') is null
        and nullif(trim(p_area_name), '') is null
        and p_lat is null and p_lng is null
      )$filter$;
  -- The candidate arms test the venue through the params CTE, which hides it from the
  -- planner: a stall menu read every dish on prod. Each arm is split in two, one for the
  -- unscoped and one for the venue-scoped call, with gates on the function arguments
  -- (one-time filters) so the arms that do not apply never run.
  v_arms_open constant text := '    from (' || chr(10) || '      (' || chr(10);
  v_arms_close constant text := chr(10) || '    ) matched' || chr(10);
  v_venue_or constant text := '(params.venue_id is null or d.venue_id = params.venue_id)';
  v_arms_sep constant text := chr(10) || chr(10) || '      union all -- venue-scoped arms: p_venue_id is set' || chr(10) || chr(10);
  v_unscoped constant text := 'nullif(p_venue_id, '''') is null';
  v_scoped constant text := 'nullif(p_venue_id, '''') is not null' || chr(10) ||
    '          and d.venue_id = nullif(p_venue_id, '''')';
  v_query_gate constant text := 'nullif(trim(coalesce(p_query, '''')), '''') is not null' || chr(10) ||
    '          and params.query is not null';
  v_noquery_gate constant text := '(nullif(trim(coalesce(p_query, '''')), '''') is null' || chr(10) ||
    '            or exists (select 1 from query_area_match))' || chr(10) ||
    '          and params.query is null';
  v_dishes_body text;
  v_dishes_def text;
  v_arms_at integer;
  v_arms_to integer;
  v_arms text;
  v_unscoped_arms text;
  v_scoped_arms text;
  v_def text := pg_get_functiondef(v_sig);
  v_start text := '    coalesce((' || chr(10) || '      select jsonb_agg(' || chr(10) ||
    '        jsonb_build_object(' || chr(10) || '          ''dish_id'', d.id,';
  v_end text := '    ), ''[]''::jsonb) as dishes,';
  v_pos integer := strpos(v_def, v_start);
  v_length integer;
  v_repair_venue boolean;
  v_repair_search boolean;
begin
  select md5(prosrc) = 'd6eb28db06d12008cbb6abdc8eea6400' and provolatile = 's'
  into v_repair_venue from pg_proc where oid = v_sig;

  if v_repair_venue then
    -- The rollback has a fixed historical definition, including its function settings.
    if md5(v_def) <> 'cf158754a8d80f44cf895afd58020580' then
      raise exception 'get_venue_detail function attributes differ from the rollback baseline';
    end if;
    if v_pos = 0 or strpos(v_def, v_end) <= v_pos then
      raise exception 'get_venue_detail lacks the expected hosted menu projection';
    end if;
    v_length := strpos(v_def, v_end) - v_pos + length(v_end);
    execute overlay(v_def placing $body$
    coalesce((
      select jsonb_agg(m.item order by m.rank_score desc, m.dish_id)
      from app_private.stall_menu_rows(v.id, null, null, 50, true) m
    ), '[]'::jsonb) as dishes,$body$ from v_pos for v_length);
  elsif not exists (
    select 1 from pg_proc
    where oid = v_sig and md5(prosrc) = '8cb316b8f5cf97ff5a0c2794e1a8608b' and provolatile = 'v'
  ) then
    raise exception 'get_venue_detail differs from the known clean and hosted definitions';
  end if;

  select md5(prosrc) = '0daa8d75a2bc375bd6dbfb67a6c4af7d' and provolatile = 's'
  into v_repair_search from pg_proc where oid = v_search_sig;

  if not v_repair_search
    and not exists (select 1 from pg_proc where oid = v_search_sig and provolatile = 'v')
  then
    raise exception 'search_venues_by_location differs from the known rate-limited and hosted definitions';
  end if;

  -- Installed apps use search_dishes after the embedded venue page. Normalize only the
  -- venue-only rank so its typed response also survives the gateway's JSON serialization.
  select prosrc into v_dishes_body from pg_proc where oid = v_dishes_sig;
  if not (md5(v_dishes_body) = any(v_known_dishes_bodies))
    or strpos(v_dishes_body, v_original_rank) = 0
    or strpos(v_dishes_body, v_archived_filter) = 0
  then
    raise exception 'search_dishes differs from the expected legacy continuation definition';
  end if;
  v_dishes_def := replace(
    replace(pg_get_functiondef(v_dishes_sig), v_original_rank, v_menu_rank),
    v_archived_filter, v_menu_visibility
  );

  v_arms_at := strpos(v_dishes_def, v_arms_open) + length('    from (' || chr(10));
  v_arms_to := strpos(v_dishes_def, v_arms_close);
  if v_arms_at <= length('    from (' || chr(10)) or v_arms_to <= v_arms_at then
    raise exception 'search_dishes lacks the expected candidate arms';
  end if;
  v_arms := substr(v_dishes_def, v_arms_at, v_arms_to - v_arms_at);
  if (length(v_arms) - length(replace(v_arms, v_venue_or, ''))) <> 4 * length(v_venue_or)
    or (length(v_arms) - length(replace(v_arms, 'params.query is not null', ''))) <> 3 * length('params.query is not null')
    or (length(v_arms) - length(replace(v_arms, 'params.query is null', ''))) <> length('params.query is null')
  then
    raise exception 'search_dishes candidate arms differ from the expected definition';
  end if;
  v_unscoped_arms := replace(replace(replace(v_arms,
    v_venue_or, v_unscoped),
    'params.query is not null', v_query_gate),
    'params.query is null', v_noquery_gate);
  v_scoped_arms := replace(replace(replace(v_arms,
    v_venue_or, v_scoped),
    'params.query is not null', v_query_gate),
    'params.query is null', v_noquery_gate);
  execute overlay(v_dishes_def placing v_unscoped_arms || v_arms_sep || v_scoped_arms
    from v_arms_at for v_arms_to - v_arms_at);

  execute format(
    'comment on function app_private.stall_menu_rows(text,double precision,text,integer,boolean) is %L',
    jsonb_build_object('repair_venue', v_repair_venue, 'repair_search', v_repair_search)::text
  );
end;
$$;

-- Include explicit volatility in the migration for the static rate-limit check.
-- On clean main these are already VOLATILE, and the guards above reject unexpected definitions.
alter function public.get_venue_detail(text) volatile;
alter function public.search_venues_by_location(text,text,double precision,double precision,integer,integer)
  volatile;

notify pgrst, 'reload schema';
