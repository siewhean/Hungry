-- Let account deletion anonymise a user's reviews.
--
-- enforce_merchant_review_reply_update raised 'authentication required' when
-- auth.uid() was null, so anonymize_account_deletion_request (run by the
-- process-account-deletions worker with the service role) failed for every
-- account that had written a review. Trusted server code (not anon or
-- authenticated) may now detach a review from its author; every app-user
-- update keeps the same guards.

create or replace function public.enforce_merchant_review_reply_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- app_private.sync_review_helpful_count: a nested trigger that changes only
  -- helpful_count.
  if pg_trigger_depth() > 1
    and (to_jsonb(new) - 'helpful_count') = (to_jsonb(old) - 'helpful_count') then
    return new;
  end if;

  -- Account deletion: the worker detaches the review from its author.
  if current_user not in ('anon', 'authenticated')
    and old.user_id is not null
    and new.user_id is null then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if old.user_id = auth.uid() then
    if new.id is distinct from old.id
      or new.user_id is distinct from old.user_id
      or new.dish_id is distinct from old.dish_id
      or new.venue_id is distinct from old.venue_id
      or new.created_at is distinct from old.created_at
      or new.merchant_reply_text is distinct from old.merchant_reply_text
      or new.merchant_replied_at is distinct from old.merchant_replied_at
      or new.helpful_count is distinct from old.helpful_count then
      raise exception 'review authors cannot change identity or merchant reply fields' using errcode = '42501';
    end if;
    return new;
  end if;

  if merchant_can_manage_venue(old.venue_id) then
    if new.id is distinct from old.id
      or new.user_id is distinct from old.user_id
      or new.dish_id is distinct from old.dish_id
      or new.venue_id is distinct from old.venue_id
      or new.author_name is distinct from old.author_name
      or new.rating is distinct from old.rating
      or new.text is distinct from old.text
      or new.tags is distinct from old.tags
      or new.would_recommend is distinct from old.would_recommend
      or new.created_at is distinct from old.created_at
      or new.helpful_count is distinct from old.helpful_count then
      raise exception 'merchant review updates are limited to reply fields' using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'not authorized to update review' using errcode = '42501';
end;
$$;
