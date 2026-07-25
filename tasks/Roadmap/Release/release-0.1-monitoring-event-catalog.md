# Hungry Release 0.1 — Monitoring and Analytics Event Catalog

> Collect the minimum data needed to operate Release 0.1. Do not record passwords, tokens, verification codes, raw search strings, exact coordinates, private content or full user profiles.

## Common properties

Every approved event should carry only:

- `app_environment`: development, staging or production;
- `platform`: ios, android or web-test;
- `app_version`;
- `build_number`;
- `implementation_sha`;
- `eas_build_id` or `eas_update_id` when available;
- `catalog_source`: supabase, excel or none;
- `catalog_release_id` when applicable;
- `network_state`: online, offline or unknown;
- `duration_ms` where applicable;
- privacy-safe error kind/code.

Do not attach email, name, raw user ID, access token, exact latitude/longitude, raw query, image bytes or review/post content.

## Funnel events

| Event | Trigger | Required properties | Success gate |
|---|---|---|---|
| `auth_started` | User submits login/signup | method, flow | No credentials in payload |
| `auth_completed` | Valid session opens authenticated shell | method, new_or_returning | Fires once per completed flow |
| `auth_failed` | Auth request fails | error_kind, method | Sanitized classification |
| `catalog_load_started` | Released catalog request begins | operation, source_requested | No raw query |
| `catalog_load_completed` | Request returns | operation, result_count, source, release_id, duration_ms | Empty result distinct from failure |
| `catalog_load_failed` | Request fails | operation, error_kind, duration_ms | Unknown/authorization not hidden |
| `catalog_fallback_used` | Eligible online read switches to Excel | operation, online_error_kind, fallback_release_id | Valid restored auth required |
| `search_submitted` | Search is submitted | query_present, filter_count | No raw query |
| `search_no_results` | Successful query returns zero items | source, release_id, filter_count | No fallback substitution |
| `dish_detail_opened` | Dish detail renders | source, release_id, dish_id_hash | Stable pseudonymous entity token only |
| `stall_detail_opened` | Stall detail renders | source, release_id, venue_id_hash | Stable pseudonymous entity token only |
| `directions_opened` | Trusted maps URL is opened | venue_id_hash | Valid location required |
| `support_opened` | Support/report action is opened | source_screen | No report content |
| `account_deletion_started` | User confirms deletion request | none | No account details |
| `account_deletion_completed` | Backend confirms completion | duration_ms | Must reflect backend completion |
| `account_deletion_failed` | Deletion fails | error_kind | Clear user recovery path |

## Operational metrics

- startup success rate;
- crash-free sessions;
- auth success/failure rate;
- catalog request success by source and operation;
- fallback rate;
- legitimate no-results rate;
- detail-open rate;
- p50/p95 startup, catalog and detail latency;
- account-deletion success rate;
- P0/P1 reports per 100 active testers.

## Alerts

| Alert | Suggested trigger | Owner |
|---|---|---|
| Crash loop | Crash-free sessions below 99.5% in beta or sudden >2x regression | Mobile owner |
| Auth outage | Auth failure rate >10% for 10 minutes | Supabase/auth owner |
| Catalog outage | Supabase catalog failure >10% or fallback rate >20% for 15 minutes | Catalog owner |
| Fallback failure | Excel fallback errors >1% | Mobile/catalog owner |
| No-results anomaly | No-results rate >2x baseline for a pilot query cohort | Search/catalog owner |
| Deletion failure | Any confirmed deletion request remains unresolved beyond policy SLA | Privacy owner |
| Security event | Auth bypass, cross-user access or credential exposure | Incident commander |

## Verification

- schema/unit tests reject prohibited keys;
- staging events are visible in staging dashboards only;
- production events are visible in production dashboards only;
- a controlled staging crash resolves through uploaded source maps;
- event counts do not double-fire on rerender or navigation restore;
- users can access the privacy policy describing analytics behavior.
