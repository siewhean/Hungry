-- Migration: Checklist, Portfolio, and Passport Extensions
-- Part 1: Checklists

-- Checklists table
create table public.checklists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_checklists_user_id on public.checklists(user_id);

-- Checklist items table
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  item_type text not null check (item_type in ('dish', 'stall', 'custom')),
  dish_id text references public.dishes(id) on delete cascade,
  stall_id text references public.venues(id) on delete cascade,
  custom_text text,
  reminder_at timestamptz,
  planned_visit_date date,
  tried_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint checklist_item_type_check check (
    (item_type = 'dish' and dish_id is not null and stall_id is null and custom_text is null) or
    (item_type = 'stall' and stall_id is not null and dish_id is null and custom_text is null) or
    (item_type = 'custom' and custom_text is not null and dish_id is null and stall_id is null)
  )
);

create index idx_checklist_items_checklist_id on public.checklist_items(checklist_id);
create index idx_checklist_items_dish_id on public.checklist_items(dish_id) where dish_id is not null;
create index idx_checklist_items_stall_id on public.checklist_items(stall_id) where stall_id is not null;
create index idx_checklist_items_position on public.checklist_items(checklist_id, position);
create unique index idx_checklist_items_unique_dish
  on public.checklist_items(checklist_id, dish_id)
  where item_type = 'dish' and dish_id is not null;
create unique index idx_checklist_items_unique_stall
  on public.checklist_items(checklist_id, stall_id)
  where item_type = 'stall' and stall_id is not null;

-- Portfolios table
create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.user_profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  description text,
  type text not null check (type in ('recommendation', 'ranking', 'trail', 'collection')),
  visibility text not null check (visibility in ('private', 'followers_only', 'public')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_portfolios_owner_id on public.portfolios(owner_id);
create index idx_portfolios_visibility on public.portfolios(visibility);
create index idx_portfolios_type on public.portfolios(type);
create index idx_portfolios_owner_created_at on public.portfolios(owner_id, created_at desc);
create index idx_portfolios_published_at on public.portfolios(published_at) where published_at is not null;
create index idx_portfolios_name_description_trgm
  on public.portfolios using gin ((lower(name || ' ' || coalesce(description, ''))) gin_trgm_ops);

-- Portfolio items table
create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  item_type text not null check (item_type in ('dish', 'stall')),
  dish_id text references public.dishes(id) on delete cascade,
  stall_id text references public.venues(id) on delete cascade,
  score integer check (score between 1 and 10),
  public_notes text,
  private_notes text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint portfolio_item_type_check check (
    (item_type = 'dish' and dish_id is not null and stall_id is null) or
    (item_type = 'stall' and stall_id is not null and dish_id is null)
  )
);

create index idx_portfolio_items_portfolio_id on public.portfolio_items(portfolio_id);
create index idx_portfolio_items_dish_id on public.portfolio_items(dish_id) where dish_id is not null;
create index idx_portfolio_items_stall_id on public.portfolio_items(stall_id) where stall_id is not null;
create index idx_portfolio_items_position on public.portfolio_items(portfolio_id, position);
create unique index idx_portfolio_items_unique_dish
  on public.portfolio_items(portfolio_id, dish_id)
  where item_type = 'dish' and dish_id is not null;
create unique index idx_portfolio_items_unique_stall
  on public.portfolio_items(portfolio_id, stall_id)
  where item_type = 'stall' and stall_id is not null;

-- Portfolio collaborators table
create table public.portfolio_collaborators (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  role text not null check (role in ('viewer', 'editor')),
  created_at timestamptz not null default now(),

  unique(portfolio_id, user_id)
);

create index idx_portfolio_collaborators_portfolio_id on public.portfolio_collaborators(portfolio_id);
create index idx_portfolio_collaborators_user_id on public.portfolio_collaborators(user_id);

-- Portfolio follows table
create table public.portfolio_follows (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),

  unique(portfolio_id, user_id)
);

create index idx_portfolio_follows_portfolio_id on public.portfolio_follows(portfolio_id);
create index idx_portfolio_follows_user_id on public.portfolio_follows(user_id);

-- Portfolio flags table
create table public.portfolio_flags (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  reporter_id uuid not null references public.user_profiles(id) on delete cascade,
  reason text not null check (reason in ('spam', 'inappropriate', 'misleading', 'other')),
  details text,
  status text not null default 'pending' check (status in ('pending', 'dismissed', 'removed')),
  reviewed_by uuid references public.user_profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_portfolio_flags_portfolio_id on public.portfolio_flags(portfolio_id);
create index idx_portfolio_flags_status on public.portfolio_flags(status);
create index idx_portfolio_flags_reporter_created_at
  on public.portfolio_flags(reporter_id, created_at desc);
create unique index idx_portfolio_flags_unique_pending
  on public.portfolio_flags(portfolio_id, reporter_id)
  where status = 'pending';

-- Passport stamps and progress events table
create table if not exists public.passport_stamps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  category_id text not null,
  level integer not null default 1 check (level >= 0),
  dishes_tried_count integer not null default 0 check (dishes_tried_count >= 0),
  stalls_visited_count integer not null default 0 check (stalls_visited_count >= 0),
  reviews_posted_count integer not null default 0 check (reviews_posted_count >= 0),
  photos_posted_count integer not null default 0 check (photos_posted_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, category_id)
);

create index if not exists idx_passport_stamps_user_id on public.passport_stamps(user_id);

create table public.passport_progress_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  category_id text not null,
  event_type text not null check (event_type in (
    'dish_tried', 'stall_visited', 'review_posted', 'photo_posted',
    'portfolio_item_added', 'public_portfolio_published', 'trail_completed'
  )),
  reference_id text,
  created_at timestamptz not null default now()
);

create index idx_passport_progress_events_user_id on public.passport_progress_events(user_id);
create index idx_passport_progress_events_category_id on public.passport_progress_events(category_id);
create index idx_passport_progress_events_user_category on public.passport_progress_events(user_id, category_id);

-- Extend passport_stamps table with new counters
alter table public.passport_stamps
  add column if not exists portfolio_items_added integer not null default 0,
  add column if not exists public_portfolios_published integer not null default 0,
  add column if not exists trails_completed integer not null default 0;

-- RLS Policies

-- Checklists: private to owner
alter table public.checklists enable row level security;

create policy "Users can view own checklists"
  on public.checklists for select
  using (auth.uid() = user_id);

create policy "Users can create own checklists"
  on public.checklists for insert
  with check (auth.uid() = user_id);

create policy "Users can update own checklists"
  on public.checklists for update
  using (auth.uid() = user_id);

create policy "Users can delete own checklists"
  on public.checklists for delete
  using (auth.uid() = user_id);

-- Checklist items: inherit checklist ownership
alter table public.checklist_items enable row level security;

create policy "Users can view own checklist items"
  on public.checklist_items for select
  using (
    exists (
      select 1 from public.checklists
      where checklists.id = checklist_items.checklist_id
      and checklists.user_id = auth.uid()
    )
  );

create policy "Users can create own checklist items"
  on public.checklist_items for insert
  with check (
    exists (
      select 1 from public.checklists
      where checklists.id = checklist_items.checklist_id
      and checklists.user_id = auth.uid()
    )
  );

create policy "Users can update own checklist items"
  on public.checklist_items for update
  using (
    exists (
      select 1 from public.checklists
      where checklists.id = checklist_items.checklist_id
      and checklists.user_id = auth.uid()
    )
  );

create policy "Users can delete own checklist items"
  on public.checklist_items for delete
  using (
    exists (
      select 1 from public.checklists
      where checklists.id = checklist_items.checklist_id
      and checklists.user_id = auth.uid()
    )
  );

-- Portfolios: visibility-based access
alter table public.portfolios enable row level security;

create policy "Users can view public portfolios"
  on public.portfolios for select
  using (visibility = 'public');

create policy "Users can view followers_only portfolios if following owner"
  on public.portfolios for select
  using (
    visibility = 'followers_only' and
    exists (
      select 1 from public.follows
      where follows.follower_id = auth.uid()
      and follows.followee_id = portfolios.owner_id
      and follows.status = 'approved'
    )
  );

create policy "Users can view own portfolios"
  on public.portfolios for select
  using (auth.uid() = owner_id);

create policy "Collaborators can view portfolios"
  on public.portfolios for select
  using (
    exists (
      select 1 from public.portfolio_collaborators
      where portfolio_collaborators.portfolio_id = portfolios.id
      and portfolio_collaborators.user_id = auth.uid()
    )
  );

create policy "Users can create own portfolios"
  on public.portfolios for insert
  with check (auth.uid() = owner_id);

create policy "Owners can update own portfolios"
  on public.portfolios for update
  using (auth.uid() = owner_id);

create policy "Owners can delete own portfolios"
  on public.portfolios for delete
  using (auth.uid() = owner_id);

-- Portfolio items: inherit portfolio visibility
alter table public.portfolio_items enable row level security;

create policy "Users can view portfolio items if can view portfolio"
  on public.portfolio_items for select
  using (
    exists (
      select 1 from public.portfolios
      where portfolios.id = portfolio_items.portfolio_id
      and (
        portfolios.visibility = 'public'
        or portfolios.owner_id = auth.uid()
        or (
          portfolios.visibility = 'followers_only' and
          exists (
            select 1 from public.follows
            where follows.follower_id = auth.uid()
            and follows.followee_id = portfolios.owner_id
            and follows.status = 'approved'
          )
        )
        or exists (
          select 1 from public.portfolio_collaborators
          where portfolio_collaborators.portfolio_id = portfolios.id
          and portfolio_collaborators.user_id = auth.uid()
        )
      )
    )
  );

create policy "Owners and editors can create portfolio items"
  on public.portfolio_items for insert
  with check (
    exists (
      select 1 from public.portfolios
      where portfolios.id = portfolio_items.portfolio_id
      and (
        portfolios.owner_id = auth.uid()
        or exists (
          select 1 from public.portfolio_collaborators
          where portfolio_collaborators.portfolio_id = portfolios.id
          and portfolio_collaborators.user_id = auth.uid()
          and portfolio_collaborators.role = 'editor'
        )
      )
    )
  );

create policy "Owners and editors can update portfolio items"
  on public.portfolio_items for update
  using (
    exists (
      select 1 from public.portfolios
      where portfolios.id = portfolio_items.portfolio_id
      and (
        portfolios.owner_id = auth.uid()
        or exists (
          select 1 from public.portfolio_collaborators
          where portfolio_collaborators.portfolio_id = portfolios.id
          and portfolio_collaborators.user_id = auth.uid()
          and portfolio_collaborators.role = 'editor'
        )
      )
    )
  );

create policy "Owners and editors can delete portfolio items"
  on public.portfolio_items for delete
  using (
    exists (
      select 1 from public.portfolios
      where portfolios.id = portfolio_items.portfolio_id
      and (
        portfolios.owner_id = auth.uid()
        or exists (
          select 1 from public.portfolio_collaborators
          where portfolio_collaborators.portfolio_id = portfolios.id
          and portfolio_collaborators.user_id = auth.uid()
          and portfolio_collaborators.role = 'editor'
        )
      )
    )
  );

-- Portfolio collaborators: owner manages, collaborators read
alter table public.portfolio_collaborators enable row level security;

create policy "Users can view collaborators if can view portfolio"
  on public.portfolio_collaborators for select
  using (
    exists (
      select 1 from public.portfolios
      where portfolios.id = portfolio_collaborators.portfolio_id
      and (
        portfolios.visibility = 'public'
        or portfolios.owner_id = auth.uid()
        or (
          portfolios.visibility = 'followers_only' and
          exists (
            select 1 from public.follows
            where follows.follower_id = auth.uid()
            and follows.followee_id = portfolios.owner_id
            and follows.status = 'approved'
          )
        )
        or portfolio_collaborators.user_id = auth.uid()
      )
    )
  );

create policy "Owners can add collaborators"
  on public.portfolio_collaborators for insert
  with check (
    exists (
      select 1 from public.portfolios
      where portfolios.id = portfolio_collaborators.portfolio_id
      and portfolios.owner_id = auth.uid()
    )
  );

create policy "Owners can remove collaborators"
  on public.portfolio_collaborators for delete
  using (
    exists (
      select 1 from public.portfolios
      where portfolios.id = portfolio_collaborators.portfolio_id
      and portfolios.owner_id = auth.uid()
    )
  );

-- Portfolio follows: users manage own follows
alter table public.portfolio_follows enable row level security;

create policy "Users can view portfolio follows"
  on public.portfolio_follows for select
  using (true);

create policy "Users can follow portfolios"
  on public.portfolio_follows for insert
  with check (auth.uid() = user_id);

create policy "Users can unfollow portfolios"
  on public.portfolio_follows for delete
  using (auth.uid() = user_id);

-- Portfolio flags: users flag public portfolios, admins review
alter table public.portfolio_flags enable row level security;

create policy "Users can view own flags"
  on public.portfolio_flags for select
  using (auth.uid() = reporter_id);

create policy "Admins can view all flags"
  on public.portfolio_flags for select
  using (
    public.app_is_current_user_ops_admin()
  );

create policy "Users can flag public portfolios"
  on public.portfolio_flags for insert
  with check (
    auth.uid() = reporter_id and
    exists (
      select 1 from public.portfolios
      where portfolios.id = portfolio_flags.portfolio_id
      and portfolios.visibility = 'public'
    )
  );

create policy "Admins can update flags"
  on public.portfolio_flags for update
  using (
    public.app_is_current_user_ops_admin()
  );

-- Passport progress events: users view own events
alter table public.passport_stamps enable row level security;
alter table public.passport_progress_events enable row level security;

create policy "Users can view own passport stamps"
  on public.passport_stamps for select
  using (auth.uid() = user_id);

create policy "System can manage passport stamps"
  on public.passport_stamps for all to service_role
  using (true)
  with check (true);

create policy "Users can view own passport events"
  on public.passport_progress_events for select
  using (auth.uid() = user_id);

create policy "System can insert passport events"
  on public.passport_progress_events for insert to service_role
  with check (true);

-- Rate-limit high-abuse user actions at the database boundary.
create or replace function public.enforce_portfolio_creation_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and new.owner_id = auth.uid() then
    if (
      select count(*)
      from public.portfolios
      where owner_id = auth.uid()
        and created_at > now() - interval '1 hour'
    ) >= 20 then
      raise exception 'Portfolio creation rate limit exceeded';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_portfolio_flag_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and new.reporter_id = auth.uid() then
    if exists (
      select 1
      from public.portfolio_flags
      where portfolio_id = new.portfolio_id
        and reporter_id = auth.uid()
        and status = 'pending'
    ) then
      raise exception 'Portfolio already has a pending flag from this user';
    end if;

    if (
      select count(*)
      from public.portfolio_flags
      where reporter_id = auth.uid()
        and created_at > now() - interval '1 hour'
    ) >= 10 then
      raise exception 'Portfolio flag rate limit exceeded';
    end if;
  end if;

  return new;
end;
$$;

-- Backend Functions

-- Function: record_passport_progress
create or replace function public.record_passport_progress(
  p_category_id text,
  p_event_type text,
  p_reference_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.passport_stamps (user_id, category_id)
  values (auth.uid(), p_category_id)
  on conflict (user_id, category_id) do nothing;

  -- Insert progress event
  insert into public.passport_progress_events (user_id, category_id, event_type, reference_id)
  values (auth.uid(), p_category_id, p_event_type, p_reference_id);

  -- Update stamp counters based on event type
  if p_event_type = 'portfolio_item_added' then
    update public.passport_stamps
    set portfolio_items_added = portfolio_items_added + 1,
        updated_at = now()
    where user_id = auth.uid() and category_id = p_category_id;
  elsif p_event_type = 'public_portfolio_published' then
    update public.passport_stamps
    set public_portfolios_published = public_portfolios_published + 1,
        updated_at = now()
    where user_id = auth.uid() and category_id = p_category_id;
  elsif p_event_type = 'trail_completed' then
    update public.passport_stamps
    set trails_completed = trails_completed + 1,
        updated_at = now()
    where user_id = auth.uid() and category_id = p_category_id;
  end if;
end;
$$;

-- Function: add_portfolio_item (with passport integration)
create or replace function public.assert_portfolio_expected_updated_at(
  p_portfolio_id uuid,
  p_expected_updated_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_expected_updated_at is null then
    return;
  end if;

  if not exists (
    select 1
    from public.portfolios p
    where p.id = p_portfolio_id
      and p.updated_at = p_expected_updated_at
  ) then
    raise exception 'This portfolio changed elsewhere. Review the latest version before saving again.';
  end if;
end;
$$;

create or replace function public.add_portfolio_item_with_passport(
  p_portfolio_id uuid,
  p_item_type text,
  p_dish_id text default null,
  p_stall_id text default null,
  p_score integer default null,
  p_public_notes text default null,
  p_private_notes text default null,
  p_expected_portfolio_updated_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
  v_category_id text := 'contributor';
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  perform public.assert_portfolio_expected_updated_at(
    p_portfolio_id,
    p_expected_portfolio_updated_at
  );

  if p_item_type not in ('dish', 'stall') then
    raise exception 'Invalid portfolio item type';
  end if;

  if p_item_type = 'dish' and (p_dish_id is null or p_stall_id is not null) then
    raise exception 'Dish portfolio items require only dish_id';
  end if;

  if p_item_type = 'stall' and (p_stall_id is null or p_dish_id is not null) then
    raise exception 'Stall portfolio items require only stall_id';
  end if;

  if p_score is not null and (p_score < 1 or p_score > 10) then
    raise exception 'Portfolio item score must be between 1 and 10';
  end if;

  if not exists (
    select 1
    from public.portfolios p
    where p.id = p_portfolio_id
    and (
      p.owner_id = auth.uid()
      or exists (
        select 1
        from public.portfolio_collaborators pc
        where pc.portfolio_id = p.id
        and pc.user_id = auth.uid()
        and pc.role = 'editor'
      )
    )
  ) then
    raise exception 'Portfolio not found or not editable';
  end if;

  if exists (
    select 1
    from public.portfolio_items pi
    where pi.portfolio_id = p_portfolio_id
    and pi.item_type = p_item_type
    and coalesce(pi.dish_id, '') = coalesce(p_dish_id, '')
    and coalesce(pi.stall_id, '') = coalesce(p_stall_id, '')
  ) then
    raise exception 'This item is already in the portfolio';
  end if;

  -- Insert portfolio item
  insert into public.portfolio_items (
    portfolio_id, item_type, dish_id, stall_id, score, public_notes, private_notes, position
  )
  values (
    p_portfolio_id, p_item_type, p_dish_id, p_stall_id, p_score, p_public_notes, p_private_notes,
    coalesce((select max(position) + 1 from public.portfolio_items where portfolio_id = p_portfolio_id), 0)
  )
  returning id into v_item_id;

  update public.portfolios
  set updated_at = now()
  where id = p_portfolio_id;

  perform public.record_passport_progress(v_category_id, 'portfolio_item_added', v_item_id::text);

  return v_item_id;
end;
$$;

create or replace function public.update_portfolio_item_with_version(
  p_item_id uuid,
  p_score integer default null,
  p_public_notes text default null,
  p_private_notes text default null,
  p_expected_portfolio_updated_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_portfolio_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select pi.portfolio_id into v_portfolio_id
  from public.portfolio_items pi
  join public.portfolios p on p.id = pi.portfolio_id
  where pi.id = p_item_id
    and (
      p.owner_id = auth.uid()
      or exists (
        select 1
        from public.portfolio_collaborators pc
        where pc.portfolio_id = p.id
          and pc.user_id = auth.uid()
          and pc.role = 'editor'
      )
    );

  if v_portfolio_id is null then
    raise exception 'Portfolio item not found or not editable';
  end if;

  perform public.assert_portfolio_expected_updated_at(
    v_portfolio_id,
    p_expected_portfolio_updated_at
  );

  if p_score is not null and (p_score < 1 or p_score > 10) then
    raise exception 'Portfolio item score must be between 1 and 10';
  end if;

  update public.portfolio_items
  set score = coalesce(p_score, score),
      public_notes = coalesce(p_public_notes, public_notes),
      private_notes = coalesce(p_private_notes, private_notes),
      updated_at = now()
  where id = p_item_id;

  update public.portfolios
  set updated_at = now()
  where id = v_portfolio_id;
end;
$$;

create or replace function public.delete_portfolio_item_with_version(
  p_item_id uuid,
  p_expected_portfolio_updated_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_portfolio_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select pi.portfolio_id into v_portfolio_id
  from public.portfolio_items pi
  join public.portfolios p on p.id = pi.portfolio_id
  where pi.id = p_item_id
    and (
      p.owner_id = auth.uid()
      or exists (
        select 1
        from public.portfolio_collaborators pc
        where pc.portfolio_id = p.id
          and pc.user_id = auth.uid()
          and pc.role = 'editor'
      )
    );

  if v_portfolio_id is null then
    raise exception 'Portfolio item not found or not editable';
  end if;

  perform public.assert_portfolio_expected_updated_at(
    v_portfolio_id,
    p_expected_portfolio_updated_at
  );

  delete from public.portfolio_items
  where id = p_item_id;

  update public.portfolio_items
  set position = ordered_items.position,
      updated_at = now()
  from (
    select id, row_number() over (order by position, created_at) - 1 as position
    from public.portfolio_items
    where portfolio_id = v_portfolio_id
  ) as ordered_items
  where public.portfolio_items.id = ordered_items.id;

  update public.portfolios
  set updated_at = now()
  where id = v_portfolio_id;
end;
$$;

-- Function: publish_portfolio (with passport integration)
create or replace function public.publish_portfolio_with_passport(
  p_portfolio_id uuid,
  p_expected_portfolio_updated_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_portfolio_type text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  perform public.assert_portfolio_expected_updated_at(
    p_portfolio_id,
    p_expected_portfolio_updated_at
  );

  select type into v_portfolio_type
  from public.portfolios
  where id = p_portfolio_id
  and owner_id = auth.uid();

  if v_portfolio_type is null then
    raise exception 'Portfolio not found or not editable';
  end if;

  update public.portfolios
  set published_at = now(),
      visibility = 'public',
      updated_at = now()
  where id = p_portfolio_id
  and owner_id = auth.uid()
  and published_at is null;

  if found then
    perform public.record_passport_progress('contributor', 'public_portfolio_published', p_portfolio_id::text);
    if v_portfolio_type = 'trail' then
      perform public.record_passport_progress('contributor', 'trail_completed', p_portfolio_id::text);
    end if;
  end if;
end;
$$;

-- Function: reorder_checklist_items
create or replace function public.reorder_checklist_items(
  p_checklist_id uuid,
  p_item_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
  v_position integer := 0;
  v_expected_count integer;
  v_requested_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.checklists
    where id = p_checklist_id
    and user_id = auth.uid()
  ) then
    raise exception 'Checklist not found or not editable';
  end if;

  select count(*) into v_expected_count
  from public.checklist_items
  where checklist_id = p_checklist_id;

  select count(distinct item_id) into v_requested_count
  from unnest(coalesce(p_item_ids, array[]::uuid[])) as item_id;

  if v_requested_count <> v_expected_count
    or exists (
      select 1
      from unnest(coalesce(p_item_ids, array[]::uuid[])) as item_id
      left join public.checklist_items ci
        on ci.id = item_id
       and ci.checklist_id = p_checklist_id
      where ci.id is null
    )
  then
    raise exception 'Checklist reorder requires every current item exactly once';
  end if;

  foreach v_item_id in array p_item_ids
  loop
    update public.checklist_items
    set position = v_position,
        updated_at = now()
    where id = v_item_id
    and checklist_id = p_checklist_id;

    v_position := v_position + 1;
  end loop;
end;
$$;

-- Function: reorder_portfolio_items
create or replace function public.reorder_portfolio_items(
  p_portfolio_id uuid,
  p_item_ids uuid[],
  p_expected_portfolio_updated_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
  v_position integer := 0;
  v_expected_count integer;
  v_requested_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  perform public.assert_portfolio_expected_updated_at(
    p_portfolio_id,
    p_expected_portfolio_updated_at
  );

  if not exists (
    select 1
    from public.portfolios p
    where p.id = p_portfolio_id
    and (
      p.owner_id = auth.uid()
      or exists (
        select 1
        from public.portfolio_collaborators pc
        where pc.portfolio_id = p.id
        and pc.user_id = auth.uid()
        and pc.role = 'editor'
      )
    )
  ) then
    raise exception 'Portfolio not found or not editable';
  end if;

  select count(*) into v_expected_count
  from public.portfolio_items
  where portfolio_id = p_portfolio_id;

  select count(distinct item_id) into v_requested_count
  from unnest(coalesce(p_item_ids, array[]::uuid[])) as item_id;

  if v_requested_count <> v_expected_count
    or exists (
      select 1
      from unnest(coalesce(p_item_ids, array[]::uuid[])) as item_id
      left join public.portfolio_items pi
        on pi.id = item_id
       and pi.portfolio_id = p_portfolio_id
      where pi.id is null
    )
  then
    raise exception 'Portfolio reorder requires every current item exactly once';
  end if;

  foreach v_item_id in array p_item_ids
  loop
    update public.portfolio_items
    set position = v_position,
        updated_at = now()
    where id = v_item_id
    and portfolio_id = p_portfolio_id;

    v_position := v_position + 1;
  end loop;

  update public.portfolios
  set updated_at = now()
  where id = p_portfolio_id;
end;
$$;

-- Function: search_portfolios
create or replace function public.search_portfolios(
  p_query text,
  p_type text default null,
  p_visibility text default 'public'
)
returns table (
  id uuid,
  owner_id uuid,
  name text,
  description text,
  type text,
  visibility text,
  published_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  item_count bigint,
  follower_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    p.id,
    p.owner_id,
    p.name,
    p.description,
    p.type,
    p.visibility,
    p.published_at,
    p.created_at,
    p.updated_at,
    (select count(*) from public.portfolio_items where portfolio_id = p.id) as item_count,
    (select count(*) from public.portfolio_follows where portfolio_id = p.id) as follower_count
  from public.portfolios p
  where
    (p_visibility is null or p.visibility = p_visibility)
    and (p_type is null or p.type = p_type)
    and (
      lower(p.name || ' ' || coalesce(p.description, '')) like '%' || lower(coalesce(p_query, '')) || '%'
    )
    and (
      p.visibility = 'public'
      or p.owner_id = auth.uid()
      or (
        p.visibility = 'followers_only' and
        exists (
          select 1 from public.follows
          where follows.follower_id = auth.uid()
          and follows.followee_id = p.owner_id
          and follows.status = 'approved'
        )
      )
      or exists (
        select 1 from public.portfolio_collaborators
        where portfolio_collaborators.portfolio_id = p.id
        and portfolio_collaborators.user_id = auth.uid()
      )
    )
  order by
    case
      when nullif(trim(coalesce(p_query, '')), '') is null then 0
      else similarity(lower(p.name || ' ' || coalesce(p.description, '')), lower(p_query))
    end desc,
    p.created_at desc;
end;
$$;

-- Triggers for updated_at timestamps
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_checklists_updated_at before update on public.checklists
  for each row execute function public.update_updated_at_column();

create trigger update_checklist_items_updated_at before update on public.checklist_items
  for each row execute function public.update_updated_at_column();

create trigger update_portfolios_updated_at before update on public.portfolios
  for each row execute function public.update_updated_at_column();

create trigger update_portfolio_items_updated_at before update on public.portfolio_items
  for each row execute function public.update_updated_at_column();

create trigger enforce_portfolio_creation_rate_limit_before_insert
  before insert on public.portfolios
  for each row execute function public.enforce_portfolio_creation_rate_limit();

create trigger enforce_portfolio_flag_rate_limit_before_insert
  before insert on public.portfolio_flags
  for each row execute function public.enforce_portfolio_flag_rate_limit();

grant select, insert, update, delete on table public.checklists to authenticated;
grant select, insert, update, delete on table public.checklist_items to authenticated;
grant select, insert, update, delete on table public.portfolios to authenticated;
grant select, update, delete on table public.portfolio_items to authenticated;
grant select, insert, delete on table public.portfolio_collaborators to authenticated;
grant select, insert, delete on table public.portfolio_follows to authenticated;
grant select, insert, update on table public.portfolio_flags to authenticated;
grant select on table public.passport_stamps to authenticated;
grant select on table public.passport_progress_events to authenticated;

grant all on table public.checklists to service_role;
grant all on table public.checklist_items to service_role;
grant all on table public.portfolios to service_role;
grant all on table public.portfolio_items to service_role;
grant all on table public.portfolio_collaborators to service_role;
grant all on table public.portfolio_follows to service_role;
grant all on table public.portfolio_flags to service_role;
grant all on table public.passport_stamps to service_role;
grant all on table public.passport_progress_events to service_role;

revoke all on function public.record_passport_progress(text, text, text) from public, anon, authenticated;
revoke all on function public.assert_portfolio_expected_updated_at(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.enforce_portfolio_creation_rate_limit() from public, anon, authenticated;
revoke all on function public.enforce_portfolio_flag_rate_limit() from public, anon, authenticated;
revoke all on function public.add_portfolio_item_with_passport(uuid, text, text, text, integer, text, text, timestamptz) from public, anon;
revoke all on function public.update_portfolio_item_with_version(uuid, integer, text, text, timestamptz) from public, anon;
revoke all on function public.delete_portfolio_item_with_version(uuid, timestamptz) from public, anon;
revoke all on function public.publish_portfolio_with_passport(uuid, timestamptz) from public, anon;
revoke all on function public.reorder_checklist_items(uuid, uuid[]) from public, anon;
revoke all on function public.reorder_portfolio_items(uuid, uuid[], timestamptz) from public, anon;
revoke all on function public.search_portfolios(text, text, text) from public, anon;
grant execute on function public.add_portfolio_item_with_passport(uuid, text, text, text, integer, text, text, timestamptz) to authenticated, service_role;
grant execute on function public.update_portfolio_item_with_version(uuid, integer, text, text, timestamptz) to authenticated, service_role;
grant execute on function public.delete_portfolio_item_with_version(uuid, timestamptz) to authenticated, service_role;
grant execute on function public.publish_portfolio_with_passport(uuid, timestamptz) to authenticated, service_role;
grant execute on function public.reorder_checklist_items(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.reorder_portfolio_items(uuid, uuid[], timestamptz) to authenticated, service_role;
grant execute on function public.search_portfolios(text, text, text) to authenticated, service_role;
