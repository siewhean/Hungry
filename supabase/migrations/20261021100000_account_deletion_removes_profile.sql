-- Account deletion removes the user's data instead of leaving it behind
-- (round-two page review, settings critical).
--
-- anonymize_account_deletion_request (0040) only rewrote user_profiles, and
-- user_profiles has no foreign key to auth.users, so auth.admin.deleteUser
-- never removed it. Every table that references user_profiles ON DELETE
-- CASCADE (public Lists, checklists, passport, settings, the bio in
-- public_profiles, and more) kept the deleted user's rows.
--
-- The function now deletes the user_profiles row at the end, after detaching
-- content that must survive (reviews and bites as "Deleted user", menu photos)
-- and clearing the user tables that have no foreign key to it. Reports the
-- user filed (post_reports, portfolio_flags) are removed with the profile.
-- Everything else in the function is unchanged from 0040.

begin;

create or replace function public.anonymize_account_deletion_request(
  p_request_id uuid,
  p_worker_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request account_deletion_requests%rowtype;
  v_user_id uuid;
begin
  select *
  into v_request
  from account_deletion_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'account deletion request not found' using errcode = 'P0002';
  end if;

  v_user_id := v_request.user_id;

  if v_request.legal_hold then
    insert into account_deletion_processing_events (request_id, user_id, event_type, metadata)
    values (
      p_request_id,
      v_user_id,
      'legal_hold',
      jsonb_build_object('retention_reason', v_request.retention_reason)
    );
    raise exception 'account deletion request is on legal hold' using errcode = '42501';
  end if;

  insert into account_deletion_processing_events (request_id, user_id, event_type, metadata)
  values (
    p_request_id,
    v_user_id,
    'anonymization_started',
    jsonb_build_object('worker_id', p_worker_id)
  );

  delete from user_blocks
  where blocker_id = v_user_id
     or blocked_user_key = v_user_id::text;

  delete from user_favourite_dishes
  where user_id = v_user_id;

  delete from bite_reactions
  where user_id = v_user_id;

  delete from taste_interaction_events
  where user_id = v_user_id;

  delete from quiz_responses
  where user_id = v_user_id;

  delete from app_user_rate_limits
  where actor_user_id = v_user_id;

  update reviews
  set
    user_id = null,
    author_name = 'Deleted user',
    text = '[deleted]',
    tags = '{}'::text[]
  where user_id = v_user_id;

  update bites
  set
    author_id = null,
    author_name = 'Deleted user',
    author_avatar = null,
    caption = ''
  where author_id = v_user_id;

  update posts
  set
    status = 'deleted',
    visibility = 'private',
    caption = '',
    generated_content = '{}'::jsonb,
    deleted_at = coalesce(deleted_at, now()),
    updated_at = now()
  where author_id = v_user_id;

  update post_comments
  set
    body = '[deleted]',
    deleted_at = coalesce(deleted_at, now()),
    updated_at = now()
  where user_id = v_user_id;

  delete from post_likes
  where user_id = v_user_id;

  delete from post_saves
  where user_id = v_user_id;

  delete from post_shares
  where user_id = v_user_id;

  update post_shares
  set target_user_id = null
  where target_user_id = v_user_id;

  delete from hidden_posts
  where viewer_id = v_user_id;

  delete from follows
  where follower_id = v_user_id
     or followee_id = v_user_id;

  delete from privacy_settings
  where user_id = v_user_id;

  delete from conversation_participants
  where participant_user_id = v_user_id;

  update conversations
  set created_by_user_id = null
  where created_by_user_id = v_user_id;

  update messages
  set
    body = '[deleted]',
    deleted_at = coalesce(deleted_at, now()),
    edited_at = coalesce(edited_at, now())
  where sender_user_id = v_user_id;

  delete from read_receipts
  where reader_user_id = v_user_id;

  update chat_messages
  set body = '[deleted]'
  where sender_user_id = v_user_id;

  update merchant_accounts
  set
    display_name = 'Deleted merchant',
    email = 'deleted+' || id::text || '@deleted.hungry.local',
    updated_at = now()
  where user_id = v_user_id;

  delete from merchant_roles
  where user_id = v_user_id;

  update merchant_dish_view_events
  set user_id = null
  where user_id = v_user_id;

  update merchant_notifications
  set recipient_user_id = null
  where recipient_user_id = v_user_id;

  -- Rows with no foreign key to the profile, or one that would block its delete.
  delete from user_taste_vectors
  where user_id = v_user_id;

  delete from recommendation_impressions
  where user_id = v_user_id;

  update merchant_analytics_events
  set user_id = null
  where user_id = v_user_id;

  update merchant_promotion_events
  set user_id = null
  where user_id = v_user_id;

  update portfolio_flags
  set reviewed_by = null
  where reviewed_by = v_user_id;

  -- Menu photos stay on the stall page (owner decision); only the link goes.
  update menu_photo_submissions
  set submitted_by = null
  where submitted_by = v_user_id;

  -- Deleting the profile fires every ON DELETE CASCADE that hangs off it:
  -- Lists (portfolios, items, collaborators, follows), checklists, passport,
  -- food cred, missions, settings, stall submissions and interactions,
  -- activity, helpful votes, dish affinities and the public_profiles row
  -- (bio). Reviews and bites were detached above and stay as "Deleted user".
  delete from user_profiles
  where id = v_user_id;

  update account_deletion_requests
  set
    status = 'processing',
    anonymized_at = coalesce(anonymized_at, now()),
    worker_locked_at = now(),
    worker_lock_id = coalesce(p_worker_id, worker_lock_id),
    last_error = null
  where id = p_request_id;

  insert into account_deletion_processing_events (request_id, user_id, event_type, metadata)
  values (
    p_request_id,
    v_user_id,
    'anonymized',
    jsonb_build_object(
      'worker_id',
      p_worker_id,
      'preserved_tables',
      array[
        'account_deletion_requests',
        'account_deletion_processing_events',
        'content_reports',
        'moderation_actions',
        'app_ops_audit_events'
      ]
    )
  );

  return v_user_id;
exception
  when others then
    update account_deletion_requests
    set
      last_error = sqlerrm,
      worker_locked_at = null
    where id = p_request_id;

    insert into account_deletion_processing_events (
      request_id,
      user_id,
      event_type,
      metadata
    )
    values (
      p_request_id,
      v_user_id,
      'failed',
      jsonb_build_object('worker_id', p_worker_id, 'error', sqlerrm)
    );

    raise;
end;
$$;

revoke all on function public.anonymize_account_deletion_request(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.anonymize_account_deletion_request(uuid, uuid) to service_role;

commit;
