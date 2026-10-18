-- Retention: follow a stall, opt-in push alerts for verified merchant menu
-- changes, and a public read of shared portfolios for web previews.
--
-- Alerts only come from a signed-in merchant who can manage the venue
-- (merchant_can_manage_venue). Service-role catalog imports have no auth.uid()
-- and never alert anyone.
--
-- The send-notifications Edge Function URL and worker token live in Vault:
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/send-notifications', 'notification_worker_url');
--   select vault.create_secret('<NOTIFICATION_WORKER_TOKEN>', 'notification_worker_token');
-- Until both secrets exist the cron job is a no-op.

-- ---------------------------------------------------------------------------
-- Stall follows
-- ---------------------------------------------------------------------------

create table if not exists public.stall_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  stall_id text not null references public.venues(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, stall_id)
);

create index if not exists idx_stall_follows_stall_id on public.stall_follows(stall_id);

alter table public.stall_follows enable row level security;

drop policy if exists "stall_follows_select_own" on public.stall_follows;
create policy "stall_follows_select_own" on public.stall_follows
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "stall_follows_insert_own" on public.stall_follows;
create policy "stall_follows_insert_own" on public.stall_follows
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "stall_follows_delete_own" on public.stall_follows;
create policy "stall_follows_delete_own" on public.stall_follows
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on table public.stall_follows from public, anon;
grant select, insert, delete on table public.stall_follows to authenticated;
grant all on table public.stall_follows to service_role;

-- ---------------------------------------------------------------------------
-- Notification preferences (opt-in; off by default)
-- ---------------------------------------------------------------------------

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stall_updates boolean not null default false,
  quiet_start_hour smallint not null default 22 check (quiet_start_hour between 0 and 23),
  quiet_end_hour smallint not null default 8 check (quiet_end_hour between 0 and 23),
  weekly_cap smallint not null default 3 check (weekly_cap between 0 and 14),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "notification_preferences_select_own" on public.notification_preferences;
create policy "notification_preferences_select_own" on public.notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "notification_preferences_insert_own" on public.notification_preferences;
create policy "notification_preferences_insert_own" on public.notification_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "notification_preferences_update_own" on public.notification_preferences;
create policy "notification_preferences_update_own" on public.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on table public.notification_preferences from public, anon;
grant select, insert, update on table public.notification_preferences to authenticated;
grant all on table public.notification_preferences to service_role;

-- ---------------------------------------------------------------------------
-- Push tokens (written only through register_push_token)
-- ---------------------------------------------------------------------------

create table if not exists public.user_push_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_push_tokens_user_id on public.user_push_tokens(user_id);

alter table public.user_push_tokens enable row level security;
revoke all on table public.user_push_tokens from public, anon, authenticated;
grant all on table public.user_push_tokens to service_role;

create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'invalid platform' using errcode = '22023';
  end if;
  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,200}\]$' then
    raise exception 'invalid push token' using errcode = '22023';
  end if;

  -- A device moves to whoever signed in on it last.
  insert into public.user_push_tokens (token, user_id, platform, updated_at)
  values (p_token, v_user_id, p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        updated_at = now();
end;
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Notification jobs (outbox the send-notifications worker drains)
-- ---------------------------------------------------------------------------

create table if not exists public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('stall_update')),
  change_kind text not null check (change_kind in ('new_dish', 'price_change', 'back_in_stock')),
  dedupe_key text not null unique,
  title text not null,
  body text not null,
  deep_link text not null,
  dish_id text references public.dishes(id) on delete cascade,
  stall_id text references public.venues(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'skipped', 'failed')),
  skip_reason text,
  attempts smallint not null default 0,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  opened_at timestamptz
);

create index if not exists idx_notification_jobs_pending
  on public.notification_jobs(created_at) where status in ('pending', 'sending');
create index if not exists idx_notification_jobs_user_sent
  on public.notification_jobs(user_id, sent_at) where status = 'sent';

alter table public.notification_jobs enable row level security;

drop policy if exists "notification_jobs_select_own" on public.notification_jobs;
create policy "notification_jobs_select_own" on public.notification_jobs
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on table public.notification_jobs from public, anon, authenticated;
grant select on table public.notification_jobs to authenticated;
grant all on table public.notification_jobs to service_role;

create or replace function public.mark_notification_opened(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notification_jobs
  set opened_at = coalesce(opened_at, now())
  where id = p_id and user_id = auth.uid();
$$;

revoke all on function public.mark_notification_opened(uuid) from public, anon;
grant execute on function public.mark_notification_opened(uuid) to authenticated;

-- Claims due jobs for the worker. Jobs stuck in 'sending' for 15 minutes are retried.
create or replace function public.claim_notification_jobs(p_limit integer default 100)
returns setof public.notification_jobs
language sql
security definer
set search_path = ''
as $$
  update public.notification_jobs j
  set status = 'sending', locked_at = now(), attempts = j.attempts + 1
  where j.id in (
    select id
    from public.notification_jobs
    where status = 'pending'
       or (status = 'sending' and locked_at < now() - interval '15 minutes')
    order by created_at
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
    for update skip locked
  )
  returning j.*;
$$;

revoke all on function public.claim_notification_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_jobs(integer) to service_role;

-- ---------------------------------------------------------------------------
-- Enqueue alerts when a verified merchant changes a dish
-- ---------------------------------------------------------------------------

create or replace function public.dish_is_sold_out(p_flags text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (
    select 1 from unnest(coalesce(p_flags, '{}')) as flag
    where regexp_replace(lower(flag), '[\s-]+', '_', 'g') = 'sold_out'
  );
$$;

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
begin
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
    concat_ws(':', sf.user_id::text, new.id, v_kind, v_day),
    v_title,
    v_body,
    'https://usehungry.com/dish/' || new.id,
    new.id,
    new.venue_id
  from public.stall_follows sf
  join public.notification_preferences np
    on np.user_id = sf.user_id and np.stall_updates
  where sf.stall_id = new.venue_id
    and sf.user_id <> v_actor
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

revoke all on function public.enqueue_stall_update_notifications() from public, anon, authenticated;

drop trigger if exists trg_dishes_enqueue_stall_updates on public.dishes;
create trigger trg_dishes_enqueue_stall_updates
  after insert or update of price, availability_flags on public.dishes
  for each row execute function public.enqueue_stall_update_notifications();

-- ---------------------------------------------------------------------------
-- Cron: drain the outbox every 10 minutes
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function public.invoke_notification_worker()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_token text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'notification_worker_url';

  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name = 'notification_worker_token';

  if v_url is null or v_token is null then
    return;
  end if;

  if not exists (select 1 from public.notification_jobs where status in ('pending', 'sending')) then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body := jsonb_build_object('limit', 100)
  );
end;
$$;

revoke all on function public.invoke_notification_worker() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'send-notifications') then
    perform cron.unschedule('send-notifications');
  end if;
  perform cron.schedule(
    'send-notifications',
    '*/10 * * * *',
    'select public.invoke_notification_worker()'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Public portfolio read for shared links (web preview, signed-out visitors)
-- ---------------------------------------------------------------------------

create or replace function public.get_public_portfolio(p_portfolio_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'description', p.description,
    'type', p.type,
    'owner_display_name', up.display_name,
    'updated_at', p.updated_at,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'item_type', i.item_type,
          'dish_id', i.dish_id,
          'stall_id', coalesce(i.stall_id, d.venue_id),
          'name', coalesce(d.name, v.name),
          'stall_name', coalesce(dv.name, v.name),
          'price', d.price,
          'score', i.score,
          'public_notes', i.public_notes
        )
        order by i.position, i.created_at
      )
      from public.portfolio_items i
      left join public.dishes d on d.id = i.dish_id
      left join public.venues dv on dv.id = d.venue_id
      left join public.venues v on v.id = i.stall_id
      where i.portfolio_id = p.id
    ), '[]'::jsonb)
  )
  from public.portfolios p
  left join public.user_profiles up on up.id = p.owner_id
  where p.id = p_portfolio_id and p.visibility = 'public';
$$;

revoke all on function public.get_public_portfolio(uuid) from public;
grant execute on function public.get_public_portfolio(uuid) to anon, authenticated;
