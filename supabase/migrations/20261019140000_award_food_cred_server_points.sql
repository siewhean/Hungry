-- award_food_cred decides the amount on the server.
--
-- The body (app_private.award_food_cred, moved there by 20260522142004) used
-- coalesce(p_points, default), and signed-in users can call the public
-- wrapper directly, so any client could mint any amount of Food Cred. The
-- daily cap only limited how many awards were made, not how large they were.
--
-- 1. p_points is honoured only for service_role callers. Everyone else gets
--    the action's default amount from food_cred_default_points.
-- 2. mission_completed takes its reward from weekly_missions, and only when
--    the caller has completed that mission (user_mission_progress), once per
--    mission. increment_mission_progress keeps calling the public wrapper with
--    the reward value; the body now reads the same value itself.
-- 3. Per-entity daily dedupe: a second award for the same action and related
--    entity on the same Singapore day earns 0 (for example toggling a stall's
--    "tried" mark off and on).
--
-- The body stays SECURITY DEFINER in app_private; the public SECURITY INVOKER
-- wrapper and its grants are unchanged.

create schema if not exists app_private;
grant usage on schema app_private to anon, authenticated, service_role;

create or replace function app_private.award_food_cred(
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
  normalized_entity_id text := nullif(trim(coalesce(p_related_entity_id, '')), '');
  resolved_points integer;
  cap integer;
  today_count integer;
  next_total integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required to award Food Cred.' using errcode = '42501';
  end if;

  if normalized_action = 'mission_completed' then
    select case when wm.reward_type = 'food_cred' then wm.reward_value else 0 end
    into resolved_points
    from weekly_missions wm
    join user_mission_progress ump
      on ump.mission_id = wm.id
     and ump.user_id = current_user_id
     and ump.completed_at is not null
    where wm.id = normalized_entity_id;

    if exists (
      select 1
      from food_cred_events fce
      where fce.user_id = current_user_id
        and fce.source_action = 'mission_completed'
        and fce.related_entity_id = normalized_entity_id
        and fce.points > 0
    ) then
      resolved_points := 0;
    end if;
  elsif coalesce(auth.role(), '') = 'service_role' and p_points is not null then
    resolved_points := p_points;
  else
    resolved_points := public.food_cred_default_points(normalized_action);
  end if;

  resolved_points := coalesce(resolved_points, 0);
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

  if normalized_entity_id is not null and exists (
    select 1
    from food_cred_events fce
    where fce.user_id = current_user_id
      and fce.source_action = normalized_action
      and fce.related_entity_id = normalized_entity_id
      and fce.points > 0
      and (fce.created_at at time zone 'Asia/Singapore')::date =
        (now() at time zone 'Asia/Singapore')::date
  ) then
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
    normalized_entity_id,
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

revoke all on function app_private.award_food_cred(text, text, text, integer)
  from public, anon;
grant execute on function app_private.award_food_cred(text, text, text, integer)
  to authenticated, service_role;

comment on function app_private.award_food_cred(text, text, text, integer) is
  'Food Cred award body: amounts come from the server (p_points only for service_role), missions pay their own reward once after completion, and one award per action and entity per day.';
