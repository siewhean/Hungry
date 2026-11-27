-- smoke: supabase/smoke/set_dish_tried.sql
-- A reviewed dish can be un-ticked from Tried. The review stays; only the Tried mark
-- (user_profiles.reviewed_dish_ids) goes, so the "dishes tried" achievement count drops by one.
-- One statement, so two quick taps or two devices never overwrite each other.
set local lock_timeout = '2s';

create or replace function public.set_dish_tried(p_dish_id text, p_tried boolean)
returns text[]
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_dish_id text := nullif(btrim(coalesce(p_dish_id, '')), '');
  v_ids text[];
begin
  if v_user_id is null then
    raise exception 'Sign in to mark dishes as tried.' using errcode = '42501';
  end if;
  if v_dish_id is null or char_length(v_dish_id) > 200 then
    raise exception 'A dish id is required.' using errcode = '22023';
  end if;

  update user_profiles up
  set reviewed_dish_ids = case
    when coalesce(p_tried, true) then
      case
        when v_dish_id = any(up.reviewed_dish_ids) then up.reviewed_dish_ids
        else array_append(up.reviewed_dish_ids, v_dish_id)
      end
    else array_remove(up.reviewed_dish_ids, v_dish_id)
  end
  where up.id = v_user_id
  returning up.reviewed_dish_ids into v_ids;

  if not found then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;

  return v_ids;
end;
$$;

comment on function public.set_dish_tried(text, boolean) is
  'Adds or removes a dish in the caller''s Tried list (user_profiles.reviewed_dish_ids); reviews are untouched.';
