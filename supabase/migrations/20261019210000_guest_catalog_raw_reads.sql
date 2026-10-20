-- Guests can browse the catalog (map pins, venue/dish pages and details).
-- Product rule: guests can see stall data; anything that saves needs an account.
--
-- Scope: only the read-only catalog_raw_* browse RPCs. Base tables
-- (catalog_releases, catalog_raw_*_cards, catalog_raw_dish_media) stay revoked
-- from anon and authenticated; publish/refresh RPCs stay service-only. Page RPCs
-- keep their 50-row cap and map_view keeps its 500-pin cap.

-- The read RPCs call this guard. Accept any API caller (anon key or signed-in
-- JWT) instead of requiring a signed-in user. Calls with no API role, such as a
-- direct database session without JWT claims, are still refused.
create or replace function public.catalog_raw_require_authenticated()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null and coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    raise exception 'authentication required' using errcode = '42501';
  end if;
end;
$$;

-- Internal helper: only the SECURITY DEFINER read RPCs call it.
revoke all on function public.catalog_raw_require_authenticated() from public, anon, authenticated;

grant execute on function public.catalog_raw_dishes_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text, text[]) to anon;
grant execute on function public.catalog_raw_venue_menu_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text, text[]) to anon;
grant execute on function public.catalog_raw_venues_page(text, double precision, double precision, integer, text[], text[], numeric, boolean, text, text, uuid, integer, text[]) to anon;
grant execute on function public.catalog_raw_dish_detail(text, uuid) to anon;
grant execute on function public.catalog_raw_venue_detail(text, uuid) to anon;
grant execute on function public.catalog_raw_map_view(double precision, double precision, double precision, double precision, double precision, uuid, double precision, double precision, integer, text[], text[], boolean, numeric) to anon;
