-- Trigger functions should be invoked by their triggers, not directly through
-- /rest/v1/rpc/*. Remove authenticated direct EXECUTE grants where present.

do $$
begin
  if to_regprocedure('public.sync_home_feed_item_for_post()') is not null then
    revoke execute on function public.sync_home_feed_item_for_post()
    from public, anon, authenticated;
  end if;

  if to_regprocedure('public.sync_post_engagement_counts()') is not null then
    revoke execute on function public.sync_post_engagement_counts()
    from public, anon, authenticated;
  end if;
end
$$;
