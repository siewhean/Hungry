# Hungry — Sprint 11 Master Implementation Plan

> **Priority rule (per 10a):** Design & layout fixes from point 9 are the most critical. All other features follow after.
> **Execution order:** Phase A (screen fixes) → Phase B (design system upgrades) → Phase C (feature additions)

---

## Overview of All Decisions

| # | Area | Decision Summary |
|---|------|-----------------|
| 1 | Typography | Fraunces for display headings, Nunito for body |
| 2 | Splash animation | Bite marks + crumbs scatter, play once, show both variants, new logo |
| 3 | Dark mode | Standard dark/grey, toggle on all screens, all colours complement dark |
| 4 | Visual design | Orange-only icons, flat cartoon + line-art mix, key screens only, custom mascot |
| 5 | New features | Merchant role switch, music page, messaging, search history, gamification |
| 6 | Discover carousels | One auto-scroll, all sections, 5 carousels, editors choice badge |
| 7 | Review/Post overhaul | Review tab = pure user reviews, posting tab = separate composer |
| 8 | Website | Already shipped ✅ |
| 9 | Screen fixes | V2 Figma, broken screens, layout/spacing, visual elements |
| 10 | Priority | App first, design first |

---

## Phase A — Critical Screen Fixes (Point 9) 🔴 HIGHEST PRIORITY

### A1. Figma V2 Implementation

Implement the 5 Figma V2 HTML prototypes (`design/figma-v2/`) into production React Native screens.

| Prototype | Governs Screen | Status |
|-----------|---------------|--------|
| `home-feed.html` | `HomeFeedScreen.tsx` | Needs layout rewrite |
| `discover-search.html` | `DishSearchScreen.tsx`, discover carousels | Needs full rebuild |
| `stall-detail.html` | `StallDetailScreen.tsx` | Needs spacing/design pass |
| `building-layout.html` | `BuildingDrillDownScreen.tsx` | Needs visual polish |
| `quick-review.html` | `QuickReviewSheet.tsx` | Needs layout alignment |

**Action:** Read each HTML file → implement matching layout in TSX → visual check against prototype.

---

### A2. Broken Screen Fixes (9b)

| Broken Item | Fix Required |
|-------------|-------------|
| **Review tab (3rd tab)** | Full rebuild — see Phase C, point 7 |
| **Budget < $8 card screens** | Fix `F-015` situation preset cards in DiscoverHome — currently shows wrong layout or placeholder |
| **Map** | Verify `HomeMapScreen` pins render, Mapbox mock working, `BuildingPin` tappable |
| **Building directory page** | `BuildingDrillDownScreen` — floor tabs, stall grid, FloorPlanViewer wired correctly |
| **Stall details page** | `StallDetailScreen` — match Figma V2 stall-detail.html layout |
| **Stories in home page** | `CircleStoryCarousel` — verify story ring rendering, tap-to-view, unseen orange/seen grey |

---

### A3. Layout / Spacing / Design Pass (9c)

> "More of the layout/spacing, and design of the entire screen. Incorporate the visual elements on all pages **except** home, profile, and posting page."

**Screens requiring visual element integration:**
- Discover screen
- Review tab (3rd tab)
- Map screen
- Building directory
- Stall detail
- Dish detail
- Search results
- Onboarding screens
- Reads tab

**Visual elements to incorporate** (per decisions in points 4 and 6):
- Food icon graphics on section headers and buttons
- Orange accent elements from design system
- Proper Fraunces display headings (decision 1)
- Correct spacing from `design-system.md` tokens

---

## Phase B — Design System Upgrades 🟡 HIGH PRIORITY

### B1. Typography: Fraunces for Display Headings (Decision 1)

**Current state:** `design-system.md` says `display` token uses `Nunito Bold 700`. The decision is to switch display headings to **Fraunces** (already loaded in the web marketing site via Google Fonts, needs adding to Expo).

#### Changes:

##### [MODIFY] `src/theme/tokens.ts`
- Add `display` and `displaySm` variants mapped to Fraunces
- Keep `h1`/`h2`/`h3` as Nunito SemiBold/Bold (body hierarchy stays Nunito)

##### [MODIFY] `app.json` / `src/components/AppBody.tsx`
- Load `Fraunces_900Black`, `Fraunces_700Bold` alongside existing Nunito/DMMono fonts
- Add fallback handling consistent with existing font-timeout logic

##### [MODIFY] `src/components/ui/AppText.tsx`
- Add `variant="display"` and `variant="displaySm"` mapped to Fraunces tokens
- Apply Fraunces to: screen hero titles, onboarding headlines, splash screen wordmark

**Rule:** Fraunces applies to display-level heroes and major section headlines only. All body/label/UI text stays Nunito.

---

### B2. Dark Mode Toggle (Decision 3)

**Current state:** Dark mode palette exists in `tokens.ts` but there is no toggle UI wired in Settings.

#### Changes:

##### [MODIFY] `src/store/useUIStore.ts`
- Add `colorScheme: 'light' | 'dark' | 'system'` state
- Add `setColorScheme()` action + persist to `AsyncStorage`

##### [MODIFY] `src/theme/index.ts` / `useHungryTheme()`
- Read `colorScheme` from store + `Appearance.getColorScheme()` for system fallback
- Return the correct `colors.light` or `colors.dark` palette

##### [MODIFY] `src/app/screens/profile/SettingsScreen.tsx`
- Add **Dark Mode toggle** section: `Light / Dark / System` — 3-way selector
- Show current mode icon (sun/moon/system)

##### Verify all screens
- All screens use `useHungryTheme()` → should automatically respond (no hardcoded colours)
- Audit any hardcoded hex values via grep

---

### B3. New Logo (Decision 2 — Extra)

> "The logo should just contain the word 'Hungry' or a logo that is simple."

**Approach:** Generate 2–3 logo options using the generate_image tool. Candidates:
1. **Wordmark only** — "Hungry" set in Fraunces with the U having a bite taken out of it
2. **Icon + wordmark** — simple fork or bowl icon + "Hungry" in Fraunces
3. **Logomark only** — abstract bite mark or bowl shape, no text

**Deliverable:** Show user options before implementing into Splash and marketing site.

---

### B4. Splash Animation Upgrade (Decision 2)

> Bite marks (realistic teeth), crumbs scatter, play once. Show both options A and B.

**Approach:** Two `Animated` API variants, user picks one.

| Option | Description |
|--------|-------------|
| **Option A** | Logo fades in → realistic bite taken from letter U → crumbs scatter outward (physics-like) |
| **Option B** | Logo builds letter-by-letter → bite mark overlays U → crumbs rain down with gravity |

##### [MODIFY] `src/app/screens/SplashScreen.tsx`
- Remove current animation, implement chosen option
- `useRef` for animation sequence, plays once, then transitions
- Crumbs: 6–8 small `Animated.View` circles in `#E8531E` + warm brown tones scatter with `Animated.spring`

---

### B5. Visual Design — Icons & Graphics (Decision 4)

> Mix of flat cartoon food and line-art food icons. Graphics on key buttons. Key screens: Discover, Review, Post.

**Approach:**
- Create SVG icon components (`src/components/icons/food/`) using lucide-style API
- Flat cartoon: `WheelIllustration`, `BowlIllustration`, `FoodPlatterIllustration`
- Line-art: `RamenIcon`, `ChickenRiceIcon`, `LaksaIcon` (for filter chips/buttons)
- Apply to: Hungry Wheel button, food category chips, key section headers

##### [NEW] `src/components/icons/food/`
- `WheelGraphic.tsx` — for Decide For Me / Hungry Wheel CTA
- `FoodCategoryIcons.tsx` — per-category line-art (10 categories)
- `MascotGraphic.tsx` — custom mascot (see B6)

**Scope:** Discover screen, Review tab, Post tab only. Home, Profile excluded.

---

### B6. Custom Mascot (Decision 4d)

> "You can create a custom mascot for me to take a look."

Generate initial mascot concept via `generate_image`. Proposed direction:
- A small bowl character with eyes and chopsticks — orange `#E8531E` coloured
- Expressions: happy (default), hungry (tongue out), thinking (deciding)
- Usage: empty states, gamification rewards, onboarding

**Deliverable:** Image concepts shown to user before implementing into code.

---

## Phase C — Feature Additions 🟢 AFTER PHASE A+B

### C1. Review Tab Complete Overhaul (Decision 7)

> "Review page (3rd tab) = pure user reviews only. No discovery section. Users can filter by food/location."

**Current state:** `ReviewScreen.tsx` is actually a **post composer** — it shows a media picker, music, caption, rating. This is the **posting screen**, not a review feed.

**Clarification confirmed (7b):**
- **Tab 3 = Review** → pure feed of user-submitted reviews (photo + rating + tagged dish + caption)
- **Tab 4 = Post** → composer (currently misnamed "ReviewScreen")

#### New Tab 3 — `ReviewFeedScreen.tsx` (NEW)

| Section | Content |
|---------|---------|
| Search/filter bar | Search by dish name or location |
| Filter chips | By: Dish · Location · Rating · Most Recent |
| Review cards | Photo, dish name, stall, rating stars, taste tags, caption excerpt, user avatar |
| "100% user content" badge | Tagline at top |

Review cards are **read-only**. No "Decide For Me" or discovery sections.

#### Post Tab remains as existing `ReviewScreen.tsx` (renamed to `PostComposerScreen`)

> "Make sure posts are visible in both post section and review section. Users choose where to post."

Add **"Post to"** toggle in composer:
- `🍜 Review Feed` (visible in Tab 3)
- `🏠 Home Feed` (visible in Tab 1)
- Or both

---

### C2. Music Page Overhaul (Decision 5b)

> "Music section = own page, vertical carousel, tap to play (no play/pause button), users can save music."

**Current state:** `MusicSelectionScreen.tsx` exists (1877 bytes — likely a stub).

#### [REWRITE] `src/app/screens/review/MusicSelectionScreen.tsx`

- Vertical `FlatList` of tracks (album art, title, artist, duration)
- **Tap row = play** (no separate play button)
- Playing indicator: animated waveform bars on left of active row
- Save/bookmark icon per track → adds to user's saved tracks
- Currently playing track shows in mini-player at bottom
- `expo-av` for audio playback

**Integration into review flow:**
- Composer shows selected track as a pill
- Track waveform visible behind video/photo reel in TikTok-style viewer

---

### C3. Merchant Role Switch (Decision 5a)

> "Separate stack entirely — not just within profile. Merchant page different from user page. Show data, analytics, orders, menu list. In same app (role switch)."

**Architecture:**

```
RootNavigator
├── MainTabs (consumer mode)
└── MerchantTabs (merchant mode)     ← NEW
    ├── MerchantDashboard             (orders, analytics snapshot)
    ├── MerchantMenu                  (dish list, edit menu)
    ├── MerchantAnalytics             (reviews, ratings, traffic)
    └── MerchantProfile               (stall info, hours)
```

**Role switch trigger:** "Switch to Merchant Mode" button in Settings → shows merchant stack. "Switch to Customer Mode" → returns to MainTabs.

**Mock data:** `merchant_id` on the mock user session, mock `orders[]`, `analytics{}`, `menuItems[]`.

---

### C4. Messaging (Decision 5c)

> "Both DM and group messages. Text, photos, voice notes, location sharing, stickers, post sharing."

**Current state:** `DirectMessagesScreen.tsx` and `ChatDetailScreen.tsx` exist in `src/app/screens/home/`.

**Required additions:**
- Group conversations (group name, avatar group)
- Message types: text ✅ (exists), photos, voice notes, location pin, sticker pack, shared post card
- "New page to compare afterwards" → build new `MessagingScreen` design then compare

---

### C5. Search History / Recents (Decision 5d)

> "Group by time, location, food genre, rating. Clear history action."

##### [MODIFY] `src/store/useSearchStore.ts`
- Add `history: SearchHistoryEntry[]` — `{ query, timestamp, location?, genre?, resultCount }`
- Add `clearHistory()` action

##### [MODIFY] `src/app/screens/search/DishSearchScreen.tsx`
- Show history grouped by: **Today / This Week / Older**
- Per-entry: query text, category icon, result count
- Swipe-to-delete per item or "Clear all" button

---

### C6. Gamification Expansion (Decision 5e)

> "All achievements, share templates (Strava-style), passport stamps, tier benefits."

**Current state:** `useGamificationStore.ts` exists with 6 tiers and basic points.

#### Achievements (brainstormed additions):

| Achievement | Trigger |
|-------------|---------|
| First Bite | First review |
| Explorer | Visit 5 different hawker centres |
| Regulars Club | Visit same stall 5× |
| Night Owl | Review at midnight+ |
| District Hopper | Reviews in 5 different districts |
| Photo Maestro | 10 reviews with photos |
| Taste Adventurer | Try all 6 taste categories |
| Social Butterfly | 10 follows |
| Singapore Hawker Heritage | Review stalls in all UNESCO hawker centres |
| Streak Master | 7-day review streak |
| Budget King | 10 reviews of dishes under $5 |
| Hidden Gem | First to review a newly added stall |

#### Tier Benefits (tied to `useGamificationStore` tier system):

| Tier | Benefit |
|------|---------|
| 🌱 Starter | Basic app access |
| 🥢 Regular | Unlock "Recents" grouping + extended search history |
| 🍜 Foodie | Custom profile badge, unlock all filter presets |
| ⭐ Expert | Early access to new features, Editor's Choice nomination rights |
| 🏆 Legend | Discounted subscription (when launched), exclusive sticker pack |
| 👑 Hawker Master | Free subscription, Featured Reviewer badge, priority in search results |

#### Share Templates (Strava-style):

3 template designs showing:
- **Template 1: "My Hungry Stats"** — total reviews, top dish, top hawker, taste profile radar
- **Template 2: "My Food Passport"** — map of Singapore with districts visited, hawker stamps
- **Template 3: "This Week's Makan"** — weekly summary card with top dishes, new stalls discovered

#### Passport Stamps (Decision 5d):

- Each hawker centre / food court = a collectible stamp
- `PassportScreen` shows a physical passport-style book
- User **drags** stamp onto a page slot to place it
- Stamps unlock when user reviews a stall from that location

---

### C7. Discover Carousel Overhaul (Decision 6)

> "One auto-scroll banner, rest manual. All sections. 5 carousels. Editors choice = badge/pill. Stall carousels show stall photos, dish carousels show dish photos only."

| Carousel | Type | Auto-scroll | Photos |
|----------|------|-------------|--------|
| Hero banner (featured) | Stall or editorial | ✅ Yes | Stall/editorial |
| Near You | Dish | Manual | Dish photos |
| Editors Choice | Dish (badge label) | Manual | Dish photos |
| Budget < $8 | Dish | Manual | Dish photos |
| Late Night Makan (10pm+) | Stall | Manual | Stall photos |

**Note:** "Late Night Makan" section only **appears** when local time ≥ 22:00.

---

## Open Questions

> [!IMPORTANT]
> **Q1 — Logo direction:** Do you want to see all 3 logo variants (wordmark only / icon+wordmark / logomark) before choosing, or should I pick a direction and show you 1–2 options?
Show me 3 options for each of the variants

> [!IMPORTANT]
> **Q2 — Splash animation:** Should both animation options (A and B) be visible simultaneously on a dev screen so you can compare, or do you want to see images/descriptions first?
You can create the animaitions for the splash screen straight away

> [!IMPORTANT]
> **Q3 — Mascot:** Should the mascot be a **bowl with eyes**, a **fork character**, or something else? Any character style preferences (cute/minimalist/expressive)?
Up to you to decide. Make it appealing for people of different ages.

> [!IMPORTANT]
> **Q4 — Merchant mode scope (Phase C3):** For the initial implementation, should merchant mode be fully mock (analytics charts + fake order data) or just the shell/navigation structure with empty states?
Make it fully mock

> [!IMPORTANT]
> **Q5 — Review feed content (Tab 3):** Should the review feed show reviews from ALL users, or only from users the logged-in user follows? Or both (tabs within the review page)?
It can have 2 sections, one for followers and the other from all users. The users can choose from a tab on the top of the screen or swipe between the two. For the ALL users, the user can search for a particular place, general or food

> [!IMPORTANT]
> **Q6 — Subscription:** Decision 5(e)(b) mentions "discounted subscription" — is there a subscription model planned? Or is this aspirational for a later V2 feature that we should reference as placeholder text for now?
Currently, there is no subscription model planned. This is just for inspiration. You can create it as a placeholder text for now

---

## Proposed Execution Order

```
Week 1 (Phase A — Screen Fixes):
  A1. Read all 5 Figma V2 prototypes
  A2. Fix broken screens (stories, building directory, stall detail, map, budget cards)
  A3. Layout/spacing pass on all in-scope screens

Week 2 (Phase B — Design System):
  B1. Fraunces typography integration
  B2. Dark mode toggle wired
  B3. Logo generation + selection
  B4. Splash animation (show both options)
  B5. Food icons (key screens only)
  B6. Mascot concept generation

Week 3 (Phase C — Features):
  C1. Review tab rebuild (Tab 3 = pure review feed)
  C7. Discover carousel overhaul
  C5. Search history grouping
  C2. Music page rewrite

Week 4 (Phase C continued):
  C3. Merchant role switch (mock-first)
  C4. Messaging additions
  C6. Gamification expansion (achievements, share templates, passport)
```

---

## Verification Plan

| Gate | Command | When |
|------|---------|------|
| Typecheck | `npm run typecheck` | After every phase |
| Expo Doctor | `npx expo-doctor` | After font/dep changes |
| Visual check | Run on iOS simulator | After each screen rewrite |
| Design compare | Open Figma V2 HTML beside simulator | After A1 |
