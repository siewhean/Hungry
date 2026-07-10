-- Full Audit V1 gamification persistence.
-- Adds Food Cred, stall interactions, weekly missions, and mission progress.

create table if not exists user_food_cred (
  user_id uuid primary key references user_profiles(id) on delete cascade,
  total_points integer not null default 0 check (total_points >= 0),
  level_index integer not null default 0 check (level_index >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists food_cred_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  source_action text not null check (source_action in (
    'review_created',
    'photo_uploaded',
    'stall_saved',
    'stall_marked_tried',
    'helpful_vote_received',
    'stall_info_corrected',
    'tag_added',
    'collection_created',
    'post_created',
    'mission_completed'
  )),
  points integer not null check (points >= 0),
  related_entity_id text,
  related_entity_type text check (
    related_entity_type is null
    or related_entity_type in ('stall', 'review', 'post', 'collection', 'mission')
  ),
  created_at timestamptz not null default now()
);

create index if not exists idx_food_cred_events_user_created
  on food_cred_events(user_id, created_at desc);
create index if not exists idx_food_cred_events_user_action_day
  on food_cred_events(user_id, source_action, ((created_at at time zone 'Asia/Singapore')::date));

create table if not exists user_stall_interactions (
  user_id uuid not null references user_profiles(id) on delete cascade,
  stall_id text not null references venues(id) on delete cascade,
  is_saved boolean not null default false,
  is_tried boolean not null default false,
  is_reviewed boolean not null default false,
  saved_at timestamptz,
  tried_at timestamptz,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, stall_id)
);

create index if not exists idx_user_stall_interactions_saved
  on user_stall_interactions(user_id, saved_at desc)
  where is_saved;
create index if not exists idx_user_stall_interactions_tried
  on user_stall_interactions(user_id, tried_at desc)
  where is_tried;

create table if not exists weekly_missions (
  id text primary key,
  title text not null,
  description text not null,
  mission_type text not null check (mission_type in (
    'save_stalls',
    'create_post',
    'write_review',
    'mark_tried',
    'add_to_collection',
    'helpful_vote'
  )),
  requirement_count integer not null check (requirement_count > 0),
  reward_type text not null check (reward_type in ('food_cred', 'passport_progress', 'badge')),
  reward_value integer not null default 0 check (reward_value >= 0),
  week_start date not null,
  week_end date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (week_end >= week_start)
);

create index if not exists idx_weekly_missions_active_week
  on weekly_missions(is_active, week_start desc, mission_type);

create table if not exists user_mission_progress (
  user_id uuid not null references user_profiles(id) on delete cascade,
  mission_id text not null references weekly_missions(id) on delete cascade,
  current_count integer not null default 0 check (current_count >= 0),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, mission_id)
);

create index if not exists idx_user_mission_progress_user_updated
  on user_mission_progress(user_id, updated_at desc);

alter table user_food_cred enable row level security;
alter table food_cred_events enable row level security;
alter table user_stall_interactions enable row level security;
alter table weekly_missions enable row level security;
alter table user_mission_progress enable row level security;

drop policy if exists "user_food_cred_select_own" on user_food_cred;
create policy "user_food_cred_select_own"
on user_food_cred for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "food_cred_events_select_own" on food_cred_events;
create policy "food_cred_events_select_own"
on food_cred_events for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_stall_interactions_select_own" on user_stall_interactions;
create policy "user_stall_interactions_select_own"
on user_stall_interactions for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "weekly_missions_select_active" on weekly_missions;
create policy "weekly_missions_select_active"
on weekly_missions for select to anon, authenticated
using (is_active);

drop policy if exists "user_mission_progress_select_own" on user_mission_progress;
create policy "user_mission_progress_select_own"
on user_mission_progress for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_food_cred_service_role_all" on user_food_cred;
create policy "user_food_cred_service_role_all"
on user_food_cred for all to service_role
using (true)
with check (true);

drop policy if exists "food_cred_events_service_role_all" on food_cred_events;
create policy "food_cred_events_service_role_all"
on food_cred_events for all to service_role
using (true)
with check (true);

drop policy if exists "user_stall_interactions_service_role_all" on user_stall_interactions;
create policy "user_stall_interactions_service_role_all"
on user_stall_interactions for all to service_role
using (true)
with check (true);

drop policy if exists "weekly_missions_service_role_all" on weekly_missions;
create policy "weekly_missions_service_role_all"
on weekly_missions for all to service_role
using (true)
with check (true);

drop policy if exists "user_mission_progress_service_role_all" on user_mission_progress;
create policy "user_mission_progress_service_role_all"
on user_mission_progress for all to service_role
using (true)
with check (true);

create or replace function public.food_cred_level_index(p_total_points integer)
returns integer
language sql
immutable
as $$
  select case
    when coalesce(p_total_points, 0) >= 3000 then 5
    when coalesce(p_total_points, 0) >= 1200 then 4
    when coalesce(p_total_points, 0) >= 500 then 3
    when coalesce(p_total_points, 0) >= 200 then 2
    when coalesce(p_total_points, 0) >= 50 then 1
    else 0
  end;
$$;

create or replace function public.food_cred_default_points(p_source_action text)
returns integer
language sql
immutable
as $$
  select case p_source_action
    when 'stall_saved' then 2
    when 'stall_marked_tried' then 5
    when 'review_created' then 15
    when 'photo_uploaded' then 5
    when 'post_created' then 10
    when 'helpful_vote_received' then 3
    when 'stall_info_corrected' then 10
    when 'tag_added' then 3
    when 'collection_created' then 10
    else 0
  end;
$$;

create or replace function public.food_cred_daily_cap(p_source_action text)
returns integer
language sql
immutable
as $$
  select case p_source_action
    when 'stall_saved' then 10
    when 'stall_marked_tried' then 5
    when 'review_created' then 5
    when 'photo_uploaded' then 10
    when 'post_created' then 3
    when 'helpful_vote_received' then 99
    when 'stall_info_corrected' then 3
    when 'tag_added' then 5
    when 'collection_created' then 2
    when 'mission_completed' then 4
    else 0
  end;
$$;

create or replace function public.award_food_cred(
  p_source_action text,
  p_related_entity_id text default null,
  p_related_entity_type text default null,
  p_points integer default null
)
returns table (
  total_points integer,
  level_index integer,
  points_awarded integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_action text := lower(nullif(trim(coalesce(p_source_action, '')), ''));
  resolved_points integer;
  cap integer;
  today_count integer;
  next_total integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required to award Food Cred.' using errcode = '42501';
  end if;

  resolved_points := coalesce(p_points, public.food_cred_default_points(normalized_action), 0);
  cap := public.food_cred_daily_cap(normalized_action);

  if resolved_points <= 0 or cap <= 0 then
    select ufc.total_points, ufc.level_index, 0
    into total_points, level_index, points_awarded
    from user_food_cred ufc
    where ufc.user_id = current_user_id;

    if total_points is null then
      total_points := 0;
      level_index := 0;
      points_awarded := 0;
    end if;

    return next;
    return;
  end if;

  select count(*)
  into today_count
  from food_cred_events fce
  where fce.user_id = current_user_id
    and fce.source_action = normalized_action
    and (fce.created_at at time zone 'Asia/Singapore')::date =
      (now() at time zone 'Asia/Singapore')::date;

  if today_count >= cap then
    resolved_points := 0;
  end if;

  insert into food_cred_events (
    user_id,
    source_action,
    points,
    related_entity_id,
    related_entity_type
  )
  values (
    current_user_id,
    normalized_action,
    resolved_points,
    nullif(trim(coalesce(p_related_entity_id, '')), ''),
    nullif(trim(coalesce(p_related_entity_type, '')), '')
  );

  insert into user_food_cred (user_id, total_points, level_index, updated_at)
  values (
    current_user_id,
    resolved_points,
    public.food_cred_level_index(resolved_points),
    now()
  )
  on conflict (user_id) do update
  set
    total_points = user_food_cred.total_points + excluded.total_points,
    level_index = public.food_cred_level_index(user_food_cred.total_points + excluded.total_points),
    updated_at = now()
  returning user_food_cred.total_points, user_food_cred.level_index
  into next_total, level_index;

  total_points := next_total;
  points_awarded := resolved_points;
  return next;
end;
$$;

create or replace function public.upsert_stall_interaction(
  p_stall_id text,
  p_is_saved boolean default null,
  p_is_tried boolean default null,
  p_is_reviewed boolean default null
)
returns table (
  user_id uuid,
  stall_id text,
  is_saved boolean,
  is_tried boolean,
  is_reviewed boolean,
  saved_at timestamptz,
  tried_at timestamptz,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required to update stall interactions.' using errcode = '42501';
  end if;

  if not exists (select 1 from venues v where v.id = p_stall_id) then
    raise exception 'Unknown stall id: %', p_stall_id;
  end if;

  insert into user_stall_interactions (
    user_id,
    stall_id,
    is_saved,
    is_tried,
    is_reviewed,
    saved_at,
    tried_at,
    reviewed_at,
    updated_at
  )
  values (
    current_user_id,
    p_stall_id,
    coalesce(p_is_saved, false),
    coalesce(p_is_tried, false),
    coalesce(p_is_reviewed, false),
    case when coalesce(p_is_saved, false) then now() else null end,
    case when coalesce(p_is_tried, false) then now() else null end,
    case when coalesce(p_is_reviewed, false) then now() else null end,
    now()
  )
  on conflict (user_id, stall_id) do update
  set
    is_saved = coalesce(p_is_saved, user_stall_interactions.is_saved),
    is_tried = coalesce(p_is_tried, user_stall_interactions.is_tried),
    is_reviewed = coalesce(p_is_reviewed, user_stall_interactions.is_reviewed),
    saved_at = case
      when p_is_saved is true and user_stall_interactions.saved_at is null then now()
      when p_is_saved is false then null
      else user_stall_interactions.saved_at
    end,
    tried_at = case
      when p_is_tried is true and user_stall_interactions.tried_at is null then now()
      when p_is_tried is false then null
      else user_stall_interactions.tried_at
    end,
    reviewed_at = case
      when p_is_reviewed is true and user_stall_interactions.reviewed_at is null then now()
      when p_is_reviewed is false then null
      else user_stall_interactions.reviewed_at
    end,
    updated_at = now()
  returning
    user_stall_interactions.user_id,
    user_stall_interactions.stall_id,
    user_stall_interactions.is_saved,
    user_stall_interactions.is_tried,
    user_stall_interactions.is_reviewed,
    user_stall_interactions.saved_at,
    user_stall_interactions.tried_at,
    user_stall_interactions.reviewed_at;
end;
$$;

create or replace function public.increment_mission_progress(
  p_mission_type text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  mission_row weekly_missions%rowtype;
  next_count integer;
  previous_completed_at timestamptz;
  next_completed_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'Authentication required to update mission progress.' using errcode = '42501';
  end if;

  for mission_row in
    select *
    from weekly_missions wm
    where wm.is_active
      and wm.mission_type = p_mission_type
      and current_date between wm.week_start and wm.week_end
  loop
    previous_completed_at := null;

    select ump.completed_at
    into previous_completed_at
    from user_mission_progress ump
    where ump.user_id = current_user_id
      and ump.mission_id = mission_row.id;

    insert into user_mission_progress (
      user_id,
      mission_id,
      current_count,
      completed_at,
      updated_at
    )
    values (
      current_user_id,
      mission_row.id,
      1,
      case when mission_row.requirement_count <= 1 then now() else null end,
      now()
    )
    on conflict (user_id, mission_id) do update
    set
      current_count = least(
        user_mission_progress.current_count + 1,
        mission_row.requirement_count
      ),
      completed_at = case
        when user_mission_progress.completed_at is not null
          then user_mission_progress.completed_at
        when user_mission_progress.current_count + 1 >= mission_row.requirement_count
          then now()
        else null
      end,
      updated_at = now()
    returning current_count, completed_at into next_count, next_completed_at;

    if previous_completed_at is null
      and next_completed_at is not null
      and next_count >= mission_row.requirement_count then
      perform public.award_food_cred(
        'mission_completed',
        mission_row.id,
        'mission',
        case when mission_row.reward_type = 'food_cred' then mission_row.reward_value else 0 end
      );
    end if;
  end loop;
end;
$$;

revoke execute on function public.award_food_cred(text, text, text, integer) from public, anon;
grant execute on function public.award_food_cred(text, text, text, integer)
to authenticated, service_role;

revoke execute on function public.upsert_stall_interaction(text, boolean, boolean, boolean)
from public, anon;
grant execute on function public.upsert_stall_interaction(text, boolean, boolean, boolean)
to authenticated, service_role;

revoke execute on function public.increment_mission_progress(text) from public, anon;
grant execute on function public.increment_mission_progress(text)
to authenticated, service_role;

insert into weekly_missions (
  id,
  title,
  description,
  mission_type,
  requirement_count,
  reward_type,
  reward_value,
  week_start,
  week_end,
  is_active
)
values
  (
    'mission-save-3-stalls',
    'Save 3 stalls',
    'Build a shortlist for your next meal.',
    'save_stalls',
    3,
    'food_cred',
    20,
    date_trunc('week', current_date)::date,
    (date_trunc('week', current_date)::date + 6),
    true
  ),
  (
    'mission-write-review',
    'Write a review',
    'Share one useful dish note for other diners.',
    'write_review',
    1,
    'food_cred',
    25,
    date_trunc('week', current_date)::date,
    (date_trunc('week', current_date)::date + 6),
    true
  ),
  (
    'mission-mark-tried',
    'Mark 2 stalls as tried',
    'Keep your passport progress accurate.',
    'mark_tried',
    2,
    'food_cred',
    20,
    date_trunc('week', current_date)::date,
    (date_trunc('week', current_date)::date + 6),
    true
  ),
  (
    'mission-post-photo',
    'Create a food post',
    'Add one photo or bite-sized update.',
    'create_post',
    1,
    'food_cred',
    15,
    date_trunc('week', current_date)::date,
    (date_trunc('week', current_date)::date + 6),
    true
  )
on conflict (id) do update
set
  title = excluded.title,
  description = excluded.description,
  mission_type = excluded.mission_type,
  requirement_count = excluded.requirement_count,
  reward_type = excluded.reward_type,
  reward_value = excluded.reward_value,
  week_start = excluded.week_start,
  week_end = excluded.week_end,
  is_active = excluded.is_active,
  updated_at = now();

comment on function public.award_food_cred(text, text, text, integer) is
  'Checked Food Cred event writer with action caps and materialized user total.';

comment on function public.upsert_stall_interaction(text, boolean, boolean, boolean) is
  'Checked per-user stall interaction writer for saved/tried/reviewed state.';

comment on function public.increment_mission_progress(text) is
  'Checked weekly mission progress incrementer that can award Food Cred on completion.';
