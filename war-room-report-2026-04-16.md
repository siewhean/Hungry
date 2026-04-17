# War Room Report — 2026-04-16
> **Classification:** Internal — Lead Architect / CoS review  
> **Scope:** Full product + codebase status as of today  
> **Purpose:** Single-pane-of-glass for moving Hungry from prototype to production

---

## 1. Executive Summary

Hungry is a fully functional, demo-ready mobile app with a complete frontend stack (Expo SDK 54 / React Native 0.81, TypeScript strict, Zustand, React Navigation v7, Mapbox). The AI Food Engine ships and works. The V2 backend schema is designed and documented. Marketing collateral exists.

**The gap between prototype and production is well-understood.** There are 9 demo-breaking bugs (P0) that have not been fixed since the Sprint 6 audit on 2026-04-08. All 9 are wiring/data issues — no new feature work required. Beyond P0s, the production path is three sequential platform layers: backend bootstrap → QR ordering → real-time messaging.

**The platform-readiness number is approximately 35%.** The frontend shell is at ~85% against PRD requirements. The backend is at 0% (all mock). Payments, ordering, and chat are unbuilt.

---

## 2. What Shipped (Confirmed Complete)

| Area | Detail | Status |
|---|---|---|
| Frontend shell | All screens implemented across 5 tabs | ✅ |
| Auth flows | Login, SignUp, ForgotPassword, ResetPassword, EmailVerification, Google stub | ✅ |
| Taste quiz | 8-step gamified onboarding → TasteVector | ✅ |
| AI Food Engine | `tasteEngine.ts`: cosine similarity, blended score, `decideForMe`, `calibrateVector`, quiz → vector | ✅ |
| Maps | Mapbox wrapper, building pins, Maxwell L1/L2 floor plan, BuildingDrillDown screen | ✅ |
| Reads | Blog feed (feature-flagged, EatBook / SethLui fixtures) | ✅ |
| Marketing | Positioning, waitlist copy, 30-day content calendar, video briefs, outreach playbook | ✅ |
| Sprint 6 audit | Full PRD vs codebase gap analysis — 9 P0s, 11 P1s, 8 P2s documented | ✅ |
| V2 backend schema | 30+ table Postgres DDL, PostGIS, pgvector, indexes, FK policy, rating trigger | ✅ |
| Infra hygiene | Hook bug fixed (`security_reminder_hook.py`), Vercel CLI upgraded to 50.42.0 | ✅ |

---

## 3. Open Risk Register

### 🔴 CRITICAL — P0 Dead Ends (Demo-Breaking)

Nine issues have been known since 2026-04-08 and are still unresolved.

| # | Issue | File | User Impact |
|---|---|---|---|
| P0-1 | `TasteFilter` route → `DeferredRouteScreen` | `RootNavigator.tsx` ~L266 | User taps "Filter by taste" → dead end |
| P0-2 | `BuildingDrillDown` route → `DeferredRouteScreen` | `RootNavigator.tsx` ~L275 | User taps building map pin → dead end |
| P0-3 | Profile doesn't sync after login | `useSessionStore.ts`, `useProfileStore.ts` | Profile stays as guest after authentication |
| P0-4 | `BitesCarousel` wrong dish IDs | `BitesCarousel.tsx` ~L23 | `"dish-1"` doesn't exist → runtime lookup fails |
| P0-5 | `BitesCarousel` "See all" → PostComposer | `BitesCarousel.tsx` ~L148 | User expects a feed, lands on compose screen |
| P0-6 | `MapZoomedIn` is a text placeholder | `MapZoomedInScreen.tsx` | User zooms map → static "placeholder next" text |
| P0-7 | `StallDetail` receives `dishId` as `venueId` | `BitesCarousel.tsx` ~L123 | Wrong stall loaded (or crash) |
| P0-8 | `useNavigation<any>()` type unsafety | `BitesCarousel.tsx` + others | Silent runtime navigation errors |
| P0-9 | `BitesCarousel` inline mock breaks data architecture | `BitesCarousel.tsx` | Direct import from `data.ts` bypasses repo layer |

**Estimated fix time: ~4 hours.** All are wiring or field-mapping changes, not new feature work.

### 🟡 HIGH — P1 Beta Blockers (11 items)

| Category | Issues |
|---|---|
| Empty states | FavouritesScreen, ReviewHistoryScreen, ProfileHomeScreen (guest) |
| Review flow | Submit doesn't persist, no success toast, no quick-review (F-018) |
| Auth | No error feedback for invalid credentials |
| Service layer | `HungryService` 75% unimplemented; missing `getBuildingDetail()`, `getFloorPlan()`, `getBites()` |
| Discovery | Situation presets (F-015) and dietary toggle on Discover root (F-014) missing |
| Loading | No skeleton screens anywhere; no connectivity detection for `OfflineStateScreen` |

### 🟢 LOW — P2 Polish (8 items)

Unit tests, deep linking, haptics, real share URL, photo carousel, code co-location, font error handling, store future-proofing.

---

## 4. PRD Feature Compliance

| ID | Feature | Status | Notes |
|---|---|---|---|
| F-001 | User accounts + Auth | ✅ | Google stub not live |
| F-002 | Taste Profile (Onboarding) | ✅ | |
| F-003 | Location permissions | ✅ | |
| F-004 | Building Drill-Down | ⚠️ | Screen built, **route disconnected** (P0-2) |
| F-005 | Dish-First Search | ✅ | |
| F-006 | Taste-Based Filtering | ⚠️ | Screen built, **route disconnected** (P0-1) |
| F-007 | Decide For Me | ✅ | AI engine live |
| F-008 | Dish Detail | ✅ | Photo carousel not wired to `gallery[]` (P2) |
| F-009 | Stall Detail | ✅ | |
| F-010 | Dish-Level Reviews | ⚠️ | Flow exists, **submit doesn't persist** (P1) |
| F-011 | Favourites | ✅ | Empty state missing (P1) |
| F-012 | Delivery Deep Links | ✅ | |
| F-013 | Blog Aggregator (Reads) | ⚠️ | Works, **hidden behind root route** not tab bar |
| F-014 | Halal / Dietary Filter | ⚠️ | In Search only, **not Discover root** (P1) |
| F-015 | Situation-Based Discovery | ❌ | Not implemented |
| F-016 | NEA Closure Integration | ✅ | `isClosedToday` badge in UI |
| F-017 | Business Portal | 🚫 | Out of scope (correct) |
| F-018 | 30-Second Tag Review | ⚠️ | Tag step exists, always routes through full 4-step |
| F-019 | Photo Check-In | ❌ | PostComposer is text-first, not 1-tap photo |

**PRD compliance: 10/19 fully implemented, 6/19 partial, 2/19 not started, 1/19 out of scope.**

---

## 5. Technical Architecture Status

### Frontend

| Layer | State | Notes |
|---|---|---|
| TypeScript | ✅ Strict, passing | Zero suppressions |
| Navigation | ⚠️ Mostly wired | 2 routes still → `DeferredRouteScreen` |
| State (Zustand) | ⚠️ Functional | Profile sync bug; no cart/order stores |
| Mock data layer | ⚠️ Partial | `HungryService`: 10/41 methods implemented |
| AI Engine | ✅ Production-ready | All functions pure, testable |
| Mapbox | ⚠️ Token-dependent | Fallback static preview without token |
| Tests | ❌ Zero coverage | `__tests__/` empty; no Jest config for RN |

### Backend

| Layer | State | Notes |
|---|---|---|
| Supabase project | ❌ Not provisioned | |
| Database schema | ✅ Designed | Full DDL in `tasks/backend-architecture.md` |
| Auth | ❌ Not configured | Supabase Auth chosen |
| API endpoints | ❌ Not built | Design complete in `backend-architecture.md §5` |
| Payments (Stripe) | ❌ Not built | System design in `mvp_audit_and_v2_roadmap.md §2.2` |
| Real-time (Socket.IO) | ❌ Not built | System design in `mvp_audit_and_v2_roadmap.md §2.1` |
| CDN / Storage | ❌ Not provisioned | Vercel Blob or Supabase Storage |

---

## 6. Production Path — Sequenced

```
TODAY         SPRINT 7         SPRINT 8         PHASE 7          PHASE 8         PHASE 9/10
              (P0 fixes)       (P1 beta hard)   (Backend boot)   (QR + Pay)      (Chat + Analytics)
──────────────────────────────────────────────────────────────────────────────────────────────────
Prototype     ──── ~4h ────>   ─── ~1wk ──>     ─── ~3wk ───>    ── ~6wk ──>     Ongoing
war room      All dead ends    Beta-ready        API live          Revenue live     Platform
report        fixed            demo app          real data         first order      scaling
```

### Sprint 7 (This Week) — Fix P0s
**Effort:** ~4 hours | **Owner:** Codex  
Wire the 2 disconnected routes, fix profile sync, fix BitesCarousel data/navigation. Typecheck must pass.

### Sprint 8 (Next Week) — P1 Beta Hardening  
**Effort:** ~1 week | **Owner:** Codex primary  
Empty states, review persistence, auth error feedback, service layer completion, situation presets.

### Phase 7 (~3 weeks) — Backend Bootstrap  
**Effort:** 3 engineer-weeks | **Owner:** Backend  
Provision Supabase, run migrations, implement discovery + search + recommendation API endpoints, replace mock repositories behind feature flag.

### Phase 8 (~6 weeks) — QR Order & Pay  
**Effort:** 6 engineer-weeks | **Owner:** Full-stack  
Stripe integration, order lifecycle, vendor dashboard MVP, guest checkout.

### Phase 9/10 (~4 weeks) — Chat + Analytics  
**Effort:** 4 engineer-weeks | **Owner:** Full-stack  
Socket.IO messaging, PostHog event instrumentation, vendor analytics dashboard.

---

## 7. Decisions Needed

| Decision | Options | Recommended | Needed By |
|---|---|---|---|
| Backend host | Supabase vs Postgres on Fly.io | **Supabase** — built-in auth, pgvector, storage, realtime | Before Phase 7 |
| API layer | Supabase Edge Functions vs Node.js/Express | **Both** — Edge Functions for CRUD, Express/Node for Socket.IO | Before Phase 7 |
| Payment gateway | Stripe only vs Stripe + PayNow | **Stripe primary + PayNow SGQR** as alternative | Before Phase 8 |
| Vendor portal | Separate repo vs monorepo | **Separate repo** — different release cadence, different auth model | Before Phase 8 |
| Chat transport | Socket.IO vs Supabase Realtime only | **Socket.IO** — typing indicators, reconnection, custom events | Before Phase 10 |
| Mobile deployment | Expo Go vs EAS Build | **EAS Build** — required for production + OTA updates | Before App Store |
| Analytics | PostHog vs Amplitude vs Mixpanel | **PostHog** — self-hostable, SQL access, feature flags built in | Before Phase 11 |

---

## 8. Key Documents

| Document | Location | Purpose |
|---|---|---|
| Product requirements | `tasks/product-context.md` | Feature spec, personas, MVP definition |
| Data contracts (V1) | `tasks/data-contracts.md` | TypeScript domain types, mock fixture shapes |
| Backend architecture (V2) | `tasks/backend-architecture.md` | Full Postgres schema, API design, commerce flow |
| V2 audit + feature roadmap | `tasks/Roadmap/mvp_audit_and_v2_roadmap.md` | Sprint 6 audit, messaging/ordering/guest system design |
| V1 architecture plan | `tasks/Roadmap/mvp_audit_and_v1_roadmap.md` | Strategic decisions, persona analysis, scaling strategy |
| Design system | `tasks/design-system.md` | Tokens, components, Figma source of truth |
| Screens + navigation | `tasks/screens.md` | Full screen inventory, route map |
| Test harness | `tasks/test-harness.md` | Verification matrix, QA protocol |
| Past lessons | `tasks/lessons.md` | Rules extracted from past corrections |
| Master task list | `tasks/todo.md` | This project's execution contract |
| Marketing launch kit | `marketing/` | Positioning, content calendar, outreach |
| AI Engine | `src/lib/ai/tasteEngine.ts` | Cosine similarity, recommend, calibrate |

---

## 9. Immediate Actions (Next 48 Hours)

| Priority | Action | Owner | Effort |
|---|---|---|---|
| 🔴 1 | Wire `TasteFilter` + `BuildingDrillDown` routes in `RootNavigator.tsx` | Codex | 30 min |
| 🔴 2 | Fix `useProfileStore` sync in `useSessionStore.completeAuth()` | Codex | 30 min |
| 🔴 3 | Fix `BitesCarousel` — IDs, navigation, data architecture | Codex | 2h |
| 🔴 4 | Fix `MapZoomedIn` — wire to `BuildingDrillDownScreen` or remove | Codex | 30 min |
| 🔴 5 | Run `npm run typecheck` after all fixes — must pass | Codex | 10 min |
| 🟡 6 | Provision Supabase project (free tier) | Backend | 1h |
| 🟡 7 | Run `0001_v2_initial_schema.sql` migration | Backend | 2h |
| 🟡 8 | Seed fixtures from V1 mock data | Backend | 2h |

---

*Report generated: 2026-04-16 | Next review: After Sprint 7 closes*
