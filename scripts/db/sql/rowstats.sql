-- Session-local helper: one row per base table with row count (and, optionally, an
-- order-independent hash of every row's text). n = -1 means "no permission to read".
create or replace function pg_temp.hungry_rowstats(p_hash boolean default false)
returns table(tbl text, n bigint, h text)
language plpgsql as $$
declare r record;
begin
  for r in
    select schemaname, tablename from pg_tables
    where schemaname in ('public', 'app_private', 'auth', 'storage')
    order by 1, 2
  loop
    tbl := r.schemaname || '.' || r.tablename;
    begin
      if p_hash then
        execute format('select count(*), coalesce(sum(hashtextextended(x::text, 0)), 0)::text from %I.%I x', r.schemaname, r.tablename) into n, h;
      else
        execute format('select count(*) from %I.%I', r.schemaname, r.tablename) into n;
        h := null;
      end if;
    exception when insufficient_privilege then
      n := -1; h := null;
    end;
    return next;
  end loop;
end $$;
