-- Profile post grids read one author's published posts on the server
-- (posts.author_id = $1, newest published_at first, paged with offset)
-- instead of filtering the newest 40 posts app-wide on the client.
-- idx_posts_author_status_created (0023) is ordered by created_at, so add a
-- partial index matching the profile read's filter and order.

create index if not exists idx_posts_author_published
  on public.posts (author_id, published_at desc, created_at desc)
  where status = 'published' and deleted_at is null;
