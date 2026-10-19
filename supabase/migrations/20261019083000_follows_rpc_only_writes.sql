-- Follow requests follow-up: make the RPCs the only way to create or answer a follow.
--
-- 1. follows_update_participant (0023) let the followee set status = 'approved'
--    straight through PostgREST, skipping approve_follow_request's block check
--    and its follow_request activity cleanup. follows_insert_requester (0023)
--    let a blocked user insert a pending row directly, which now delivers a
--    'follow_request' inbox item. Every app write already goes through the
--    SECURITY DEFINER RPCs (follow_user, approve/decline/cancel_follow_request),
--    so both policies are dropped. With RLS on and no INSERT/UPDATE policy,
--    authenticated users can no longer insert or update follows rows directly.
--    follows_select_participant and follows_delete_participant (unfollow,
--    remove follower) are unchanged.
-- 2. Backfill: pending follows created before 20261019074000 got a 'new_follower'
--    activity item. Turn those into 'follow_request' items, so the inbox links
--    to Follow Requests and approving them sends the one 'new_follower'.

drop policy if exists "follows_insert_requester" on public.follows;
drop policy if exists "follows_update_participant" on public.follows;

update public.activity_events ae
set event_type = 'follow_request'
where ae.event_type = 'new_follower'
  and exists (
    select 1
    from public.follows f
    where f.follower_id = ae.actor_id
      and f.followee_id = ae.recipient_id
      and f.status = 'pending'
  );
