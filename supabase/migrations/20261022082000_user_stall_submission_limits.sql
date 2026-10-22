-- Profile medium M13: size caps and a daily limit on stall submissions.
--
-- submit_user_stall_submission is SECURITY INVOKER and authenticated users have
-- their own insert policy and column grants on user_stall_submissions, so a
-- check inside the RPC can be skipped by inserting directly. The limits live in
-- a BEFORE INSERT trigger instead, which both paths go through:
--   * text fields: name 120, building 120, area 60, address 200, unit 20,
--     floor 20, postal code 10, hours 500, source link 500, notes 1000;
--   * menu items at most 50, delivery links at most 10, gallery photos at most 6
--     (the app caps photos at 6), and no jsonb field over 20000 characters;
--   * at most 10 submissions per user in any rolling 24 hours.
-- The trigger function is SECURITY DEFINER so the daily count does not depend on
-- the caller's row access. It only runs on insert: existing rows are untouched,
-- and ops can still edit a row's status or notes with service_role.

create schema if not exists app_private;

create or replace function app_private.enforce_user_stall_submission_limits()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recent integer;
begin
  if char_length(coalesce(new.stall_name, '')) > 120
    or char_length(coalesce(new.building_name, '')) > 120
    or char_length(coalesce(new.area, '')) > 60
    or char_length(coalesce(new.address, '')) > 200
    or char_length(coalesce(new.unit_number, '')) > 20
    or char_length(coalesce(new.floor, '')) > 20
    or char_length(coalesce(new.postal_code, '')) > 10
    or char_length(coalesce(new.operating_hours, '')) > 500
    or char_length(coalesce(new.source_url, '')) > 500
    or char_length(coalesce(new.notes, '')) > 1000
  then
    raise exception 'A stall submission field is too long.' using errcode = '23514';
  end if;

  if jsonb_array_length(new.menu_items) > 50
    or jsonb_array_length(new.delivery_links) > 10
    or jsonb_array_length(new.gallery_images) > 6
    or char_length(new.menu_items::text) > 20000
    or char_length(new.delivery_links::text) > 20000
    or char_length(new.gallery_images::text) > 20000
  then
    raise exception 'A stall submission has too many items.' using errcode = '23514';
  end if;

  select count(*)
  into v_recent
  from public.user_stall_submissions s
  where s.user_id = new.user_id
    and s.created_at > now() - interval '24 hours';

  if v_recent >= 10 then
    raise exception 'You have reached the daily limit for stall submissions. Try again tomorrow.'
      using errcode = '54000';
  end if;

  return new;
end;
$$;

revoke all on function app_private.enforce_user_stall_submission_limits()
  from public, anon, authenticated;

drop trigger if exists trg_user_stall_submissions_limits on public.user_stall_submissions;
create trigger trg_user_stall_submissions_limits
  before insert on public.user_stall_submissions
  for each row execute function app_private.enforce_user_stall_submission_limits();
