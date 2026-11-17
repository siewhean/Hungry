# Hungry Stitch Screen Briefs

This file identifies which screens are already good enough to use as reference anchors, which screens still need generation, and the exact briefs to paste into Stitch.

## Existing Progress To Keep

Use these screens as visual anchors. Do not regenerate them first unless you are standardizing them to match the final system.

- Home social feed
  - `/Users/Siew Hean/Documents/GitHub/Hungry/design/figma-v2/home-feed.html`
- Discover landing + search hybrid
  - `/Users/Siew Hean/Documents/GitHub/Hungry/design/figma-v2/discover-search.html`
- Building layout + floor navigation
  - `/Users/Siew Hean/Documents/GitHub/Hungry/design/figma-v2/building-layout.html`
- Stall detail
  - `/Users/Siew Hean/Documents/GitHub/Hungry/design/figma-v2/stall-detail.html`
- Quick review flow + review success
  - `/Users/Siew Hean/Documents/GitHub/Hungry/design/figma-v2/quick-review.html`

Secondary concept references:

- Reads, search utility, profile, settings, and state screens
  - `/Users/Siew Hean/Documents/GitHub/Hungry/design/archive/figma-concept/index.html`
  - `/Users/Siew Hean/Documents/GitHub/Hungry/design/archive/figma-redesign/prototype.html`

## Screens Still To Design In Stitch

Priority order:

1. Splash
2. Login
3. Sign Up
4. Forgot Password
5. Email Verification
6. Taste Quiz
7. Dietary Preferences
8. Location Permission
9. Search Idle
10. Taste Filter Sheet
11. Search Results
12. Decide For Me Result
13. Dish Detail
14. Reads Article Bridge
15. Profile Home
16. Favourites
17. Review History
18. Settings
19. Guest Soft Gate
20. Offline State
21. Not Found State

## Use This Global Prefix In Stitch

Paste this before each screen prompt:

> Design a mobile app screen for Hungry, a Singapore dish-first food discovery app. Use the attached DESIGN.md rules exactly. Standardize the layout, spacing, typography, and components with the rest of the app. Use Paper Warm `#FFF7EE` as the default canvas, white for raised cards and sheets, Hungry Orange `#E8531E` for primary actions, Russian Red `#CD0302` for urgency and high-energy accents, Hawker Amber `#F5A623` for ratings and recommendation highlights, Autumn Green `#4F7E17` for freshness and open-now states, Line `#E7DED4` for borders and dividers, and Deep Navy `#1A2E44` for strong text and icon strokes. Use Nunito for UI text and DM Mono for prices, unit numbers, and codes. Keep the layout compact, polished, image-led where relevant, and clearly optimized for mobile. Do not use purple gradients, oversized blocks, emoji icons, teal accents, or inconsistent component styles.

## Screen Briefs

### 01. Splash

- Purpose:
  - Establish brand, confirm appetite-led tone, and transition to the app quickly.
- Required blocks:
  - centered Hungry logo
  - short tagline
  - subtle food-texture or map-dot background motif
  - loading indicator
- Components:
  - brand mark
  - minimal progress indicator
- Notes:
  - keep it clean and premium
  - no buttons
- Stitch prompt:
  - Create the Hungry splash screen for a Singapore dish-first food discovery app. Use a Paper Warm background, centered logo, short tagline “Find the dish. Not just the restaurant.” and a subtle background motif inspired by food maps or dish pins. Use Hungry Orange as the core brand accent and allow a restrained Russian Red or Hawker Amber detail if needed. Keep the screen elegant, fast, and minimal with a small loading indicator near the bottom. No clutter, no extra controls, no large paragraphs.

### 02. Login

- Purpose:
  - Let users sign in fast without making the screen feel corporate.
- Required blocks:
  - compact top brand header
  - email field
  - password field
  - primary sign-in button
  - Google sign-in secondary action
  - forgot password link
  - sign-up link
- Components:
  - AppHeader light
  - Input fields
  - PrimaryButton
  - SecondaryButton
- Notes:
  - high trust and low friction
  - guest-friendly tone
- Stitch prompt:
  - Design a polished mobile login screen for Hungry. Make it warm and modern, not enterprise. Use a compact brand header, two clean inputs for email and password, a strong orange sign-in button, a secondary Google sign-in option, a small “Forgot password?” link, and a bottom link to sign up. Keep spacing tight, typography moderate, and component styling consistent with a consumer food app.

### 03. Sign Up

- Purpose:
  - Create account with minimal friction.
- Required blocks:
  - brand header
  - display name
  - email
  - password
  - confirm or helper text
  - terms note
  - create account CTA
  - Google sign-up option
- Components:
  - Input set
  - Inline helper text
  - PrimaryButton
- Notes:
  - use concise copy
  - make the main CTA clear
- Stitch prompt:
  - Design the Hungry sign-up screen as a compact mobile form with display name, email, and password fields, a strong orange “Create account” button, a Google sign-up secondary action, and a short terms/privacy note. The layout should feel modern, welcoming, and easy to complete in under 30 seconds. Keep the UI standardized with the login screen.

### 04. Forgot Password

- Purpose:
  - Recover access with one simple action.
- Required blocks:
  - title
  - short explanation
  - email input
  - send reset link CTA
  - back to login link
- Components:
  - Input
  - PrimaryButton
  - Secondary text link
- Notes:
  - do not expose security complexity
- Stitch prompt:
  - Design a clean “Forgot password” mobile screen for Hungry with one email field, a short explanation, an orange “Send reset link” button, and a lightweight back-to-login link. Use the same standardized auth-shell spacing, type scale, and component styling as the other auth screens.

### 05. Email Verification

- Purpose:
  - Confirm sign-up and make next steps obvious.
- Required blocks:
  - success or inbox illustration
  - short title
  - helper text
  - resend timer state
  - resend action
  - back to login
- Components:
  - State illustration
  - Countdown row
  - Primary or secondary action
- Notes:
  - optimistic and calm
- Stitch prompt:
  - Design the Hungry email verification screen with a friendly, polished confirmation state: a lightweight inbox or check illustration, a short “Check your inbox” title, helper text explaining verification, a resend timer, a resend action, and a back-to-login link. Keep the layout clean and aligned with the auth screen family.

### 06. Taste Quiz

- Purpose:
  - Capture taste vector quickly.
- Required blocks:
  - progress indicator
  - one question at a time
  - slider or stepped scale
  - optional taste labels
  - next button
  - skip link
- Components:
  - ReviewStepper adapted for onboarding
  - TasteSlider
  - PrimaryButton
- Notes:
  - should feel playful but efficient
  - six-step quiz model
- Stitch prompt:
  - Design the Hungry taste quiz screen as a mobile onboarding step. Show one taste question at a time, a compact progress indicator, a polished slider for intensity, small labels for the taste dimension, and a clear Next button. The screen should feel warm, modern, and lightweight, with just enough delight to make the quiz memorable without slowing it down.

### 07. Dietary Preferences

- Purpose:
  - Let users set restrictions without friction.
- Required blocks:
  - screen title
  - short supporting line
  - multi-select chip grid
  - “no restrictions” option
  - next button
- Components:
  - Selectable chips
  - PrimaryButton
- Notes:
  - chips must be standardized in size and states
- Stitch prompt:
  - Design the Hungry dietary preferences screen with a clean chip-based multi-select layout for Halal, Vegetarian, Vegan, Pork-Free, Nut-Free, and Gluten-Free, plus a “No restrictions” option. Keep the screen visually simple, modern, and highly tappable with consistent chip sizing and a clear next-step CTA.

### 08. Location Permission

- Purpose:
  - Explain location value and request permission clearly.
- Required blocks:
  - illustration or location motif
  - title
  - two-line value proposition
  - allow location CTA
  - secondary manual entry action
- Components:
  - State illustration
  - PrimaryButton
  - SecondaryButton
- Notes:
  - make the rationale obvious: nearby dishes, hawker centres, indoor navigation
- Stitch prompt:
  - Design the Hungry location permission screen. Show a clear but friendly explanation that location powers nearby dishes, hawker-centre discovery, and building navigation. Include a strong primary CTA to allow location and a secondary action for manual location entry. The screen should feel trustworthy, lightweight, and helpful.

### 09. Search Idle

- Purpose:
  - Make dish-first search useful before typing.
- Required blocks:
  - search field
  - recent searches
  - cuisine chips
  - dietary quick toggles
  - entry to taste filter
  - decide for me shortcut
- Components:
  - SearchField
  - Chip row
  - SectionHeader
  - DecideForMeCard compact
- Notes:
  - more utility-driven than Discover
- Stitch prompt:
  - Design the Hungry Search Idle screen as a dish-first utility surface. Include a focused search bar, recent searches, cuisine chips, quick dietary toggles, a clear “Taste Filter” control, and a compact “Decide For Me” shortcut. Make the layout denser and more functional than Discover while preserving the same visual system.

### 10. Taste Filter Sheet

- Purpose:
  - Let users tune cravings precisely.
- Required blocks:
  - bottom-sheet or modal shell
  - six taste sliders
  - default profile hint
  - reset action
  - apply button
- Components:
  - BottomSheet
  - TasteSlider
  - PrimaryButton
- Notes:
  - sheet should feel premium and compact
- Stitch prompt:
  - Design the Hungry Taste Filter screen as a premium bottom sheet with six standardized taste sliders: Sweet, Spicy, Sour, Salty, Rich, and Aromatic. Include a “Reset to my profile” action, an Apply CTA, and subtle default-value cues. Keep the controls compact, elegant, and easy to scan on a phone.

### 11. Search Results

- Purpose:
  - Rank nearby dish options fast.
- Required blocks:
  - active search field
  - filter summary row
  - dish result list
  - distance, rating, taste match, and stall metadata
  - optional decide for me re-entry
- Components:
  - SearchField active
  - FilterPills
  - DishCard result variant
- Notes:
  - prioritize density and scanability
- Stitch prompt:
  - Design the Hungry Search Results screen for dish-first search. Show a list of dish cards ranked by proximity, rating, and taste match, with each card displaying dish image, dish name, stall name, unit or building context, price, and key taste tags. The layout should be compact, highly scannable, and more utility-led than the social feed.

### 12. Decide For Me Result

- Purpose:
  - Present one dish recommendation with confidence.
- Required blocks:
  - hero recommendation card
  - taste match or why-this-picked explanation
  - order now CTA
  - get directions CTA
  - try again action
- Components:
  - DecideForMeCard expanded
  - CTADock
- Notes:
  - must feel decisive, not random
- Stitch prompt:
  - Design the Hungry “Decide For Me” result screen around one hero dish recommendation. Use strong photography, a clear taste-match explanation, and two main actions: Order Now and Get Directions, plus a lighter “Try Again” action. The screen should feel confident, high-conviction, and tailored to the user’s craving profile.

### 13. Dish Detail

- Purpose:
  - Turn a dish into a decision fast.
- Required blocks:
  - large hero dish image
  - dish name and price
  - taste tags
  - radar or taste visualization summary
  - stall context
  - review preview
  - order CTA and write review CTA
- Components:
  - HeroMedia
  - PriceBlock
  - TasteTag
  - ReviewPreview
  - CTADock
- Notes:
  - dish page should feel more appetite-led than stall page
- Stitch prompt:
  - Design the Hungry Dish Detail screen as an appetite-led decision page. Include a large hero image, dish name, price, taste tags, a compact taste-profile visualization, stall and location context, a short community review preview, and a sticky bottom CTA area for ordering and writing a review. Keep the screen premium, compact, and clearly dish-first.

### 14. Reads Article Bridge

- Purpose:
  - Connect editorial content back into discovery.
- Required blocks:
  - article hero
  - short editorial excerpt
  - featured stall or dish card
  - CTA into stall detail
  - related nearby article or dish
- Components:
  - HeroMedia
  - ArticleCard
  - StallCard featured
- Notes:
  - not a full browser view
  - bridge screen only
- Stitch prompt:
  - Design the Hungry Reads Article Bridge screen that sits between an editorial article and a Hungry venue page. Show the article hero, a short excerpt, a featured stall or dish card, and a strong CTA that takes the user into the stall detail flow. Make the screen feel editorial but still part of the app.

### 15. Profile Home

- Purpose:
  - Show taste identity, saved content, and activity.
- Required blocks:
  - profile hero
  - taste fingerprint card
  - saved dishes summary
  - review history summary
  - activity stats
  - settings entry
- Components:
  - ProfileHero
  - TasteFingerprintCard
  - StatPill
  - SettingsRow
- Notes:
  - identity first, settings second
- Stitch prompt:
  - Design the Hungry Profile Home screen with a clear user identity header, a taste fingerprint card, saved dishes summary, review history summary, and compact activity stats. Keep the screen warm and personal, but not noisy. Settings should be present but not dominant.

### 16. Favourites

- Purpose:
  - Let users revisit saved dishes and stalls quickly.
- Required blocks:
  - segmented filter or tabs for dishes and stalls
  - saved item list
  - compact metadata
  - empty state
- Components:
  - SegmentControl
  - DishCard compact
  - StallCard compact
  - EmptyState
- Notes:
  - optimize for revisit and reorder, not browsing
- Stitch prompt:
  - Design the Hungry Favourites screen with a simple segmented control for saved dishes and saved stalls, plus a tidy saved-items list with thumbnails, location context, and compact metadata. Include a strong empty state for first-time users. The screen should feel practical and lightweight.

### 17. Review History

- Purpose:
  - Show past contributions and let users revisit them.
- Required blocks:
  - stats row
  - review list
  - dish context
  - stall context
  - score and date
- Components:
  - HistoryRow
  - ReviewSummaryCard
- Notes:
  - clearly dish-attached
- Stitch prompt:
  - Design the Hungry Review History screen with a compact stats summary at the top and a scrollable list of past dish reviews showing dish name, stall name, score, date, and a short snippet of the review. Make it clear that reviews are attached to dishes, not just venues.

### 18. Settings

- Purpose:
  - Manage preferences without overwhelming the user.
- Required blocks:
  - grouped settings rows
  - notifications
  - dietary preferences
  - location preferences
  - app feature toggles
  - sign out
- Components:
  - SettingsRow
  - Toggle rows
  - Danger action row
- Notes:
  - lowest emotional intensity screen
  - keep it clean and standardized
- Stitch prompt:
  - Design the Hungry Settings screen with grouped settings rows for notifications, dietary preferences, location settings, and feature preferences, plus a clear sign-out action. Keep the screen minimal, orderly, and consistent with the Profile screen family.

### 19. Guest Soft Gate

- Purpose:
  - Nudge guests to sign in when they try to save or review.
- Required blocks:
  - bottom sheet
  - short value proposition
  - Google sign-in
  - email sign-in
  - continue as guest
- Components:
  - SoftGateSheet
  - PrimaryButton
  - SecondaryButton
- Notes:
  - polite, fast, dismissible
- Stitch prompt:
  - Design the Hungry guest soft gate as a bottom sheet that appears when a guest tries to save a dish or write a review. Include a short explanation of the benefit, a Google sign-in action, an email sign-in action, and a continue-as-guest option. The tone should be helpful and low-pressure.

### 20. Offline State

- Purpose:
  - Recover gracefully when there is no connection.
- Required blocks:
  - calm illustration
  - title
  - concise explanation
  - retry action
  - secondary action to view saved items if relevant
- Components:
  - EmptyState
  - PrimaryButton
  - SecondaryButton
- Notes:
  - no scary error styling
- Stitch prompt:
  - Design the Hungry offline state screen with a calm illustration, a concise title, a short explanation, a Retry action, and an optional secondary action to view saved or cached content. Keep the tone warm and practical rather than alarming.

### 21. Not Found State

- Purpose:
  - Recover from broken or missing links.
- Required blocks:
  - neutral illustration
  - title
  - explanation
  - back to discover CTA
  - optional search CTA
- Components:
  - EmptyState
  - PrimaryButton
- Notes:
  - should feel part of the app, not a developer error page
- Stitch prompt:
  - Design the Hungry not-found screen for missing dishes, stalls, or links. Include a simple illustration, one short explanation, a strong “Back to Discover” action, and an optional search action. Keep it lightweight, branded, and mobile-native.

## Stitch Workflow Recommendation

Generate in these batches so the system stays consistent:

1. Auth shell family:
   - Login
   - Sign Up
   - Forgot Password
   - Email Verification
2. Onboarding family:
   - Taste Quiz
   - Dietary Preferences
   - Location Permission
3. Search and decision family:
   - Search Idle
   - Taste Filter
   - Search Results
   - Decide For Me Result
   - Dish Detail
4. Reads and profile family:
   - Reads Article Bridge
   - Profile Home
   - Favourites
   - Review History
   - Settings
5. Recovery and guest family:
   - Guest Soft Gate
   - Offline State
   - Not Found State

## Standardization Checklist For Every Generated Screen

- Same type scale as `src/theme/tokens.ts`
- Same spacing scale as `src/theme/tokens.ts`
- Same radius system as `src/theme/tokens.ts`
- Same button behavior and CTA hierarchy
- Same bottom-nav treatment on root screens
- Same search field treatment across Discover and Search
- Same dish, stall, and article card language
- Same review component language across review, profile, and detail flows
