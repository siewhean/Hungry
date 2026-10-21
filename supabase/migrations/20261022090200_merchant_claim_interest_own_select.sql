-- merchant-M1: a signed-in user can read their own stall claims, so the stall page can show
-- Submitted / In review / Approved. The table stays closed to everyone else; writes still go
-- through submit_merchant_claim_interest.

alter table public.merchant_claim_interests enable row level security;

revoke all on public.merchant_claim_interests from anon, authenticated;
grant select on public.merchant_claim_interests to authenticated;

drop policy if exists merchant_claim_interests_select_own on public.merchant_claim_interests;
create policy merchant_claim_interests_select_own
on public.merchant_claim_interests for select
to authenticated
using (claimed_by = (select auth.uid()));
