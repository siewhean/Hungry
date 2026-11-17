-- Bound the known-source venue scan used by scheduled enrichment reviews.
-- Some older clean schemas predate menu_source_url, so guard the index creation;
-- environments with the enrichment columns receive the partial index.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'venues'
      and column_name = 'menu_source_url'
  ) then
    execute 'create index if not exists idx_venues_known_menu_source_id
      on public.venues (id)
      where menu_source_url is not null';
  end if;
end
$$;
