# Hungry — Design Standards

> **Authoritative reference** for all content creation and Figma-to-code work.
> Every agent, contributor, and designer must read this before producing, reviewing, or implementing any screen, component, or asset.
> Source of truth hierarchy: this document → `src/theme/tokens.ts` → `design/figma-v2/` prototypes → `tasks/design-system.md`.

---

## 0. How to Use This Document

| You are… | Read sections… |
|----------|---------------|
| Starting a new screen or component | 1 → 2 → 3 → 4 → 7 → 8 |
| Extracting specs from a Figma frame | 2 → 3 → 4 → 9 |
| Writing UI copy or labels | 6 → 10 |
| Reviewing a PR or design handoff | 8 → 11 |
| Debugging a visual regression | 2 → 3 → 5 → 11 |

---

## 1. Brand Identity

| Attribute | Value |
|-----------|-------|
| Product name | **Hungry** |
| Tagline | "Find the dish. Not just the restaurant." |
| Secondary tagline | "Find the dish. Makan nearby." |
| Visual metaphor | A local hawker's handwritten sign — purposeful, unpretentious |
| Personality | Warm · direct · local · knowledgeable food friend |
| What it is NOT | Generic food-delivery app · trendy SaaS product · creator platform |
| Market | Singapore locals, residents, tourists — hawker centres, food courts |
| Core unit | The **dish** — not the restaurant, not the venue |

### Brand Personality at a Glance

```
Warm      ████████░░  not cold or clinical
Local     █████████░  unmistakably Singapore
Direct    ████████░░  no fluff, no filler
Useful    █████████░  practical first, social second
Social    ████░░░░░░  light social mechanics — not a creator platform
```

---

## 2. Color System

### 2.1 Light Mode Palette

> Always reference via `useHungryTheme().palette.*` — never hardcode hex values.

| Token | Hex | Named colour | Primary use |
|-------|-----|-------------|-------------|
| `bg` | `#FFF7EE` | Paper Warm | Primary app background, screen canvas |
| `bgMuted` | `#FFFFFF` | White | Secondary section backgrounds |
| `bgSoft` | `#F8EFE4` | Warm Ivory | Soft tinted section containers |
| `surface` | `#FFFFFF` | White | Card surfaces, modal interiors |
| `surfaceRaised` | `#FFF9F3` | Cream | Elevated cards, bottom sheets |
| `text` | `#1A2E44` | Deep Navy | Primary body and heading text |
| `textSecondary` | `#41566F` | Slate | Secondary labels, sub-headings |
| `textMuted` | `#6F7D8D` | Ash | Metadata, captions, timestamps |
| `border` | `#E7DED4` | Line | Dividers, card borders, input strokes |
| `orange` | `#E8531E` | Hungry Orange | CTAs, active states, brand accent |
| `orangeDark` | `#CD0302` | Russian Red | Pressed orange, urgency, alert badges |
| `orangeLight` | `#FFF1E6` | Orange Blush | Orange soft backgrounds, tinted chips |
| `navy` | `#1A2E44` | Deep Navy | Headings, high-contrast text, icons |
| `amber` | `#F5A623` | Hawker Amber | Star ratings, must-order highlights |
| `amberLight` | `#FFF3DB` | Amber Blush | Soft amber backgrounds |
| `teal` | `#14B8A6` | Teal | Food court map pins, dietary tags |
| `success` | `#4F7E17` | Autumn Green | Open status, halal/vegetarian cues |
| `successSoft` | `#EEF5E5` | Mint Soft | Success backgrounds |
| `warning` | `#C78712` | Warm Ochre | Price alerts, hygiene B warnings |
| `warningSoft` | `#FFF3DB` | Ochre Soft | Warning backgrounds |
| `error` | `#CD0302` | Russian Red | Errors, closed status, hygiene D |
| `errorSoft` | `#FDE3E2` | Red Soft | Error backgrounds |
| `info` | `#1A2E44` | Deep Navy | Informational banners |
| `infoSoft` | `#EAF0F6` | Sky Soft | Info backgrounds |
| `mapBg` | `#FFF7EE` | Paper Warm | Map canvas base colour |
| `mapRoadPrimary` | `#FFFFFF` | White | Primary road lines |
| `mapRoadSecondary` | `#E7DED4` | Line | Secondary road/path lines |
| `overlay` | `rgba(17,24,39,0.45)` | Scrim | Map overlays, modal scrims |

### 2.2 Dark Mode Palette

| Token | Hex |
|-------|-----|
| `bg` | `#0D0F14` |
| `bgMuted` | `#121722` |
| `bgSoft` | `#1D2430` |
| `surface` | `#161C27` |
| `surfaceRaised` | `#1B2433` |
| `text` | `#F9FAFB` |
| `textSecondary` | `#D1D5DB` |
| `textMuted` | `#9CA3AF` |
| `border` | `#374151` |
| `orange` | `#E8531E` (unchanged) |
| `orangeDark` | `#F06A34` |
| `orangeLight` | `#3A1E17` |
| `navy` | `#E4EBF4` |
| `amber` | `#F5A623` (unchanged) |
| `amberLight` | `#342A14` |
| `teal` | `#14B8A6` (unchanged) |
| `success` | `#4ADE80` |
| `successSoft` | `#163722` |
| `warning` | `#F59E0B` |
| `warningSoft` | `#3D2B14` |
| `error` | `#F87171` |
| `errorSoft` | `#3A1B1B` |
| `mapBg` | `#121722` |
| `mapRoadPrimary` | `#303845` |
| `mapRoadSecondary` | `#1F2937` |

### 2.3 Semantic Colour Application Rules

**Canvas ratio (light mode):**
- 55% Paper Warm (`#FFF7EE`) and white surfaces
- 25% Deep Navy, Line, and image-led neutral structure
- 10% Hungry Orange for primary actions only
- 5% Hawker Amber for ratings and highlights
- 5% Russian Red + Autumn Green for urgency and freshness signals

**Colour assignment by context:**

| Context | Colour | Token |
|---------|--------|-------|
| Primary CTA button | Hungry Orange | `palette.orange` |
| Active tab indicator | Hungry Orange | `palette.orange` |
| Selected chip / filter | Hungry Orange fill | `palette.orange` / `palette.orangeLight` |
| Star ratings | Hawker Amber | `palette.amber` |
| Must-order badge | Hawker Amber | `palette.amber` |
| Open-now status | Autumn Green | `palette.success` |
| Vegetarian / halal flag | Autumn Green | `palette.success` |
| Hygiene grade A | Autumn Green | `palette.success` / `palette.successSoft` |
| Hygiene grade B | Warm Ochre | `palette.warning` / `palette.warningSoft` |
| Hygiene grade C | Russian Red (low) | `palette.orangeDark` |
| Hygiene grade D | Russian Red | `palette.error` / `palette.errorSoft` |
| Closed status | Russian Red | `palette.error` |
| Hawker centre map pin | Hungry Orange | `palette.orange` |
| Food court map pin | Teal | `palette.teal` |
| Restaurant map pin | Muted text | `palette.textMuted` |
| Delivery — GrabFood | External: `#00B14F` | (brand colour, not a token) |
| Delivery — Foodpanda | External: `#D70F64` | (brand colour, not a token) |
| Error / destructive | Russian Red | `palette.error` |
| Info banner | Navy | `palette.info` / `palette.infoSoft` |

> **External brand colours** (GrabFood green, Foodpanda pink) are the only permitted hardcoded hex values. Document them with an inline comment: `// GrabFood brand colour — intentionally external`.

### 2.4 Colour Don'ts

- Never use purple, blue, or unrelated palette accents unless implementing a system-only state
- Never use teal for anything other than food court pins and dietary tags
- Never use the same orange opacity for both active and hover states
- Never apply dark mode colours in light mode components

---

## 3. Typography

### 3.1 Type Scale

> Access via `useHungryTheme().typography.*`

| Token | Font family | Weight | Size | Line height | Letter spacing | Use |
|-------|-------------|--------|------|-------------|----------------|-----|
| `display` | Nunito | 700 Bold | 32 | 38 | — | Hero headings only |
| `h1` | Nunito | 700 Bold | 24 | 30 | — | Screen titles |
| `h2` | Nunito | 600 SemiBold | 20 | 26 | — | Section headers |
| `h3` | Nunito | 600 SemiBold | 17 | 22 | — | Card titles |
| `bodyLarge` | Nunito | 400 Regular | 17 | 24 | — | Lead body, intro text |
| `body` | Nunito | 400 Regular | 15 | 22 | — | Default body copy |
| `bodySmall` | Nunito | 400 Regular | 13 | 18 | — | Captions, metadata |
| `micro` | Nunito | 500 Medium | 11 | 14 | +0.6 | Chips, badges, dietary flags |
| `price` | DM Mono | 400 Regular | 15 | 22 | — | All prices, numeric values |
| `code` | DM Mono | 400 Regular | 13 | 18 | — | Debug/code display |

### 3.2 Typography Rules

**Font assignment:**
- All UI text → `Nunito_*` (imported via `@expo-google-fonts/nunito`)
- All prices and monetary values → `DMMono_400Regular` — no exceptions
- All code or debug output → `DMMono_400Regular`
- Never reference a font family string directly in a StyleSheet — use `typography.*` token

**Scale application:**
- Screen/route title → `h1` or `h2` (never `display`)
- Card title → `h3`
- Card metadata, distance, unit number → `bodySmall`
- Chip labels, dietary flags, status badges → `micro`
- Body copy in list cards → max 3 lines, `body` or `bodySmall`
- Never mix Nunito weights arbitrarily — only use weights in the scale above

**Anti-patterns:**
- ❌ Oversized `display` paired with ultra-thin `bodySmall` metadata
- ❌ `fontFamily: "Nunito_700Bold"` hardcoded in StyleSheet — use `typography.h1` etc.
- ❌ Raw `fontSize: 13` without a token — find the nearest token variant

---

## 4. Spacing, Layout, and Sizing

### 4.1 Spacing Scale

> Access via `useHungryTheme().spacing[N]`

| Token | px | Common use |
|-------|----|------------|
| `spacing[1]` | 4 | Icon-to-text gap, tight inline spacing |
| `spacing[2]` | 8 | Chip padding, small gaps |
| `spacing[3]` | 12 | Card inner padding (compact), vertical gap inside grouped content |
| `spacing[4]` | 16 | Default screen horizontal padding, vertical gap between sections |
| `spacing[5]` | 20 | Vertical gap between major section groups |
| `spacing[6]` | 24 | Large section gaps, bottom sheet padding |
| `spacing[8]` | 32 | Between major regions |
| `spacing[12]` | 48 | Large vertical rhythm |
| `spacing[16]` | 64 | Screen-level breathing room, hero bottom offset |

> **No value between 24 and 32.** `spacing[7]` (28) is intentionally absent. Use `spacing[6]` or `spacing[8]`.

### 4.2 Standard Screen Padding

| Location | Value |
|----------|-------|
| Horizontal outer padding | `spacing[4]` (16) |
| Top content offset below safe area | `spacing[3]` to `spacing[4]` (12–16) |
| Vertical gap inside a grouped section | `spacing[3]` (12) |
| Vertical gap between sections | `spacing[5]` (20) |
| Vertical gap between major regions | `spacing[6]` (24) |
| Bottom padding above tab bar | `spacing[12]` + `insets.bottom` |

### 4.3 Border Radius Scale

> Access via `useHungryTheme().radii.*`

| Token | px | Use |
|-------|----|-----|
| `radii.sm` | 8 | Chips, small badges, utility pills |
| `radii.md` | 12 | Cards, input fields, tag containers |
| `radii.lg` | 18 | Main content cards, large card surfaces |
| `radii.pill` | 999 | Full-pill buttons, round icons, avatar circles |

> No new radius value may be introduced without explicit design decision. `borderRadius: 999` in StyleSheets must be replaced with `radii.pill`.

### 4.4 Target Canvas and Responsive Behaviour

| Attribute | Value |
|-----------|-------|
| Design canvas | iPhone Pro portrait — 402 × 874 |
| Minimum supported width | 390 px (iPhone SE) |
| Adaptive layout rule | Must work on 390 px without redesign or horizontal overflow |
| Platform | iOS-first; Android parity required — test both |

### 4.5 Touch Targets

| Target type | Minimum size |
|-------------|-------------|
| Primary buttons | 52 px height |
| Icon buttons | 44 × 44 |
| Chip filters | 32 px height |
| Star rating taps | 44 × 44 per star |
| List row items | 48 px minimum height |
| Badge / tag tap (if interactive) | 32 × 32 minimum |

---

## 5. Elevation, Shadow, and Z-Index

### 5.1 Shadow Tokens

> Access via `useHungryTheme().shadows.*`

| Token | `shadowOpacity` | `shadowRadius` | `elevation` | Use |
|-------|----------------|----------------|-------------|-----|
| `shadows.card` | 0.05 | 14 | 2 | Standard list cards |
| `shadows.floating` | 0.10 | 18 | 4 | FABs, toasts, floating docks |

**Rules:**
- Never mix more than 2 shadow depths on a single screen
- Cards behind a hero image use no shadow
- Bottom sheets use `shadows.floating`
- Do not add drop shadows to text or icons

### 5.2 Z-Index Layer System

> Access via `useHungryTheme().zIndex.*` — **must always be applied**

| Token | Value | Layer |
|-------|-------|-------|
| `zIndex.map` | 1 | Map base canvas |
| `zIndex.overlay` | 10 | Map overlays, modals, dimmed scrims |
| `zIndex.fab` | 20 | Floating action buttons (Decide For Me) |
| `zIndex.toast` | 30 | Toast notifications — always on top |

> Any floating, modal, or overlay element must consume these tokens. Never use raw `zIndex` integers.

---

## 6. Motion and Animation

### 6.1 Motion Token Reference

> Access via `useHungryTheme().motion.*`

| Token | Duration | Use |
|-------|----------|-----|
| `motion.buttonPress` | 100ms | Scale feedback on button tap |
| `motion.screenTransition` | 250ms | Screen push/pop |
| `motion.sheet` | 300ms | Bottom sheet open/close |
| `motion.toast` | 250ms | Toast entrance/exit |
| `motion.skeleton` | 1500ms | Skeleton shimmer loop |

### 6.2 Animation Rules

- Every animation must serve a clear purpose (feedback, transition, loading signal)
- No decorative motion — if removing the animation doesn't hurt usability, remove it
- Stagger timing only when it clarifies a sequence (e.g., staggered card entrance in feed)
- Use easing curves intentionally: springs for physical objects, ease-out for panel reveals
- Haptic feedback required on: Decide For Me result, successful review submit, toggle changes
- Never animate text or icon colour — use opacity or scale instead

---

## 7. Component Standards

### 7.1 Primitive Components (must reuse — never reinvent)

| Component | Location | Use |
|-----------|----------|-----|
| `AppText` | `src/components/ui/AppText` | **All text** — maps `variant` to typography scale |
| `Button` | `src/components/ui/Button` | All tappable primary/secondary/ghost actions |
| `Card` | `src/components/ui/Card` | List items, content containers |
| `Input` | `src/components/ui/Input` | All text inputs; React Hook Form compatible |
| `Badge` | `src/components/ui/Badge` | Status indicators |
| `Chip` | `src/components/ui/Chip` | Filter pills, taste tags |
| `Screen` | `src/components/ui/Screen` | Screen wrapper — safe area handling |
| `EmptyState` | `src/components/ui/EmptyState` | Empty list/section states |
| `InlineBanner` | `src/components/ui/InlineBanner` | Inline info/warning/error messages |
| `FloatingToast` | `src/components/ui/FloatingToast` | Global success/error feedback |

### 7.2 Domain Components

**Dish (`src/components/dish/`):**
- `DishCard` — primary discovery card with large image, price (DM Mono), rating
- `TasteRadarChart` — 6-axis SVG radar chart; always used for taste visualisation
- `MustOrderBadge` — amber badge; render only when `dish.mustOrder === true`
- `DecideForMeCard` — orange FAB + result card; entry point for randomiser
- `DeliveryPlatformButton` — GrabFood / Foodpanda branded deep-link button

**Stall (`src/components/stall/`):**
- `StallCard` — venue list card with name, grade, hours
- `StallHeader` — detail screen hero header
- `OperatingHours` — hours display with open (green) / closed (red) distinction
- `HygieneGradeBadge` — A/B/C/D badge with correct semantic colour per grade

**Map (`src/components/map/`):**
- `MapSurface` — Mapbox wrapper with mock-friendly fallback
- `BuildingPin` — typed map pin (hawker=orange, food_court=teal, restaurant=grey)
- `FloorSelector` — horizontal scroll floor tab bar
- `MapBottomSheet` — building summary sheet with gesture handle
- `BuildingLegend` — legend for building type colour coding
- `ClusterPin` — aggregated multi-venue pin for dense areas

**Review (`src/components/review/`):**
- `ReviewCard` — single review display with author, rating, tags, photos
- `StarRating` — interactive (editable) and display modes; 1–5 integer
- `TasteTagSelector` — multi-select chip grid for review tags
- `PhotoPicker` — photo strip with add/remove for review compose

### 7.3 Component Rules

**Buttons:**
- Primary: `orange` fill · white text · `radii.lg` (18) · min height 52
- Secondary: white/soft-neutral fill · navy text · visible border
- Ghost: no fill · navy or orange text · no border
- Loading state: show `ActivityIndicator` inside button; disable tap
- Never implement a custom button — always use the `Button` primitive

**Cards:**
- Image cards: media first, copy second
- Utility cards: title → metadata → one action
- Never mix more than 2 shadow depths on one screen
- Image placeholder must use `palette.border` or `palette.bgSoft` — never `#E5E7EB`

**Chips:**
- Max height: 32
- Use only for: filters, taste tags, floor levels, dietary flags, status labels
- Selected state: `orangeLight` background, `orange` border and text
- Must include `accessibilityState={{ selected }}` when used as a toggle

**Search inputs:**
- Height: 48
- Leading icon (search icon)
- `radii.md` (12) radius
- Subtle border `palette.border` — no heavy shadow

**Bottom sheets:**
- `radii.lg` (18) top corners
- Grip handle visible — centred, 4 px tall, 32 px wide, `palette.border` colour
- Always includes a title or search field in the sheet header
- Max 2 primary actions in any sheet

**CTA docks (sticky bottom bars):**
- Anchored at bottom with safe area inset
- Max 1 primary CTA + 1 secondary CTA
- Never more than 2 actions — use a sheet if more are needed

---

## 8. Screen Shell Templates

Every screen must use one of these five shells. Do not invent a sixth.

### Shell 1 — Feed Shell
*Home feed · Discover feed · Reads feed*
```
safe-area top
compact header row (logo or screen title + icon actions)
optional hero / lead module
FlatList or ScrollView content
bottom navigation
```

### Shell 2 — Utility Shell
*Search · Search results · Favourites · Review history · Settings*
```
app bar with back or close action
search field or filter row (if relevant)
primary content list
optional sticky filter dock
bottom navigation (root screens only)
```

### Shell 3 — Detail Shell
*Dish detail · Stall detail · Reads article bridge*
```
hero media (full-width image or carousel — 260–320 px)
title + trust/status block (name, grade, open/closed, distance)
information clusters (taste, hours, delivery links)
supporting list modules (reviews, related dishes)
sticky CTA dock (directions, delivery, favourite)
```

### Shell 4 — Form / Funnel Shell
*Login · Sign up · Forgot password · Taste quiz · Dietary prefs · Location permission*
```
brand marker or progress bar
one dominant task (heading + input or options)
one supporting explanation block
primary CTA at bottom
secondary text link (skip / back / alternative action)
```

### Shell 5 — State Shell
*Offline · Not found · Empty state · Soft gate*
```
one icon or illustration area (centred)
one concise title
one concise description (1–2 sentences max)
one primary recovery CTA
one optional secondary action
```

**For every shell, always account for these states:**
- Default (data loaded, authenticated if required)
- Loading (skeleton or spinner — never a blank screen)
- Empty (zero results — use `EmptyState` component, not raw text)
- Error / offline (use `EmptyState` or `InlineBanner`)
- Guest vs authenticated (show/hide protected actions)

---

## 9. Figma-to-Code Extraction Rules

Follow these rules every time you extract specs from a Figma frame, prototype, or exported asset.

### 9.1 Before You Start

- [ ] Confirm the frame is from `design/figma-v2/` (not the archived concept or old redesign)
- [ ] Check `design/stitch/DESIGN.md` for the screen's intended shell type
- [ ] Identify which screen shell applies (Feed / Utility / Detail / Form / State)
- [ ] Confirm the screen exists in `tasks/screens.md` before building it

### 9.2 Colour Extraction

| If the Figma value is… | Map to… |
|------------------------|---------|
| `#E8531E` | `palette.orange` |
| `#CD0302` | `palette.orangeDark` (or `palette.error`) |
| `#FFF1E6` / `#FDF0EB` | `palette.orangeLight` |
| `#1A2E44` | `palette.navy` (or `palette.text`) |
| `#FFF7EE` | `palette.bg` |
| `#FFFFFF` | `palette.surface` |
| `#E7DED4` | `palette.border` |
| `#4F7E17` | `palette.success` |
| `#F5A623` | `palette.amber` |
| `#14B8A6` | `palette.teal` |
| `#C78712` | `palette.warning` |
| `rgba(17,24,39,0.45)` | `palette.overlay` |
| Any other hex | Stop — check if it maps to a token; if not, flag before implementing |

> Never transcribe a raw hex from Figma directly into code unless it is an intentional external brand colour (GrabFood, Foodpanda). Document it with a comment.

### 9.3 Spacing Extraction

| If Figma shows… | Map to… |
|----------------|---------|
| 4 | `spacing[1]` |
| 8 | `spacing[2]` |
| 12 | `spacing[3]` |
| 16 | `spacing[4]` |
| 20 | `spacing[5]` |
| 24 | `spacing[6]` |
| 32 | `spacing[8]` |
| 48 | `spacing[12]` |
| 64 | `spacing[16]` |
| Any other value | Flag — do not introduce a new spacing constant without justification |

### 9.4 Typography Extraction

| If Figma shows… | Map to… |
|----------------|---------|
| 32 Bold | `typography.display` |
| 24 Bold | `typography.h1` |
| 20 SemiBold | `typography.h2` |
| 17 SemiBold | `typography.h3` |
| 17 Regular | `typography.bodyLarge` |
| 15 Regular | `typography.body` |
| 13 Regular | `typography.bodySmall` |
| 11 Medium | `typography.micro` |
| 15 DM Mono | `typography.price` |
| Any other size | Flag — do not introduce new font size without justification |

### 9.5 Radius Extraction

| If Figma shows… | Map to… |
|----------------|---------|
| 8 | `radii.sm` |
| 12 | `radii.md` |
| 18 | `radii.lg` |
| 999 / fully round | `radii.pill` |
| Any other value | Flag — check intent before introducing a new radius |

### 9.6 Component Mapping

Before implementing any custom shape from Figma, check whether a component already exists:

| I see in Figma… | Check first… |
|----------------|-------------|
| A filled orange rectangle with white text | `Button` variant `primary` |
| A white rectangle with border and text | `Button` variant `secondary` |
| A card with image + title + metadata | `DishCard` or `StallCard` |
| A circular rating display with stars | `StarRating` |
| A hexagonal or radar polygon shape | `TasteRadarChart` |
| A coloured pill with short text | `Chip` or `Badge` |
| A bottom drawer with grip handle | `MapBottomSheet` or general `BottomSheet` |
| An inline colour block with icon + message | `InlineBanner` |
| A centred icon + headline + body + button | `EmptyState` |
| A map pin with colour coding | `BuildingPin` |

### 9.7 Image Assets

- All dish images → Unsplash CDN URLs from `FOOD_*` constants in `src/lib/services/mock/data.ts`
- Never paste an image URL inline in a component — add a named constant to `data.ts`
- No AI-generated food imagery
- No stock photo watermarks
- No generic placeholder graphics in production screens

### 9.8 Figma Handoff Checklist (before you write any code)

- [ ] Every colour in the frame maps to a named token or is a documented external brand colour
- [ ] Every spacing value in the frame maps to a `spacing[N]` token
- [ ] Every font size and weight maps to a `typography.*` token
- [ ] Every corner radius maps to a `radii.*` token
- [ ] The component already exists in the library, or a creation is justified
- [ ] The screen shell type is identified
- [ ] All five states are accounted for (default, loading, empty, error, guest)
- [ ] No hardcoded hex, px, or font string will appear in the implementation

---

## 10. Content and Copy Standards

### 10.1 Voice and Tone

| Do | Don't |
|----|-------|
| Direct, warm, local | Corporate or formal |
| Singlish references are welcome | Excessive exclamation marks |
| "Find the dish. Makan nearby." | "Discover amazing restaurants!" |
| "Nearby hawker centres" | "Explore exciting food destinations" |
| Specific stall and dish names | Vague generic descriptions |
| Knowledgeable food friend | Startup buzzword copy |
| Concise — one idea per label | Run-on UX copy |

### 10.2 Singapore-Local Vocabulary

Use these terms where appropriate:

| Use | Instead of |
|-----|-----------|
| Hawker centre | Food market / food hall |
| Food court | (use exactly — it's a distinct type) |
| Stall | Restaurant / outlet |
| Makan | (Singlish for eating — use sparingly in headings) |
| Unit number | Store number |
| Open now | Currently open |
| Closed for cleaning | Closed (generic) |

### 10.3 UI Copy Rules

**Labels and buttons:**
- Buttons: verb-first — "Save dish", "Write review", "Get directions"
- Tab labels: one word maximum — "Home", "Search", "Maps", "Profile"
- Section headers: all caps, spaced — "NEARBY HAWKER CENTRES"
- Empty states: one short empathetic line + one action — "No dishes saved yet. Start exploring."

**Metadata format:**
- Distance: "230 m away" (metres for < 1 km, "1.2 km" for ≥ 1 km)
- Price: "S$5.50" — always with dollar sign, always DM Mono font
- Price range: "S$4.50 – S$7.00" — en dash, not hyphen
- Rating: "4.3" — one decimal, never "4.30"
- Review count: "(124 reviews)" — parentheses, lowercase
- Operating hours: "10:00 AM – 8:00 PM" — 12-hour with AM/PM, en dash
- Unit number: "#01-10" — always with hash prefix

**Prohibited copy patterns:**
- ❌ Developer-facing strings in production (e.g., "This is mock data")
- ❌ Placeholder text referencing implementation state (e.g., "The list fills up once wired in")
- ❌ Screen IDs visible to users (e.g., "SCR-006")
- ❌ "Simulate photo failure" or any debug affordance in production UI
- ❌ Explicit mock disclosures (e.g., "Saved locally in this mock session")
- ❌ Generic startup phrases: "Launch faster", "Build your dreams", "Create without limits"
- ❌ Fake testimonials or placeholder reviewer names
- ❌ Hardcoded social counts (e.g., `reviewCount ?? 24 + 36 + index * 4`)

---

## 11. Anti-Patterns Reference

Anything on this list is grounds for PR rejection.

### Visual Anti-Patterns

| Anti-pattern | Correct approach |
|-------------|-----------------|
| Purple gradients | Not in this palette — use orange or navy |
| Heavy glassmorphism (blurred frosted surfaces) | Use `palette.surfaceRaised` with `shadows.floating` |
| Sparkle / star / fire emojis in headings | Remove entirely |
| Emoji icons in tab bar or navigation | Use `lucide-react-native` icons only |
| Generic glowing hover effects | Use scale or opacity only |
| Oversized `display` heading with ultra-thin body | Match heading weight to scale — never ultra-thin body |
| Dark mode as the default canvas | Light mode is default; dark mode is opt-in |
| AI-generated food imagery | Unsplash CDN URLs from `FOOD_*` constants only |
| Fake star ratings or fabricated review counts | Use real mock data from `data.ts` |
| Delivery buttons without brand colours | GrabFood green, Foodpanda pink — always |

### Code Anti-Patterns

| Anti-pattern | Correct approach |
|-------------|-----------------|
| `color: "#E8531E"` | `color: palette.orange` |
| `borderRadius: 999` | `borderRadius: radii.pill` |
| `gap: 12` inline | `gap: spacing[3]` |
| `fontFamily: "Nunito_700Bold"` in StyleSheet | `...typography.h1` spread |
| `fontSize: 15` raw | `...typography.body` spread |
| `useNavigation<any>()` | `useNavigation<NavigationProp<RootStackParamList>>()` |
| Inline fixture data in a component | Add to `src/lib/services/mock/data.ts` |
| `navigation.navigate("X")` without typed params | Declare params in `navigationTypes.ts` |
| `Math.round(reviewCount * 4 + 36)` fabricated numbers | Use real repository values |
| `zIndex: 100` magic number | `zIndex: zIndex.toast` |
| `bottom: 24` magic number | `bottom: spacing[6]` |
| Hardcoded `88` tab bar offset | `spacing[12] + insets.bottom` |
| `StyleSheet` without `useHungryTheme()` for colours | Always consume palette via hook |
| Duplicate component built inline in a screen | Reuse the shared component |

### UX Anti-Patterns

| Anti-pattern | Correct approach |
|-------------|-----------------|
| Blank screen during data load | Show skeleton or spinner |
| No empty state when list is empty | Use `EmptyState` component with CTA |
| Error crash with no recovery UI | Wrap with error boundary + `EmptyState` |
| `EmptyState` without `Screen` wrapper | Always nest inside `Screen` |
| Debug button visible to end users | Remove before PR — never ship dev affordances |
| Step counter saying "5 of 5" with 4 screens | Fix the count to match the actual flow |
| Auth redirect with visible flash of protected content | Gate with conditional render, not only `useEffect` |
| Recommend defaulting to `true` on 1-star review | Default to `false`; require explicit opt-in |
| Recent searches hardcoded in store initial state | Persist or initialise empty |
| Stall reviews disconnected from the actual venue | Source from the venue's `reviews` array |

---

## 12. Accessibility Standards

Every component and screen must meet these minimums.

### Touch Targets
- All interactive elements ≥ 44 × 44 (primary actions ≥ 52 height)
- Badge or chip as tap target: minimum 32 × 32

### Text and Colour
- Body text: ≥ 4.5:1 contrast ratio against its background
- Large text (≥ 18pt or ≥ 14pt bold): ≥ 3:1 contrast ratio
- Never convey information by colour alone — pair with icon or label

### ARIA / Accessibility Props (React Native)

| Element | Required props |
|---------|---------------|
| Every `Pressable` / `TouchableOpacity` | `accessibilityRole="button"` + `accessibilityLabel` |
| Every `Chip` (toggle/filter) | `accessibilityRole="button"` + `accessibilityState={{ selected }}` |
| Every `StarRating` | `accessibilityRole="radiogroup"` on container; each star `accessibilityRole="radio"` + `accessibilityState={{ selected, checked }}` |
| `FloatingToast` | `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"` |
| `TasteRadarChart` | `accessibilityRole="image"` + `accessibilityLabel` describing all 6 values |
| Image elements | `accessibilityLabel` or `accessibilityIgnoresInvertColors` when decorative |
| `FloorSelector` tabs | `accessibilityRole="tab"` + `accessibilityState={{ selected }}` |
| `MustOrderBadge` | `accessibilityLabel="Must order"` |

### Screen Reader Behaviour
- Every screen must be fully navigable with VoiceOver (iOS) and TalkBack (Android)
- Interactive elements must announce their role, label, and state
- Toast notifications must be read aloud automatically (`accessibilityLiveRegion`)
- Charts and data visualisations must have a text summary equivalent

---

## 13. File and Folder Conventions

```
src/
  app/
    navigation/          # RootNavigator, navigationTypes.ts — protected paths
    screens/             # One folder per tab or flow
  components/
    ui/                  # Primitives — AppText, Button, Card, Input, etc.
    dish/                # DishCard, TasteRadarChart, etc.
    stall/               # StallCard, StallHeader, etc.
    map/                 # MapSurface, BuildingPin, etc.
    review/              # ReviewCard, StarRating, etc.
    social/              # BiteCard, BitesCarousel
  constants/
    featureFlags.ts      # All feature flags — never bypass in production
    taste.ts             # TASTE_DIMENSIONS, NEUTRAL_TASTE_VECTOR
  features/              # Business logic, not components
  lib/
    services/mock/
      data.ts            # Single source of all fixture data
      repositories.ts    # All mock repository functions
  store/                 # Zustand stores only
  theme/
    tokens.ts            # Single source of all design tokens — never edit structure
    index.tsx            # useHungryTheme() hook + HungryThemeProvider
  types/
    domain.ts            # Canonical TypeScript domain types — never duplicate
```

**File creation rules:**
- New fixture data → `data.ts` only
- New domain types → `domain.ts` only
- New tokens → `tokens.ts` only, with matching dark mode value
- New screens → one file per screen, in the correct `screens/` subfolder
- New primitives → `src/components/ui/` with named export from `index.ts`
- No inline fixture arrays in components or screens

---

## 14. Pre-Implementation Checklist

Run through this before writing any new screen, component, or significant change.

### Design Checks
- [ ] The relevant Figma prototype has been reviewed (`design/figma-v2/`)
- [ ] Every colour maps to a palette token — no raw hex
- [ ] Every spacing value maps to a `spacing[N]` token
- [ ] Every font size and weight maps to a `typography.*` token
- [ ] Every radius maps to a `radii.*` token
- [ ] The shell type is identified and applied
- [ ] All 5 states are accounted for (default, loading, empty, error, guest)

### Component Checks
- [ ] Reusing existing primitives — not reinventing them
- [ ] `AppText` used for all text — no raw `<Text>` elements
- [ ] All `Pressable` elements have `accessibilityRole` and `accessibilityLabel`
- [ ] Interactive toggles have `accessibilityState={{ selected/checked }}`
- [ ] `FloatingToast` has `accessibilityRole="alert"`
- [ ] No `useNavigation<any>()` — typed navigation props used

### Code Quality Checks
- [ ] `npm run typecheck` passes — no errors, no `any` bypasses
- [ ] Feature flags are respected — no flag bypassing
- [ ] No developer-facing copy in production UI
- [ ] No mock disclosure text visible to end users
- [ ] No hardcoded social counts or fabricated numbers
- [ ] `zIndex` tokens applied to all floating/modal elements
- [ ] Tab bar bottom padding uses `spacing[12] + insets.bottom` — no magic `88`

### Data Checks
- [ ] No inline fixture data in components — all in `data.ts`
- [ ] No direct import from `data.ts` in screens — always via `repositories.ts`
- [ ] Images use `FOOD_*` constants or a new named constant in `data.ts`
- [ ] Store state accessed via selectors — not `getState()` outside React lifecycle

---

## 15. Quick Reference Card

```
ALWAYS                                  NEVER
──────────────────────────────────────────────────────
palette.orange (not "#E8531E")         Purple gradients
typography.h1 (not fontSize: 24)       Sparkle / emoji in headings
spacing[4] (not gap: 16)              Generic SaaS UI patterns
radii.pill (not borderRadius: 999)     Heavy glassmorphism
zIndex.toast (not zIndex: 100)         AI-generated food images
DM Mono for all prices                 Fabricated engagement numbers
AppText for all text                   Raw <Text> elements
EmptyState for empty lists             Plain AppText as empty fallback
Screen wrapper for all routes          Floating EmptyState without Screen
accessibilityRole on all Pressables    Pressables with no a11y role
data.ts for all fixture data           Inline arrays in components
repositories.ts for all data calls     Direct data.ts imports in screens
feature flags respected                Feature flag bypasses
User-facing copy only                  Developer notes in production UI
```
