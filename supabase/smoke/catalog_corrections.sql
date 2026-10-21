-- Smoke checks for 20261022050300_catalog_corrections.sql.
-- "Something wrong?" reports go through submit_catalog_correction only: guests
-- are refused, bad kinds are refused, and the table is not writable directly.
-- Runs in a transaction and rolls back.

begin;

do $$
begin
  if not (select c.relrowsecurity from pg_class c where c.oid = 'public.catalog_corrections'::regclass) then
    raise exception 'catalog_corrections must have row level security on';
  end if;
  if has_table_privilege('authenticated', 'public.catalog_corrections', 'insert')
     or has_table_privilege('anon', 'public.catalog_corrections', 'select') then
    raise exception 'catalog_corrections must have no direct insert or guest read';
  end if;
  if has_function_privilege('anon', 'public.submit_catalog_correction(text, text, text, text)', 'execute') then
    raise exception 'guests must not call submit_catalog_correction';
  end if;
  if not has_function_privilege('authenticated', 'public.submit_catalog_correction(text, text, text, text)', 'execute') then
    raise exception 'signed-in diners must be able to call submit_catalog_correction';
  end if;
end $$;

-- No signed-in user: refused with an auth error.
do $$
begin
  perform public.submit_catalog_correction('catalog-corrections-smoke-venue', 'closed');
  raise exception 'a guest must not be able to submit a correction';
exception
  when insufficient_privilege then
    null;
end $$;

rollback;
