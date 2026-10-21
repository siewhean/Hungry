-- H29: the dish "Tried" mark is saved on the server.
--
-- The Tried button only changed the device's profile store, so marks were lost
-- on reinstall or a new phone. set_dish_tried adds or removes one dish in the
-- caller's user_profiles.reviewed_dish_ids (the app's "Tried" list) in one
-- statement, so two quick taps or two devices never overwrite each other.
-- A dish the caller has reviewed stays in the list: un-ticking Tried never
-- removes a real review from their history. Returns the updated list.
--
-- SECURITY INVOKER: user_profiles RLS (own row) and reviews RLS apply.
-- New function: public.set_dish_tried(text, boolean).

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
  v_has_review boolean;
  v_ids text[];
begin
  if v_user_id is null then
    raise exception 'Sign in to mark dishes as tried.' using errcode = '42501';
  end if;
  if v_dish_id is null or char_length(v_dish_id) > 200 then
    raise exception 'A dish id is required.' using errcode = '22023';
  end if;

  select exists (
    select 1 from reviews r where r.user_id = v_user_id and r.dish_id = v_dish_id
  ) into v_has_review;

  update user_profiles up
  set reviewed_dish_ids = case
    when coalesce(p_tried, true) or v_has_review then
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

revoke all on function public.set_dish_tried(text, boolean) from public, anon;
grant execute on function public.set_dish_tried(text, boolean) to authenticated, service_role;

comment on function public.set_dish_tried(text, boolean) is
  'Adds or removes a dish in the caller''s Tried list (user_profiles.reviewed_dish_ids); a reviewed dish stays.';
