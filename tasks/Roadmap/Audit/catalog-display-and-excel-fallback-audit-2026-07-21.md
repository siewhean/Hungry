# Catalog Display and Excel Fallback Audit

> Date: 2026-07-21  
> Branch: `codex/catalog-excel-fallback-audit`  
> Base: `main`  
> Scope: Discover, Browse/Search, catalog images, Supabase availability, bundled Excel fallback, data completeness, and iOS verification handoff.

---

## Executive Summary

The app already contained two large catalog sources:

1. the release-versioned Supabase catalog used by the V2 catalog read service; and
2. the bundled, rights-reviewed Excel runtime catalog used by the Excel provider.

The main integration gap was that the V2 catalog service explicitly had **no Excel fallback**. The legacy Supabase discovery methods also returned an empty/error result when Supabase was unconfigured, unreachable, unauthenticated, or returned an RPC error, even though the app bundle already contained usable venue, dish, location, and menu-image data.

This change adds a read-only Excel catalog adapter, a Supabase-first resilient raw catalog service, and a read-only fallback around the legacy discovery methods. Shared writes such as profiles, reviews, posts, and merchant changes are **not** redirected to mock or Excel behavior.

### Updated status

| Area | Before | After |
|---|---|---|
| Supabase catalog available | Online catalog renders | Unchanged |
| Supabase catalog unavailable | Catalog error/empty state | Bundled Excel catalog renders |
| Missing Supabase public config | Released provider could not return catalog data | Released provider remains Supabase-first and its discovery/catalog reads use Excel fallback |
| Legacy Discover feed | Online results only | Supabase results or location-aware Excel discovery feed |
| Discover dish images | Menu images when online rows supplied them | Menu images from Supabase or Excel fallback |
| Stall images | Venue/representative menu image when supplied | Logo → venue image → representative menu dish image |
| All stalls | Online paging or limited legacy results | Supabase/Excel paging for full directory; Discover exposes representative nearby results with Show More |
| Writes during fallback | Not applicable | Remain on configured write service; fallback is catalog-read-only |

---

## Repository Findings

### 1. The Excel runtime catalog was already usable

`src/lib/services/excel/repositories.ts` already provides:

- buildings;
- venues/stalls;
- dishes/menu items;
- location coordinates and planning areas;
- image and logo URL sanitization;
- search by query, cuisine, dietary flags, price, open status, area, and radius;
- nearby/popular ranking that prioritizes rows with real images.

`src/lib/services/excel/excelService.ts` already provides location-aware discovery and search, including venue-count queries and discovery feed construction.

### 2. The online catalog and legacy discovery paths did not use that fallback

Before this change, `getCatalogRawService()` returned the Supabase raw service only when the active provider mode was `supabase`. Its own comment explicitly stated that it had no mock/Excel fallback.

The raw service requires a configured Supabase client and authenticated session. The legacy discovery methods also depended on successful online reads. A configuration, auth, network, or RPC failure could therefore prevent the already-bundled Excel data from reaching Discover, Browse, detail, or map surfaces.

### 3. Discover already rejects generic placeholder hosts

`src/features/discover/bites.ts` rejects image hosts such as:

- Unsplash;
- Picsum;
- Wikimedia placeholder-style sources.

It prioritizes dish gallery images and the dish's actual image URL. This means the principal image problem was not the card component choosing Unsplash; it was incomplete or unavailable catalog rows reaching the screen.

### 4. Showing every stall on one Discover screen is not appropriate

The complete catalog should be **accessible**, not mounted simultaneously. Rendering thousands of stalls at once would harm memory, startup time, scrolling, and network usage.

The required behavior is:

- Discover shows representative nearby sections;
- Discover's area-stall section supports incremental Show More;
- Browse/Search exposes the full directory;
- cursor paging or infinite scrolling loads subsequent pages;
- totals indicate catalog coverage;
- images are loaded lazily and cached.

---

## Changes Implemented

### `src/lib/services/catalog/excelFallback.ts`

Added a catalog adapter with the same read contract as the raw Supabase catalog:

- `listDishes()`;
- `getDiscoverSections()`;
- `listVenues()`;
- `getDish()`;
- `getVenue()`;
- `listVenueMenu()`;
- `getMapViewport()`.

The adapter supports:

- cursor paging;
- query filtering;
- nearby distance sorting;
- radius filtering;
- cuisine filters;
- dietary filters;
- max-price filtering;
- open-only filtering;
- building-type filtering;
- dish and venue detail reads;
- map viewport reads.

Image precedence is:

1. stall logo;
2. stall/venue image;
3. representative menu dish image;
4. explicit `Image unavailable` UI when no valid image exists.

The fallback uses the bundled catalog's menu images. It does not introduce Unsplash or generic remote placeholder imagery.

### `src/lib/services/serviceProvider.ts`

`getCatalogRawService()` is now resilient:

1. call the Supabase raw catalog first;
2. preserve the Supabase result when successful;
3. fall back to the bundled Excel catalog on configuration, auth, network, RPC, timeout, or empty-release failure;
4. preserve the fallback release ID for subsequent detail/menu pagination reads.

The Supabase provider's **read-only discovery methods** are also wrapped with Excel fallback:

- buildings and area counts;
- venue and dish reads;
- venue menus;
- popular nearby;
- location-aware Discover feed;
- location-aware venue search;
- dish search;
- Decide For Me.

Only discovery/catalog **reads** fall back. The profile/social/review/merchant write service remains unchanged.

### `src/lib/services/supabase/client.ts`

Released builds remain on the Supabase-first provider so the same route and screen behavior is preserved. If public Supabase configuration is absent, the Supabase client returns `null` and the resilient discovery/catalog wrappers serve the bundled Excel data.

Development builds can still explicitly select Supabase, Excel, or mock. Without an explicit source and without Supabase configuration, development defaults to the Excel provider rather than a tiny mock catalog.

### Test coverage

Added `src/lib/services/catalog/excelFallback.test.ts` covering:

- workbook totals exposed through catalog paging;
- distinct subsequent venue pages;
- real menu image URL selection;
- blocked placeholder rejection;
- venue image or representative dish image selection;
- non-empty Discover sections without Supabase.

Updated service-provider tests to verify that released builds remain Supabase-first while reads can fall back to Excel.

---

## Data Visibility Contract

### Supabase available

- Use the release-versioned Supabase catalog.
- Use server-side paging and filters.
- Display approved catalog images returned by the RPCs.
- Continue to use Supabase for authenticated writes.

### Supabase unconfigured

- Keep the released app on the Supabase-first provider.
- The missing client causes discovery/catalog reads to use the bundled Excel fallback.
- Display bundled buildings, venues, dishes, planning areas, and menu images.
- Authenticated writes remain unavailable until Supabase configuration is restored; the app does not fake successful writes.

### Supabase temporarily fails at runtime

- The legacy discovery wrapper and raw catalog wrapper catch read failures.
- Discover, catalog Browse, details, menus, search, Decide For Me, and map reads use the Excel data.
- Raw catalog pages use the `excel-fallback-v1` release ID so subsequent pages/details stay on the same source.

### No valid image

- Do not substitute Unsplash.
- Do not invent a stall logo.
- Show a neutral image-unavailable state or name/initial logo treatment.

---

## Required QA

### Automated

Run from repo root:

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run test:e2e
npx expo-doctor --non-interactive
npm run audit:assets
npm run audit:supabase:static
npm run smoke:database:location
npm run smoke:database:search
npm run smoke:database:rls
```

### Supabase staging

```bash
npm run smoke:supabase-canonical-food-business-staging
npm run smoke:supabase-full-audit-v1
```

Test these states:

1. Supabase healthy and authenticated;
2. Supabase URL/key absent;
3. Supabase RPC returns an error;
4. network disabled after a successful session;
5. catalog page 1 and subsequent cursor pages;
6. dish and venue detail opened from an Excel fallback page;
7. guest Discover shows Excel-backed nearby stalls during an online outage;
8. Search/Browse can reach subsequent stall and dish pages.

### iOS simulator/device

The following must be run in Codex with the Build iOS Apps / XcodeBuildMCP workflow because this audit environment does not have the simulator-control tools:

1. build and launch the iOS app;
2. open Discover;
3. verify menu images are visible;
4. verify stall rows use stall logo/image or representative menu dish;
5. tap Browse Dishes and Browse Stalls;
6. scroll through multiple pages;
7. disable Supabase connectivity and refresh;
8. verify Excel data replaces the online catalog error;
9. open fallback dish and venue details;
10. capture screenshots and console logs.

Suggested existing native commands:

```bash
npm run smoke:native:ios:prepared
npm run smoke:native:ios:media:prepared
```

For production-like JavaScript behavior, also run:

```bash
npx expo start --no-dev --minify
```

---

## Current Verification Status

| Check | Status | Notes |
|---|---|---|
| Static code audit | Complete | Supabase-first + Excel read fallback implemented. |
| Fallback unit tests added | Complete | Tests committed but not proven green in this environment. |
| GitHub CI | Blocked | Jobs fail before useful step/log output is returned. |
| Security workflow | Blocked | Workflow fails before usable step/log output is returned. |
| Vercel preview | Blocked externally | Free daily deployment limit exceeded. |
| Automated AI review | Blocked externally | Codex/Copilot review quota exhausted. |
| iOS simulator/device visual QA | Not run | XcodeBuildMCP/simulator tools are unavailable in this conversation. |
| Supabase staging smoke | Not run here | Requires staging credentials. |

---

## Remaining Risks

| Risk | Severity | Action |
|---|---:|---|
| Native visual verification not run in this environment | P0 before release | Run XcodeBuildMCP/Simulator QA and attach screenshots. |
| Automated checks have not produced usable results | P0 before merge | Run locally or restore GitHub Actions capacity/logging, then attach results. |
| Remote menu URLs may expire or reject hotlinking | P1 | Audit failed-image hosts and migrate approved media to owned storage/CDN. |
| Raw full-directory catalog may require auth | P1 | Decide whether the complete public directory should be guest-readable; keep RLS intentional. |
| Large Excel bundle increases binary size and memory | P1 | Measure EAS binary size and cold-load cost; consider split/chunked fallback later. |
| Fallback data is a bundle snapshot | P1 | Display data freshness/source and regenerate catalog for releases. |
| Supabase and Excel totals differ | Expected | Treat Supabase as canonical when healthy; Excel is resilient read coverage only. |

---

## Audit Verdict

### Static architecture verdict

**Go candidate for automated and native verification.**

The catalog now has a coherent Supabase-first and Excel-fallback read path. The Discover image pipeline uses actual menu/stall media where available, legacy Discover can recover with location-aware Excel data, and the full catalog is accessible through paging rather than rendering all rows at once.

### Production verdict

**No-Go until automated checks and native iOS/Android visual QA pass.**

Do not mark this complete solely from static inspection. The final gate is an actual production-like simulator/device run with Supabase healthy and Supabase unavailable, plus successful typecheck/lint/test/security verification.

---

## PR #44 closeout update — 2026-07-24

Implementation SHA: `da3d6dd4959af08ac13ef3404d1ed8a0863cc86d`.

- Repo-local source suite: 617 passed, 0 failed, 2 intentional credential-gated skips; typecheck, lint, source formatting, asset audit, static Supabase and Edge checks pass; `npm audit` reports 0 vulnerabilities.
- The strict catalog media boundary now requires explicit display approval and a recognised rights state. This safely withholds raw, placeholder, unverified and social-hero media instead of rendering it.
- Excel has contract proof for three distinct dish and venue pages, cursor reset, release/source-bound details and signed-out denial. Live raw Supabase pages are not release-ready: page 3 contains `dsh-mock-*` data and venue pages have semantic duplicates.
- Exact pilot candidates and their image/right states are recorded in `tasks/Roadmap/Release/release-0.1-pilot-catalog.md`; only three of ten pairs have approved/permitted media. Aggregate pilot imagery is 5/273 venues (1.83%) and 511/876 dishes (58.33%), which is insufficient for first-screen visual readiness.
- Canonical and full-audit Supabase smokes pass, but location (and therefore search/RLS continuation) returns HTTP 402 `exceed_db_size_quota`. The non-password Advisor gate fails on app-owned remote findings and local/remote migration history diverges.
- The mandatory-auth Playwright release subset passes 3/3 on an isolated current-source server. The full suite and merchant harness are not acceptance evidence because their legacy Developer Launcher harness cannot run under the non-dev Expo Web bundle.
- No final-SHA EAS iOS or Android artifact, installed-device run, screenshots, or five-tester evidence exists.

**Current production verdict: No-Go.** Do not enable visual catalog claims, fallback claims, or a release label until the remote data/security, staging, final-artifact and tester gates in the closeout report pass.
