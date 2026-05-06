-- Tighten review author updates after merchant replies were added.
-- Authors may edit review content, but cannot spoof merchant reply fields
-- or move a review between users, dishes, or venues.

create or replace function enforce_merchant_review_reply_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
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
      or new.merchant_replied_at is distinct from old.merchant_replied_at then
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
      or new.created_at is distinct from old.created_at then
      raise exception 'merchant review updates are limited to reply fields' using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'not authorized to update review' using errcode = '42501';
end;
$$;
