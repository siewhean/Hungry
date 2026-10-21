-- merchant-L15: any signed-in user could insert their own merchant_accounts row (and then
-- outlets and roles under it). Merchant accounts are created from an ops-approved claim by the
-- service role, so the self-insert policy goes away. Select/update policies are unchanged.

drop policy if exists "merchant_accounts_insert_own" on public.merchant_accounts;
