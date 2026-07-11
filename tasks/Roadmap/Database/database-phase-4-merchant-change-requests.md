# DB-P0-07 Merchant Change Requests

## Scope

Phase 4 second slice only: add an RPC-gated merchant change request queue for reviewed venue, outlet, profile, menu, hours, media, promotion, and ownership updates.

## Implemented

- `merchant_change_requests`
- `merchant_change_request_events`
- `0037_merchant_change_request_helper_grants.sql` corrective hardening so `merchant_org_owns_venue` is internal/service-role only.
- Queue indexes for organization/status/cursor, venue/status/cursor, requester cursor, target lookup, and event history.
- Security-definer helpers/RPCs:
  - `is_platform_operator`
  - `merchant_org_owns_venue`
  - `submit_merchant_change_request`
  - `list_merchant_change_requests`
  - `get_merchant_change_request_detail`
  - `cancel_merchant_change_request`
  - `review_merchant_change_request`
- RLS on both tables.
- Service-role management policies.
- Authenticated read access only through bounded member/platform policies.
- Merchant writes through RPCs only; no direct authenticated table writes.
- Internal helper RPCs are not exposed to app clients.

## Deliberately Deferred

- Applying approved requests into canonical `venues`, `dishes`, menu, or media tables.
- Menu versioning.
- Merchant media asset tables/storage processing.
- Background jobs.
- Analytics summaries.
- Partitioning.
- QR ordering, payments, refunds, payouts.

## Verification Plan

- Source contract: `src/lib/services/supabase/merchant-change-requests.test.ts`
- Linked smoke: `supabase/smoke/merchant_change_requests.sql`
- Standard gates:
  - `npm run typecheck`
  - `npm test`
  - `npm run lint`
  - `git diff --check`
  - `supabase db push --dry-run`
  - `supabase db push --yes`
  - `supabase db query --linked -f supabase/smoke/merchant_change_requests.sql`
  - `gitleaks protect --staged --redact`
