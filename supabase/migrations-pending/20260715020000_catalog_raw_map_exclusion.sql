-- The raw map is a separate authenticated RPC, so it needs the same
-- non-consumer venue boundary as raw dish/venue cards and details.
do $$
declare
  v_definition text;
  v_original text;
begin
  select pg_get_functiondef('public.catalog_raw_map_view(double precision,double precision,double precision,double precision,double precision,uuid,double precision,double precision,integer,text[],text[],boolean,numeric)'::regprocedure)
    into v_definition;
  v_original := v_definition;
  v_definition := replace(
    v_definition,
    E'from public.catalog_raw_venue_cards\n      where release_id = v_release and latitude between',
    E'from public.catalog_raw_venue_cards\n      where release_id = v_release\n        and not exists (select 1 from public.catalog_raw_excluded_venues e where e.venue_id = id)\n        and latitude between'
  );
  v_definition := replace(
    v_definition,
    E'select * from public.catalog_raw_venue_cards\n      where release_id = v_release and latitude between',
    E'select * from public.catalog_raw_venue_cards\n      where release_id = v_release\n        and not exists (select 1 from public.catalog_raw_excluded_venues e where e.venue_id = id)\n        and latitude between'
  );
  if v_definition = v_original then
    raise exception 'catalog_raw_map_view exclusion patch did not apply';
  end if;
  execute v_definition;
end;
$$;
