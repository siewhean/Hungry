# design-system.md — Hungry Design System Reference

> Dictionary format. Source of truth for all visual decisions.
> Never hardcode any of these values — always import from `src/theme/tokens.ts` via `useHungryTheme()`.

---

## Brand Identity

| Attribute | Value |
|-----------|-------|
| Primary accent | Orange `#E8531E` |
| Secondary accent | Navy `#1A2E44` |
| Supporting | Amber `#F5A623`, Teal `#14B8A6` |
| Personality | Warm, direct, local — not trendy SaaS, not food-delivery app |
| Visual metaphor | A local hawker's handwritten sign — purposeful, unpretentious |

---

## Color Palette (Light Mode)

| Token | Hex | Use |
|-------|-----|-----|
| `bg` | `#FFFFFF` | Screen background |
| `bgMuted` | `#F9FAFB` | Secondary backgrounds, list areas |
| `bgSoft` | `#FDF0EB` | Warm tinted surfaces (orange tint) |
| `surface` | `#FFFFFF` | Card surfaces |
| `surfaceRaised` | `#FAF7F2` | Elevated cards, bottom sheets |
| `text` | `#111827` | Primary text |
| `textSecondary` | `#374151` | Secondary text, labels |
| `textMuted` | `#6B7280` | Metadata, captions |
| `border` | `#D1D5DB` | Dividers, card borders |
| `orange` | `#E8531E` | CTAs, active states, brand accent |
| `orangeDark` | `#C43E10` | Orange pressed state |
| `orangeLight` | `#FDF0EB` | Orange soft background |
| `navy` | `#1A2E44` | Headings, high-contrast text |
| `amber` | `#F5A623` | Star ratings, highlights |
| `teal` | `#14B8A6` | Tags, dietary badges |
| `success` | `#16A34A` | Open status, positive indicators |
| `error` | `#DC2626` | Errors, closed status |
| `warning` | `#D97706` | Warnings, price alerts |
| `overlay` | `rgba(17,24,39,0.45)` | Map overlays, modal scrim |

Source: `src/theme/tokens.ts → colors.light`

---

## Color Palette (Dark Mode)

| Token | Hex |
|-------|-----|
| `bg` | `#0D0F14` |
| `bgMuted` | `#121722` |
| `surface` | `#161C27` |
| `surfaceRaised` | `#1B2433` |
| `text` | `#F9FAFB` |
| `textMuted` | `#9CA3AF` |
| `border` | `#374151` |
| `orange` | `#E8531E` (unchanged) |

Source: `src/theme/tokens.ts → colors.dark`

---

## Typography Scale

| Token | Font | Size | Line Height | Use |
|-------|------|------|-------------|-----|
| `display` | Nunito Bold 700 | 32 | 38 | Hero headings |
| `h1` | Nunito Bold 700 | 24 | 30 | Screen titles |
| `h2` | Nunito SemiBold 600 | 20 | 26 | Section headers |
| `h3` | Nunito SemiBold 600 | 17 | 22 | Card titles |
| `bodyLarge` | Nunito Regular 400 | 17 | 24 | Lead body copy |
| `body` | Nunito Regular 400 | 15 | 22 | Default body |
| `bodySmall` | Nunito Regular 400 | 13 | 18 | Captions, meta |
| `micro` | Nunito Medium 500 | 11 | 14 | Labels, tags (+ 0.6 letter-spacing) |
| `price` | DM Mono Regular 400 | 15 | 22 | Prices, numeric values |
| `code` | DM Mono Regular 400 | 13 | 18 | Debug/code display |

Source: `src/theme/tokens.ts → typography`

**Rules:**
- Dish prices → always `price` token (DM Mono)
- Never mix Nunito weights arbitrarily — stick to the scale
- `micro` is for chips, badges, dietary flags only

---

## Spacing Scale

| Token | px | Common use |
|-------|-----|------------|
| `spacing[1]` | 4 | Inline gaps, icon-to-text |
| `spacing[2]` | 8 | Small padding, chip padding |
| `spacing[3]` | 12 | Card inner padding (compact) |
| `spacing[4]` | 16 | Default screen horizontal padding |
| `spacing[5]` | 20 | Section gaps |
| `spacing[6]` | 24 | Large section gaps |
| `spacing[8]` | 32 | Between major sections |
| `spacing[12]` | 48 | Large vertical rhythm |
| `spacing[16]` | 64 | Screen-level breathing room |

Source: `src/theme/tokens.ts → spacing`

---

## Border Radius Scale

| Token | px | Use |
|-------|-----|-----|
| `radii.sm` | 8 | Chips, small badges |
| `radii.md` | 12 | Cards, inputs |
| `radii.lg` | 18 | Bottom sheets, large cards |
| `radii.pill` | 999 | Full-pill buttons, round badges |

Source: `src/theme/tokens.ts → radii`

---

## Shadow Definitions

| Token | Use |
|-------|-----|
| `shadows.card` | Standard cards in lists |
| `shadows.floating` | FAB, floating toasts, elevated sheets |

Source: `src/theme/tokens.ts → shadows`

---

## Motion Timing

| Token | ms | Use |
|-------|----|-----|
| `motion.buttonPress` | 100 | Button scale feedback |
| `motion.screenTransition` | 250 | Screen push/pop |
| `motion.sheet` | 300 | Bottom sheet open/close |
| `motion.toast` | 250 | Toast appear/dismiss |
| `motion.skeleton` | 1500 | Skeleton shimmer loop |

Source: `src/theme/tokens.ts → motion`

---

## Z-Index Layer System

| Token | Value | Layer |
|-------|-------|-------|
| `zIndex.map` | 1 | Map base |
| `zIndex.overlay` | 10 | Map overlays, modals |
| `zIndex.fab` | 20 | Floating action buttons |
| `zIndex.toast` | 30 | Toast notifications |

---

## Component Inventory

### Primitives (`src/components/ui/`)

| Component | Props summary | When to use |
|-----------|--------------|-------------|
| `AppText` | `variant`, `color`, `children` | All text — maps to typography scale |
| `Button` | `variant` (`primary`/`secondary`/`ghost`), `onPress`, `loading`, `disabled` | All tappable actions |
| `Card` | `children`, `onPress?` | List items, content containers |
| `Input` | `label`, `error`, React Hook Form compatible | All text inputs |
| `Badge` | `label`, `color` | Status indicators |
| `Chip` | `label`, `selected`, `onPress` | Filter pills, taste tags |
| `Screen` | `children`, `edges?` | Screen wrapper — handles safe area |
| `EmptyState` | `icon`, `title`, `subtitle`, `action?` | Empty list states |
| `InlineBanner` | `type` (`info`/`warning`/`error`), `message` | Inline contextual alerts |
| `FloatingToast` | Global singleton — triggered via `useUIStore` | Success/error feedback |

### Dish Components (`src/components/dish/`)

| Component | Key props | Notes |
|-----------|----------|-------|
| `DishCard` | `dish: DishSummary`, `onPress` | Primary discovery card — large image |
| `TasteRadarChart` | `vector: TasteVector`, `size?` | 6-axis SVG radar chart |
| `MustOrderBadge` | — | Orange badge — only when `dish.mustOrder === true` |
| `DecideForMeCard` | `onPress` | Randomiser CTA card in home feed |
| `DeliveryButton` | `platform`, `links` | GrabFood / Foodpanda deep link button |
| `DeliveryPlatformButton` | `link: DeliveryLink` | Individual platform button |

### Stall Components (`src/components/stall/`)

| Component | Key props | Notes |
|-----------|----------|-------|
| `StallCard` | `venue: VenueSummary` | Venue list card |
| `StallHeader` | `venue: VenueSummary` | Detail screen header |
| `OperatingHours` | `hours: string`, `closureNotice?` | Hours + closure notice |
| `HygieneGradeBadge` | `grade: HygieneGrade` | A/B/C/D badge |

### Map Components (`src/components/map/`)

| Component | Key props | Notes |
|-----------|----------|-------|
| `MapSurface` | `children` | Wraps Mapbox — mock-friendly |
| `BuildingPin` | `building: BuildingSummary`, `onPress` | Map pin for a hawker/food court |
| `ClusterPin` | `count`, `onPress` | Aggregated multi-venue pin |
| `FloorSelector` | `floors`, `selected`, `onSelect` | Floor switcher in drill-down |
| `MapBottomSheet` | `building?` | Bottom sheet summaries on map |
| `BuildingLegend` | — | Map legend (building type icons) |

### Review Components (`src/components/review/`)

| Component | Key props | Notes |
|-----------|----------|-------|
| `ReviewCard` | `review: Review` | Single review display |
| `StarRating` | `value`, `max?`, `editable?` | Star display + interactive input |
| `TasteTagSelector` | `selected`, `onToggle` | Multi-select taste tag chips |
| `PhotoPicker` | `photos`, `onAdd`, `onRemove` | Photo strip in review compose |

---

## Design Anti-Patterns (NEVER do these)

| Anti-pattern | Why |
|-------------|-----|
| Purple gradients | Off-brand |
| Sparkle/emoji in headings | Cheap, off-brand |
| Generic glowing hover effects | Web pattern — not mobile |
| Oversized display headings + ultra-thin body | Breaks type hierarchy |
| Fake testimonials | Misleading |
| Placeholder AI-marketing names | Off-brand |
| Social icons with no function | Noise |
| Feature flags bypassed in production components | Breaks flag system |
| Hardcoded `#E8531E` instead of `palette.orange` | Breaks theming |

---

## Design Prototypes

| Location | Screens covered |
|----------|----------------|
| `design/archive/figma-concept/index.html` | Archived initial concept |
| `design/figma-v2/home-feed.html` | Home feed |
| `design/figma-v2/discover-search.html` | Discover / search |
| `design/figma-v2/stall-detail.html` | Stall detail |
| `design/figma-v2/building-layout.html` | Building drill-down |
| `design/figma-v2/quick-review.html` | Review flow |
| `design/archive/figma-redesign/prototype.html` | Archived redesign prototype |
| `design/archive/figma-redesign/direction.html` | Archived visual direction |
| `design/archive/figma-redesign/components.html` | Archived component showcase |

**Rule:** Before building any new screen or major component, open the relevant prototype to check intended layout and visual direction.
