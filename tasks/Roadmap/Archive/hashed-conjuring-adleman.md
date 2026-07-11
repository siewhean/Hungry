# Plan — Sprint 7 Review & Sprint 8 Update

## Context

This document was originally written at the 2026-04-16 checkpoint and is now superseded for Sprint 7 status.
As of 2026-04-17, Sprint 7 P0 items are closed in code and validated in `tasks/todo.md` wave logs.

Current source of truth:
- `tasks/todo.md`
- `src/app/navigation/RootNavigator.tsx`
- `src/components/social/BitesCarousel.tsx`
- `src/app/screens/discover/MapZoomedInScreen.tsx`
- `src/store/useSessionStore.ts`

## Sprint 7 Audit — Ground Truth (2026-04-17)

| # | Item | File | Status | Evidence |
|---|------|------|--------|----------|
| 1 | Wire `TasteFilter` to real screen | `src/app/navigation/RootNavigator.tsx` | ✅ DONE | `component={TasteFilterScreen}` is registered |
| 2 | Wire `BuildingDrillDown` to real screen | `src/app/navigation/RootNavigator.tsx` | ✅ DONE | `component={BuildingDrillDownScreen}` is registered |
| 3 | Profile sync on auth | `src/store/useSessionStore.ts` | ✅ DONE | `completeAuth()` calls `syncProfile(true)` |
| 4 | `BitesCarousel` real data (P0 scope) | `src/components/social/BitesCarousel.tsx` | ✅ DONE | Uses `getHomeBitesFeed()` fallback path, no broken hardcoded IDs path |
| 5 | `BitesCarousel` "See all" navigation | `src/components/social/BitesCarousel.tsx` | ✅ DONE | Header action routes to `SearchHome` |
| 6 | Remove `MapZoomedIn` placeholder | `src/app/screens/discover/MapZoomedInScreen.tsx` | ✅ DONE | Screen renders functional map/sheet flow |
| 7 | StallDetail param field (`venueId`) | current bites/stall flow | ✅ DONE | Current runtime flow uses correct venue-based routing |
| 8 | Replace `useNavigation<any>` with typed nav (Sprint 7 P0 scope) | Sprint 7 surfaces | ✅ DONE | P0-targeted surfaces now typed |
| 9 | `npm run typecheck` green | `tasks/todo.md` wave log | ✅ VERIFIED | Wave verification logs mark typecheck passing |

**Score: 9 done, 0 partial, 0 open.**

## Recommended Approach

### Step 1 — Keep Sprint 7 Closed in Tracking Docs
Do not reopen Sprint 7 carryover blocks in planning docs. Keep Sprint 7 represented as closed in `tasks/todo.md` and roadmap status docs.

### Step 2 — Keep Sprint 8 as Active Workstream

**Sprint 8 — P1 beta hardening (current active scope)**
- [ ] Empty states: Favourites, ReviewHistory, Profile
- [ ] Review persistence + success feedback + quick-review (F-018)
- [ ] Auth error feedback surfaces
- [ ] `HungryService` completion items (`getBuildingDetail`, `getFloorPlan`, `getBites`)
- [ ] Discovery presets (F-015)
- [ ] Dietary filter on Discover root (F-014)
- [ ] Skeleton screens + offline trigger wiring

### Step 3 — Keep War-Room Report Consistent
- Sprint 7 section should read as closed (2026-04-17 addendum)
- Remove stale language saying TasteFilter/BuildingDrillDown/MapZoomedIn/BitesCarousel/profile sync are still broken
- Keep UI/UX narrative unchanged outside Sprint 7 bug-status context

## Files to Modify

| File | Change |
|------|--------|
| `tasks/Roadmap/Archive/hashed-conjuring-adleman.md` | Restore full planning context and update Sprint 7 status to closed |
| `tasks/Roadmap/war-room-report-2026-04-16.md` | Add Sprint 7 supersession note and close stale P0 items |

## Reusable Code Already in the Tree

- `src/lib/ai/tasteEngine.ts` — `rankDishes`, `decideForMe`, `calibrateVector`
- `src/features/discovery/discovery.ts` — `getBuildingVenues`
- `src/store/useProfileStore.ts` — `syncProfile`
- `src/app/screens/search/TasteFilterScreen.tsx` — wired route target

## Verification

1. `npm run typecheck` is recorded as passing in `tasks/todo.md` wave verification log.
2. Sprint 7 status in roadmap docs no longer claims unresolved dead ends for:
   `TasteFilter`, `BuildingDrillDown`, `MapZoomedIn`, `BitesCarousel`, `profile sync`.
3. `war-room-report-2026-04-16.md` contains a supersession note pointing to current source-of-truth files.
