# Hungry — Design Batching (G-01)

> Generated 2026-04-12 by Gemini (ArchitectUX) to organize remaining P1/P2 visual and UX items.

---

## Batch 1: Maps & Discover Drill-Down
**Focus**: Tightening the spatial discovery experience and building-level navigation.

| ID | Issue | Target File(s) |
|----|-------|----------------|
| P1-43 | Map bottom sheet gap/height/padding tightening | `HomeMapScreen.tsx` |
| P1-44 | Map bottom sheet card corner treatment (square bottom) | `HomeMapScreen.tsx` |
| P2-09 | BuildingDrillDown placeholder copy correction | `BuildingDrillDownScreen.tsx` |
| P2-10 | BuildingDrillDown dish carousel limits / "see more" | `BuildingDrillDownScreen.tsx` |
| P2-12 | Map bottom sheet open stall count logic fix | `HomeMapScreen.tsx` |
| P2-13 | `BuildingLegend` rendering and placement | `HomeMapScreen.tsx` |
| P2-14 | `MapSurface` `cameraPadding` implementation | `MapSurface.tsx` |
| P2-50 | MapBottomSheet accessibility roles | `MapBottomSheet.tsx` |

---

## Batch 2: Detail Screens & Delivery
**Focus**: Final visual polish for the core "dish-first" destination screens.

| ID | Issue | Target File(s) |
|----|-------|----------------|
| P1-04 | DishDetail delivery button brand colours (Grab/Foodpanda) | `DishDetailScreen.tsx` |
| P1-48 | StallDetail hero image-to-text fade polish | `StallDetailScreen.tsx` |
| G-03 | Final visual polish for StallDetail attributes and hierarchy | `StallDetailScreen.tsx` |

---

## Batch 3: Auth System Consistency
**Focus**: Harmonizing the post-Splash auth experience.

| ID | Issue | Target File(s) |
|----|-------|----------------|
| P2-16 | Auth branding consistency (verification/forgot/reset) | `AuthStack.tsx` screens |
| G-05 | Visual system pass for login/signup/reset forms | `AuthStack.tsx` screens |

---

## Batch 4: Search & Discover UI Polish
**Focus**: Improving the entry point to discovery.

| ID | Issue | Target File(s) |
|----|-------|----------------|
| P1-20 | `groupResultsByVenue` implementation (UX direction) | `search.ts` |
| P1-21 | Discovery feed building proximity logic | `search.ts` |
| P1-47 | TasteFilter slider integer steps (`step={1}`) | `TasteFilterScreen.tsx` |
| P2-05 | DishSearch "Suggested for tonight" card visuals | `DishSearchScreen.tsx` |
| P2-06 | SearchResults redundant subtitle cleanup | `SearchResultsScreen.tsx` |
| P2-07 | SearchResults empty state CTA for taste filters | `SearchResultsScreen.tsx` |
| P2-08 | `recentSearches` persistence/logic | `useSearchStore.ts` |

---

## Batch 5: Home & Social Feed
**Focus**: Removing mock disclosures and humanizing the feed.

| ID | Issue | Target File(s) |
|----|-------|----------------|
| P2-01 | Home feed empty state copy (remove mock disclosure) | `HomeFeedScreen.tsx` |
| P2-02 | Social engagement counts realism/UX | `HomeFeedScreen.tsx` |
| P2-03 | Time-of-day contextual headings | `HomeFeedScreen.tsx` |
| P1-17 | Home feed error boundary | `HomeFeedScreen.tsx` |

---

## Batch 6: Profile & Reads
**Focus**: Completing the personal and editorial surfaces.

| ID | Issue | Target File(s) |
|----|-------|----------------|
| P1-42 | `readsEnabled` feature flag enforcement | `MainTabs.tsx` |
| P2-23 | Favourites empty state mock copy removal | `FavouritesScreen.tsx` |
| P2-24 | Settings screen mock banner/toggles cleanup | `SettingsScreen.tsx` |
| P2-25 | Profile editing: avatar upload/password-change flows | `EditProfileScreen.tsx` |
| P2-26 | EditProfile mock disclosure removal | `EditProfileScreen.tsx` |
| P2-29 | `ProfileScreen.tsx` dead indirection removal | `ProfileScreen.tsx` |
| P2-30 | Reads metadata: dynamic read time | `ReadsFeedScreen.tsx` |
| P2-31 | "View Archive" interactivity | `ReadsFeedScreen.tsx` |
| P2-32 | Reads colours raw hex to tokens | `ReadsFeedScreen.tsx` |

---

## Batch 7: Shared Component & Token Cleanup
**Focus**: Systemic consistency and token adoption.

| ID | Issue | Target File(s) |
|----|-------|----------------|
| P1-37 | FloatingToast entrance/exit animations | `FloatingToast.tsx` |
| P1-38 | FloatingToast zIndex token usage | `FloatingToast.tsx` |
| P1-39 | FloatingToast tone field usage | `FloatingToast.tsx` |
| P1-40 | `HygieneGradeBadge` dark mode tokens | `HygieneGradeBadge.tsx` |
| P1-41 | `FloorPlanViewer` dark mode tokens | `FloorPlanViewer.tsx` |
| P2-33 | `DishCard` image placeholder tokens | `DishCard.tsx` |
| P2-35 | `StallHeader` spacing tokens | `StallHeader.tsx` |
| P2-36 | `OperatingHours` colour tokens | `OperatingHours.tsx` |
| P2-37 | Typography `fontFamily` token adoption | Multiple |
| P2-38 | `MapSurface` road colour tokens | `MapSurface.tsx` |
| P2-39 | `borderRadius` pill token adoption | Multiple |
| P2-40 | `BiteCard` tag text tokens | `BiteCard.tsx` |
| P2-55 | `shadows.card` dark mode tokens | `tokens.ts` |
| P2-56 | Consume `zIndex` tokens in components | Multiple |
| P2-57 | Consume `motion` tokens in components | Multiple |

---

## Batch 8: Infrastructure & Accessibility
**Focus**: Building new primitives and closing A11y gaps.

| ID | Issue | Target File(s) |
|----|-------|----------------|
| P2-46 | StarRating roles and context labels | `StarRating.tsx` |
| P2-47 | ProfileRadarChart screen-reader accessibility | `ProfileRadarChart.tsx` |
| P2-48 | MustOrderBadge accessibility labels | `MustOrderBadge.tsx` |
| P2-49 | BiteCard roles and labels | `BiteCard.tsx` |
| P2-51 | `Input` component error prop/styling | `Input.tsx` |
| P2-52 | `Skeleton` loading primitive | `src/components/ui/` |
| P2-53 | `Avatar` primitive | `src/components/ui/` |
| P2-54 | General-purpose `BottomSheet` primitive | `src/components/ui/` |
