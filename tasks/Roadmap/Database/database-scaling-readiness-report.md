# Database Scaling Readiness Report

Date: 2026-06-07
Scope: static repo audit, no live production mutation

## Canonical Data Rule

Supabase is the source of truth for shared, synced, cross-user, merchant, and safety-sensitive data. Client stores may cache or optimistically mirror data, but failed writes must roll back or surface an error.

## Covered Areas

| Area | Evidence |
| --- | --- |
| Core schema and RLS | `supabase/migrations/0002_core_schema.sql`, `0003_rls_policies.sql` |
| Mobile storage and media policy | `0016_mobile_storage_security.sql`, `0025_post_media_visible_storage_policy.sql`, `20260607090000_security_audit_remediation.sql` |
| Discovery/search/detail reads | `0029_server_side_discovery_reads.sql`, `0030_home_social_feed_reads.sql`, `0031_location_directory_reads.sql`, `20260606120000_database_excel_integration_foundation.sql` |
| Social safety/feed | `0032_social_governance_feed_foundation.sql`, `0033_social_governance_feed_foundation_fixes.sql`, `0034_post_report_write_integrity.sql` |
| Merchant organization and isolation | `0035_merchant_organization_foundation.sql`, `0039_merchant_portal_readiness.sql` |
| Merchant analytics | `20260525120301_merchant_analytics_foundation.sql` |
| Website console/admin linkage | `20260531144116_website_database_linkage.sql`, `20260601090000_website_console_admin_roles.sql` |

## Static Smoke Coverage

- `scripts/smoke_search_queries.mjs`
- `scripts/smoke_location_queries.mjs`
- `scripts/smoke_rls.mjs`
- `scripts/supabase-full-audit-v1-smoke.mjs`
- `supabase/smoke/server_side_discovery_reads.sql`
- `supabase/smoke/home_social_feed_reads.sql`
- `supabase/smoke/location_directory_reads.sql`
- `supabase/smoke/merchant_organization_foundation.sql`
- `supabase/smoke/merchant_analytics_foundation.sql`
- `supabase/smoke/website_console_admins.sql`

## Scaling Requirements

- Read RPCs must be bounded with explicit `limit` and cursor or location parameters where applicable.
- Hot list pages must avoid unbounded client-side scans in production Supabase mode.
- RLS policies must deny cross-account and cross-outlet mutation by default.
- Merchant/admin mutations must be backed by server-side auth/RBAC and audit evidence.
- New indexes are allowed only when a concrete query or Advisor gap is identified.

## Current Blockers

- Live Advisor evidence is external and requires approved Supabase credentials.
- Live RLS smoke against staging is external and must use approved test accounts.
- No additive queue/table migration was created in this pass because no exact queue schema gap was proven by static audit.
