-- Support changed-row keyset reads used by scripts/sync_supabase_excel_master.py.
-- The original core tables predate updated_at, so establish the cursor columns and
-- maintenance triggers before creating the indexes. IF NOT EXISTS keeps this
-- compatible with environments where the columns were added out of band.
-- The sync filters and orders on updated_at before using id as its stable tie-breaker.

alter table public.venues
  add column if not exists updated_at timestamptz not null default now();

alter table public.dishes
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_venues_updated_at on public.venues;
create trigger trg_venues_updated_at
  before update on public.venues
  for each row execute function public.set_updated_at();

drop trigger if exists trg_dishes_updated_at on public.dishes;
create trigger trg_dishes_updated_at
  before update on public.dishes
  for each row execute function public.set_updated_at();

create index if not exists idx_venues_updated_at_id
  on public.venues (updated_at, id);

create index if not exists idx_dishes_updated_at_id
  on public.dishes (updated_at, id);
