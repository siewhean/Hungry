-- Display names get a length limit and a reserved-name check, and display names
-- and bios go through the same text filter as reviews (round-two settings M10).
--
-- The display name is public (public_profiles, reviews, Lists, comments) and had
-- no limit, so a person could set a very long name or pose as the team ("Hungry",
-- "Hungry Team", "Admin"). The new public bio was unmoderated.
--
-- * Names longer than 40 characters are cut to 40 once here, then
--   user_profiles_display_name_length keeps them within 40.
-- * app_private.user_profiles_enforce_text_rules() runs BEFORE INSERT and
--   BEFORE UPDATE OF display_name, bio on user_profiles, for app users only
--   (anon / authenticated; trusted server code, migrations and workers are not
--   filtered, so the team can still hold the reserved names):
--     - an existing profile whose name or bio changes is REFUSED (23514 with a
--       hint) when the name is over 40 characters, is a reserved name, or the
--       name or bio carries a blocked term or more than one link or phone number
--       (app_private.review_text_violation, the review filter);
--     - a brand-new profile row is SANITISED instead (name cut to 40, a reserved
--       or blocked name or bio dropped to null), so sign-in with a provider name
--       such as "Admin" or a 60-character Google name never fails;
--     - an unchanged name or bio is never re-checked, so a legacy profile can
--       still save other fields.
-- Reserved names: hungry, admin, administrator, official, support, staff,
-- moderator, system, team, and hungry followed by team / official / support /
-- admin / staff / hq / mod / moderator / app / care / help (an optional number
-- may follow), compared after lower-casing, mapping 0 1 3 4 5 to o i e a s and
-- dropping spaces and symbols.
--
-- New: app_private.is_reserved_display_name(text),
-- app_private.user_profiles_enforce_text_rules() (trigger only, SECURITY INVOKER),
-- trigger trg_user_profiles_enforce_text_rules, constraint
-- user_profiles_display_name_length. Redefines no existing function.

create schema if not exists app_private;

create or replace function app_private.is_reserved_display_name(p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
           translate(lower(coalesce(p_name, '')), '01345', 'oieas'),
           '[^a-z0-9]', '', 'g'
         )
         ~ '^(hungry|admin|administrator|official|support|staff|moderator|system|team)[0-9]*$|^hungry(team|official|support|admin|staff|hq|mod|moderator|app|care|help)[0-9]*$';
$$;

revoke all on function app_private.is_reserved_display_name(text) from public;
grant execute on function app_private.is_reserved_display_name(text)
  to anon, authenticated, service_role;

-- Cut names that are already too long, then cap them.
update public.user_profiles
set display_name = left(btrim(display_name), 40)
where char_length(display_name) > 40;

alter table public.user_profiles
  drop constraint if exists user_profiles_display_name_length;
alter table public.user_profiles
  add constraint user_profiles_display_name_length
  check (display_name is null or char_length(display_name) <= 40);

-- SECURITY INVOKER so current_user is the caller; the term lookup inside
-- review_text_violation is the definer part.
create or replace function app_private.user_profiles_enforce_text_rules()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing boolean := false;
  v_old_name text;
  v_old_bio text;
  v_name text;
  v_name_changed boolean;
  v_bio_changed boolean;
begin
  -- Trusted server code (service role, migrations, workers) is not filtered.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_existing := true;
    v_old_name := old.display_name;
    v_old_bio := old.bio;
  else
    -- An upsert fires the INSERT trigger even when the row already exists.
    select true, up.display_name, up.bio
      into v_existing, v_old_name, v_old_bio
    from public.user_profiles up
    where up.id = new.id;
    v_existing := coalesce(v_existing, false);
  end if;

  v_name := nullif(btrim(new.display_name), '');
  v_name_changed := v_name is distinct from nullif(btrim(v_old_name), '');
  v_bio_changed := nullif(btrim(new.bio), '') is distinct from nullif(btrim(v_old_bio), '');

  if v_name_changed and v_name is not null then
    if not v_existing then
      -- First write of a brand-new profile: never block sign-in, just sanitise.
      v_name := left(v_name, 40);
      if app_private.is_reserved_display_name(v_name)
        or app_private.review_text_violation(v_name) is not null then
        v_name := null;
      end if;
      new.display_name := v_name;
    else
      if char_length(v_name) > 40 then
        raise exception 'Display names can be up to 40 characters.'
          using errcode = '23514', hint = 'display_name_too_long';
      end if;
      if app_private.is_reserved_display_name(v_name) then
        raise exception 'That display name is reserved. Please choose another.'
          using errcode = '23514', hint = 'display_name_reserved';
      end if;
      if app_private.review_text_violation(v_name) is not null then
        raise exception 'That display name contains words we don''t allow.'
          using errcode = '23514', hint = 'display_name_blocked_term';
      end if;
    end if;
  end if;

  if v_bio_changed and nullif(btrim(new.bio), '') is not null
    and app_private.review_text_violation(new.bio) is not null then
    if not v_existing then
      new.bio := null;
    else
      raise exception 'Your bio contains words or links we don''t allow. Please edit it and try again.'
        using errcode = '23514', hint = 'bio_text_not_allowed';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function app_private.user_profiles_enforce_text_rules() from public, anon, authenticated;

drop trigger if exists trg_user_profiles_enforce_text_rules on public.user_profiles;
create trigger trg_user_profiles_enforce_text_rules
  before insert or update of display_name, bio on public.user_profiles
  for each row
  execute function app_private.user_profiles_enforce_text_rules();
