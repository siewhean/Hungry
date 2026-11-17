# Hungry DESIGN.md

This file is the Stitch design-system brief for the Hungry consumer mobile app.

## Product

- Product: Hungry
- Platform: mobile app, iOS-first, React Native + Expo
- Core idea: the dish is the atomic unit, not the restaurant
- Market: Singapore locals, residents, tourists, hawker-centre and food-court diners
- Brand promise: a knowledgeable local food guide in your pocket

## Source Of Truth

Use these project rules as the base context before generating any new screen:

1. Product requirements:
   - `/Users/Siew Hean/Documents/GitHub/Hungry/Research/01_Product_Requirements_Document_Hungry.docx`
2. App flows and screen IDs:
   - `/Users/Siew Hean/Documents/GitHub/Hungry/Research/02_App_Flow_Document_Hungry.docx`
3. Frontend tokens and UI rules:
   - `/Users/Siew Hean/Documents/GitHub/Hungry/Research/03_Frontend_Guidelines_Hungry.docx`
   - `/Users/Siew Hean/Documents/GitHub/Hungry/src/theme/tokens.ts`
4. Current design anchors:
   - `/Users/Siew Hean/Documents/GitHub/Hungry/design/figma-v2/home-feed.html`
   - `/Users/Siew Hean/Documents/GitHub/Hungry/design/figma-v2/discover-search.html`
   - `/Users/Siew Hean/Documents/GitHub/Hungry/design/figma-v2/building-layout.html`
   - `/Users/Siew Hean/Documents/GitHub/Hungry/design/figma-v2/stall-detail.html`
   - `/Users/Siew Hean/Documents/GitHub/Hungry/design/figma-v2/quick-review.html`
   - `/Users/Siew Hean/Documents/GitHub/Hungry/design/archive/figma-concept/index.html`
   - `/Users/Siew Hean/Documents/GitHub/Hungry/design/archive/figma-redesign/prototype.html`

## Product Structure

- Final product IA should converge to:
  - Discover
  - Search
  - Reads
  - Profile
- Current code still has:
  - Home
  - Discover
  - Maps
  - Review
  - Profile
- Design rule for Stitch:
  - Treat `Home` as the social-feed variant of Discover.
  - Treat `Maps` as the map-mode variant of Discover.
  - Treat `Review` as a deep flow or modal sequence, not a separate design language.
  - Do not invent a sixth navigation model.

## Design Principles

- Dish-first, not venue-first.
- Food photography should carry the emotional weight.
- White or near-white should dominate the canvas so food images stay vivid.
- Visual style should feel warm, local, modern, and socially alive.
- The product should feel useful first, social second.
- Use social mechanics lightly:
  - reactions
  - save
  - share
  - comment count
- Do not turn the app into a creator platform.
- Map experiences should feel spatial and premium, not like a plain directory.
- Reviews must stay attached to dishes, not only to stalls.
- Reads must bridge back into stalls or dishes, not feel like orphan content.

## Visual Direction

- Tone:
  - warm
  - appetite-led
  - community-trusted
  - Singapore-local
  - image-led
- Avoid:
  - purple gradients
  - generic SaaS cards
  - oversized pastel blocks
  - emoji icons
  - oversized type
  - heavy glassmorphism
  - dark mode as the default canvas

## Color System

Use this palette as the main visual system for Stitch outputs.

- Hungry Orange:
  - `#E8531E`
  - primary CTA
  - active tab
  - selected chips
  - primary highlights
- Russian Red:
  - `#CD0302`
  - urgency
  - key conversion accents
  - social counters
  - alert badges
- Hawker Amber:
  - `#F5A623`
  - ratings
  - must-order highlights
  - recommendation cues
- Autumn Green:
  - `#4F7E17`
  - freshness
  - open-now states
  - healthy or vegetarian cues
  - secondary map and location accents
- Paper Warm:
  - `#FFF7EE`
  - primary app background
  - soft section backgrounds
  - warm canvas behind food imagery
- Line:
  - `#E7DED4`
  - borders
  - dividers
  - low-contrast containers
- Deep Navy:
  - `#1A2E44`
  - primary headings
  - high-contrast text
  - dark icon strokes
- White:
  - `#FFFFFF`
  - card surfaces
  - raised sheets
  - modal interiors
- Primary text:
  - `#111827`
- Secondary text:
  - `#374151`
- Muted text:
  - `#6B7280`

Application ratio:

- 55% Paper Warm and white surfaces
- 25% Deep Navy, Line, and image-led neutral structure
- 10% Hungry Orange for primary actions
- 5% Hawker Amber for ratings and highlights
- 5% Russian Red and Autumn Green for urgency and freshness signals

## Typography

Use the app token scale and do not upscale it.

- Display:
  - 32 / 38, Nunito Bold
- H1:
  - 24 / 30, Nunito Bold
- H2:
  - 20 / 26, Nunito SemiBold
- H3:
  - 17 / 22, Nunito SemiBold
- Body Large:
  - 17 / 24, Nunito Regular
- Body:
  - 15 / 22, Nunito Regular
- Body Small:
  - 13 / 18, Nunito Regular
- Micro:
  - 11 / 14, Nunito Medium
- Price / unit / code:
  - 15 / 22, DM Mono

Rules:

- Screen titles should usually be H1 or H2, not Display.
- Card titles should be H3 or 15-17 px equivalents.
- Metadata should use Body Small or Micro.
- Never let body copy exceed 3 lines in list cards.

## Layout System

Use one canonical mobile frame:

- iPhone Pro portrait
- 402 x 874 if Stitch needs an exact canvas

Responsive expectation:

- Must still work down to 390 px wide without redesign

Spacing scale:

- 4, 8, 12, 16, 20, 24, 32, 48

Standard screen padding:

- horizontal outer padding: 16
- top content offset below safe area: 12 to 16
- vertical gap inside grouped content: 12
- vertical gap between sections: 20
- vertical gap between major regions: 24

Standard radii:

- small utility surfaces: 8
- chips, tags, small cards: 12
- main content cards: 18
- bottom sheets and floating docks: 24
- pills: 999

## Standard Screen Shells

### 1. Feed Shell

Used for:

- Home feed
- Discover feed variant
- Reads feed

Structure:

- safe-area top
- compact header row
- hero or lead module
- vertically scrolling content
- bottom navigation

### 2. Utility Shell

Used for:

- Search
- Search results
- Favourites
- Review history
- Settings

Structure:

- app bar
- search or filter row if relevant
- primary content list
- optional sticky CTA or filter dock
- bottom navigation if it is a root screen

### 3. Detail Shell

Used for:

- Stall detail
- Dish detail
- Reads article bridge

Structure:

- hero media
- title and trust/status block
- information clusters
- supporting list modules
- sticky CTA dock when action matters

### 4. Form / Funnel Shell

Used for:

- Login
- Sign up
- Forgot password
- Email verification
- Taste quiz
- Dietary preferences
- Location permission

Structure:

- progress or brand marker
- one dominant task
- one supporting explanation block
- primary CTA at bottom
- secondary text link

### 5. State Shell

Used for:

- Offline
- Not found
- empty states
- soft gate

Structure:

- one clear illustration or icon area
- one concise title
- one concise description
- one primary recovery action
- one optional secondary action

## Standard Component Set

All new screens should be assembled only from these standardized component families.

### Global

- `AppHeader`
- `BottomNav`
- `SectionHeader`
- `InlineBanner`
- `SearchField`
- `PrimaryButton`
- `SecondaryButton`
- `IconButton`
- `SoftGateSheet`

### Discovery

- `SocialPostCard`
- `DishCard`
- `StallCard`
- `ArticleCard`
- `MapPreviewCard`
- `BuildingBottomSheet`
- `FloorChip`
- `MapPin`
- `DecideForMeCard`

### Detail

- `HeroMedia`
- `TrustStatusRow`
- `TasteTag`
- `PriceBlock`
- `OperatingHoursBlock`
- `CommunityReviewCard`
- `CTADock`

### Review

- `ReviewStepper`
- `StarRating`
- `TasteTagSelector`
- `PhotoPicker`
- `ReviewSummaryCard`

### Profile

- `ProfileHero`
- `TasteFingerprintCard`
- `SavedDishCard`
- `HistoryRow`
- `SettingsRow`
- `StatPill`

## Component Rules

- Search fields:
  - 48 px height
  - leading icon
  - rounded 18 px
  - subtle border, not heavy shadow
- Primary buttons:
  - min height 52
  - orange fill
  - white text
  - 18 px radius
- Secondary buttons:
  - white or soft-neutral fill
  - navy text
  - visible border
- Cards:
  - never mix more than 2 shadow depths on one screen
  - image cards use media first, copy second
  - utility cards use title, metadata, and one action
- Chips:
  - max height 32
  - use only for filters, taste tags, levels, status
- Bottom sheets:
  - 24 px radius
  - handle visible
  - sheet header always includes a concise title or search field
- CTA docks:
  - anchored at bottom
  - max 2 primary actions
  - keep one strongest CTA only

## Color Application Rules

- Default app canvas should be Paper Warm, not flat white.
- Use white for cards and elevated surfaces so food imagery still pops.
- Hungry Orange remains the default primary action color.
- Russian Red should be used sparingly:
  - key urgency
  - strong social energy
  - important alerts
- Hawker Amber is for ratings, recommendation flags, and discovery warmth.
- Autumn Green is for open-now, freshness, healthy filters, and calm secondary emphasis.
- Line should replace generic grey borders in Stitch outputs.
- Avoid introducing teal, blue, or unrelated palette accents unless the screen specifically needs a system-only state.

## Interaction Rules

- Discover / Home:
  - support scroll-first browsing
  - give immediate search entry
  - make `Decide For Me` visually distinct
- Search:
  - results must feel denser and more utility-led than Discover
- Map and building:
  - always pair spatial context with a bottom sheet or floor list
- Review:
  - keep to 3 or 4 compact steps maximum
- Profile:
  - place settings below identity and history, never above them

## Standard States Per Screen

Every new screen should account for:

- default
- loading
- empty
- error or offline
- authenticated vs guest, where relevant

## Content Rules

- Use Singapore-local wording when helpful:
  - nearby makan
  - hawker centre
  - food court
  - unit number
- Keep copy compact.
- Favor real food nouns over generic app copy.
- Menu and taste information should be concrete, not decorative.

## Existing Screens To Preserve As Anchors

These already have useful direction and should be treated as design references rather than reinvented from scratch:

- Home feed
- Discover landing and search
- Building layout
- Stall detail
- Quick review flow
- Review success

## Remaining Work Principle

Generate the remaining screens so they clearly belong to the same system as the anchors above.

- Same header logic
- Same type scale
- Same card language
- Same bottom-nav behavior
- Same CTA treatment
- Same map and review conventions

## Pre-Export Checklist

- All root screens use the same bottom navigation structure.
- All screens use the same spacing scale.
- No screen introduces a new corner radius without reason.
- No screen introduces a new font pairing.
- All buttons and cards reuse the standard component set.
- Search, review, map, and profile patterns remain visually consistent across flows.
