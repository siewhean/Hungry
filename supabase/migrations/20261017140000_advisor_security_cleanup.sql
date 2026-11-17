-- Clear the app-owned Security Advisor findings raised on the rebuilt project.

-- Cursor helpers had no pinned search_path.
alter function public.catalog_raw_cursor(jsonb) set search_path = public, extensions;
alter function public.catalog_raw_cursor_value(text) set search_path = public, extensions;

-- Internal helpers are only called from other SECURITY DEFINER RPCs, which run as the owner.
revoke all on function public.catalog_raw_release_for_read(uuid) from public, anon, authenticated;
revoke all on function public.catalog_raw_require_authenticated() from public, anon, authenticated;
