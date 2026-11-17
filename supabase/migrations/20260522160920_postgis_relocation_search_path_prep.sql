-- Prepare app-owned PostGIS read RPCs for support-assisted PostGIS relocation.
--
-- Supabase Security Advisor still flags PostGIS because the extension is in
-- public and is owned by supabase_admin. If Support moves PostGIS to the
-- extensions schema, these RPCs must still be able to resolve st_* functions
-- and geography casts. Keep public first to preserve table/function lookup
-- behavior before relocation, and add extensions for the future extension
-- schema.

do $$
begin
  if to_regprocedure('public.get_taste_recommendations(text, double precision[], text[], text, double precision, double precision, integer, text[], integer)') is not null then
    execute 'alter function public.get_taste_recommendations(text, double precision[], text[], text, double precision, double precision, integer, text[], integer) set search_path = public, extensions';
  end if;

  if to_regprocedure('public.search_dishes(text, double precision, double precision, integer, text[], integer, double precision, text, text)') is not null then
    execute 'alter function public.search_dishes(text, double precision, double precision, integer, text[], integer, double precision, text, text) set search_path = public, extensions';
  end if;

  if to_regprocedure('public.get_nearby_open_venues(double precision, double precision, integer, integer, integer, text)') is not null then
    execute 'alter function public.get_nearby_open_venues(double precision, double precision, integer, integer, integer, text) set search_path = public, extensions';
  end if;

  if to_regprocedure('public.list_buildings(double precision, double precision, integer, integer, integer, text)') is not null then
    execute 'alter function public.list_buildings(double precision, double precision, integer, integer, integer, text) set search_path = public, extensions';
  end if;

  if to_regprocedure('public.list_venues_by_building(text, boolean, integer, integer, text)') is not null then
    execute 'alter function public.list_venues_by_building(text, boolean, integer, integer, text) set search_path = public, extensions';
  end if;
end
$$;
