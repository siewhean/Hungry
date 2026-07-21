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

The main integration gap was that the V2 catalog service explicitly had **no Excel fallback**. When Supabase was unconfigured, unreachable, unauthenticated, or returned a catalog error, the Discover catalog could render an error/empty state even though the app bundle already contained usable venue, dish, location, and menu-image data.

This change adds a read-only Excel catalog adapter and a Supabase-first resilient catalog service. Shared writes such as profiles, reviews, posts, and merchant changes are **not** redirected to mock or Excel behavior.

### Updated status

| Area | Before | After |
|---|---|---|
| Supabase catalog available | Online catalog renders | Unchanged |
| Supabase catalog unavailable | Catalog error/empty state | Bundled Excel catalog renders |
| Missing Supabase public config | Provider stayed on Supabase | Released build uses Excel catalog provider |
| Discover dish images | Menu images when online rows supplied them | Menu images from Supabase or Excel fallback |
| Stall images | Venue/representative menu image when supplied | Logo → venue image → representative dish image |
| All stalls | Online cursor paging only | Supabase or Excel cursor paging |
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

`src/lib/services/excel/excelService.ts` already provides location-aware discovery and search, including a large venue-count query and discovery feed construction.

### 2. The V2 raw catalog did not use that fallback

Before this change, `getCatalogRawService()` returned the Supabase raw service only when the active provider mode was `supabase`. Its own comment explicitly stated that it had no mock/Excel fallback.

The raw service also requires a configured Supabase client and authenticated session. A failure therefore prevented the already-bundled Excel data from reaching `CatalogDiscoverHome`.

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

Only catalog **reads** fall back. The profile/social/review/merchant write service remains unchanged.

### `src/lib/services/supabase/client.ts`

A released build with missing public Supabase URL/key now selects the Excel provider instead of showing an empty catalog.

When Supabase is correctly configured, released builds still use Supabase first.

### Test coverage

Added `src/lib/services/catalog/excelFallback.test.ts` covering:

- workbook totals exposed through catalog paging;
- distinct subsequent venue pages;
- real menu image URL selection;
- blocked placeholder rejection;
- venue image or representative dish image selection;
- non-empty Discover sections without Supabase.

Updated service-provider tests to recognize the released-build fallback policy.

---

## Data Visibility Contract

### Supabase available

- Use the release-versioned Supabase catalog.
- Use server-side paging and filters.
- Display approved catalog images returned by the RPCs.
- Continue to use Supabase for authenticated writes.

### Supabase unconfigured

- Select the Excel provider.
- Display the bundled buildings, venues, dishes, planning areas, and menu images.
- Keep the app useful for read-only food discovery.

### Supabase temporarily fails at runtime

- The raw catalog wrapper catches read failures.
- Discover, catalog Browse, details, menus, and map reads use the Excel adapter.
- Returned pages use the `excel-fallback-v1` release ID so subsequent pages/details stay on the same source.

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
6. dish and venue detail opened from an Excel fallback page.

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

---

## Remaining Risks

| Risk | Severity | Action |
|---|---:|---|
| Native visual verification not run in this environment | P0 before release | Run XcodeBuildMCP/Simulator QA and attach screenshots. |
| Remote menu URLs may expire or reject hotlinking | P1 | Audit failed-image hosts and migrate approved media to owned storage/CDN. |
| Runtime outage while signed out may still encounter auth-dependent online directory behavior | P1 | Verify guest path uses Excel provider/fallback in a release build. |
| Large Excel bundle increases binary size and memory | P1 | Measure EAS binary size and cold-load cost; consider split/chunked fallback later. |
| Fallback data is a bundle snapshot | P1 | Display data freshness/source and regenerate catalog for releases. |
| Supabase and Excel totals differ | Expected | Treat Supabase as canonical when healthy; Excel is resilient read coverage only. |

---

## Audit Verdict

### Static architecture verdict

**Go candidate for automated verification.**

The catalog now has a coherent Supabase-first and Excel-fallback read path. The Discover image pipeline uses actual menu/stall media where available, and the full catalog is accessible through paging rather than rendering all rows at once.

### Production verdict

**No-Go until automated checks and native iOS/Android visual QA pass.**

Do not mark this complete solely from static inspection. The final gate is an actual release-mode simulator/device run with Supabase healthy and Supabase unavailable.
