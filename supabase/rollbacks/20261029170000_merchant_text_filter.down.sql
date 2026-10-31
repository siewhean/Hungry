-- Undo 20261029170000_merchant_text_filter: dish and stall text is no longer checked against the
-- blocked-word list (review text still is).

drop trigger if exists trg_enforce_merchant_text_filter on public.dishes;
drop trigger if exists trg_enforce_merchant_text_filter on public.merchant_outlets;
drop function if exists app_private.enforce_merchant_text_filter();

notify pgrst, 'reload schema';
