-- Merchant Centre RLS hardening.
-- - Limit merchant review updates to reply-only fields.
-- - Restrict notification preference writes to owner/manager roles.
-- - Restrict customer interaction reports to merchants linked to the review venue.

create or replace function merchant_can_manage_venue(p_venue_id text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from merchant_outlets mo
    left join merchant_accounts ma on ma.id = mo.merchant_account_id
    left join merchant_roles mr on mr.merchant_account_id = mo.merchant_account_id
    where mo.venue_id = p_venue_id
      and (
        ma.user_id = auth.uid()
        or (mr.user_id = auth.uid() and mr.role in ('owner', 'manager'))
      )
  );
$$;

create or replace function enforce_merchant_review_reply_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  -- Review authors may update their own review through the existing own-row policy.
  if old.user_id = auth.uid() then
    if new.user_id is distinct from old.user_id
      or new.created_at is distinct from old.created_at then
      raise exception 'review identity fields are immutable' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Merchants may only set or update their public reply fields.
  if merchant_can_manage_venue(old.venue_id) then
    if new.id is distinct from old.id
      or new.user_id is distinct from old.user_id
      or new.dish_id is distinct from old.dish_id
      or new.venue_id is distinct from old.venue_id
      or new.author_name is distinct from old.author_name
      or new.rating is distinct from old.rating
      or new.text is distinct from old.text
      or new.tags is distinct from old.tags
      or new.would_recommend is distinct from old.would_recommend
      or new.created_at is distinct from old.created_at then
      raise exception 'merchant review updates are limited to reply fields' using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'not authorized to update review' using errcode = '42501';
end;
$$;

drop trigger if exists trg_enforce_merchant_review_reply_update on reviews;
create trigger trg_enforce_merchant_review_reply_update
before update on reviews
for each row
execute function enforce_merchant_review_reply_update();

drop policy if exists "interaction_reports_insert_authenticated" on customer_interaction_reports;
drop policy if exists "interaction_reports_insert_merchant_owner_or_manager" on customer_interaction_reports;
create policy "interaction_reports_insert_merchant_owner_or_manager"
on customer_interaction_reports for insert to authenticated
with check (
  auth.uid() = reported_by
  and exists (
    select 1
    from reviews r
    where r.id = customer_interaction_reports.interaction_id
      and merchant_can_manage_venue(r.venue_id)
  )
);

drop policy if exists "interaction_reports_select_merchant_owner_or_manager" on customer_interaction_reports;
create policy "interaction_reports_select_merchant_owner_or_manager"
on customer_interaction_reports for select to authenticated
using (
  exists (
    select 1
    from reviews r
    where r.id = customer_interaction_reports.interaction_id
      and merchant_can_manage_venue(r.venue_id)
  )
);

drop policy if exists "notification_prefs_member" on merchant_notification_preferences;
drop policy if exists "notification_prefs_select_member" on merchant_notification_preferences;
create policy "notification_prefs_select_member"
on merchant_notification_preferences for select to authenticated
using (
  exists (
    select 1
    from merchant_accounts ma
    left join merchant_roles mr on mr.merchant_account_id = ma.id
    where ma.id = merchant_notification_preferences.merchant_account_id
      and (ma.user_id = auth.uid() or mr.user_id = auth.uid())
  )
);

drop policy if exists "notification_prefs_insert_owner_or_manager" on merchant_notification_preferences;
create policy "notification_prefs_insert_owner_or_manager"
on merchant_notification_preferences for insert to authenticated
with check (
  exists (
    select 1
    from merchant_accounts ma
    left join merchant_roles mr on mr.merchant_account_id = ma.id
    where ma.id = merchant_notification_preferences.merchant_account_id
      and (
        ma.user_id = auth.uid()
        or (mr.user_id = auth.uid() and mr.role in ('owner', 'manager'))
      )
  )
);

drop policy if exists "notification_prefs_update_owner_or_manager" on merchant_notification_preferences;
create policy "notification_prefs_update_owner_or_manager"
on merchant_notification_preferences for update to authenticated
using (
  exists (
    select 1
    from merchant_accounts ma
    left join merchant_roles mr on mr.merchant_account_id = ma.id
    where ma.id = merchant_notification_preferences.merchant_account_id
      and (
        ma.user_id = auth.uid()
        or (mr.user_id = auth.uid() and mr.role in ('owner', 'manager'))
      )
  )
)
with check (
  exists (
    select 1
    from merchant_accounts ma
    left join merchant_roles mr on mr.merchant_account_id = ma.id
    where ma.id = merchant_notification_preferences.merchant_account_id
      and (
        ma.user_id = auth.uid()
        or (mr.user_id = auth.uid() and mr.role in ('owner', 'manager'))
      )
  )
);

drop policy if exists "notification_prefs_delete_owner_or_manager" on merchant_notification_preferences;
create policy "notification_prefs_delete_owner_or_manager"
on merchant_notification_preferences for delete to authenticated
using (
  exists (
    select 1
    from merchant_accounts ma
    left join merchant_roles mr on mr.merchant_account_id = ma.id
    where ma.id = merchant_notification_preferences.merchant_account_id
      and (
        ma.user_id = auth.uid()
        or (mr.user_id = auth.uid() and mr.role in ('owner', 'manager'))
      )
  )
);
