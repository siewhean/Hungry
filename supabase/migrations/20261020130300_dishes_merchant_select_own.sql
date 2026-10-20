-- Let a merchant read the dishes of a venue they manage, drafts included.
--
-- 20260527145534 split dishes_write_merchant_owner_or_manager (FOR ALL) into
-- insert/update/delete policies, so merchants lost their SELECT policy and only
-- public_select_dishes (displayable rows) remained. Verified saves still worked
-- because the write guard approves the row, but an unverified merchant's draft
-- (20261020130100) is not displayable: merchant_save_dish's INSERT ... RETURNING
-- failed RLS, and later UPDATE/DELETE of the draft could not see the row.
-- Diners are unaffected: drafts stay out of public_select_dishes and the raw catalog.

drop policy if exists "dishes_select_merchant_owner_or_manager" on public.dishes;
create policy "dishes_select_merchant_owner_or_manager"
on public.dishes for select to authenticated
using (public.merchant_can_manage_venue(venue_id));
