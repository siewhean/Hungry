-- Merchant low-rating alerts: a push to the merchant when a review rated
-- 2 stars or below is posted on a verified outlet.
--
-- Reuses the outbox from 20261018003000_retention_follows_push_alerts.sql:
-- jobs go into public.notification_jobs and the send-notifications worker
-- sends them through Expo. The worker rechecks each job before sending: the
-- account's low_rating_alerts setting is still on, the review still exists and
-- is not hidden or removed by moderation, the job is under 48 hours old, and
-- it is outside the recipient's quiet hours. Low-rating alerts do not count
-- against, and are not limited by, the consumer weekly push cap.
--
-- 1. notification_jobs accepts category 'merchant_low_rating' and carries the
--    review and merchant account the alert is about.
-- 2. A trigger on reviews (after insert, rating <= 2):
--    - records the in-app alert in merchant_notifications for every merchant
--      account with an outlet on the review's venue (same dedupe key as the
--      client's syncLowRatingNotifications, so neither duplicates the other);
--    - for outlets with a current 'verified' verification whose account has
--      merchant_notification_preferences.low_rating_alerts on (default on when
--      no row exists), enqueues one push job per account owner and per
--      owner/manager role that has a registered push device, skipping the
--      reviewer and anyone who blocked them;
--    - asks the worker to run now instead of waiting for the 10-minute cron.
-- No weekly email is sent: merchant_email_outbox is not touched.
--
-- The trigger body lives in app_private (SECURITY DEFINER); it is not callable
-- by clients.

create schema if not exists app_private;

-- 1. Outbox ---------------------------------------------------------------

alter table public.notification_jobs
  add column if not exists review_id uuid references public.reviews(id) on delete cascade,
  add column if not exists merchant_account_id uuid
    references public.merchant_accounts(id) on delete cascade;

create index if not exists idx_notification_jobs_review_id
  on public.notification_jobs(review_id) where review_id is not null;
create index if not exists idx_notification_jobs_merchant_account_id
  on public.notification_jobs(merchant_account_id) where merchant_account_id is not null;

alter table public.notification_jobs
  drop constraint if exists notification_jobs_category_check;
alter table public.notification_jobs
  add constraint notification_jobs_category_check
  check (category in ('stall_update', 'weekly_picks', 'merchant_low_rating'));

alter table public.notification_jobs
  drop constraint if exists notification_jobs_change_kind_check;
alter table public.notification_jobs
  add constraint notification_jobs_change_kind_check
  check (change_kind in ('new_dish', 'price_change', 'back_in_stock', 'weekly_picks', 'low_rating'));

-- 2. Enqueue on review insert -------------------------------------------------

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
    'MerchantTabs/CustomerInbox',
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

drop trigger if exists trg_reviews_enqueue_merchant_low_rating on public.reviews;
create trigger trg_reviews_enqueue_merchant_low_rating
  after insert on public.reviews
  for each row execute function app_private.enqueue_merchant_low_rating_alert();
