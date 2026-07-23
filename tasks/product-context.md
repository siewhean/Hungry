# product-context.md — Product Requirements & App Context

> Derived from the Hungry product requirements, app-flow, frontend-guideline, research, and approved product-policy updates. Use this as stable product context; use `tasks/backlog.md` and `tasks/verification.md` for implementation status.

## Core identity

| Key | Value |
|---|---|
| Tagline | “Find the dish. Not just the restaurant.” |
| Secondary | “Find the dish. Makan nearby.” |
| Primary data object | Individual dish, not only the venue/restaurant |
| Primary market | Singapore locals, residents, and visitors |
| Platform | Expo/React Native app plus public, merchant, and operational web surfaces |
| Backend | Supabase PostgreSQL, Auth, Storage, RPCs, RLS, and Edge Functions |
| Catalog continuity | Bundled rights-reviewed Excel catalog, authenticated read-only fallback only |

## Mandatory account policy

Hungry does not support guest mode.

```text
Fresh user: Splash → Onboarding → Create Account / Sign In → verification when required → authenticated app
Returning user: Splash → secure session restoration → authenticated app, or Login when no valid session exists
```

Rules:

- MainTabs and app data surfaces must not mount before authentication.
- Supabase is mandatory for authentication and every shared write.
- Missing release configuration, failed login/signup, signed-out state, missing/invalid/revoked sessions, and deep-link bypass attempts remain outside the app shell.
- Excel fallback is available only after a valid Supabase-authenticated session has been restored and an eligible catalog network/RPC/release outage occurs.
- A successful empty search remains empty; fallback must not replace legitimate no-results.

Public privacy, terms, support, and account-deletion web pages may remain available outside the authenticated app.

## Problem this product solves

| Problem | Product response |
|---|---|
| Decision fatigue | Dish-first ranking, filters, nearby discovery, and Decide For Me |
| Restaurant-centric competitors | Search and detail surfaces organised around individual dishes and stalls |
| Hawker centres are difficult to navigate | Location, building, floor/unit, stall, menu, and map context |
| Food information is scattered | Canonical catalog, source provenance, merchant input, and curated public content |
| Cuisine filters do not express cravings | Taste vectors and taste/dietary intent filters |
| Hawker culture is under-served | Singapore-first hawker and food-court coverage |

## User personas

### Persona 1 — The indecisive local

| Attribute | Value |
|---|---|
| Archetype | Wei Ming, 26, CBD office worker |
| Goals | Find food near work in under three minutes; discover stalls; remember favourites |
| Pain points | Daily decision fatigue; venue-first tools do not explain what to order |
| Device emphasis | Android |

### Persona 2 — Tourist or expat explorer

| Attribute | Value |
|---|---|
| Archetype | Sarah, 34, new to Singapore |
| Goals | Navigate hawker centres; discover local dishes; understand stalls and menus |
| Pain points | Hawker complexity; disconnected articles; unfamiliar dish names |
| Device emphasis | iPhone |

### Persona 3 — Hawker or merchant operator

| Attribute | Value |
|---|---|
| Archetype | Uncle Tan, second-generation stall owner |
| Goals | Be discoverable; maintain menu/profile; understand customer interest |
| Pain points | Limited digital presence and time; fragmented platforms |
| Product surface | Feature-gated merchant app/web surfaces backed by Supabase |

## MVP feature set

### Core features

| ID | Feature | Key requirement |
|---|---|---|
| F-001 | Accounts and authentication | Mandatory account; email/password; approved OAuth providers when enabled; verification and recovery flows |
| F-002 | Taste profile onboarding | Quiz seeds taste preferences; onboarding selections persist and migrate to the authenticated profile |
| F-003 | Location | Clear permission purpose; manual fallback; app handles denial safely |
| F-004 | Building/stall navigation | Map or list → building/stall/menu/detail context with safe missing-data states |
| F-005 | Dish-first search | Search dishes, stalls, and areas with bounded server-side paging and location relevance |
| F-006 | Taste/dietary filtering | Taste, dietary, cuisine, location, price, and availability filters where supported by canonical data |
| F-007 | Decide For Me | Select a suitable nearby dish without false precision or fake data |
| F-008 | Dish detail | Approved menu media, price, taste context, reviews, source and venue context |
| F-009 | Stall detail | Stall identity, building/unit, hours, menu, directions, merchant claim state where enabled |
| F-010 | Dish-level reviews | Authenticated rating/text/tags/media with storage ownership and moderation safeguards |
| F-011 | Favourites | Supabase-backed saved dishes with useful sorting and reliable rehydration |
| F-012 | Delivery links | Safe allowlisted external links; hide when unavailable |
| F-013 | Posts and profile history | Supabase-backed public/private content with media, moderation, report/block/delete controls |
| F-014 | Account settings | Profile, privacy, notification/device settings, password/recovery, and account deletion |

### Feature-gated secondary surfaces

These are not assumed production-ready merely because code exists:

- merchant centre and merchant claim flows;
- direct messages, comments, and stories;
- Passport, missions, collections, checklists, and portfolios;
- OCR and operations workflows;
- floorplans and experimental map/drill-down variants;
- AI creator/business tools;
- public promotions and advanced analytics.

Each requires its own flag, role boundary, canonical data source, moderation/security review, tests, and release evidence.

## Explicit MVP exclusions

- In-app ordering or payment unless separately approved and audited.
- Table reservations.
- Unmoderated public messaging or user-generated-content surfaces.
- International-market assumptions in Singapore MVP data and copy.
- Grocery, recipes, or delivery logistics.
- Production use of mock providers, fake counts, placeholder claims, or generic stock food images.

## Key UX specifications

### Taste vector

| Spec | Detail |
|---|---|
| Dimensions | sweet, spicy, sour, salty, rich, aromatic |
| Implementation range | Canonical implementation uses the domain model; adapters normalise external formats |
| User profile | Seeded during onboarding and stored on the authenticated profile |
| Matching | Explainable recommendation score; no unsupported confidence claims |

### Decide For Me

| Spec | Detail |
|---|---|
| Trigger | Prominent authenticated action with accessible label and safe haptics |
| Inputs | User taste, dietary rules, selected/current location, canonical availability |
| Result | Dish, stall, location context, source-backed image, and clear retry/expand behavior |
| No match | Show a real no-results/expand-filter state; do not inject unrelated fallback results |

### Favourites sorting

Users should be able to revisit saved dishes by:

- dish type or taxonomy;
- rating where real data exists;
- taste similarity;
- distance, area, building, or stall;
- recent save/visit activity.

### Location and permissions

- Explain location use before or with the native permission request.
- Permission denial must not crash or trap the user.
- Manual area selection remains available.
- Do not collect or retain precise location beyond the disclosed product need.

### Media

- Prefer menu-derived dish media.
- Stall cards use stall logo → stall/venue image → representative menu dish image.
- Reject generic placeholder providers such as Unsplash for production catalog cards.
- Display only rights-approved media and preserve provenance.

### Authenticated access matrix

| State | Expected behavior |
|---|---|
| Fresh install | Splash then local onboarding |
| Onboarding complete, no account | Mandatory Create Account / Sign In |
| Authenticated, Supabase healthy | Full approved app and Supabase reads/writes |
| Authenticated, eligible catalog outage | Read-only Excel catalog continuity; writes unavailable with clear feedback |
| Signed out | Auth flow only; no MainTabs or Excel catalog |
| Missing/invalid/revoked session | Clear sensitive state and return to auth |
| Missing production Supabase config | Blocking configuration/service-unavailable state |

## Performance and quality targets

| Action | Target or principle |
|---|---|
| Cold start to usable | Under three seconds on representative devices where practical |
| Search response | Fast perceived response; staging p95 target documented in performance QA |
| Detail load | Bounded request, skeleton/loading/error handling, no full-catalog hydration |
| Tab interaction | Immediate response; prefetch must not block navigation |
| Catalog paging | Cursor-paged and deduplicated; do not mount the full catalog at once |
| Image loading | Cached, correct aspect ratio, safe failure state, no placeholder-host fallback |
| Offline/outage | Read continuity only when policy allows; no false write success |

## Current data sources

| Data | Canonical source |
|---|---|
| Authentication and account | Supabase Auth and profile tables |
| Shared user/merchant content | Supabase database and storage under RLS |
| Release catalog | Supabase release-versioned catalog/RPCs |
| Catalog outage continuity | Bundled validated Excel runtime catalog after authentication |
| Canonical source work | Versioned workbook and audited enrichment/reconciliation pipelines |
| Location/building data | Approved imported/enriched sources with provenance |
| Analytics/crash data | Configured PostHog/Sentry sinks with privacy scrubbing |

## Tone and content rules

| Do | Do not |
|---|---|
| Direct, warm, locally knowledgeable | Corporate jargon or exaggerated claims |
| Use specific real dish and stall context | Generic “amazing restaurants” copy |
| Use approved menu/stall photos | Unsplash, generic stock food, or unapproved AI food imagery |
| Explain source/freshness when relevant | Present uncertain data as verified fact |
| Use accessible labels and clear errors | Rely on icon-only or color-only meaning |

## Current navigation reference

The authenticated consumer shell currently centres on:

- Home feed;
- Discover/search;
- Create post action;
- Review;
- Profile and settings.

Root routes provide details, browse/search, map, activity, auth/account, and feature-gated advanced or merchant surfaces. `src/app/navigation/navigationTypes.ts`, navigator registration, feature flags, and route guards are the implementation source of truth. Do not reorder tabs or expose hidden routes without explicit product approval and verification.
