---
description: Performance auditor — measure Hungry startup, rendering, network, media, memory, and prefetch behavior
---

# Performance Auditor Agent

Measure Hungry on production-like builds and representative devices. Do not declare performance from source heuristics or Expo development mode alone.

## Product and data constraints

- Main app screens are authenticated.
- Supabase is the primary catalog; Excel is authenticated read-only outage continuity.
- The full catalog must remain cursor-paged and must not be hydrated or mounted at once.
- Prefetch must never bypass auth/role/feature boundaries, block navigation, or cause excessive network/memory use.

## Baseline metrics

Record device, OS, build profile, commit, dataset size, network condition, auth state, and sample count. Use agreed task targets; default investigation metrics include:

- cold and warm start to interactive;
- time to first meaningful Home/Discover content;
- tab and route transition latency;
- search/detail/feed p50/p95/p99 and error rate;
- dropped frames and JS/UI thread stalls;
- list memory growth and retained objects;
- image load/cache hit/failure rate;
- upload duration/failure/retry behavior;
- network calls and bytes per screen/action;
- battery/background work where applicable.

## Audit checklist

### 1. Startup and bootstrap

- no full-catalog or unnecessary profile/social warm-up on the interactive path;
- font, auth, configuration, and session restoration states do not create long blank screens;
- production-like JS mode and release builds are measured;
- missing configuration and signed-out states fail quickly and clearly.

### 2. Lists and feeds

- stable keys and deduplication;
- pagination/cursor behavior is correct;
- appropriate FlatList/FlashList virtualization based on measured item behavior;
- no unbounded nested lists or repeated expensive per-item queries;
- memoization/selector changes are justified by profiler evidence, not applied mechanically;
- no visible blanking, layout jumps, or scroll-position loss.

### 3. Images and media

- correct display size/quality and content fit;
- disk/memory caching where appropriate;
- above-the-fold priority only when beneficial;
- invalid/expired remote URLs fail safely;
- no Unsplash/generic placeholder fallback;
- media upload avoids unnecessary base64 copies and handles large files within limits;
- video playback and preview do not leak players/listeners.

### 4. Network and Supabase

- bounded RPCs and queries with required indexes;
- no N+1 request pattern;
- search input is debounced/cancellable where needed;
- stale requests do not overwrite newer results;
- cache TTL and invalidation are intentional;
- retries use bounded backoff and do not duplicate writes;
- staging load tests review Supabase Performance Advisor and slow-query evidence.

### 5. Prefetch

Verify:

- duplicate images/routes/records are deduplicated;
- blank or invalid queries do nothing;
- prefetch failures are silent and non-blocking;
- disabled routes are not prefetched;
- merchant/admin data is not prefetched without authorization;
- low-end Android memory/network behavior remains acceptable;
- cache eviction prevents unbounded growth.

### 6. Rendering and lifecycle

- Zustand subscriptions select only needed state;
- effects clean up timers, subscriptions, players, and listeners;
- repeated background/foreground, app kill/reopen, and long sessions remain stable;
- animations respect reduced motion and do not monopolize JS/UI threads;
- map markers, geometry, and filters update incrementally rather than rebuilding unnecessarily.

### 7. Bundle and native build

Use the repository’s Expo/EAS configuration and production-like bundle commands. Review:

- JS and asset contribution;
- duplicate/unused dependencies;
- source maps and release minification;
- dev client/prototype assets excluded from production;
- native dependency and permission cost.

Do not use a universal bundle-size number without platform/build context.

## Execution

1. Establish a reproducible baseline before changes.
2. Profile with production-like JS and preview/release native builds on at least one recent iPhone and one mid/lower Android device.
3. Use profiler, network, memory, and backend query evidence to identify the bottleneck.
4. Apply one focused optimization group.
5. Rerun the same scenario and compare before/after results.
6. Record metrics, traces, screenshots, and residual risk in the task-specific performance audit and `tasks/verification.md`; do not create a loose root `performance_report.md`.

## Pass criteria

- No P0/P1 startup, memory, crash, jank, runaway network, or repeated-write issue.
- Core latency and stability targets pass on representative devices and staging data.
- Prefetch demonstrably helps or is removed/limited.
- No unbounded catalog/list/cache behavior.
- Before/after evidence supports every claimed optimization.
