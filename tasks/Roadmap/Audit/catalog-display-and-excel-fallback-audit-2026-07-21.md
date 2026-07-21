# Catalog Display and Excel Fallback Audit

> Date: 2026-07-21  
> Branch: `frontend-design-overhaul`  
> Scope: Discover, Browse/Search, catalog images, Supabase availability, bundled Excel fallback, data completeness, and iOS verification handoff.

## Executive Summary

Hungry already contains two catalog sources:

1. the release-versioned Supabase food catalog; and
2. the bundled, rights-reviewed Excel runtime catalog.

The integration gap was that Supabase read failures could leave Discover, Search, Browse, or detail screens empty even though the bundled Excel catalog contained usable buildings, stalls, dishes, locations, and menu-image URLs.

The branch now keeps Supabase as the primary source and uses the Excel catalog as a **read-only fallback** for discovery and catalog reads. Profile, review, post, social, and merchant writes remain on Supabase and are never silently written into mock/Excel state.

## Changes Implemented

### Catalog adapter

`src/lib/services/catalog/excelFallback.ts` implements:

- paged dish directory reads;
- paged stall/venue directory reads;
- Discover sections;
- dish details;
- venue details;
- venue menus;
- map viewport records;
- query, cuisine, dietary, price, open-now, radius, and building filters.

### Legacy Discover/search fallback

`src/lib/services/serviceProvider.ts` wraps Supabase discovery reads so these methods fall back to the Excel provider on configuration, auth, network, RPC, timeout, empty, or missing-record failures:

- buildings and area venue counts;
- venue and dish reads;
- venue menus;
- nearby dishes;
- location-aware Discover feed;
- location-aware venue search;
- dish search;
- Decide For Me.

### Raw catalog fallback

The release-versioned raw catalog remains Supabase-first and falls back to Excel for:

- dishes;
- venues;
- Discover sections;
- detail/menu reads;
- map viewport reads.

Excel pages use the release ID `excel-fallback-v1`, keeping later cursor/detail reads on the same source.

### Image behavior

Dish image priority:

1. menu/gallery image;
2. primary dish image;
3. neutral image-unavailable state.

Stall image priority:

1. stall logo;
2. stall/venue image;
3. representative menu dish image;
4. name/initial or neutral unavailable state.

The Discover image policy rejects generic placeholder providers such as Unsplash and Picsum.

## Data Visibility Policy

The entire catalog should be reachable, but it should not be rendered simultaneously on one Discover screen.

- Discover shows representative, location-relevant content.
- The area-stall section reveals additional results incrementally.
- Browse Dishes and Browse Stalls provide cursor-paged full-directory access.
- Search filters the full source.
- Dish/stall details remain reachable from fallback pages.

This avoids loading thousands of cards into memory while ensuring records are accessible.

## Tests Added/Updated

- workbook totals surfaced in catalog results;
- cursor paging returns distinct later records;
- menu image URLs are used;
- blocked placeholder hosts are rejected;
- stall cards have a logo, venue image, or representative menu image where available;
- Discover sections work without Supabase;
- released builds stay Supabase-first while reads can fall back to Excel.

## Required Commands

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

With staging credentials:

```bash
npm run smoke:supabase-canonical-food-business-staging
npm run smoke:supabase-full-audit-v1
```

## Required iOS QA

Run in the Build iOS Apps / XcodeBuildMCP environment:

1. build and launch the app;
2. open Discover;
3. confirm menu images appear;
4. confirm stalls use stall logo/image or representative menu image;
5. open Browse Dishes and Browse Stalls;
6. load multiple pages;
7. disable Supabase connectivity and refresh;
8. confirm Excel-backed results replace the online error state;
9. open fallback dish and venue detail pages;
10. capture screenshots and logs;
11. repeat in production-like JS mode with `npx expo start --no-dev --minify`.

## Current Status

| Check | Status |
|---|---|
| Static integration audit | Complete |
| Excel read fallback | Implemented |
| Menu/stall image source policy | Implemented |
| Pagination tests | Added |
| GitHub CI | Not proven green; workflow currently fails before useful step/log output |
| Vercel preview | Externally blocked by daily deployment limit |
| Supabase staging smoke | Requires credentials |
| iOS simulator/device QA | Requires XcodeBuildMCP/Simulator environment |

## Remaining Risks

- Some remote source images may expire or block hotlinking; approved images should eventually move to owned storage/CDN.
- The bundled Excel catalog is a release snapshot and increases binary size.
- Full public-directory guest access needs an intentional RLS/product decision.
- Native visual behavior is not proven until simulator/device QA is completed.

## Verdict

**Static architecture: Go candidate for verification.**

**Production: No-Go until typecheck, lint, tests, Supabase smoke, security checks, and production-like iOS/Android visual QA pass.**
