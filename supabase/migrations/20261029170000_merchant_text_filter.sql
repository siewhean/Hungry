-- smoke: supabase/smoke/merchant_text_filter.sql
-- Merchant Centre round-four phase 4 (MERCH-R4-34).
--
-- The dish name, description and taste tags a merchant types, and the stall name and
-- description, are shown to every diner, but only review text went through the blocked-word
-- check (20261021163000). A BEFORE INSERT / UPDATE trigger on public.dishes and
-- public.merchant_outlets now refuses a blocked term (whole word, case-insensitive) in those
-- fields, using the same app_private.review_blocked_terms list ops already maintain with plain
-- SQL. Unlike reviews, links and phone numbers are fine here: a stall may list its website and
-- number in its description.
--
-- Only app users (anon / authenticated) are checked; the service role, migrations, workers and
-- ops edits are not.
-- Rollback: supabase/rollbacks/20261029170000_merchant_text_filter.down.sql.

create or replace function app_private.enforce_merchant_text_filter()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_text text;
begin
  if current_user not in ('authenticated', 'anon') or public.app_is_current_user_ops_admin() then
    return new;
  end if;

  if tg_table_name = 'dishes' then
    v_text := concat_ws(' ', new.name, new.description, array_to_string(new.taste_tags, ' '));
  else
    v_text := concat_ws(' ', new.name, new.description);
  end if;

  if app_private.review_text_violation(v_text) is not distinct from 'blocked_term' then
    raise exception 'This text contains words we don''t allow. Please edit it and try again.'
      using errcode = '23514', hint = 'merchant_text_blocked_term';
  end if;

  return new;
end;
$$;

revoke all on function app_private.enforce_merchant_text_filter() from public, anon, authenticated;

drop trigger if exists trg_enforce_merchant_text_filter on public.dishes;
create trigger trg_enforce_merchant_text_filter
before insert or update of name, description, taste_tags on public.dishes
for each row
execute function app_private.enforce_merchant_text_filter();

drop trigger if exists trg_enforce_merchant_text_filter on public.merchant_outlets;
create trigger trg_enforce_merchant_text_filter
before insert or update of name, description on public.merchant_outlets
for each row
execute function app_private.enforce_merchant_text_filter();

notify pgrst, 'reload schema';
