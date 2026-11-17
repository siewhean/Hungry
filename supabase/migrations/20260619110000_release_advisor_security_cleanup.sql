-- Public-launch release hardening for Supabase Security Advisor findings.
-- Additive only: fixes mutable search_path warnings and removes app-role
-- execution of SECURITY DEFINER functions where RLS can safely own access.

begin;

-- Pure catalog helper functions must use a fixed search_path.
alter function public.catalog_url_is_delivery_app(text)
  set search_path = public, pg_catalog;

alter function public.catalog_display_image_url(text, boolean, text, text)
  set search_path = public, pg_catalog;

alter function public.catalog_menu_is_displayable(boolean, text, text)
  set search_path = public, pg_catalog;

-- Customer promotion reads are public only for active/live rows. Move the RPC
-- to SECURITY INVOKER and back it with narrow RLS + column grants.
drop policy if exists "merchant_outlets_public_live_select" on public.merchant_outlets;
create policy "merchant_outlets_public_live_select"
on public.merchant_outlets for select to anon, authenticated
using (is_live = true);

grant select (id, venue_id, is_live)
on table public.merchant_outlets
to anon, authenticated;

drop policy if exists "merchant_promotions_public_active_select" on public.merchant_promotions;
create policy "merchant_promotions_public_active_select"
on public.merchant_promotions for select to anon, authenticated
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

grant select (
  id,
  outlet_id,
  title,
  description,
  target_dish_id,
  promotion_item_type,
  start_date,
  end_date,
  original_price,
  promotional_price,
  final_price,
  discount_percentage,
  is_available,
  target_audience,
  status,
  created_at
)
on table public.merchant_promotions
to anon, authenticated;

alter function public.list_customer_active_promotions(text, text)
  security invoker;

alter function public.list_customer_active_promotions(text, text)
  set search_path = public, pg_catalog;

-- Activity insert trigger functions still need definer rights when fired by
-- table triggers, but clients should not be able to execute them directly.
alter function public.trg_activity_on_post_like()
  set search_path = public, pg_catalog;
alter function public.trg_activity_on_post_comment()
  set search_path = public, pg_catalog;
alter function public.trg_activity_on_follow()
  set search_path = public, pg_catalog;

revoke execute on function public.trg_activity_on_post_like()
  from public, anon, authenticated;
revoke execute on function public.trg_activity_on_post_comment()
  from public, anon, authenticated;
revoke execute on function public.trg_activity_on_follow()
  from public, anon, authenticated;

-- mark_activity_read only updates the caller's own rows through the existing
-- activity_events_update_own RLS policy, so it can be an invoker function.
alter function public.mark_activity_read(uuid)
  security invoker;

alter function public.mark_activity_read(uuid)
  set search_path = public, pg_catalog;

-- User stall submissions should be RLS-bound. Keep the RPC API shape for app
-- compatibility, but make every known overload execute as the caller.
drop policy if exists "user_stall_submissions_insert_own_pending"
on public.user_stall_submissions;
create policy "user_stall_submissions_insert_own_pending"
on public.user_stall_submissions for insert to authenticated
with check (
  auth.uid() = user_id
  and status = 'pending'
  and ops_notes is null
);

grant insert (
  user_id,
  stall_name,
  image_url,
  image_storage_bucket,
  image_storage_path,
  image_mime_type,
  gallery_images,
  source_url,
  building_name,
  area,
  address,
  postal_code,
  unit_number,
  floor,
  operating_hours,
  menu_items,
  delivery_links,
  notes
)
on table public.user_stall_submissions
to authenticated;

do $$
begin
  if to_regprocedure('public.submit_user_stall_submission(text,text,text,text,text,text,text,text,text,text,text,text,jsonb,jsonb,text)') is not null then
    alter function public.submit_user_stall_submission(
      text, text, text, text, text, text, text, text, text, text, text, text, jsonb, jsonb, text
    ) security invoker;
    alter function public.submit_user_stall_submission(
      text, text, text, text, text, text, text, text, text, text, text, text, jsonb, jsonb, text
    ) set search_path = public, pg_catalog;
  end if;

  if to_regprocedure('public.submit_user_stall_submission(text,text,text,text,text,text,text,text,text,text,text,text,text,jsonb,jsonb,text)') is not null then
    alter function public.submit_user_stall_submission(
      text, text, text, text, text, text, text, text, text, text, text, text, text, jsonb, jsonb, text
    ) security invoker;
    alter function public.submit_user_stall_submission(
      text, text, text, text, text, text, text, text, text, text, text, text, text, jsonb, jsonb, text
    ) set search_path = public, pg_catalog;
  end if;

  if to_regprocedure('public.submit_user_stall_submission(text,text,text,text,text,jsonb,text,text,text,text,text,text,text,text,jsonb,jsonb,text)') is not null then
    alter function public.submit_user_stall_submission(
      text, text, text, text, text, jsonb, text, text, text, text, text, text, text, text, jsonb, jsonb, text
    ) security invoker;
    alter function public.submit_user_stall_submission(
      text, text, text, text, text, jsonb, text, text, text, text, text, text, text, text, jsonb, jsonb, text
    ) set search_path = public, pg_catalog;
  end if;
end $$;

commit;
