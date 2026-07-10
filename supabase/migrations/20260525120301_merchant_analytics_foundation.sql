-- Merchant analytics foundation.
-- Adds RPC-backed action events, daily rollups, promotion events, weekly
-- summary persistence, and audit logs for merchant portal production metrics.

create table if not exists public.merchant_analytics_events (
  id uuid primary key default gen_random_uuid(),
  merchant_account_id uuid not null references public.merchant_accounts(id) on delete cascade,
  outlet_id uuid not null references public.merchant_outlets(id) on delete cascade,
  venue_id text not null references public.venues(id) on delete cascade,
  dish_id text references public.dishes(id) on delete set null,
  promotion_id uuid references public.merchant_promotions(id) on delete set null,
  user_id uuid,
  session_id text not null,
  event_type text not null check (
    event_type in (
      'stall_profile_view',
      'menu_view',
      'direction_tap',
      'contact_tap',
      'social_link_tap',
      'save',
      'share',
      'promotion_impression',
      'promotion_click',
      'promotion_save',
      'promotion_profile_visit',
      'promotion_dish_view'
    )
  ),
  source text not null default 'customer'
    check (source in ('customer', 'merchant_preview', 'system')),
  dedupe_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_merchant_analytics_events_outlet_occurred
  on public.merchant_analytics_events(outlet_id, occurred_at desc);
create index if not exists idx_merchant_analytics_events_type_occurred
  on public.merchant_analytics_events(event_type, occurred_at desc);
create index if not exists idx_merchant_analytics_events_dish_occurred
  on public.merchant_analytics_events(dish_id, occurred_at desc)
  where dish_id is not null;
create index if not exists idx_merchant_analytics_events_promo_occurred
  on public.merchant_analytics_events(promotion_id, occurred_at desc)
  where promotion_id is not null;

create table if not exists public.merchant_promotion_events (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.merchant_promotions(id) on delete cascade,
  merchant_account_id uuid not null references public.merchant_accounts(id) on delete cascade,
  outlet_id uuid not null references public.merchant_outlets(id) on delete cascade,
  venue_id text not null references public.venues(id) on delete cascade,
  dish_id text references public.dishes(id) on delete set null,
  user_id uuid,
  session_id text not null,
  event_type text not null
    check (event_type in ('impression', 'click', 'save', 'profile_visit', 'dish_view')),
  dedupe_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_merchant_promotion_events_promo_occurred
  on public.merchant_promotion_events(promotion_id, occurred_at desc);
create index if not exists idx_merchant_promotion_events_outlet_occurred
  on public.merchant_promotion_events(outlet_id, occurred_at desc);

create table if not exists public.merchant_analytics_daily_rollups (
  merchant_account_id uuid not null references public.merchant_accounts(id) on delete cascade,
  outlet_id uuid not null references public.merchant_outlets(id) on delete cascade,
  metric_date date not null,
  profile_visits integer not null default 0,
  menu_views integer not null default 0,
  dish_views integer not null default 0,
  direction_taps integer not null default 0,
  saves integer not null default 0,
  shares integer not null default 0,
  contact_taps integer not null default 0,
  social_link_taps integer not null default 0,
  promotion_impressions integer not null default 0,
  promotion_clicks integer not null default 0,
  promotion_saves integer not null default 0,
  promotion_profile_visits integer not null default 0,
  promotion_dish_views integer not null default 0,
  unique_sessions integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (outlet_id, metric_date)
);

create index if not exists idx_merchant_analytics_daily_rollups_account_date
  on public.merchant_analytics_daily_rollups(merchant_account_id, metric_date desc);

create table if not exists public.merchant_dish_analytics_daily (
  merchant_account_id uuid not null references public.merchant_accounts(id) on delete cascade,
  outlet_id uuid not null references public.merchant_outlets(id) on delete cascade,
  venue_id text not null references public.venues(id) on delete cascade,
  dish_id text not null references public.dishes(id) on delete cascade,
  metric_date date not null,
  views integer not null default 0,
  saves integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (outlet_id, dish_id, metric_date)
);

create index if not exists idx_merchant_dish_analytics_daily_outlet_date
  on public.merchant_dish_analytics_daily(outlet_id, metric_date desc);

create table if not exists public.merchant_weekly_summaries (
  id uuid primary key default gen_random_uuid(),
  merchant_account_id uuid not null references public.merchant_accounts(id) on delete cascade,
  outlet_id uuid not null references public.merchant_outlets(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  total_views integer not null default 0,
  dish_views integer not null default 0,
  top_dishes jsonb not null default '[]'::jsonb,
  new_reviews integer not null default 0,
  average_rating numeric(3, 2) not null default 0,
  rating_change numeric(4, 2) not null default 0,
  unreplied_reviews integer not null default 0,
  promotion_views integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (outlet_id, week_start)
);

create index if not exists idx_merchant_weekly_summaries_account_week
  on public.merchant_weekly_summaries(merchant_account_id, week_start desc);

create table if not exists public.merchant_audit_logs (
  id uuid primary key default gen_random_uuid(),
  merchant_account_id uuid not null references public.merchant_accounts(id) on delete cascade,
  outlet_id uuid references public.merchant_outlets(id) on delete cascade,
  actor_user_id uuid,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_merchant_audit_logs_account_created
  on public.merchant_audit_logs(merchant_account_id, created_at desc);
create index if not exists idx_merchant_audit_logs_outlet_created
  on public.merchant_audit_logs(outlet_id, created_at desc)
  where outlet_id is not null;

alter table public.merchant_analytics_events enable row level security;
alter table public.merchant_promotion_events enable row level security;
alter table public.merchant_analytics_daily_rollups enable row level security;
alter table public.merchant_dish_analytics_daily enable row level security;
alter table public.merchant_weekly_summaries enable row level security;
alter table public.merchant_audit_logs enable row level security;

drop policy if exists "merchant_analytics_events_select_member" on public.merchant_analytics_events;
create policy "merchant_analytics_events_select_member"
on merchant_analytics_events for select to authenticated
using (public.merchant_can_manage_outlet_v2(outlet_id));

drop policy if exists "merchant_promotion_events_select_member" on public.merchant_promotion_events;
create policy "merchant_promotion_events_select_member"
on merchant_promotion_events for select to authenticated
using (public.merchant_can_manage_outlet_v2(outlet_id));

drop policy if exists "merchant_analytics_daily_rollups_select_member" on public.merchant_analytics_daily_rollups;
create policy "merchant_analytics_daily_rollups_select_member"
on merchant_analytics_daily_rollups for select to authenticated
using (public.merchant_can_manage_outlet_v2(outlet_id));

drop policy if exists "merchant_dish_analytics_daily_select_member" on public.merchant_dish_analytics_daily;
create policy "merchant_dish_analytics_daily_select_member"
on merchant_dish_analytics_daily for select to authenticated
using (public.merchant_can_manage_outlet_v2(outlet_id));

drop policy if exists "merchant_weekly_summaries_select_member" on public.merchant_weekly_summaries;
create policy "merchant_weekly_summaries_select_member"
on merchant_weekly_summaries for select to authenticated
using (public.merchant_can_manage_outlet_v2(outlet_id));

drop policy if exists "merchant_audit_logs_select_member" on public.merchant_audit_logs;
create policy "merchant_audit_logs_select_member"
on merchant_audit_logs for select to authenticated
using (
  public.merchant_can_manage_outlet_v2(outlet_id)
  or exists (
    select 1
    from merchant_accounts ma
    left join merchant_roles mr on mr.merchant_account_id = ma.id
    where ma.id = merchant_audit_logs.merchant_account_id
      and (
        ma.user_id = auth.uid()
        or mr.user_id = auth.uid()
      )
  )
);

revoke insert, update, delete on table public.merchant_analytics_events from anon, authenticated;
revoke insert, update, delete on table public.merchant_promotion_events from anon, authenticated;
revoke insert, update, delete on table public.merchant_analytics_daily_rollups from anon, authenticated;
revoke insert, update, delete on table public.merchant_dish_analytics_daily from anon, authenticated;
revoke insert, update, delete on table public.merchant_weekly_summaries from anon, authenticated;
revoke insert, update, delete on table public.merchant_audit_logs from anon, authenticated;

grant select on table public.merchant_analytics_events to authenticated;
grant select on table public.merchant_promotion_events to authenticated;
grant select on table public.merchant_analytics_daily_rollups to authenticated;
grant select on table public.merchant_dish_analytics_daily to authenticated;
grant select on table public.merchant_weekly_summaries to authenticated;
grant select on table public.merchant_audit_logs to authenticated;
grant all on table public.merchant_analytics_events to service_role;
grant all on table public.merchant_promotion_events to service_role;
grant all on table public.merchant_analytics_daily_rollups to service_role;
grant all on table public.merchant_dish_analytics_daily to service_role;
grant all on table public.merchant_weekly_summaries to service_role;
grant all on table public.merchant_audit_logs to service_role;

do $promotion_constraints$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'merchant_promotions_title_required_length_chk'
  ) then
    alter table public.merchant_promotions
      add constraint merchant_promotions_title_required_length_chk
      check (char_length(btrim(title)) between 1 and 80)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'merchant_promotions_description_length_chk'
  ) then
    alter table public.merchant_promotions
      add constraint merchant_promotions_description_length_chk
      check (char_length(description) between 1 and 600)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'merchant_promotions_date_order_chk'
  ) then
    alter table public.merchant_promotions
      add constraint merchant_promotions_date_order_chk
      check (end_date > start_date)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'merchant_promotions_price_non_negative_chk'
  ) then
    alter table public.merchant_promotions
      add constraint merchant_promotions_price_non_negative_chk
      check (
        coalesce(original_price, 0) >= 0
        and coalesce(promotional_price, 0) >= 0
        and coalesce(final_price, 0) >= 0
      )
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'merchant_promotions_discount_range_chk'
  ) then
    alter table public.merchant_promotions
      add constraint merchant_promotions_discount_range_chk
      check (discount_percentage is null or discount_percentage between 0 and 100)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'merchant_promotions_existing_item_target_chk'
  ) then
    alter table public.merchant_promotions
      add constraint merchant_promotions_existing_item_target_chk
      check (promotion_item_type <> 'existing_menu_item' or target_dish_id is not null)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'merchant_promotions_active_available_chk'
  ) then
    alter table public.merchant_promotions
      add constraint merchant_promotions_active_available_chk
      check (status <> 'active' or is_available)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'merchant_promotions_final_not_above_original_chk'
  ) then
    alter table public.merchant_promotions
      add constraint merchant_promotions_final_not_above_original_chk
      check (
        original_price is null
        or final_price is null
        or final_price <= original_price
      )
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'merchant_promotions_discount_consistency_chk'
  ) then
    alter table public.merchant_promotions
      add constraint merchant_promotions_discount_consistency_chk
      check (
        original_price is null
        or final_price is null
        or discount_percentage is null
        or original_price <= 0
        or abs((((original_price - final_price) / original_price) * 100) - discount_percentage) <= 1
      )
      not valid;
  end if;
end
$promotion_constraints$;

create or replace function public.enforce_merchant_promotion_target_dish()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_outlet_venue_id text;
  v_dish_venue_id text;
begin
  if new.promotion_item_type = 'existing_menu_item' then
    if new.target_dish_id is null then
      raise exception 'Existing menu item promotions require a selected dish.';
    end if;

    select venue_id
    into v_outlet_venue_id
    from merchant_outlets
    where id = new.outlet_id;

    select venue_id
    into v_dish_venue_id
    from dishes
    where id = new.target_dish_id;

    if v_outlet_venue_id is null
      or v_dish_venue_id is null
      or v_dish_venue_id is distinct from v_outlet_venue_id
    then
      raise exception 'Existing menu item promotions must target a dish from this outlet.';
    end if;
  end if;

  return new;
end
$function$;

drop trigger if exists trg_enforce_merchant_promotion_target_dish
  on public.merchant_promotions;
create trigger trg_enforce_merchant_promotion_target_dish
before insert or update of outlet_id, promotion_item_type, target_dish_id
on public.merchant_promotions
for each row
execute function public.enforce_merchant_promotion_target_dish();

create or replace function public.refresh_merchant_analytics_daily_rollup(
  p_outlet_id uuid,
  p_metric_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_outlet record;
  v_start timestamptz := p_metric_date::timestamptz;
  v_end timestamptz := (p_metric_date + 1)::timestamptz;
begin
  select id, merchant_account_id
  into v_outlet
  from merchant_outlets
  where id = p_outlet_id;

  if not found then
    return;
  end if;

  with action_counts as (
    select
      count(*) filter (where event_type in ('stall_profile_view', 'promotion_profile_visit'))::integer as profile_visits,
      count(*) filter (where event_type = 'menu_view')::integer as menu_views,
      count(*) filter (where event_type = 'direction_tap')::integer as direction_taps,
      count(*) filter (where event_type in ('save', 'promotion_save'))::integer as saves,
      count(*) filter (where event_type = 'share')::integer as shares,
      count(*) filter (where event_type = 'contact_tap')::integer as contact_taps,
      count(*) filter (where event_type = 'social_link_tap')::integer as social_link_taps
    from merchant_analytics_events
    where outlet_id = p_outlet_id
      and occurred_at >= v_start
      and occurred_at < v_end
  ),
  dish_counts as (
    select count(*)::integer as dish_views
    from merchant_dish_view_events
    where outlet_id = p_outlet_id
      and viewed_at >= v_start
      and viewed_at < v_end
  ),
  promo_counts as (
    select
      count(*) filter (where event_type = 'impression')::integer as promotion_impressions,
      count(*) filter (where event_type = 'click')::integer as promotion_clicks,
      count(*) filter (where event_type = 'save')::integer as promotion_saves,
      count(*) filter (where event_type = 'profile_visit')::integer as promotion_profile_visits,
      count(*) filter (where event_type = 'dish_view')::integer as promotion_dish_views
    from merchant_promotion_events
    where outlet_id = p_outlet_id
      and occurred_at >= v_start
      and occurred_at < v_end
  ),
  sessions as (
    select count(distinct session_id)::integer as unique_sessions
    from (
      select session_id
      from merchant_analytics_events
      where outlet_id = p_outlet_id
        and occurred_at >= v_start
        and occurred_at < v_end
      union all
      select session_id
      from merchant_dish_view_events
      where outlet_id = p_outlet_id
        and viewed_at >= v_start
        and viewed_at < v_end
    ) session_rows
  )
  insert into merchant_analytics_daily_rollups (
    merchant_account_id,
    outlet_id,
    metric_date,
    profile_visits,
    menu_views,
    dish_views,
    direction_taps,
    saves,
    shares,
    contact_taps,
    social_link_taps,
    promotion_impressions,
    promotion_clicks,
    promotion_saves,
    promotion_profile_visits,
    promotion_dish_views,
    unique_sessions,
    updated_at
  )
  select
    v_outlet.merchant_account_id,
    p_outlet_id,
    p_metric_date,
    coalesce(action_counts.profile_visits, 0),
    coalesce(action_counts.menu_views, 0),
    coalesce(dish_counts.dish_views, 0) + coalesce(promo_counts.promotion_dish_views, 0),
    coalesce(action_counts.direction_taps, 0),
    coalesce(action_counts.saves, 0),
    coalesce(action_counts.shares, 0),
    coalesce(action_counts.contact_taps, 0),
    coalesce(action_counts.social_link_taps, 0),
    coalesce(promo_counts.promotion_impressions, 0),
    coalesce(promo_counts.promotion_clicks, 0),
    coalesce(promo_counts.promotion_saves, 0),
    coalesce(promo_counts.promotion_profile_visits, 0),
    coalesce(promo_counts.promotion_dish_views, 0),
    coalesce(sessions.unique_sessions, 0),
    now()
  from action_counts, dish_counts, promo_counts, sessions
  on conflict (outlet_id, metric_date) do update set
    profile_visits = excluded.profile_visits,
    menu_views = excluded.menu_views,
    dish_views = excluded.dish_views,
    direction_taps = excluded.direction_taps,
    saves = excluded.saves,
    shares = excluded.shares,
    contact_taps = excluded.contact_taps,
    social_link_taps = excluded.social_link_taps,
    promotion_impressions = excluded.promotion_impressions,
    promotion_clicks = excluded.promotion_clicks,
    promotion_saves = excluded.promotion_saves,
    promotion_profile_visits = excluded.promotion_profile_visits,
    promotion_dish_views = excluded.promotion_dish_views,
    unique_sessions = excluded.unique_sessions,
    updated_at = now();
end;
$function$;

create or replace function public.refresh_merchant_dish_analytics_daily(
  p_outlet_id uuid,
  p_dish_id text,
  p_metric_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_outlet record;
  v_dish record;
  v_start timestamptz := p_metric_date::timestamptz;
  v_end timestamptz := (p_metric_date + 1)::timestamptz;
begin
  select id, merchant_account_id, venue_id
  into v_outlet
  from merchant_outlets
  where id = p_outlet_id;

  if not found then
    return;
  end if;

  select id, venue_id
  into v_dish
  from dishes
  where id = p_dish_id
    and venue_id = v_outlet.venue_id;

  if not found then
    return;
  end if;

  insert into merchant_dish_analytics_daily (
    merchant_account_id,
    outlet_id,
    venue_id,
    dish_id,
    metric_date,
    views,
    saves,
    updated_at
  )
  values (
    v_outlet.merchant_account_id,
    p_outlet_id,
    v_outlet.venue_id,
    p_dish_id,
    p_metric_date,
    (
      select count(*)::integer
      from merchant_dish_view_events
      where outlet_id = p_outlet_id
        and dish_id = p_dish_id
        and viewed_at >= v_start
        and viewed_at < v_end
    ),
    (
      select count(*)::integer
      from merchant_analytics_events
      where outlet_id = p_outlet_id
        and dish_id = p_dish_id
        and event_type in ('save', 'promotion_save')
        and occurred_at >= v_start
        and occurred_at < v_end
    ),
    now()
  )
  on conflict (outlet_id, dish_id, metric_date) do update set
    views = excluded.views,
    saves = excluded.saves,
    updated_at = now();
end;
$function$;

create or replace function public.record_merchant_dish_view(
  p_dish_id text,
  p_session_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_dish record;
  v_outlet record;
  v_user_id uuid := auth.uid();
  v_session_id text := nullif(trim(coalesce(p_session_id, '')), '');
  v_dedupe_key text;
  v_event_id uuid;
  v_inserted boolean := false;
begin
  if nullif(trim(coalesce(p_dish_id, '')), '') is null then
    raise exception 'dish id is required' using errcode = '22023';
  end if;

  select id, venue_id
  into v_dish
  from dishes
  where id = p_dish_id;

  if not found or v_dish.venue_id is null then
    return null;
  end if;

  select id, merchant_account_id, venue_id
  into v_outlet
  from merchant_outlets
  where venue_id = v_dish.venue_id
  order by created_at asc
  limit 1;

  if not found then
    return null;
  end if;

  if v_user_id is not null and public.merchant_can_manage_outlet_v2(v_outlet.id) then
    return null;
  end if;

  v_session_id := coalesce(v_session_id, v_user_id::text);

  if v_session_id is null then
    raise exception 'anonymous dish views require a bounded session id' using errcode = '22023';
  end if;

  if char_length(v_session_id) > 128 or v_session_id !~ '^[A-Za-z0-9:_-]{4,128}$' then
    raise exception 'session id format is invalid' using errcode = '22023';
  end if;

  if v_user_id is null and exists (
    select 1
    from merchant_dish_view_events
    where session_id = v_session_id
      and viewed_at >= now() - interval '1 hour'
    group by session_id
    having count(*) >= 120
  ) then
    raise exception 'dish view rate limit exceeded' using errcode = 'P0001';
  end if;

  v_dedupe_key := p_dish_id || ':' || v_session_id || ':' || to_char(now(), 'YYYY-MM-DD"T"HH24');

  insert into merchant_dish_view_events (
    merchant_account_id,
    outlet_id,
    venue_id,
    dish_id,
    user_id,
    session_id,
    dedupe_key,
    viewed_at
  )
  values (
    v_outlet.merchant_account_id,
    v_outlet.id,
    v_outlet.venue_id,
    v_dish.id,
    v_user_id,
    v_session_id,
    v_dedupe_key,
    now()
  )
  on conflict (dedupe_key) do nothing
  returning id into v_event_id;

  v_inserted := v_event_id is not null;

  if v_event_id is null then
    select id
    into v_event_id
    from merchant_dish_view_events
    where dedupe_key = v_dedupe_key;
  end if;

  if v_inserted then
    perform public.refresh_merchant_analytics_daily_rollup(v_outlet.id, current_date);
    perform public.refresh_merchant_dish_analytics_daily(v_outlet.id, v_dish.id, current_date);
  end if;

  return v_event_id;
end;
$function$;

revoke all on function public.record_merchant_dish_view(text, text)
  from public, anon, authenticated;
grant execute on function public.record_merchant_dish_view(text, text)
  to anon, authenticated;

create or replace function public.record_merchant_action_event(
  p_event_type text,
  p_session_id text,
  p_outlet_id uuid default null,
  p_venue_id text default null,
  p_dish_id text default null,
  p_promotion_id uuid default null,
  p_source text default 'customer',
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_event_type text := nullif(trim(coalesce(p_event_type, '')), '');
  v_source text := coalesce(nullif(trim(coalesce(p_source, '')), ''), 'customer');
  v_outlet record;
  v_outlet_loaded boolean := false;
  v_dish record;
  v_promotion record;
  v_promotion_loaded boolean := false;
  v_user_id uuid := auth.uid();
  v_session_id text := nullif(trim(coalesce(p_session_id, '')), '');
  v_dedupe_key text;
  v_event_id uuid;
  v_promotion_event_type text;
begin
  if v_event_type not in (
    'stall_profile_view',
    'menu_view',
    'direction_tap',
    'contact_tap',
    'social_link_tap',
    'save',
    'share',
    'promotion_impression',
    'promotion_click',
    'promotion_save',
    'promotion_profile_visit',
    'promotion_dish_view'
  ) then
    raise exception 'unsupported merchant analytics event type' using errcode = '22023';
  end if;

  if v_source not in ('customer', 'merchant_preview', 'system') then
    raise exception 'unsupported merchant analytics source' using errcode = '22023';
  end if;

  if v_source = 'merchant_preview' then
    return null;
  end if;

  if p_outlet_id is not null then
    select id, merchant_account_id, venue_id
    into v_outlet
    from merchant_outlets
    where id = p_outlet_id;
    v_outlet_loaded := found;
  elsif p_venue_id is not null then
    select id, merchant_account_id, venue_id
    into v_outlet
    from merchant_outlets
    where venue_id = p_venue_id
    order by created_at asc
    limit 1;
    v_outlet_loaded := found;
  elsif p_dish_id is not null then
    select d.id, d.venue_id
    into v_dish
    from dishes d
    where d.id = p_dish_id;

    if found then
      select id, merchant_account_id, venue_id
      into v_outlet
      from merchant_outlets
      where venue_id = v_dish.venue_id
      order by created_at asc
      limit 1;
      v_outlet_loaded := found;
    end if;
  elsif p_promotion_id is not null then
    select mo.id, mo.merchant_account_id, mo.venue_id
    into v_outlet
    from merchant_promotions mp
    join merchant_outlets mo on mo.id = mp.outlet_id
    where mp.id = p_promotion_id;
    v_outlet_loaded := found;

    select *
    into v_promotion
    from merchant_promotions
    where id = p_promotion_id;
    v_promotion_loaded := found;
  end if;

  if not v_outlet_loaded then
    return null;
  end if;

  if v_user_id is not null and public.merchant_can_manage_outlet_v2(v_outlet.id) then
    return null;
  end if;

  if p_promotion_id is not null and not v_promotion_loaded then
    select *
    into v_promotion
    from merchant_promotions
    where id = p_promotion_id
      and outlet_id = v_outlet.id;

    if not found then
      raise exception 'promotion does not belong to outlet' using errcode = '22023';
    end if;
    v_promotion_loaded := true;
  end if;

  if p_dish_id is not null then
    select id, venue_id
    into v_dish
    from dishes
    where id = p_dish_id
      and venue_id = v_outlet.venue_id;

    if not found then
      raise exception 'dish does not belong to outlet venue' using errcode = '22023';
    end if;
  elsif v_promotion_loaded and v_promotion.target_dish_id is not null then
    p_dish_id := v_promotion.target_dish_id;
  end if;

  v_session_id := coalesce(v_session_id, v_user_id::text);

  if v_session_id is null then
    raise exception 'anonymous merchant analytics events require a bounded session id' using errcode = '22023';
  end if;

  if char_length(v_session_id) > 128 or v_session_id !~ '^[A-Za-z0-9:_-]{4,128}$' then
    raise exception 'session id format is invalid' using errcode = '22023';
  end if;

  if v_user_id is null and exists (
    select 1
    from merchant_analytics_events
    where session_id = v_session_id
      and occurred_at >= now() - interval '1 hour'
    group by session_id
    having count(*) >= 240
  ) then
    raise exception 'merchant analytics event rate limit exceeded' using errcode = 'P0001';
  end if;

  v_dedupe_key :=
    v_outlet.id::text || ':' ||
    v_event_type || ':' ||
    coalesce(p_promotion_id::text, 'outlet') || ':' ||
    coalesce(p_dish_id, 'none') || ':' ||
    v_session_id || ':' ||
    to_char(now(), 'YYYY-MM-DD"T"HH24:MI');

  insert into merchant_analytics_events (
    merchant_account_id,
    outlet_id,
    venue_id,
    dish_id,
    promotion_id,
    user_id,
    session_id,
    event_type,
    source,
    dedupe_key,
    metadata,
    occurred_at
  )
  values (
    v_outlet.merchant_account_id,
    v_outlet.id,
    v_outlet.venue_id,
    p_dish_id,
    p_promotion_id,
    v_user_id,
    v_session_id,
    v_event_type,
    v_source,
    v_dedupe_key,
    coalesce(p_metadata, '{}'::jsonb),
    now()
  )
  on conflict (dedupe_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select id
    into v_event_id
    from merchant_analytics_events
    where dedupe_key = v_dedupe_key;
    return v_event_id;
  end if;

  if v_event_type like 'promotion_%' and p_promotion_id is not null then
    v_promotion_event_type := case v_event_type
      when 'promotion_impression' then 'impression'
      when 'promotion_click' then 'click'
      when 'promotion_save' then 'save'
      when 'promotion_profile_visit' then 'profile_visit'
      when 'promotion_dish_view' then 'dish_view'
      else null
    end;

    insert into merchant_promotion_events (
      promotion_id,
      merchant_account_id,
      outlet_id,
      venue_id,
      dish_id,
      user_id,
      session_id,
      event_type,
      dedupe_key,
      metadata,
      occurred_at
    )
    values (
      p_promotion_id,
      v_outlet.merchant_account_id,
      v_outlet.id,
      v_outlet.venue_id,
      p_dish_id,
      v_user_id,
      v_session_id,
      v_promotion_event_type,
      v_dedupe_key,
      coalesce(p_metadata, '{}'::jsonb),
      now()
    )
    on conflict (dedupe_key) do nothing;

    update merchant_promotions
    set
      impressions = impressions + case when v_promotion_event_type = 'impression' then 1 else 0 end,
      clicks = clicks + case when v_promotion_event_type = 'click' then 1 else 0 end,
      saves = saves + case when v_promotion_event_type = 'save' then 1 else 0 end,
      profile_visits = profile_visits + case when v_promotion_event_type = 'profile_visit' then 1 else 0 end,
      dish_views = dish_views + case when v_promotion_event_type = 'dish_view' then 1 else 0 end,
      updated_at = now()
    where id = p_promotion_id;
  end if;

  perform public.refresh_merchant_analytics_daily_rollup(v_outlet.id, current_date);
  if p_dish_id is not null then
    perform public.refresh_merchant_dish_analytics_daily(v_outlet.id, p_dish_id, current_date);
  end if;

  return v_event_id;
end;
$function$;

revoke all on function public.record_merchant_action_event(text, text, uuid, text, text, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_merchant_action_event(text, text, uuid, text, text, uuid, text, jsonb)
  to anon, authenticated;

create or replace function public.get_merchant_analytics(
  p_outlet_id uuid,
  p_since timestamptz default null,
  p_until timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_outlet record;
  v_since timestamptz := coalesce(p_since, now() - interval '7 days');
  v_until timestamptz := coalesce(p_until, now());
  v_previous_since timestamptz;
  v_previous_until timestamptz;
  v_profile_visits integer := 0;
  v_menu_views integer := 0;
  v_direction_taps integer := 0;
  v_saves integer := 0;
  v_shares integer := 0;
  v_contact_taps integer := 0;
  v_social_link_taps integer := 0;
  v_dish_views integer := 0;
  v_post_interactions integer := 0;
  v_review_count integer := 0;
  v_average_rating numeric := 0;
  v_previous_profile_visits integer := 0;
  v_previous_menu_views integer := 0;
  v_previous_review_count integer := 0;
  v_previous_average_rating numeric := 0;
  v_top_dishes jsonb := '[]'::jsonb;
  v_keywords jsonb := '[]'::jsonb;
  v_peak_hours jsonb := '[]'::jsonb;
  v_taste_tags jsonb := '[]'::jsonb;
begin
  select id, merchant_account_id, venue_id
  into v_outlet
  from merchant_outlets
  where id = p_outlet_id;

  if not found or not public.merchant_can_manage_outlet_v2(p_outlet_id) then
    raise exception 'not authorized to read merchant analytics' using errcode = '42501';
  end if;

  v_previous_until := v_since;
  v_previous_since := v_since - (v_until - v_since);

  select
    coalesce(count(*) filter (where event_type in ('stall_profile_view', 'promotion_profile_visit')), 0)::integer,
    coalesce(count(*) filter (where event_type = 'menu_view'), 0)::integer,
    coalesce(count(*) filter (where event_type = 'direction_tap'), 0)::integer,
    coalesce(count(*) filter (where event_type in ('save', 'promotion_save')), 0)::integer,
    coalesce(count(*) filter (where event_type = 'share'), 0)::integer,
    coalesce(count(*) filter (where event_type = 'contact_tap'), 0)::integer,
    coalesce(count(*) filter (where event_type = 'social_link_tap'), 0)::integer
  into
    v_profile_visits,
    v_menu_views,
    v_direction_taps,
    v_saves,
    v_shares,
    v_contact_taps,
    v_social_link_taps
  from merchant_analytics_events
  where outlet_id = p_outlet_id
    and occurred_at >= v_since
    and occurred_at < v_until;

  select
    coalesce(count(*), 0)::integer
  into v_dish_views
  from merchant_dish_view_events
  where outlet_id = p_outlet_id
    and viewed_at >= v_since
    and viewed_at < v_until;

  v_dish_views := v_dish_views + (
    select coalesce(count(*), 0)::integer
    from merchant_promotion_events
    where outlet_id = p_outlet_id
      and event_type = 'dish_view'
      and occurred_at >= v_since
      and occurred_at < v_until
  );

  select
    coalesce(count(*), 0)::integer,
    coalesce(avg(r.rating), 0)::numeric
  into v_review_count, v_average_rating
  from reviews r
  join dishes d on d.id = r.dish_id
  where d.venue_id = v_outlet.venue_id
    and r.created_at >= v_since
    and r.created_at < v_until;

  v_post_interactions := v_review_count;

  select
    coalesce(count(*) filter (where event_type in ('stall_profile_view', 'promotion_profile_visit')), 0)::integer,
    coalesce(count(*) filter (where event_type = 'menu_view'), 0)::integer
  into v_previous_profile_visits, v_previous_menu_views
  from merchant_analytics_events
  where outlet_id = p_outlet_id
    and occurred_at >= v_previous_since
    and occurred_at < v_previous_until;

  select
    coalesce(count(*), 0)::integer,
    coalesce(avg(r.rating), 0)::numeric
  into v_previous_review_count, v_previous_average_rating
  from reviews r
  join dishes d on d.id = r.dish_id
  where d.venue_id = v_outlet.venue_id
    and r.created_at >= v_previous_since
    and r.created_at < v_previous_until;

  with dish_rows as (
    select
      d.id,
      d.name,
      coalesce(view_counts.view_count, 0)::integer as views,
      coalesce(save_counts.save_count, 0)::integer as saves
    from dishes d
    left join (
      select dish_id, count(*)::integer as view_count
      from merchant_dish_view_events
      where outlet_id = p_outlet_id
        and viewed_at >= v_since
        and viewed_at < v_until
      group by dish_id
    ) view_counts on view_counts.dish_id = d.id
    left join (
      select dish_id, count(*)::integer as save_count
      from merchant_analytics_events
      where outlet_id = p_outlet_id
        and event_type in ('save', 'promotion_save')
        and dish_id is not null
        and occurred_at >= v_since
        and occurred_at < v_until
      group by dish_id
    ) save_counts on save_counts.dish_id = d.id
    where d.venue_id = v_outlet.venue_id
  ),
  ranked as (
    select *
    from dish_rows
    where views > 0 or saves > 0
    order by views desc, saves desc, name asc
    limit 5
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'dishId', id,
          'name', name,
          'views', views,
          'saves', saves
        )
        order by views desc, saves desc, name asc
      ),
      '[]'::jsonb
    ),
    coalesce(jsonb_agg(to_jsonb(lower(name)) order by views desc, saves desc, name asc), '[]'::jsonb)
  into v_top_dishes, v_keywords
  from ranked;

  with discovery_events as (
    select viewed_at as occurred_at
    from merchant_dish_view_events
    where outlet_id = p_outlet_id
      and viewed_at >= v_since
      and viewed_at < v_until
    union all
    select occurred_at
    from merchant_analytics_events
    where outlet_id = p_outlet_id
      and occurred_at >= v_since
      and occurred_at < v_until
  ),
  ranked_hours as (
    select extract(hour from occurred_at)::integer as hour, count(*) as event_count
    from discovery_events
    group by extract(hour from occurred_at)::integer
    order by event_count desc, hour asc
    limit 6
  )
  select coalesce(jsonb_agg(to_jsonb(hour) order by event_count desc, hour asc), '[]'::jsonb)
  into v_peak_hours
  from ranked_hours;

  with tag_rows as (
    select unnest(r.tags) as tag
    from reviews r
    join dishes d on d.id = r.dish_id
    where d.venue_id = v_outlet.venue_id
      and r.created_at >= v_since
      and r.created_at < v_until
    union all
    select unnest(d.taste_tags) as tag
    from dishes d
    join merchant_dish_view_events mdve on mdve.dish_id = d.id
    where d.venue_id = v_outlet.venue_id
      and mdve.outlet_id = p_outlet_id
      and mdve.viewed_at >= v_since
      and mdve.viewed_at < v_until
    union all
    select dft.tag_slug as tag
    from dish_flavor_tags dft
    join dishes d on d.id = dft.dish_id
    where d.venue_id = v_outlet.venue_id
      and dft.status in ('pending', 'applied')
  ),
  ranked_tags as (
    select trim(lower(tag)) as tag, count(*)::integer as tag_count
    from tag_rows
    where trim(coalesce(tag, '')) <> ''
    group by trim(lower(tag))
    order by tag_count desc, tag asc
    limit 8
  )
  select coalesce(
    jsonb_agg(jsonb_build_object('tag', tag, 'count', tag_count) order by tag_count desc, tag asc),
    '[]'::jsonb
  )
  into v_taste_tags
  from ranked_tags;

  return jsonb_build_object(
    'outletId', p_outlet_id,
    'profileVisits', v_profile_visits,
    'menuViews', v_menu_views,
    'dishViews', v_dish_views,
    'directionTaps', v_direction_taps,
    'saves', v_saves,
    'shares', v_shares,
    'contactTaps', v_contact_taps,
    'socialLinkTaps', v_social_link_taps,
    'postInteractions', v_post_interactions,
    'reviewCount', v_review_count,
    'averageRating', round(v_average_rating, 2),
    'topDishes', v_top_dishes,
    'mostSearchedKeywords', v_keywords,
    'peakDiscoveryHours', v_peak_hours,
    'customerTasteTags', v_taste_tags,
    'previousPeriodComparison', jsonb_build_object(
      'profileVisits', v_previous_profile_visits,
      'menuViews', v_previous_menu_views,
      'reviewCount', v_previous_review_count,
      'averageRating', round(v_previous_average_rating, 2)
    )
  );
end;
$function$;

revoke all on function public.get_merchant_analytics(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_merchant_analytics(uuid, timestamptz, timestamptz)
  to authenticated;

create or replace function public.persist_merchant_weekly_summary(
  p_outlet_id uuid,
  p_week_start date,
  p_week_end date,
  p_total_views integer,
  p_dish_views integer,
  p_top_dishes jsonb,
  p_new_reviews integer,
  p_average_rating numeric,
  p_rating_change numeric,
  p_unreplied_reviews integer,
  p_promotion_views integer,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_outlet record;
  v_summary_id uuid;
begin
  select id, merchant_account_id
  into v_outlet
  from merchant_outlets
  where id = p_outlet_id;

  if not found or not public.merchant_can_manage_outlet_v2(p_outlet_id) then
    raise exception 'not authorized to persist merchant weekly summary' using errcode = '42501';
  end if;

  insert into merchant_weekly_summaries (
    merchant_account_id,
    outlet_id,
    week_start,
    week_end,
    total_views,
    dish_views,
    top_dishes,
    new_reviews,
    average_rating,
    rating_change,
    unreplied_reviews,
    promotion_views,
    metadata,
    created_at,
    updated_at
  )
  values (
    v_outlet.merchant_account_id,
    p_outlet_id,
    p_week_start,
    p_week_end,
    greatest(coalesce(p_total_views, 0), 0),
    greatest(coalesce(p_dish_views, 0), 0),
    coalesce(p_top_dishes, '[]'::jsonb),
    greatest(coalesce(p_new_reviews, 0), 0),
    coalesce(p_average_rating, 0),
    coalesce(p_rating_change, 0),
    greatest(coalesce(p_unreplied_reviews, 0), 0),
    greatest(coalesce(p_promotion_views, 0), 0),
    coalesce(p_metadata, '{}'::jsonb),
    now(),
    now()
  )
  on conflict (outlet_id, week_start) do update set
    week_end = excluded.week_end,
    total_views = excluded.total_views,
    dish_views = excluded.dish_views,
    top_dishes = excluded.top_dishes,
    new_reviews = excluded.new_reviews,
    average_rating = excluded.average_rating,
    rating_change = excluded.rating_change,
    unreplied_reviews = excluded.unreplied_reviews,
    promotion_views = excluded.promotion_views,
    metadata = excluded.metadata,
    updated_at = now()
  returning id into v_summary_id;

  insert into merchant_audit_logs (
    merchant_account_id,
    outlet_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    v_outlet.merchant_account_id,
    p_outlet_id,
    auth.uid(),
    'weekly_summary_persisted',
    'merchant_weekly_summary',
    v_summary_id::text,
    jsonb_build_object('weekStart', p_week_start, 'weekEnd', p_week_end)
  );

  return v_summary_id;
end;
$function$;

revoke all on function public.persist_merchant_weekly_summary(
  uuid,
  date,
  date,
  integer,
  integer,
  jsonb,
  integer,
  numeric,
  numeric,
  integer,
  integer,
  jsonb
) from public, anon, authenticated;
grant execute on function public.persist_merchant_weekly_summary(
  uuid,
  date,
  date,
  integer,
  integer,
  jsonb,
  integer,
  numeric,
  numeric,
  integer,
  integer,
  jsonb
) to authenticated;
