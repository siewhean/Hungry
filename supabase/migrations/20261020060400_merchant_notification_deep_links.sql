-- Merchant notification deep links use real app paths.
--
-- merchant_notifications rows stored navigator names ('MerchantTabs/CustomerInbox',
-- 'MerchantTabs/MerchantAnalytics'). CustomerInbox was not in the linking
-- config and the analytics route is called Analytics, so the links would have
-- opened nothing once push or in-app taps were wired. They are now
-- hungry://merchant/inbox and hungry://merchant/analytics, which the app's
-- linking config maps to those screens.
--
-- The low-rating trigger body from 20261019170000_merchant_low_rating_push.sql is
-- recreated with the new link; nothing else in it changes. Existing rows are
-- rewritten.

create or replace function app_private.enqueue_merchant_low_rating_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id text := new.venue_id;
  v_rating text := to_char(new.rating, 'FM0.0');
  v_snippet text := left(coalesce(new.text, ''), 120);
  v_jobs integer := 0;
begin
  if new.rating is null or new.rating > 2 then
    return new;
  end if;

  if v_venue_id is null then
    select d.venue_id into v_venue_id from public.dishes d where d.id = new.dish_id;
  end if;
  if v_venue_id is null then
    return new;
  end if;

  -- In-app alert, one per merchant account with an outlet on this venue.
  insert into public.merchant_notifications (
    merchant_account_id, outlet_id, kind, title, body, status, dedupe_key, deep_link, metadata,
    created_at
  )
  select distinct on (mo.merchant_account_id)
    mo.merchant_account_id,
    mo.id,
    'low_rating',
    mo.name || ' received a low rating',
    v_rating || ' stars: ' || v_snippet,
    'unread',
    'low-rating:' || new.id::text,
    'hungry://merchant/inbox',
    jsonb_build_object('reviewId', new.id, 'rating', new.rating, 'snippet', new.text),
    new.created_at
  from public.merchant_outlets mo
  where mo.venue_id = v_venue_id
  order by mo.merchant_account_id, mo.created_at
  on conflict (dedupe_key) do nothing;

  -- Push, only for verified outlets whose account keeps the alert on.
  insert into public.notification_jobs (
    user_id, category, change_kind, dedupe_key, title, body, deep_link, dish_id, stall_id,
    review_id, merchant_account_id
  )
  select
    r.user_id,
    'merchant_low_rating',
    'low_rating',
    concat_ws(':', r.user_id::text, 'low_rating', new.id::text),
    r.outlet_name || ': new ' || v_rating || '-star review',
    coalesce(nullif(v_snippet, ''), 'Open Merchant Centre to read and reply.'),
    'https://usehungry.com/merchant',
    new.dish_id,
    v_venue_id,
    new.id,
    r.merchant_account_id
  from (
    select distinct on (recipient.user_id)
      recipient.user_id,
      mo.merchant_account_id,
      mo.name as outlet_name
    from public.merchant_outlets mo
    join public.merchant_verifications mv
      on mv.outlet_id = mo.id
     and mv.status = 'verified'
     and (mv.expires_at is null or mv.expires_at > now())
    join public.merchant_accounts ma on ma.id = mo.merchant_account_id
    left join public.merchant_notification_preferences mnp
      on mnp.merchant_account_id = mo.merchant_account_id
    cross join lateral (
      select ma.user_id
      union
      select mr.user_id
      from public.merchant_roles mr
      where mr.merchant_account_id = mo.merchant_account_id
        and mr.role in ('owner', 'manager')
        and mr.user_id is not null
    ) recipient
    where mo.venue_id = v_venue_id
      and coalesce(mnp.low_rating_alerts, true)
      and recipient.user_id is distinct from new.user_id
      -- Only people with a registered device (also keeps the auth.users FK safe).
      and exists (
        select 1 from public.user_push_tokens t where t.user_id = recipient.user_id
      )
      and not exists (
        select 1
        from public.user_blocks ub
        where ub.blocker_id = recipient.user_id
          and ub.blocked_user_key = new.user_id::text
      )
    order by recipient.user_id, mo.created_at
  ) r
  on conflict (dedupe_key) do nothing;

  get diagnostics v_jobs = row_count;

  if v_jobs > 0 then
    -- Best effort: the 10-minute cron still drains the outbox if this fails.
    begin
      perform public.invoke_notification_worker();
    exception when others then
      null;
    end;
  end if;

  return new;
end;
$$;

revoke all on function app_private.enqueue_merchant_low_rating_alert() from public, anon, authenticated;

update public.merchant_notifications
set deep_link = 'hungry://merchant/inbox'
where deep_link = 'MerchantTabs/CustomerInbox';

update public.merchant_notifications
set deep_link = 'hungry://merchant/analytics'
where deep_link = 'MerchantTabs/MerchantAnalytics';
