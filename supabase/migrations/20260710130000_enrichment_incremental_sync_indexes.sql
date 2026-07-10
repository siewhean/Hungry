-- Support changed-row keyset reads used by scripts/sync_supabase_excel_master.py.
-- The sync filters and orders on updated_at before using id as its stable tie-breaker.

create index if not exists idx_venues_updated_at_id
  on public.venues (updated_at, id);

create index if not exists idx_dishes_updated_at_id
  on public.dishes (updated_at, id);
