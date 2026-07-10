# Admin Dashboard Scaling QA Report

Date: 2026-06-07

## Production Rule

Admin and Hungry Console operations must be server-side guarded. Client-side route hiding is not sufficient.

## Required Controls

- Admin session validation on every API route.
- Role lookup from Supabase admin/console tables.
- CSRF or bearer-token protection for mutations.
- Pagination for list endpoints.
- Redaction of secrets, tokens, private contact details, and internal notes where not required.
- Audit logs for verification, merchant status, and data-changing operations.

## Repo-Local Evidence

- `marketing/website/web-v2/src/app/api/console/_auth.ts` centralizes console auth checks.
- Website console admin roles migration exists in `supabase/migrations/20260601090000_website_console_admin_roles.sql`.
- Website linkage migration exists in `supabase/migrations/20260531144116_website_database_linkage.sql`.
- Security/static tests cover sanitizer behavior and public website route exposure.

## QA Matrix

| Area | Checks |
| --- | --- |
| Access | anon denied, non-admin denied, admin allowed |
| Merchant applications | paginated list, detail view, status update, audit record |
| Verification | status transition, document visibility, no stale client-only state |
| Analytics | bounded query, safe aggregation, no PII leak |
| Incident use | revoke access, export evidence, preserve audit history |

## Remaining Blockers

- Staging console smoke with real admin/non-admin accounts.
- Audit-log completeness proof.
- Data retention and PII redaction sign-off.
