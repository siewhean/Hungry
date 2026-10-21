-- Stall-update pushes never announce hidden draft dishes (round-two medium
-- detail-M14).
--
-- enqueue_stall_update_notifications (based on 20261018003000, its only and so
-- latest definition) fired for any dish insert or price change by a user who
-- passes merchant_can_manage_venue, which does not require verification, and it
-- never looked at dishes.merchant_draft (added in 20261020130100). A draft dish
-- an unverified merchant saved therefore sent "New on the menu: X, S$Y" to every
-- follower, and the push opened a dish page that says "We can't find this dish".
--
-- Now:
--   * a draft dish (new.merchant_draft) never enqueues anything;
--   * the draft -> published transition (the ops verify job, or a verified
--     merchant saving a draft) enqueues a "new on the menu" alert once per
--     follower, stall and day, so publishing a whole menu is one push, not one
--     per dish. The publish transition is not gated on merchant_can_manage_venue:
--     only the verify job or a verified merchant can clear merchant_draft;
--   * the trigger also fires when merchant_draft changes.
-- Merchant edits keep their existing rules and dedupe keys.

begin;

create or replace function public.enqueue_stall_update_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_kind text;
  v_title text;
  v_body text;
  v_venue_name text;
  v_day text := to_char(now() at time zone 'Asia/Singapore', 'YYYY-MM-DD');
  v_published boolean := false;
begin
  -- Hidden drafts are not on the menu diners see.
  if new.merchant_draft then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.merchant_draft and not new.merchant_draft then
    if public.dish_is_sold_out(new.availability_flags) then
      return new;
    end if;
    v_published := true;
    v_kind := 'new_dish';
  else
    if v_actor is null or not public.merchant_can_manage_venue(new.venue_id) then
      return new;
    end if;

    if tg_op = 'INSERT' then
      if public.dish_is_sold_out(new.availability_flags) then
        return new;
      end if;
      v_kind := 'new_dish';
    elsif public.dish_is_sold_out(old.availability_flags)
          and not public.dish_is_sold_out(new.availability_flags) then
      v_kind := 'back_in_stock';
    elsif new.price is distinct from old.price
          and not public.dish_is_sold_out(new.availability_flags) then
      v_kind := 'price_change';
    else
      return new;
    end if;
  end if;

  select name into v_venue_name from public.venues where id = new.venue_id;
  v_title := coalesce(v_venue_name, 'A stall you follow');
  v_body := case v_kind
    when 'new_dish' then 'New on the menu: ' || new.name || ', S$' || to_char(new.price, 'FM999990.00')
    when 'back_in_stock' then new.name || ' is back today.'
    else new.name || ' is now S$' || to_char(new.price, 'FM999990.00')
  end;

  insert into public.notification_jobs (
    user_id, category, change_kind, dedupe_key, title, body, deep_link, dish_id, stall_id
  )
  select
    sf.user_id,
    'stall_update',
    v_kind,
    case
      when v_published then concat_ws(':', sf.user_id::text, new.venue_id, 'menu_published', v_day)
      else concat_ws(':', sf.user_id::text, new.id, v_kind, v_day)
    end,
    v_title,
    v_body,
    'https://usehungry.com/dish/' || new.id,
    new.id,
    new.venue_id
  from public.stall_follows sf
  join public.notification_preferences np
    on np.user_id = sf.user_id and np.stall_updates
  where sf.stall_id = new.venue_id
    and sf.user_id is distinct from v_actor
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

revoke all on function public.enqueue_stall_update_notifications() from public, anon, authenticated;

drop trigger if exists trg_dishes_enqueue_stall_updates on public.dishes;
create trigger trg_dishes_enqueue_stall_updates
  after insert or update of price, availability_flags, merchant_draft on public.dishes
  for each row execute function public.enqueue_stall_update_notifications();

commit;
