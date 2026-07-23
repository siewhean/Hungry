# Hungry Scaling Implementation, Test, and QA/QC Plan

> Integration base: `main`  
> Scope: authenticated mobile app, public website, merchant/developer web surfaces, Supabase, media, data pipelines, CI/CD, observability, and release operations.  
> Goal: scale safely from internal beta to tens of thousands of users before considering a major architecture rewrite.

## 1. Architecture boundary

Hungry does not support guest mode in the app.

```text
Splash → Onboarding → Create Account / Sign In → verification when required → authenticated app
```

- Supabase is mandatory for authentication and shared writes.
- Supabase release/RPC catalog reads are primary.
- The bundled Excel catalog is authenticated read-only continuity for classified catalog outages only.
- Missing release configuration, failed auth, signed-out/invalid/revoked sessions, and legitimate no-results must not invoke Excel fallback.
- Public website pages may remain public and cache-heavy; this does not create public access to authenticated mobile routes.

## 2. Scale stages

| Stage | Approximate audience | Primary goal |
|---|---:|---|
| Internal | 10–100 | correctness, RLS, core flow and release repeatability |
| Closed beta | 100–1,000 | production flags, monitoring, media and auth reliability |
| Public beta | 1,000–10,000 | indexed reads, cache strategy, rate limits, operational response |
| Growth | 10,000–100,000 | queues, read models, moderation scale, cost controls, capacity planning |
| Larger scale | 100,000+ | separate search/analytics/worker infrastructure only when evidence requires it |

These numbers are planning bands, not guarantees. Capacity decisions use measured concurrency, request rate, data size, latency, error rate, storage/egress, moderation load, and cost.

## 3. Scaling principles

1. **Keep one source of truth per data class.**
   - Supabase owns accounts, profiles, shared content, merchant/admin state, and writes.
   - Zustand is cache, local draft, optimistic state, or device-only settings.
   - Excel is not a write store or authentication provider.

2. **Bound every interactive read.**
   - Cursor paging, explicit limits, stable ordering, cancellation, and indexes.
   - Never hydrate or render the entire catalog/feed client-side.

3. **Enforce authorization at every layer.**
   - Navigation/feature flags for UX; service checks and RLS/RBAC for security.
   - Merchant outlet and admin/ops roles are server-enforced and audited.

4. **Separate public web traffic from authenticated operations.**
   - Cache/ISR/CDN public pages.
   - Avoid service-role keys or broad database reads in browsers.
   - Protect merchant/admin mutations with server sessions, CSRF-safe patterns, and least privilege.

5. **Move expensive and retryable work off request paths.**
   - OCR, imports, enrichment, image processing, notifications, analytics aggregation, moderation fan-out, deletion processing, exports, and SEO generation.
   - Use idempotency, retry policy, dead-letter/review state, observability, and cost limits.

6. **Scale from evidence, not architecture fashion.**
   - Fix query/index/cache/connection problems before adding microservices.
   - Introduce dedicated search, queues, or analytics storage only after measured thresholds and ownership are clear.

7. **Every phase has rollback and proof.**
   - Static tests alone do not certify a database, native build, or production environment.

## 4. Product surfaces

### Authenticated mobile app

Responsibilities:

- onboarding and account lifecycle;
- Home/Discover/Search/Browse/Map/details;
- favourites, reviews, posts, activity, profile, settings;
- feature-gated merchant/advanced surfaces;
- native permissions, secure session persistence, media, offline/error behavior.

Scaling focus:

- fast secure bootstrap;
- bounded catalog/feed RPCs;
- paged/virtualized lists;
- image caching and upload limits;
- targeted prefetch with deduplication and authorization;
- no false offline write success;
- native crash/ANR/memory/battery monitoring.

### Public website

Responsibilities:

- product/SEO/area/dish/stall/guide pages approved for public indexing;
- merchant acquisition and support/privacy/deletion pages;
- app conversion and public lead capture.

Scaling focus:

- static generation/ISR/CDN where suitable;
- segmented sitemaps, canonical/noindex rules and structured data;
- cached/public data projections rather than unrestricted live queries;
- bot/rate-limit/abuse protection;
- privacy-safe analytics and Core Web Vitals.

### Merchant portal

Responsibilities:

- authentication, claim/verification, business profile, menu/dish/media/hours;
- review/customer interactions, promotions and approved analytics;
- OCR draft review and support.

Scaling focus:

- outlet-scoped RLS and server-side role checks;
- audit logs and optimistic concurrency/version checks;
- paged lists and pre-aggregated analytics;
- strict uploads, idempotent mutations and background jobs;
- no cross-merchant data exposure.

### Developer/admin/ops dashboard

Responsibilities:

- moderation, reports, merchant/OCR queues, feature/release operations, import status, system health and support workflows.

Scaling focus:

- narrow admin/ops roles and MFA;
- no service-role secret in browser;
- audited high-impact actions and approvals;
- redaction, pagination and background export;
- operational dashboards tied to alerts/runbooks.

## 5. Phase plan

### Phase 0 — Repository and scope baseline

Implementation:

- reconcile active branches/PRs with `main`;
- close superseded change lines and remove stale refs after review;
- maintain one active backlog and verification ledger;
- classify every feature as production, staging, role-gated, prototype, or removed;
- inventory data source, route, permissions, environment and deployment ownership.

Tests/evidence:

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test
npx expo-doctor --non-interactive
npm run audit:assets
npm run audit:supabase:static
npm run release:ready:local
```

Exit: reproducible clean branch and explicit scope; no undocumented failures.

### Phase 1 — Environment, authentication and feature boundaries

Implementation:

- separate development, staging and production values/owners;
- block released builds when Supabase configuration is missing;
- validate SecureStore session restoration and fail-closed invalidation;
- remove guest/unauthenticated app routes;
- validate deep links/return routes;
- register only approved production features;
- protect preview/admin environments.

QA:

- fresh install/onboarding/auth;
- verification/recovery;
- session restore/revoke/sign-out;
- missing configuration;
- direct/deep-link/notification/stale-state bypass;
- merchant/admin role matrix.

Exit: no auth, role, flag, environment or fallback bypass.

### Phase 2 — Database, RLS and storage readiness

Implementation:

- schema ownership and migration policy;
- RLS and grants on user, UGC, merchant, admin and storage objects;
- narrow SECURITY DEFINER functions with controlled search path/execute grants;
- indexes for foreign keys, filters, sort/cursor and location queries;
- storage path ownership, MIME/size policies and lifecycle/retention;
- backup/PITR and restore test decision.

Tests:

```bash
npm run audit:supabase:static
npm run smoke:database:rls
npm run smoke:database:location
npm run smoke:database:search
```

With staging credentials, run Security/Performance Advisor and full Supabase smokes.

Exit: no P0/P1 cross-user/cross-merchant access or unbounded hot query.

### Phase 3 — Catalog, search, discovery and detail APIs

Implementation:

- release-versioned, bounded RPCs;
- stable cursor pagination and deduplication;
- location/area/cuisine/dietary/price/availability filters;
- active-release publication/validation and provenance;
- non-consumer exclusions and approved imagery;
- typed catalog errors;
- authenticated read-only Excel fallback for eligible availability failures;
- successful empty results remain empty.

Performance/QA:

- representative Singapore areas including sparse/dense cases;
- 3+ pages of dishes/stalls with stable IDs/order;
- detail/menu/map consistency;
- query plans, p50/p95/p99, error rate and active release totals;
- targeted catalog outage while auth remains healthy;
- signed-out/invalid-session fallback denial.

Exit: complete catalog reachability through paging/search/detail with no full-client hydration.

### Phase 4 — Profile, favourites, reviews and posts

Implementation:

- one canonical user/profile/avatar identity;
- idempotent save/unsave and publish operations;
- media upload validation/ownership and cleanup;
- cross-surface/cross-user visibility;
- optimistic rollback and conflict/version handling;
- report/block/delete/moderation and account-deletion integration.

Load/QA:

- concurrent duplicate actions;
- upload interruption/retry;
- cross-user RLS visibility/isolation;
- feed pagination and moderation filtering;
- sign-out/re-login cache correctness;
- no offline/local false success.

Exit: shared state is durable, isolated and observable.

### Phase 5 — Mobile performance and resilience

Implementation:

- production-like startup and deferred non-critical work;
- list virtualization/paging;
- image/media cache and memory control;
- cancellable requests and bounded retries;
- deduplicated authorized prefetch;
- app lifecycle cleanup;
- clear loading/empty/error/offline/fallback states.

Native evidence:

- current and older supported iPhone;
- current and mid/lower Android device;
- weak network/offline;
- 30+ minute navigation/scroll/media session;
- large text, dark mode, reduced motion, VoiceOver/TalkBack;
- crash, ANR, memory and battery/network measurements.

Exit: core targets and crash-free beta threshold pass on representative devices.

### Phase 6 — Public website scale and SEO safety

Implementation:

- public data contract and cache/ISR strategy;
- invalidation/revalidation ownership;
- rate limiting and server-only secrets;
- canonical URLs, sitemap/robots/noindex and structured data;
- image optimization and accessibility;
- merchant/admin route isolation from indexing.

Tests:

- build, type/lint/security route contracts;
- authenticated Lighthouse for protected web surfaces;
- cache hit/revalidation behavior;
- bot/abuse and malformed request tests;
- Search Console and production domain evidence.

Exit: public traffic is cache-heavy and cannot expose private/admin data.

### Phase 7 — Merchant/admin operational scale

Implementation:

- role matrices and outlet ownership;
- audited high-impact operations;
- paged queues and analytics read models;
- upload/import/OCR background processing;
- concurrency conflict handling;
- support, moderation and data-correction workflows.

QA:

- owner/manager/staff/read-only/normal-user/wrong-merchant/admin/ops accounts;
- cross-outlet and cross-role denial;
- audit log and retry/idempotency proof;
- queue backlog/recovery and export redaction.

Exit: operations scale without broad privileges or client-side secrets.

### Phase 8 — Jobs, queues and scheduled work

For each job define:

- producer and validated payload;
- idempotency/dedupe key;
- retry/backoff and maximum attempts;
- dead-letter/manual review state;
- timeout/concurrency/rate/cost limits;
- result and audit record;
- alert and runbook;
- data retention and deletion behavior.

Test duplicate delivery, partial failure, poison payload, worker restart, backlog surge and dependency outage.

Exit: user requests are not blocked by expensive work and retries cannot corrupt/duplicate state.

### Phase 9 — Observability and incident readiness

Implementation:

- Sentry release/source maps and privacy scrubbers;
- Supabase/Vercel/EAS logs and alerts;
- app/backend/web correlation/request identifiers without PII;
- dashboards for auth, catalog, search, upload, posts/reviews, queues, errors, latency and cost;
- incident severity, owner, communication, rollback/forward-fix and postmortem templates.

Exit: a controlled staging failure is detected, triaged and resolved through the runbook.

### Phase 10 — Load and capacity testing

Use staging only unless an approved production-safe plan exists.

Scenarios:

- auth/session refresh;
- search/discovery/detail/map;
- public web/cache misses;
- post/review publish and media uploads;
- merchant/admin queues;
- job backlog and notification fan-out.

Record concurrency, requests/second, dataset size, p50/p95/p99, throughput, error rate, database connections/CPU/IO, storage/egress, queue lag and cost.

After every run inspect slow queries/advisors/logs, fix the measured bottleneck, and repeat.

Exit: capacity and cost headroom meet the launch stage with rollback/scale-up triggers.

### Phase 11 — Release, rollout and rollback

Required:

- green repository, database, native, web and security gates;
- iOS TestFlight and Android internal/closed track smoke;
- store metadata/privacy/Data Safety/demo account/review notes;
- monitoring and alerts;
- database/app/web/OTA compatibility matrix;
- staged rollout and stop thresholds;
- previous stable app/OTA/web artifact and forward-fix database plan;
- on-call owner and status communication.

Exit: Go candidate only when all repo-local and external P0 gates pass.

## 6. Test pyramid

| Layer | Purpose |
|---|---|
| Unit/source contracts | pure logic, boundaries, configuration and static invariants |
| Integration | service/store, Supabase RPC/RLS/storage/function behavior |
| Playwright | Expo web, public website, merchant/admin web flows |
| Maestro/native | permissions, lifecycle, deep links, auth, media, native layout/accessibility |
| Load/capacity | latency, throughput, connection/queue/cost behavior |
| Manual/external | VoiceOver/TalkBack, store consoles, legal/privacy, DNS/SMTP/monitoring |

No layer replaces another.

## 7. Release scorecard

| Dimension | Required result |
|---|---|
| Authentication/configuration | fail closed; no guest/bypass |
| Data isolation | RLS/RBAC/storage smoke pass |
| Catalog | paged, indexed, complete/reachable, eligible fallback only |
| Shared writes | durable, idempotent, no false success |
| UGC | report/block/moderation/contact/delete controls |
| Performance | stage targets and headroom pass |
| Reliability | crash/ANR/error and queue thresholds pass |
| Privacy/security | declarations, scans, advisor and manual review pass |
| Native/web | supported-device/browser and accessibility proof pass |
| Operations | alerts, runbooks, rollout/rollback owners ready |
| External | store, domain, SMTP, monitoring and legal proof complete |

## 8. Current status source

Do not maintain completion percentages in this plan. Use:

```text
tasks/backlog.md
tasks/verification.md
tasks/session-log.md
current task-specific audit and PR
```

Production remains **No-Go** while any P0 or required external proof is incomplete.
