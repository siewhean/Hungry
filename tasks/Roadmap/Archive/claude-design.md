# Plan — Hungry design pass + missing screens + marketing site

## Context

The user wants the prior Design System UI-kit work pulled into the real React Native app at this worktree. The design deliverable from the last session (`ui_kits/` with 18 preview cards) does **not exist** in this repo — this worktree is the actual Expo/React Native app. So "implement the design" here means landing the foundations (fonts, dark-mode softening, motif) and the new feature screens directly in `src/`, plus scaffolding a marketing website under `marketing/website/`.

Current state (verified):
- `src/theme/tokens.ts` already has `light.bg = "#FFFFFF"` — the flip the user asked for is done.
- `dark.bg = "#0D0F14"` — near-black; user wants something softer.
- `src/app/screens/SplashScreen.tsx` animates "H" scaling in + "ungry" sliding in. User wants a bite taken OUT of the `u` instead.
- `src/app/screens/wheel/WheelSpinScreen.tsx` exists — wheel animation is already built; re-verify fidelity only.
- `src/app/screens/review/MusicSelectionScreen.tsx` exists — music picker is done.
- Missing entirely: Merchant home/profile screen, Messaging list + thread, Recents, Hungry Passport (achievements).
- `marketing/website/` has only `waitlist-page-copy.md` + `waitlist-wireframe.md` — no built site.
- No curved-green-hero motif or bubble/pin illustration wired into any screen.
- Fonts: check `package.json` for `@expo-google-fonts/*`; no appetite-forward display font wired.

Scope of this plan (confirmed with user): 3 phases. Phase 1 is the foundation pass, Phase 2 integrates the motif into existing screens, Phase 3 ships four new screens with mock data. Marketing website is **deferred** — not included.

---

## Phase 1 — Foundation pass (tokens, fonts, motif, splash)

**Files:**
- `src/theme/tokens.ts` — soften dark mode; add motif tokens.
- `src/theme/index.tsx` — load display font.
- `package.json` — add `@expo-google-fonts/fraunces` (or `@expo-google-fonts/dm-serif-display`).
- `src/components/ui/` — add `HungryMotifHero.tsx` (curved green hero + bubbles + pin illustration).
- `src/app/screens/SplashScreen.tsx` — replace bite choreography: "Hungry" wordmark renders, bite arc cuts a chunk out of the `u`.
- `docs/DESIGN_STANDARDS.md` — update dark-mode and type-system sections.

**Changes:**
1. **Font.** Add **Fraunces** (or DM Serif Display as alt) as `fontFamilies.display` in tokens. Serif with soft terminals reads as warm/appetite-forward versus the current sans-only stack. Keep Nunito for body. Wire `useFonts({ Fraunces_600SemiBold, Fraunces_700Bold })` in `src/theme/index.tsx`.
2. **Dark mode.** Change `dark.bg` from `#0D0F14` → `#1C1A17` (warm charcoal, not black). Shift `dark.surface` to `#26221E`, `dark.surfaceRaised` to `#322D27`. Keeps hawker-paper warmth without going full black.
3. **Motif.** Add to tokens:
   ```
   motif: {
     bubbleOrange: "#F5A623",
     bubbleCream: "#FFF1E6",
   }
   ```
   Build `HungryMotifHero` as a reusable component: curved-bottom green band (border-radius on bottom corners via SVG path), 3–5 floating translucent bubbles, optional centred pin/chopstick SVG illustration. Accept `title` + `subtitle` + optional `rightSlot` props.
4. **Splash bite-the-u.** Replace current splash. Render "Hungry" full wordmark in display font. Animate a crescent-bite SVG mask sweeping across the `u` glyph (SVG `<mask>` + `Animated.Value` driving `x` translate on the mask rect). ~900ms total: 0–400ms wordmark fades in, 400–700ms bite arc sweeps, 700–900ms hold, then navigate.
5. **Design standards doc.** Update §1 palette table, §2 typography, §3 dark-mode, add new §5 "Motif system" with usage rules.

**Verification:**
- `npm run typecheck` passes.
- Run app in sim: splash renders in display font with visible bite arc; dark mode is warm charcoal not black; `HungryMotifHero` renders correctly when dropped into a test screen.

---

## Phase 2 — Integrate motif into existing screens

**Files:**
- `src/app/screens/home/HomeFeedScreen.tsx` — top 30% = `HungryMotifHero`, below = current feed.
- `src/app/screens/discover/DiscoverHomeScreen.tsx` — 3 new horizontal carousels (Trending This Week, Under $10, Late-Night Eats) using existing `HorizontalCarousel` primitive if present; else inline ScrollView horizontal.
- `src/app/screens/review/ReviewScreen.tsx` — layout refinement only: bigger hero image, stickier rating row, cleaner music-picker entry point (link to existing `MusicSelectionScreen`).

**Verification:**
- `npm run typecheck` passes.
- Launch sim, navigate Home → Discover → Review: motif visible, carousels scroll, review layout cleaner.

---

## Phase 3 — New screens

**Files (new):**
- `src/app/screens/merchant/MerchantHomeScreen.tsx` — merchant dashboard stub (today's orders, menu status, claim status).
- `src/app/screens/merchant/MerchantStack.tsx` — stack wiring.
- `src/app/screens/messaging/MessagingListScreen.tsx` — list of threads.
- `src/app/screens/messaging/MessagingThreadScreen.tsx` — single thread view.
- `src/app/screens/messaging/MessagingStack.tsx`.
- `src/app/screens/recents/RecentsScreen.tsx` — recently viewed dishes/venues grouped by day.
- `src/app/screens/passport/HungryPassportScreen.tsx` — achievements grid (locked/unlocked states), progress bars, shareable card.
- `src/app/navigation/RootNavigator.tsx` (or equivalent) — register new stacks.

**Data contracts:** use existing mock service (`src/lib/services/mock/`) — add `merchantOrders`, `messagingThreads`, `recentViews`, `passportAchievements` mock collections. Land as read-only for now; post/write flows follow later.

**Verification:**
- `npm run typecheck` passes.
- Each screen navigable from a dev menu or linked tab; renders mock data; not hooked to Supabase yet (flagged in todo as Phase 3b).

---

## Phase 4 — Marketing website

**Deferred.** Not shipping in this session. Revisit separately.

---

## Reusable utilities to leverage

- `src/theme/index.tsx` — `useHungryTheme()` already provides palette/motion/spacing/radii. Wire display font here.
- `src/components/ui/` — existing AppText, buttons, cards; extend, don't duplicate.
- `src/components/wheel/WheelSvg.tsx` — already drives wheel visuals; no changes needed.
- `src/app/screens/review/MusicSelectionScreen.tsx` — already built; just link from ReviewScreen.
- `src/lib/services/mock/` — add new mock collections per Phase 3.

---

## Risk / callouts

- **Splash "bite the u" is the flashiest ask.** SVG mask + Animated values works but needs careful path design. If Fraunces's `u` bowl is too narrow, fall back to a custom SVG wordmark.
- **Dark-mode warm charcoal** — users may prefer the current black; token change is reversible.
- **Merchant screen** — Phase 8 of the roadmap is "Merchant Portal". This plan ships a read-only stub; full merchant portal is its own track.
- Active Sprint 10 work (OCR + claim CTA) should not be disturbed by these changes — all new code paths, no touching `StallDetailScreen` claim flow or OCR upload.

---

## End-to-end verification

1. `npm run typecheck` — passes after each phase.
2. `npm run lint` — passes.
3. Run app on iOS simulator: splash → home (motif) → discover (carousels) → review (refined) → new screens reachable.
4. Update `tasks/todo.md` with phase-level checkpoints and append to session log per project convention.
