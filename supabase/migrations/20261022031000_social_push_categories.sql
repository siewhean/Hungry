-- Social push: a follow request and a daily likes digest reach the user's phone,
-- so they no longer depend on opening the bell.
--
-- Both go through the same outbox and send-notifications worker as stall alerts,
-- weekly picks and meal-time suggestions, which apply opt-out, quiet hours
-- (22:00-08:00 SGT) and dedupe. A follow request is something a person is
-- waiting on, so the worker never counts it toward the weekly cap; the likes
-- digest (at most one a day) does count.
--
-- One switch: notification_preferences.social_activity (on by default). Push
-- itself stays off until notificationsEnabled ships (featureFlags.ts).
--
-- Constraints replaced: notification_jobs_category_check and
-- notification_jobs_change_kind_check, based on 20261019201000_mealtime_suggestions_push.sql.

alter table public.notification_preferences
  add column if not exists social_activity boolean not null default true;

alter table public.notification_jobs
  drop constraint if exists notification_jobs_category_check;
alter table public.notification_jobs
  add constraint notification_jobs_category_check
  check (category in (
    'stall_update',
    'weekly_picks',
    'merchant_low_rating',
    'mealtime',
    'social_follow_request',
    'social_like_digest'
  ));

alter table public.notification_jobs
  drop constraint if exists notification_jobs_change_kind_check;
alter table public.notification_jobs
  add constraint notification_jobs_change_kind_check
  check (change_kind in (
    'new_dish',
    'price_change',
    'back_in_stock',
    'weekly_picks',
    'low_rating',
    'mealtime',
    'follow_request',
    'like_digest'
  ));

create schema if not exists app_private;

-- ---------------------------------------------------------------------------
-- Follow request: one job per request event, queued when the event is created
-- ---------------------------------------------------------------------------

create or replace function app_private.enqueue_social_follow_request_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if NEW.event_type <> 'follow_request' then
    return NEW;
  end if;

  -- Only people with a device get a job; the worker rechecks opt-out and quiet hours.
  if not exists (
    select 1 from public.user_push_tokens t where t.user_id = NEW.recipient_id
  ) then
    return NEW;
  end if;

  insert into public.notification_jobs (
    user_id, category, change_kind, dedupe_key, title, body, deep_link
  )
  values (
    NEW.recipient_id,
    'social_follow_request',
    'follow_request',
    concat_ws(':', NEW.recipient_id::text, 'social_follow_request', NEW.id::text),
    'New follow request',
    'Someone asked to follow you. Tap to review it.',
    'https://usehungry.com/follow-requests'
  )
  on conflict (dedupe_key) do nothing;

  return NEW;
end;
$$;

revoke all on function app_private.enqueue_social_follow_request_push()
  from public, anon, authenticated;

drop trigger if exists trg_enqueue_social_follow_request_push on public.activity_events;
create trigger trg_enqueue_social_follow_request_push
  after insert on public.activity_events
  for each row
  when (NEW.event_type = 'follow_request')
  execute function app_private.enqueue_social_follow_request_push();

-- ---------------------------------------------------------------------------
-- Likes digest: one job per person per Singapore day, from unread likes in the
-- last 24 hours. Likes that were undone are already deleted (unlike trigger),
-- and likes from people the viewer blocked are left out.
-- ---------------------------------------------------------------------------

create or replace function app_private.enqueue_social_like_digest_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Singapore')::date;
  v_count integer;
begin
  insert into public.notification_jobs (
    user_id, category, change_kind, dedupe_key, title, body, deep_link
  )
  select
    digest.recipient_id,
    'social_like_digest',
    'like_digest',
    concat_ws(':', digest.recipient_id::text, 'social_like_digest', v_today::text),
    'Your posts got some love',
    concat(
      digest.actor_count,
      case when digest.actor_count = 1 then ' person liked ' else ' people liked ' end,
      case when digest.post_count = 1 then 'your post' else 'your posts' end,
      ' today.'
    ),
    case
      when digest.post_count = 1
        then 'https://usehungry.com/post/' || digest.only_post_id::text
      else 'https://usehungry.com/activity'
    end
  from (
    select
      ae.recipient_id,
      count(distinct ae.actor_id) as actor_count,
      count(distinct ae.target_id) as post_count,
      (array_agg(ae.target_id))[1] as only_post_id
    from public.activity_events ae
    where ae.event_type = 'new_like'
      and ae.read_at is null
      and ae.created_at >= now() - interval '24 hours'
      and not app_private.app_user_block_exists(ae.recipient_id, ae.actor_id)
    group by ae.recipient_id
  ) digest
  left join public.notification_preferences np on np.user_id = digest.recipient_id
  where coalesce(np.social_activity, true)
    and exists (
      select 1 from public.user_push_tokens t where t.user_id = digest.recipient_id
    )
  on conflict (dedupe_key) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function app_private.enqueue_social_like_digest_notifications()
  from public, anon, authenticated;
grant execute on function app_private.enqueue_social_like_digest_notifications()
  to service_role;

create or replace function public.enqueue_social_like_digest_notifications()
returns integer
language sql
volatile
security invoker
set search_path = public, app_private
as $$
  select app_private.enqueue_social_like_digest_notifications();
$$;

revoke all on function public.enqueue_social_like_digest_notifications()
  from public, anon, authenticated;
grant execute on function public.enqueue_social_like_digest_notifications() to service_role;

-- ---------------------------------------------------------------------------
-- Cron: 03:00 UTC = 11:00 SGT, outside quiet hours. The existing
-- send-notifications job drains the outbox every 10 minutes.
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'social-like-digest-notifications') then
    perform cron.unschedule('social-like-digest-notifications');
  end if;
  perform cron.schedule(
    'social-like-digest-notifications',
    '0 3 * * *',
    'select public.enqueue_social_like_digest_notifications()'
  );
end;
$$;
