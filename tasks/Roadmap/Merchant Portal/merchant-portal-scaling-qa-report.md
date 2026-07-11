# Merchant Portal Scaling QA Report

Date: 2026-06-07

## Production Posture

The mobile merchant centre is not production-enabled in MVP. Website merchant auth and console routes remain server-side protected and must not rely on client-only hiding.

## Scaling Requirements

- Merchant users can access only organizations/outlets they belong to.
- Owner/manager-sensitive actions require server-side RBAC.
- Cookie-backed web mutations require CSRF and same-origin checks.
- Menu/profile changes must propagate to consumer read models without stale cache traps.
- Merchant analytics must be paginated and bounded.
- Every mutation should create or preserve enough audit evidence for support review.

## Repo-Local Evidence

- Supabase migrations cover merchant organization, portal readiness, catalog guards, analytics, and website linkage.
- `marketing/website/web-v2/src/app/api/merchant/_session.ts` validates merchant session and CSRF.
- Source contracts cover merchant CSRF behavior.
- Merchant centre production exposure is gated through `FEATURE_FLAGS.merchantCentreEnabled`.

## QA Matrix

| Flow | Checks |
| --- | --- |
| Verification | pending/completed status, document upload, review state |
| Outlet switch | long names, isolation, no cross-outlet write |
| Menu | add/edit/toggle/search, consumer preview, image propagation |
| Reviews | unreplied filter, reply-only updates, low-rating notification path |
| Analytics | dashboard, dish views, weekly summary, empty states |
| Settings/team | owner-only add/remove, invite state, notification routing |

## Remaining Blockers

- Live staging RBAC smoke with owner/manager/member/non-member accounts.
- External email invitation provider proof.
- Merchant analytics load proof.
- Audit-log retention review.
