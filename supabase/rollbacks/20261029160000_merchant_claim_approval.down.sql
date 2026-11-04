-- Undo 20261029160000_merchant_claim_approval: claims go back to being approved by hand in SQL.
-- Merchant accounts, owner roles and outlets that approvals already created stay: they belong to
-- real merchants, and removing them would lock those merchants out. Claims already marked
-- 'converted' stay converted.

drop function if exists public.approve_merchant_claim(uuid);
drop function if exists app_private.approve_merchant_claim(uuid);

notify pgrst, 'reload schema';
