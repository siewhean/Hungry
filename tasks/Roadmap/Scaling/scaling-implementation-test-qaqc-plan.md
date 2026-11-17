# Hungry Scaling Implementation, Test Plan, and QA/QC Plan

> Scope: Hungry mobile app, public website, merchant portal, developer/admin dashboard, Supabase backend, storage, CI/CD, observability, and release operations.
> Goal: Prepare Hungry to scale from MVP beta to thousands of users safely, without rewriting the product architecture.
> Principle: Scale by separating public reads, authenticated user actions, merchant operations, admin operations, background jobs, and analytics.

---

## 1. Executive Summary

Hungry should scale in stages. The next priority is not microservices. The priority is to make the current architecture safe, testable, cacheable, and observable.

The scaling plan focuses on:

1. Production-safe feature flags.
2. Supabase RLS and database indexing.
3. Fast location-aware discovery/search queries.
4. Public website caching and SEO page generation.
5. Secure merchant portal access.
6. Secure developer/admin dashboard access.
7. Background jobs for OCR, imports, analytics, media processing, and notifications.
8. Clear QA/QC gates before each launch stage.
9. Load testing using realistic traffic patterns.
10. Observability through Sentry, Supabase logs/advisors, Vercel logs, and product analytics.

---

## 2. Target Scale Stages

| Stage | Users | Traffic profile | Primary goal |
|---|---:|---|---|
| Internal MVP | 10–100 | team/demo traffic | correctness, RLS, core flow stability |
| MVP beta | 100–1,000 | light daily usage | safe production flags, core features working |
| Public beta | 1,000–10,000 | repeated discovery/search traffic | caching, indexed reads, reliable media/upload |
| Growth | 10,000–100,000 | social/feed/search traffic spikes | queues, rate limits, read models, observability |
| Large scale | 100,000+ | high public SEO + app traffic | dedicated search/analytics/worker separation |

---

## 3. Scaling Principles

1. **Supabase is canonical for shared/synced data.**
   - Profile, reviews, posts, follows, likes, saves, merchant data, and activity must be database-backed.
   - Zustand should only be local cache, optimistic state, or device-local settings.

2. **Public website traffic should be CDN/cache-heavy.**
   - Area, dish, stall, guide, and SEO pages should not query the database on every request.

3. **Mobile app should use optimized APIs/RPCs.**
   - Use dedicated discovery/search/detail RPCs, not heavy client-side joins.

4. **Merchant and admin operations must be server-side protected.**
   - Never expose service-role keys.
   - Use RBAC, RLS, audit logs, and CSRF protections for web portals.

5. **Expensive work must be queued.**
   - OCR, image processing, imports, analytics aggregation, notification fanout, account deletion, and SEO page generation should not block user-facing requests.

6. **Every scaling phase must have tests and rollback.**
   - No scaling change is complete without performance, security, and QA evidence.

---

## 4. Product Surfaces

### 4.1 Mobile App

Responsibilities:

- Onboarding
- Auth
- Home / Discover / Search
- Dish Detail / Stall Detail
- Saves
- Reviews
- Basic posts
- Profile
- Settings
- Local/offline cache

Scaling focus:

- keep guest browsing fast
- optimize discovery/search/detail RPCs
- cache short-lived read data
- queue failed writes
- compress/upload media safely
- avoid rendering huge lists without virtualization
- use analytics and crash reporting

### 4.2 Public Website

Responsibilities:

- SEO landing pages
- area/dish/stall/hawker centre pages
- Singapore guides
- merchant acquisition pages
- app download conversion
- waitlist / lead capture

Scaling focus:

- static generation / ISR where possible
- sitemap segmentation
- noindex thin pages
- structured data validation
- CDN caching
- no database query per public page request when avoidable

### 4.3 Merchant Portal

Responsibilities:

- merchant login
- claim/verification
- profile editor
- menu editor
- dish editor
- opening hours
- image uploads
- OCR draft review
- reviews/customer inbox
- promotions
- analytics

Scaling focus:

- server-side auth and RBAC
- outlet-scoped RLS
- audit logs
- paginated lists
- pre-aggregated analytics
- strict media upload limits

### 4.4 Developer/Admin Dashboard

Responsibilities:

- feature flags
- moderation queue
- OCR queue
- merchant claim queue
- user reports
- system health
- Supabase smoke results
- SEO/indexing status
- data import status
- release readiness

Scaling focus:

- admin-only server-side access
- audit every admin action
- no service-role key in browser
- paginated queries
- redacted sensitive data
- background exports

---

## 5. Phase Overview

| Phase | Name | Main outcome |
|---:|---|---|
| 0 | Baseline audit and scope freeze | Know current state; stop risky expansion |
| 1 | Environment and feature flag hardening | Safe production/staging/dev separation |
| 2 | Database/RLS/index readiness | Secure, indexed, queryable Supabase |
| 3 | API/service/query scaling | Fast discovery/search/detail/feed APIs |
| 4 | Public website scaling | Cached SEO pages and safe web routing |
| 5 | Mobile app scaling | Stable app flows, media, cache, offline retry |
| 6 | Merchant portal scaling | RBAC, outlet ownership, audit logging |
| 7 | Developer dashboard scaling | Admin isolation and operational visibility |
| 8 | Background jobs and queues | Async OCR/imports/media/analytics/notifications |
| 9 | Observability and incident readiness | Logs, metrics, alerts, dashboards |
| 10 | Load testing | k6/browser/mobile load profiles |
| 11 | QA/QC release gates | Manual + automated release certification |
| 12 | Rollout and rollback | Safe staged release process |
| 13 | Post-launch monitoring | Validate real-world performance and user behavior |

---

# Phase 0 — Baseline Audit and Scope Freeze

## Goal

Establish the current app/website/backend state and prevent new advanced features from masking scaling problems.

## Implementation Tasks

1. Freeze new features until Phase 0–3 pass.
2. Compare `frontend-design-overhaul` against `main`.
3. Identify all changed areas:
   - mobile app
   - public website
   - merchant portal
   - developer/admin dashboard
   - Supabase migrations
   - scripts
   - native/iOS
   - assets
   - CI/security
4. Decide which features are MVP, staging-only, or advanced.
5. Document production feature flags.
6. Document current database schema and RLS status.
7. Document current test coverage.
8. Document current build status.

## Test Plan

| Test | Type | Pass criteria |
|---|---|---|
| Branch compare | Static | All changed scopes are documented |
| Feature flag audit | Static/unit | Production does not expose unfinished surfaces |
| Current test suite | Automated | Typecheck/lint/test pass or failures documented |
| Current Supabase audit | Static/smoke | RLS/index/advisor issues listed |
| Current web build | Automated | Public website build passes |

## QA/QC Checklist

- [ ] No new feature work starts before baseline is logged.
- [ ] Branch scope is classified.
- [ ] Production flag values are documented.
- [ ] MVP vs advanced features are separated.
- [ ] Known failures are documented, not ignored.

## Verification Commands

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test
npx expo-doctor --non-interactive
npm run audit:supabase:static
npm run audit:assets
npm run release:ready:local
```

## Deliverables

- `tasks/Roadmap/Scaling/scaling-baseline-audit.md`
- Updated `tasks/todo.md`
- Updated feature flag matrix

---

# Phase 1 — Environment and Feature Flag Hardening

## Goal

Ensure production, staging, and development cannot accidentally expose the wrong features.

## Implementation Tasks

1. Create an explicit environment matrix:
   - development
   - staging
   - production
2. Lock production defaults:
   - `prototypeRoutesEnabled = false`
   - `merchantCentreEnabled = false` until approved
   - `directMessagesEnabled = false` until moderation/realtime ready
   - `storiesEnabled = false` until database-backed
   - `floorplansEnabled = false` until geometry QA passes
   - `gamificationEnabled = false` until fully data-backed
   - `commentsEnabled = false` unless moderation is ready
3. Add `featureFlags.test.ts`.
4. Add route exposure tests for production.
5. Add CI check to fail on unsafe production defaults.
6. Ensure no environment secrets are committed.
7. Update `.env.example`.

## Test Plan

| Test | Type | Pass criteria |
|---|---|---|
| Production flags | Unit | Advanced flags are off |
| Staging flags | Unit | Staging-only features can be enabled intentionally |
| Dev flags | Unit | Dev launcher/dev surfaces allowed only in dev |
| Route exposure | Integration | Disabled routes cannot open |
| Deep links | Integration | Disabled routes redirect to NotFound/Login safely |
| Secret scan | Security | No secrets in repo |

## QA/QC Checklist

- [ ] Production flag values are explicit.
- [ ] Staging values are intentional.
- [ ] Feature flag tests exist.
- [ ] Route tests exist.
- [ ] Deep links cannot bypass flags.
- [ ] Secrets are not committed.

## Verification Commands

```bash
npm run test
npm run security:gitleaks
npm run security:trufflehog
```

## Deliverables

- `src/constants/featureFlags.ts`
- `src/constants/featureFlags.test.ts`
- `src/app/navigation/route-production-readiness.test.ts`
- `tasks/Roadmap/Scaling/feature-flag-release-matrix.md`

---

# Phase 2 — Database, RLS, Index, and Schema Readiness

## Goal

Make Supabase secure and fast enough for MVP beta and public beta.

## Implementation Tasks

1. Audit all user-owned and merchant-owned tables.
2. Confirm RLS is enabled.
3. Confirm policies are correct.
4. Index all foreign keys used in joins/filters.
5. Index common query paths:
   - area/location
   - dish search
   - venue/stall search
   - posts feed
   - reviews
   - favourites
   - merchant outlet data
   - activity events
6. Add PostGIS if location/distance search is needed.
7. Add query views/RPCs for:
   - discovery feed
   - search
   - dish detail
   - stall detail
   - public post feed
   - following feed later
   - merchant dashboard summary
8. Run Supabase Security Advisor.
9. Run Supabase Performance Advisor.
10. Create RLS smoke tests.
11. Create query performance smoke tests.

## Required Tables to Audit

- `user_profiles`
- `public_profiles`
- `privacy_settings`
- `user_favourite_dishes`
- `reviews`
- `review_photos`
- `posts`
- `post_media`
- `post_likes`
- `post_saves`
- `post_comments`
- `user_follows`
- `activity_events`
- `merchant_accounts`
- `merchant_outlets`
- `merchant_dishes`
- `merchant_claims`
- `dishes_draft`
- `content_reports`
- `storage.objects`

## Test Plan

| Test | Type | Pass criteria |
|---|---|---|
| RLS enabled | Static/SQL | All private tables have RLS |
| Anon read | SQL smoke | Anon can read only public discovery data |
| User isolation | SQL smoke | User cannot read/write another user’s private data |
| Merchant isolation | SQL smoke | Merchant cannot update another outlet |
| Admin/ops isolation | SQL smoke | Non-admin cannot access queues |
| FK indexes | Static/advisor | No unindexed hot FKs |
| Query performance | Smoke/load | Discovery/search/detail meet latency targets |

## Performance Targets

| Query | p95 target |
|---|---:|
| Dish detail | < 200ms |
| Stall detail | < 200ms |
| Discovery by area | < 500ms |
| Search by query + area | < 500ms |
| Home feed | < 700ms |
| Merchant dashboard summary | < 1000ms |

## QA/QC Checklist

- [ ] RLS policies reviewed.
- [ ] No service-role key in mobile/web client.
- [ ] Security Advisor issues triaged.
- [ ] Performance Advisor issues triaged.
- [ ] Indexes added for hot joins/filters.
- [ ] Query performance report created.
- [ ] Migration rollback notes exist.

## Verification Commands

```bash
npm run audit:supabase:static
npm run audit:supabase:advisor-security:non-password
npm run audit:supabase:advisor-support-snapshot
npm run smoke:supabase-full-audit-v1
npm run smoke:database:location
npm run smoke:database:search
```

## Deliverables

- `tasks/Roadmap/Database/database-scaling-readiness-report.md`
- `tasks/Roadmap/Database/database-query-performance-report.md`
- New migrations if needed
- Supabase smoke tests

---

# Phase 3 — API, Service Layer, and Query Scaling

## Goal

Ensure app and website use optimized service methods instead of heavy client-side joins or mock fallbacks.

## Implementation Tasks

1. Audit every screen’s data source.
2. Require all MVP screens to use `HungryService` or `DataRepository`.
3. Add optimized methods:
   - `getDiscoveryFeedByLocation`
   - `searchDishesByLocation`
   - `getDishDetail`
   - `getStallDetail`
   - `getPublicPostFeed`
   - `listUserPosts`
   - `getMerchantDashboardSummary`
4. Ensure public website uses server-side safe queries.
5. Add pagination to feed/search/list endpoints.
6. Add query timeout handling.
7. Add cache TTL rules.
8. Remove production mock fallbacks that hide database failures.
9. Add error contracts for empty/offline/failure states.

## Test Plan

| Test | Type | Pass criteria |
|---|---|---|
| Screen data source audit | Static | No MVP screen uses mock-only data in production |
| Discovery service | Unit/integration | Returns location-aware results |
| Search service | Integration | Supports query + location + filters |
| Detail service | Integration | Missing IDs return safe null/empty |
| Pagination | Integration | Large lists paginate correctly |
| Timeout handling | Unit/integration | User gets safe error/empty state |
| Mock mode | Unit | Mock only used intentionally |

## QA/QC Checklist

- [ ] Every screen has documented data source.
- [ ] Public reads are paginated.
- [ ] Heavy joins are server-side/RPC/view-based.
- [ ] Mobile app does not perform expensive table scans.
- [ ] Website does not perform uncached DB calls per SEO page request.

## Deliverables

- `tasks/Roadmap/Scaling/service-layer-scaling-audit.md`
- Updated `src/lib/services/types.ts`
- Updated Supabase service methods
- Integration tests

---

# Phase 4 — Public Website Scaling

## Goal

Make the public website fast, cacheable, SEO-friendly, and isolated from private portals.

## Implementation Tasks

1. Split public website routes from merchant/admin routes if possible.
2. Use static generation/ISR for:
   - homepage
   - area pages
   - dish pages
   - stall pages
   - hawker centre pages
   - guides
3. Keep private portal routes dynamic and uncached.
4. Add cache headers.
5. Add sitemap segmentation.
6. Add robots rules.
7. Add structured data validation.
8. Add noindex logic for thin pages.
9. Add image optimization.
10. Add public web load tests.
11. Add build budget checks.

## Test Plan

| Test | Type | Pass criteria |
|---|---|---|
| Web build | Automated | Build passes |
| Sitemap | Static | Only public indexable routes included |
| Robots | Static | Private/admin/API routes blocked |
| Structured data | Static | JSON-LD valid and matches visible content |
| Noindex | Static | Thin pages noindexed |
| Lighthouse | Manual/CI | Core pages pass thresholds |
| Public web load | k6 | Cached pages sustain target RPS |

## Public Web Performance Targets

| Page | p95 target |
|---|---:|
| Homepage | < 1.5s |
| Static guide page | < 1.5s |
| Area page | < 2s |
| Dish page | < 2s |
| Stall page | < 2s |
| Waitlist submission | < 1s API response |

## QA/QC Checklist

- [ ] SEO pages are crawlable.
- [ ] Public pages are cached.
- [ ] Private routes are not in sitemap.
- [ ] No admin/merchant private page is indexable.
- [ ] Structured data is truthful.
- [ ] Waitlist/lead forms are rate-limited.

## Verification Commands

```bash
cd marketing/website/web-v2 && npm run build
cd marketing/website/web-v2 && npm run lint
npm run seo:validate
npm run seo:sitemap
npm run seo:structured-data
```

## Deliverables

- `tasks/Roadmap/Scaling/public-website-scaling-report.md`
- SEO validation scripts
- k6 public website tests

---

# Phase 5 — Mobile App Scaling

## Goal

Ensure mobile app flows work under real usage, media upload, flaky network, and cached/offline conditions.

## Implementation Tasks

1. Validate app boot time.
2. Validate tab navigation performance.
3. Add list virtualization where needed.
4. Add image size rules.
5. Add offline states.
6. Add write retry queue for:
   - profile updates
   - post publish
   - review submission
   - likes/saves
   - comments if enabled
7. Add upload progress and retry.
8. Add Sentry crash reporting and performance tracing.
9. Add app version/update tracking.
10. Add mobile smoke tests.

## Test Plan

| Test | Type | Pass criteria |
|---|---|---|
| Fresh install | Manual/Maestro | App boots and reaches onboarding |
| Guest browse | Manual/Maestro | User can browse without auth |
| Login/signup | Manual/Maestro | Auth works on device |
| Media upload | Manual/Maestro | Post/review media uploads |
| Offline read | Manual | Cached data or empty state appears |
| Offline write | Manual | Mutation queues or shows safe failure |
| Tab swipe | Manual | No gesture conflict |
| Crash reporting | Manual | Test error appears in Sentry staging |

## Mobile Performance Targets

| Metric | Target |
|---|---:|
| Cold app interactive | < 3s on modern device |
| Tab switch | < 300ms perceived |
| Search result response | < 500ms p95 |
| Detail screen data load | < 300ms p95 |
| Image upload failure rate | < 2% in staging smoke |

## QA/QC Checklist

- [ ] iOS smoke passes.
- [ ] Android smoke passes.
- [ ] Media permissions pass.
- [ ] Offline states pass.
- [ ] No app crash on missing data.
- [ ] Upload retry is clear.
- [ ] Sentry staging captures test crash.

## Verification Commands

```bash
npm run smoke:native:ios:prepared
npm run smoke:native:ios:media:prepared
npm run smoke:native:ios:chat:prepared
npm run test
```

## Deliverables

- `tasks/Roadmap/Scaling/mobile-scaling-qa-report.md`
- Maestro flows
- Sentry staging verification

---

# Phase 6 — Merchant Portal Scaling

## Goal

Make merchant portal secure and scalable for verified merchants.

## Implementation Tasks

1. Enforce merchant RBAC:
   - owner
   - manager
   - staff
   - readonly
2. Enforce outlet ownership in RLS.
3. Add server-side route guards.
4. Add CSRF protection for web mutations.
5. Add audit logs for merchant changes.
6. Add menu edit validation.
7. Add image upload validation.
8. Add pagination for menu/reviews/inbox.
9. Add cache invalidation after merchant updates.
10. Add merchant dashboard summary read model.
11. Add merchant portal load tests.

## Test Plan

| Test | Type | Pass criteria |
|---|---|---|
| Merchant auth | E2E | Login/session works |
| Outlet isolation | RLS/E2E | Merchant cannot access another outlet |
| Menu edit | E2E | Edit persists and consumer sees update |
| Image upload | E2E/manual | Upload validates MIME/size |
| Audit log | Integration | Change creates audit row |
| Dashboard | Integration/load | Summary loads quickly |
| CSRF | Security | Mutation rejects missing/invalid token |

## Merchant Performance Targets

| Action | p95 target |
|---|---:|
| Dashboard load | < 1.5s |
| Menu list | < 1s |
| Dish update | < 1s |
| Review inbox | < 1.5s |
| Image upload signed URL | < 500ms |

## QA/QC Checklist

- [ ] Merchant centre disabled in production until approved.
- [ ] Staging merchant login works.
- [ ] RBAC works.
- [ ] RLS works.
- [ ] Audit logs work.
- [ ] Merchant changes update consumer app/website.
- [ ] Analytics are real or labelled preview.

## Deliverables

- `tasks/Roadmap/Merchant Portal/merchant-portal-scaling-qa-report.md`
- Merchant E2E tests
- Merchant load tests

---

# Phase 7 — Developer/Admin Dashboard Scaling

## Goal

Make developer/admin dashboard safe for operational use.

## Implementation Tasks

1. Require admin role.
2. Add server-side RBAC.
3. Block client-only admin guards.
4. Add audit logs for every admin action.
5. Paginate all queues:
   - reports
   - users
   - merchants
   - feature flags
   - OCR drafts
   - claims
6. Redact sensitive fields by default.
7. Add admin API rate limits.
8. Add CSRF protection.
9. Add dashboard health widgets.
10. Add admin E2E tests.

## Test Plan

| Test | Type | Pass criteria |
|---|---|---|
| Unauthenticated access | E2E/security | Redirect/reject |
| Non-admin access | E2E/security | Forbidden |
| Admin access | E2E | Allowed |
| Audit logging | Integration | Action creates audit event |
| Pagination | Integration | Large queues paginate |
| Sensitive fields | QA | Redacted by default |
| CSRF | Security | Mutation rejects invalid token |

## QA/QC Checklist

- [ ] Admin dashboard isolated from public website.
- [ ] Admin routes not in sitemap.
- [ ] Admin APIs reject non-admins.
- [ ] Service role never exposed to browser.
- [ ] Audit logs are immutable or protected.

## Deliverables

- `tasks/Roadmap/Scaling/admin-dashboard-scaling-qa-report.md`
- Admin security tests
- Admin route audit

---

# Phase 8 — Background Jobs, Queues, and Async Processing

## Goal

Move slow, expensive, or retryable work out of user-facing requests.

## Async Workloads

| Workload | Queue reason |
|---|---|
| OCR menu extraction | slow and variable |
| Excel/import data processing | batch workload |
| image optimization | CPU/network heavy |
| notification fanout | bursty |
| analytics aggregation | scheduled |
| SEO page generation | batch/revalidate |
| account deletion | multi-table cleanup |
| merchant verification review | workflow state machine |
| email sending | external rate limits |

## Implementation Tasks

1. Choose queue strategy:
   - Supabase `pgmq`
   - Edge Function + DB job table
   - external queue later
2. Add `jobs` table or queue abstraction.
3. Add retry policy.
4. Add dead-letter handling.
5. Add idempotency keys.
6. Add job status dashboard.
7. Add scheduled cron jobs where appropriate.
8. Add alert on stuck/failed jobs.

## Test Plan

| Test | Type | Pass criteria |
|---|---|---|
| Job enqueue | Integration | Job row/queue item created |
| Job retry | Integration | Failed job retries |
| Dead letter | Integration | Exhausted job is marked failed |
| Idempotency | Integration | Duplicate job does not duplicate side effect |
| Queue dashboard | E2E | Admin sees status |
| OCR async | Smoke | OCR does not block UI |

## QA/QC Checklist

- [ ] All slow work has async path.
- [ ] Jobs are idempotent.
- [ ] Failed jobs are visible.
- [ ] No user request waits for OCR/imports/analytics.
- [ ] Account deletion is safe and auditable.

## Deliverables

- `tasks/Roadmap/Scaling/background-jobs-scaling-plan.md`
- Queue migration
- Worker/Edge Function tests

---

# Phase 9 — Observability, Alerts, and Incident Readiness

## Goal

Make production issues visible before users report them.

## Implementation Tasks

1. Configure Sentry for mobile.
2. Configure Sentry/web logging for website/portal/dashboard if used.
3. Add product analytics event taxonomy.
4. Add Supabase database dashboards.
5. Add Vercel dashboard monitoring.
6. Add alert thresholds:
   - high crash rate
   - high API error rate
   - slow discovery/search
   - failed media uploads
   - failed auth
   - failed merchant writes
   - failed OCR jobs
   - elevated RLS errors
7. Add runbooks:
   - database slowdown
   - auth outage
   - media upload failure
   - merchant portal access issue
   - failed migration
   - bad app release
8. Add release health dashboard.

## Test Plan

| Test | Type | Pass criteria |
|---|---|---|
| Sentry mobile test crash | Manual | Appears in staging |
| Web error capture | Manual | Appears in dashboard |
| API error log | Integration | Failed API logged |
| Supabase slow query | Manual/advisor | Slow query visible |
| Alert simulation | Manual | Alert delivered |
| Runbook drill | Manual | Team can follow steps |

## QA/QC Checklist

- [ ] Error tracking enabled.
- [ ] Sensitive data not logged.
- [ ] Alerts have owners.
- [ ] Runbooks exist.
- [ ] Release health monitored.

## Deliverables

- `tasks/Roadmap/Scaling/observability-runbook.md`
- `tasks/Roadmap/Scaling/incident-response-plan.md`
- Sentry verification report

---

# Phase 10 — Load Testing

## Goal

Validate that Hungry can handle hundreds to thousands of users before launch.

## Load Test Scenarios

| Scenario | Tool | Target |
|---|---|---:|
| Public website homepage | k6 | 500 RPS via CDN |
| Area SEO page | k6 | 500 RPS via CDN |
| Dish detail API | k6 | 200 RPS |
| Stall detail API | k6 | 200 RPS |
| Search | k6 | 100 RPS |
| Discovery feed | k6 | 100 RPS |
| Login/signup | k6/manual | controlled; no auth abuse |
| Review submit | k6 | 10–25 RPS |
| Post publish metadata | k6 | 5–20 RPS |
| Media upload | manual/k6 staged | low volume + failure testing |
| Merchant dashboard | k6/Playwright | 20 RPS |
| Admin dashboard | Playwright | low RPS, strict auth |

## k6 Threshold Examples

- `http_req_failed < 1%`
- `p95 search < 500ms`
- `p95 discovery < 700ms`
- `p95 details < 300ms`
- `p99 details < 1000ms`

## Implementation Tasks

1. Add load test scripts:
   - `scripts/load/public-web.k6.js`
   - `scripts/load/search.k6.js`
   - `scripts/load/discovery.k6.js`
   - `scripts/load/detail.k6.js`
   - `scripts/load/post-publish.k6.js`
   - `scripts/load/merchant-portal.k6.js`
   - `scripts/load/admin-dashboard.k6.js`
2. Add package scripts.
3. Run against staging only.
4. Record p50/p95/p99/error rate.
5. Identify slow queries.
6. Add missing indexes or query changes.
7. Repeat until thresholds pass.

## Test Data Requirements

- 1,000+ dishes
- 200+ venues/stalls
- 20+ areas
- 100+ users
- 500+ posts
- 500+ reviews
- 50+ merchants
- realistic media references
- following graph for social tests

## QA/QC Checklist

- [ ] Load tests run only against staging.
- [ ] Thresholds are encoded in scripts.
- [ ] Results are documented.
- [ ] Slow queries are traced.
- [ ] Advisor reports reviewed after tests.
- [ ] No test data leaks into production.

## Deliverables

- `tasks/Roadmap/Scaling/scaling-load-test-results.md`
- k6 scripts
- performance fix PRs

---

# Phase 11 — Manual QA/QC Matrix

## Goal

Validate the user-facing experience on real devices and browsers.

## Mobile QA Matrix

| Flow | iOS | Android | Pass criteria |
|---|---:|---:|---|
| Fresh install | [ ] | [ ] | App boots |
| Guest onboarding | [ ] | [ ] | Completes |
| Guest browse | [ ] | [ ] | Home/Search/Detail works |
| Login/signup | [ ] | [ ] | Auth works |
| Save dish | [ ] | [ ] | Persists |
| Submit review | [ ] | [ ] | Appears on detail/profile |
| Publish post | [ ] | [ ] | Other user can see it |
| Upload media | [ ] | [ ] | Upload succeeds/fails safely |
| Offline state | [ ] | [ ] | No crash |
| Feature flags | [ ] | [ ] | Advanced routes blocked |

## Public Website QA Matrix

| Flow | Chrome | Safari | Mobile | Pass criteria |
|---|---:|---:|---:|---|
| Homepage | [ ] | [ ] | [ ] | Loads fast |
| Area page | [ ] | [ ] | [ ] | Content visible |
| Dish page | [ ] | [ ] | [ ] | Schema truthful |
| Stall page | [ ] | [ ] | [ ] | Data visible |
| Sitemap | [ ] | — | — | Valid |
| Robots | [ ] | — | — | Private routes blocked |
| Waitlist | [ ] | [ ] | [ ] | Submit works |

## Merchant Portal QA Matrix

| Flow | Pass criteria |
|---|---|
| Merchant login | Valid merchant can log in |
| Non-merchant blocked | Non-merchant rejected |
| Outlet isolation | Cannot see another outlet |
| Menu edit | Update persists |
| Image upload | Validates and stores |
| Audit log | Change recorded |
| Dashboard | Loads with real/labelled metrics |

## Admin Dashboard QA Matrix

| Flow | Pass criteria |
|---|---|
| Admin login | Admin allowed |
| Non-admin blocked | Forbidden |
| Feature flag change | Audited |
| User report queue | Paginates |
| Merchant claim queue | Paginates |
| OCR queue | Admin/ops only |
| Sensitive data | Redacted by default |

---

# Phase 12 — Release Rollout and Rollback

## Goal

Release safely and recover quickly.

## Implementation Tasks

1. Create release channels:
   - internal
   - staging
   - preview
   - production
2. Use staged rollout for app updates.
3. Use web preview deploys for public/merchant/admin.
4. Require release checklist approval.
5. Require production feature flag review.
6. Require migration rollback notes.
7. Require smoke tests after deploy.
8. Define rollback:
   - app OTA rollback
   - app store binary rollback/patch
   - web rollback
   - database migration rollback or forward fix
   - feature flag kill switch

## QA/QC Checklist

- [ ] Release checklist completed.
- [ ] Smoke tests passed.
- [ ] Feature flags reviewed.
- [ ] Migration applied successfully.
- [ ] Rollback path documented.
- [ ] Monitoring active.
- [ ] On-call owner assigned.

## Deliverables

- `tasks/Roadmap/Scaling/release-rollout-and-rollback-plan.md`
- `tasks/Roadmap/Scaling/production-release-checklist.md`

---

# Phase 13 — Post-Launch Monitoring

## Goal

Validate real-world performance and user behavior after release.

## First 24 Hours

Monitor:

- crash-free sessions
- auth errors
- search latency
- discovery latency
- post publish failures
- review submit failures
- media upload failures
- Supabase errors
- Edge Function errors
- web 5xx
- merchant portal errors
- admin dashboard errors

## First 7 Days

Review:

- user retention
- search-to-detail conversion
- save/review/post conversion
- SEO landing traffic
- app install/signup funnel
- content reports
- merchant claims
- slow queries
- storage growth
- cost growth

## Deliverables

- `tasks/Roadmap/Scaling/post-launch-scaling-review.md`
- incident log if issues occur
- phase-2 scaling recommendations

---

# Required Repo Deliverables

Create these files:

```text
tasks/Roadmap/Scaling/scaling-implementation-test-qaqc-plan.md
tasks/Roadmap/Scaling/scaling-baseline-audit.md
tasks/Roadmap/Scaling/feature-flag-release-matrix.md
tasks/Roadmap/Database/database-scaling-readiness-report.md
tasks/Roadmap/Database/database-query-performance-report.md
tasks/Roadmap/Scaling/service-layer-scaling-audit.md
tasks/Roadmap/Scaling/public-website-scaling-report.md
tasks/Roadmap/Scaling/mobile-scaling-qa-report.md
tasks/Roadmap/Merchant Portal/merchant-portal-scaling-qa-report.md
tasks/Roadmap/Scaling/admin-dashboard-scaling-qa-report.md
tasks/Roadmap/Scaling/background-jobs-scaling-plan.md
tasks/Roadmap/Scaling/observability-runbook.md
tasks/Roadmap/Scaling/incident-response-plan.md
tasks/Roadmap/Scaling/scaling-load-test-results.md
tasks/Roadmap/Scaling/release-rollout-and-rollback-plan.md
tasks/Roadmap/Scaling/production-release-checklist.md
tasks/Roadmap/Scaling/post-launch-scaling-review.md
```

Add these scripts if missing:

```json
{
  "load:public-web": "k6 run scripts/load/public-web.k6.js",
  "load:search": "k6 run scripts/load/search.k6.js",
  "load:discovery": "k6 run scripts/load/discovery.k6.js",
  "load:detail": "k6 run scripts/load/detail.k6.js",
  "load:post-publish": "k6 run scripts/load/post-publish.k6.js",
  "load:merchant": "k6 run scripts/load/merchant-portal.k6.js",
  "load:admin": "k6 run scripts/load/admin-dashboard.k6.js"
}
```

---

# Codex Prompt

```text
You are working on the Hungry `frontend-design-overhaul` branch.

Your task is to implement the scaling implementation, test plan, and QA/QC process for the entire Hungry app and website ecosystem.

Read:
- `tasks/Roadmap/Scaling/scaling-implementation-test-qaqc-plan.md`
- `tasks/Roadmap/mvp-basic-features-implementation-phases.md`
- `tasks/Roadmap/advanced-features-implementation-phases.md`
- `tasks/Roadmap/hungry-seo-ai-discovery-plan.md`
- `src/constants/featureFlags.ts`
- `src/app/navigation/RootNavigator.tsx`
- `.github/workflows/ci.yml`
- `package.json`
- Supabase migrations and smoke scripts
- marketing/web and marketing/website/web-v2

Goal:
Make Hungry ready to scale from MVP beta to thousands of users across:
- mobile app
- public website
- merchant portal
- developer/admin dashboard
- Supabase backend
- storage
- background jobs
- observability
- release operations

Rules:
1. Do not add new product features unless required for scaling safety.
2. Do not enable advanced features in production.
3. Keep production feature flags safe.
4. Supabase must remain canonical for shared/synced data.
5. Public website pages must be cached/static/ISR where possible.
6. Merchant/admin operations must be server-side protected.
7. Slow/expensive work must be queued or documented for queueing.
8. Every phase needs tests and QA/QC acceptance criteria.
9. Record exact commands and results in the relevant report files.
10. Do not touch production directly.

Implement the phases in order:

Phase 0 — Baseline Audit and Scope Freeze
- Document current branch scope, feature flags, test status, DB status.

Phase 1 — Environment and Feature Flag Hardening
- Make production flags safe.
- Add route exposure tests.
- Add feature flag release matrix.

Phase 2 — Database/RLS/Index Readiness
- Audit RLS, indexes, hot queries, advisor results.
- Add missing indexes/migrations only if needed.
- Add RLS/query smoke tests.

Phase 3 — API/Service/Query Scaling
- Audit screen data sources.
- Add/verify optimized RPCs/service methods for discovery/search/detail/feed.
- Add pagination/timeouts/error contracts.

Phase 4 — Public Website Scaling
- Verify static/ISR strategy, sitemap, robots, noindex, structured data, SEO validation.

Phase 5 — Mobile App Scaling
- Verify app boot, tab performance, media upload, offline states, retry queue, Sentry.

Phase 6 — Merchant Portal Scaling
- Verify RBAC, outlet isolation, CSRF, audit logs, menu update propagation.

Phase 7 — Developer/Admin Dashboard Scaling
- Verify admin-only access, server-side guards, pagination, audit logs, redaction.

Phase 8 — Background Jobs and Queues
- Plan or implement queue abstraction for OCR/imports/media/analytics/notifications/account deletion.

Phase 9 — Observability and Incident Readiness
- Add runbooks, alert thresholds, dashboards, Sentry verification.

Phase 10 — Load Testing
- Add k6 scripts for public web, discovery, search, detail, post publish, merchant, admin.
- Encode thresholds.

Phase 11 — Manual QA/QC Matrix
- Create QA matrices for mobile, public web, merchant portal, admin dashboard.

Phase 12 — Release Rollout and Rollback
- Create rollout/rollback plan and production release checklist.

Phase 13 — Post-Launch Monitoring
- Create post-launch monitoring report template.

After changes, run:
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm run test`
- `npx expo-doctor --non-interactive`
- `npm run audit:assets`
- `npm run audit:supabase:static`
- `npm run check:edge-functions`
- `npm run release:ready:local`

If available, run:
- `npm run audit:supabase:advisor-security:non-password`
- `npm run smoke:supabase-full-audit-v1`
- `npm run smoke:native:ios:prepared`
- `npm run smoke:ocr-staging`
- load test scripts added in this phase

Final response must include:
1. Phases completed
2. Files created/changed
3. Tests added
4. Load scripts added
5. QA/QC gates added
6. Commands run and results
7. Remaining scaling blockers
8. Production readiness status
9. Recommended next PR split
```

---

# Source Notes

This plan is aligned with current platform guidance:

- Supabase production checklist: RLS, Security Advisor, Performance Advisor, indexes, load testing, PITR, auth rate limits, abuse prevention, and launch coordination.
- Supabase Database Advisors: missing indexes, RLS issues, security-definer risks, exposed sensitive columns, bucket listing risks, and other checks.
- Supabase connection guidance: appropriate pooling/connection strategy for serverless and edge environments.
- Vercel Fluid Compute: dynamic scaling and concurrency support for function-heavy workloads.
- Expo EAS Update: staged updates and rollback/republish for non-native app code.
- k6 thresholds: use pass/fail thresholds for p95 latency and error rate.
- Playwright: web end-to-end testing.
- Maestro: mobile UI smoke testing.
- Sentry React Native: crash/performance/error observability.
