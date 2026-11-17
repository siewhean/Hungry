-- PostgreSQL functions otherwise retain PUBLIC execute by default. Raw catalog
-- routes are signed-in only, even though their bodies also enforce auth.uid().
revoke all on function public.catalog_raw_dishes_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text, text[]) from public, anon;
revoke all on function public.catalog_raw_venue_menu_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text, text[]) from public, anon;
revoke all on function public.catalog_raw_venues_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text[]) from public, anon;
revoke all on function public.catalog_raw_dish_detail(text, uuid) from public, anon;
revoke all on function public.catalog_raw_venue_detail(text, uuid) from public, anon;
revoke all on function public.catalog_raw_map_view(double precision, double precision, double precision, double precision, double precision, uuid, double precision, double precision, integer, text[], text[], boolean, numeric) from public, anon;

grant execute on function public.catalog_raw_dishes_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text, text[]) to authenticated;
grant execute on function public.catalog_raw_venue_menu_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text, text[]) to authenticated;
grant execute on function public.catalog_raw_venues_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text[]) to authenticated;
grant execute on function public.catalog_raw_dish_detail(text, uuid) to authenticated;
grant execute on function public.catalog_raw_venue_detail(text, uuid) to authenticated;
grant execute on function public.catalog_raw_map_view(double precision, double precision, double precision, double precision, double precision, uuid, double precision, double precision, integer, text[], text[], boolean, numeric) to authenticated;
