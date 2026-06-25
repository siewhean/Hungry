-- RLS Performance Advisor cleanup.
-- Scope: remove per-row auth.uid() initplan warnings and collapse duplicate
-- authenticated SELECT policies while preserving existing public/member access.

begin;

drop policy if exists "activity_events_select_own" on public.activity_events;
create policy "activity_events_select_own"
on public.activity_events for select to authenticated
using (recipient_id = (select auth.uid()));

drop policy if exists "activity_events_update_own" on public.activity_events;
create policy "activity_events_update_own"
on public.activity_events for update to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own"
on public.user_settings for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own"
on public.user_settings for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own"
on public.user_settings for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "user_settings_delete_own" on public.user_settings;
create policy "user_settings_delete_own"
on public.user_settings for delete to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "review_photos_insert_own_review" on public.review_photos;
create policy "review_photos_insert_own_review"
on public.review_photos for insert to authenticated
with check (
  exists (
    select 1
    from public.reviews r
    where r.id = review_photos.review_id
      and r.user_id = (select auth.uid())
  )
  and coalesce(storage_bucket, 'review-media') = 'review-media'
  and coalesce(storage_path, url) like (select auth.uid())::text || '/%'
);

drop policy if exists "review_photos_update_own_review" on public.review_photos;
create policy "review_photos_update_own_review"
on public.review_photos for update to authenticated
using (
  exists (
    select 1
    from public.reviews r
    where r.id = review_photos.review_id
      and r.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.reviews r
    where r.id = review_photos.review_id
      and r.user_id = (select auth.uid())
  )
  and coalesce(storage_bucket, 'review-media') = 'review-media'
  and coalesce(storage_path, url) like (select auth.uid())::text || '/%'
);

drop policy if exists "review_photos_delete_own_review" on public.review_photos;
create policy "review_photos_delete_own_review"
on public.review_photos for delete to authenticated
using (
  exists (
    select 1
    from public.reviews r
    where r.id = review_photos.review_id
      and r.user_id = (select auth.uid())
  )
);

drop policy if exists "user_stall_submissions_insert_own_pending"
on public.user_stall_submissions;
create policy "user_stall_submissions_insert_own_pending"
on public.user_stall_submissions for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'
);

drop policy if exists "merchant_outlets_public_live_select" on public.merchant_outlets;
drop policy if exists "merchant_outlets_select_member" on public.merchant_outlets;

create policy "merchant_outlets_anon_live_select"
on public.merchant_outlets for select to anon
using (is_live = true);

create policy "merchant_outlets_authenticated_select"
on public.merchant_outlets for select to authenticated
using (
  is_live = true
  or exists (
    select 1
    from public.merchant_accounts ma
    where ma.id = merchant_outlets.merchant_account_id
      and ma.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.merchant_roles mr
    where mr.merchant_account_id = merchant_outlets.merchant_account_id
      and mr.user_id = (select auth.uid())
  )
);

drop policy if exists "merchant_promotions_public_active_select" on public.merchant_promotions;
drop policy if exists "merchant_promotions_member_select" on public.merchant_promotions;

create policy "merchant_promotions_anon_active_select"
on public.merchant_promotions for select to anon
using (
  status = 'active'
  and coalesce(is_available, true) = true
  and now() >= start_date
  and now() <= end_date
  and exists (
    select 1
    from public.merchant_outlets mo
    where mo.id = merchant_promotions.outlet_id
      and mo.is_live = true
  )
);

create policy "merchant_promotions_authenticated_select"
on public.merchant_promotions for select to authenticated
using (
  (
    status = 'active'
    and coalesce(is_available, true) = true
    and now() >= start_date
    and now() <= end_date
    and exists (
      select 1
      from public.merchant_outlets mo
      where mo.id = merchant_promotions.outlet_id
        and mo.is_live = true
    )
  )
  or exists (
    select 1
    from public.merchant_outlets mo
    left join public.merchant_accounts ma on ma.id = mo.merchant_account_id
    left join public.merchant_roles mr on mr.merchant_account_id = mo.merchant_account_id
    where mo.id = merchant_promotions.outlet_id
      and (ma.user_id = (select auth.uid()) or mr.user_id = (select auth.uid()))
  )
);

commit;
