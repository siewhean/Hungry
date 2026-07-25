-- Required after applying the versioned raw-catalog release migrations. This
-- is definition-aware evidence for the Advisor allowlist: the publisher stays
-- service-role-only, the read routes are authenticated-only, and their bodies
-- retain the explicit auth guard rather than merely sharing a function name.
do $$
declare
  v_publisher regprocedure := 'public.catalog_raw_publish_release(text)'::regprocedure;
  v_definition text;
  v_raw_rpc regprocedure;
begin
  if has_function_privilege('anon', v_publisher, 'execute')
    or has_function_privilege('authenticated', v_publisher, 'execute')
    or not has_function_privilege('service_role', v_publisher, 'execute') then
    raise exception 'catalog publisher grants are not service-role-only';
  end if;

  if has_table_privilege('anon', 'public.catalog_raw_release_manifests', 'select')
    or has_table_privilege('authenticated', 'public.catalog_raw_release_manifests', 'select')
    or has_table_privilege('anon', 'public.catalog_raw_release_quarantines', 'select')
    or has_table_privilege('authenticated', 'public.catalog_raw_release_quarantines', 'select') then
    raise exception 'catalog release audit tables are readable by a client role';
  end if;

  foreach v_raw_rpc in array array[
    'public.catalog_raw_dishes_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text,text[])'::regprocedure,
    'public.catalog_raw_venue_menu_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text,text[])'::regprocedure,
    'public.catalog_raw_venues_page(text,double precision,double precision,integer,text[],text[],numeric,boolean,text,text,uuid,integer,text[])'::regprocedure,
    'public.catalog_raw_dish_detail(text,uuid)'::regprocedure,
    'public.catalog_raw_venue_detail(text,uuid)'::regprocedure,
    'public.catalog_raw_map_view(double precision,double precision,double precision,double precision,double precision,uuid,double precision,double precision,integer,text[],text[],boolean,numeric)'::regprocedure
  ] loop
    if has_function_privilege('anon', v_raw_rpc, 'execute')
      or not has_function_privilege('authenticated', v_raw_rpc, 'execute') then
      raise exception 'raw catalog RPC grant is not authenticated-only: %', v_raw_rpc;
    end if;

    select pg_get_functiondef(v_raw_rpc) into v_definition;
    if v_definition not ilike '%catalog_raw_require_authenticated%' then
      raise exception 'raw catalog RPC lacks the required auth guard: %', v_raw_rpc;
    end if;
  end loop;
end;
$$;
