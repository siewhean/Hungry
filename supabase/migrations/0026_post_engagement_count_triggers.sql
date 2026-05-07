-- Keep denormalized post engagement counters in sync with persisted rows.
-- UI feed readers consume `posts.like_count/save_count/share_count`, while
-- interactions are stored in row-level engagement tables.

create or replace function public.sync_post_engagement_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_post_id uuid;
begin
  target_post_id := coalesce(new.post_id, old.post_id);

  update public.posts
  set
    like_count = (select count(*)::integer from public.post_likes where post_id = target_post_id),
    save_count = (select count(*)::integer from public.post_saves where post_id = target_post_id),
    share_count = (select count(*)::integer from public.post_shares where post_id = target_post_id),
    updated_at = now()
  where id = target_post_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_post_likes_sync_counts on public.post_likes;
create trigger trg_post_likes_sync_counts
after insert or delete on public.post_likes
for each row execute function public.sync_post_engagement_counts();

drop trigger if exists trg_post_saves_sync_counts on public.post_saves;
create trigger trg_post_saves_sync_counts
after insert or delete on public.post_saves
for each row execute function public.sync_post_engagement_counts();

drop trigger if exists trg_post_shares_sync_counts on public.post_shares;
create trigger trg_post_shares_sync_counts
after insert or delete on public.post_shares
for each row execute function public.sync_post_engagement_counts();
