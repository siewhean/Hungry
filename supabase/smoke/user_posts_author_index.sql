-- Smoke checks for 20261019110000_user_posts_author_index.sql.
-- The profile post read (one author, published, newest first) has its
-- partial index. Runs in a transaction and rolls back.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'posts'
      and indexname = 'idx_posts_author_published'
      and indexdef ilike '%(author_id, published_at DESC, created_at DESC)%'
      and indexdef ilike '%status = ''published''%'
      and indexdef ilike '%deleted_at IS NULL%'
  ) then
    raise exception 'idx_posts_author_published is missing or has the wrong shape';
  end if;
end $$;

rollback;
