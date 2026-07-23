# Hungry Stitch Screen Briefs

> Purpose: concise prompts for generating or reviewing Hungry mobile concepts.  
> Runtime source of truth: registered screens, feature flags, current product policy, and approved design system.  
> Do not treat a generated Stitch screen as implementation authority without reconciling it against the app.

## Product boundary

Hungry does not support guest mode.

```text
Splash → Onboarding → Create Account / Sign In → verification when required → authenticated app
```

Do not generate:

- Continue as Guest or Skip Login;
- guest soft gates;
- unauthenticated Home, Discover, Search, detail, map, review, post, or profile screens;
- enabled-looking UI for production-disabled features;
- generic stock/Unsplash food imagery;
- fake ratings, counts, hours, promotions, or verification claims.

Excel catalog fallback, when surfaced, is an authenticated read-only continuity state. It must not look as though saves, reviews, posts, profile edits, or merchant writes can succeed offline.

## Repository-relative visual anchors

Use current repository sources rather than developer-specific absolute paths:

```text
design/figma-v2/home-feed.html
design/figma-v2/discover-search.html
design/figma-v2/building-layout.html
design/figma-v2/stall-detail.html
design/figma-v2/quick-review.html
design/archive/figma-concept/index.html
design/archive/figma-redesign/prototype.html
design/stitch/DESIGN.md
PROJECT_INSTRUCTIONS.md
tasks/design-system.md
```

Archived concepts provide visual ideas only. Current product and accessibility rules override them.

## Global prefix

Use this before a screen-specific prompt:

> Design a mobile screen for Hungry, a Singapore dish-first food discovery app. Follow the current Hungry design tokens and reusable components. Use a warm paper-like background, raised neutral surfaces, accessible Hungry Orange for primary actions, strong dark text, restrained status colours, Nunito-based UI typography, and monospaced treatment only where the design system uses it for prices/codes. Make the screen compact, clear, mobile-native, safe-area aware, accessible at large text sizes, and consistent in light and dark modes. Use approved menu-derived dish imagery and stall logo/venue/representative-dish imagery. Do not use purple gradients, generic stock food, emoji as primary UI icons, fake data, or unsupported feature states.

## Screen families and briefs

### 1. Splash and bootstrap

**Purpose:** brand introduction while authentication/configuration bootstrap completes.

Required states:

- normal Splash;
- session restoration;
- blocking released-build configuration/service-unavailable state.

Prompt:

> Design Hungry’s minimal splash/bootstrap family with the Hungry mark, “Find the dish. Not just the restaurant.”, restrained motion, and a small progress treatment. Also provide a calm blocking configuration/service-unavailable variant with a clear support/update action. No navigation controls on the normal splash and no path into the app when configuration is missing.

### 2. Onboarding welcome and value

**Purpose:** explain dish-first discovery, taste preferences, and location value before mandatory authentication.

Required:

- clear progress;
- skippable optional quiz portions only where product-approved;
- no account bypass;
- location explanation and manual-location alternative.

Prompt:

> Design a short Hungry onboarding sequence explaining dish-first search, personalised taste preferences, and nearby Singapore food. Keep each step benefit-led, accessible, and fast. The final step must lead to mandatory Create Account / Sign In, not guest access.

### 3. Mandatory account screen

**Purpose:** create an account or sign in after onboarding.

Required:

- Create account and Sign in tabs/actions;
- email/password paths;
- approved OAuth providers only when enabled;
- terms/privacy links;
- offline/auth-unavailable error state;
- no guest or skip action.

Prompt:

> Design Hungry’s mandatory account screen shown after onboarding. Provide clear Create account and Sign in paths, trusted email/password fields, optional enabled provider buttons, terms/privacy context, validation, and a calm network-unavailable state. The hierarchy should make authentication required without feeling punitive. Do not include Continue as Guest, Skip, or a dismiss route into the app.

### 4. Email verification and recovery

**Purpose:** complete account verification and restore access safely.

Required states:

- check inbox;
- resend timer/action;
- verification not yet confirmed;
- forgot password;
- reset password;
- reset success with Login action.

Prompt:

> Design a consistent Hungry verification and password-recovery family with concise explanations, clear next actions, resend/retry states, and accessible errors. Do not imply the account is active until verification/session confirmation succeeds.

### 5. Authenticated Home feed

**Purpose:** show relevant public food activity and recommendations after authentication.

Required:

- feed loading/empty/error states;
- source-backed media;
- accessible post/profile/dish/stall actions;
- activity inbox;
- no fake engagement counts;
- clear write failure/retry behavior.

Prompt:

> Design Hungry’s authenticated Home feed with image-led food posts, clear author and dish/stall context, compact social actions, and strong hierarchy. Use real menu/user media patterns, not stock food. Include loading, empty, failed-media, and backend-write failure variants without false optimistic success.

### 6. Discover and browse

**Purpose:** scan nearby dishes and stalls, filter, search, map, and open full paged directories.

Required:

- dish and stall totals where real;
- filters for supported dietary/cuisine/price/location data;
- Browse Dishes and Browse Stalls;
- map action;
- legitimate no-results;
- live versus authenticated offline-catalog source indication.

Prompt:

> Design Hungry’s authenticated Discover screen with a compact search launcher, supported filter chips, nearby menu-image dish cards, stall rows using logo/venue/representative-dish imagery, Browse Dishes and Browse Stalls actions, and map access. Include distinct legitimate no-results and read-only offline-catalog states. Do not substitute unrelated results when a search has no matches.

### 7. Search and filter

**Purpose:** high-density dish/stall/area search with paged results.

Required:

- active search field;
- cancellable loading;
- recent/suggested intent only when data-backed;
- filter summary and clear action;
- paged/deduplicated results;
- empty/error/offline variants.

Prompt:

> Design a utility-focused Hungry search family: idle search, filter sheet, dish results, and stall results. Prioritise scanability, menu imagery, location/stall context, price, dietary tags, and clear filter state. Include loading, no-results, and authenticated read-only fallback variants.

### 8. Dish detail

**Purpose:** help the user decide on one dish.

Required:

- approved menu/gallery media;
- dish, stall, building/unit, price, dietary/taste context;
- reviews and source/verification treatment;
- Save and Write review actions;
- missing/unavailable data states;
- offline write-unavailable state.

Prompt:

> Design an appetite-led Hungry dish detail screen with approved menu imagery, dish and stall identity, price/location context, supported taste/dietary information, community review preview, Save, directions/order link where available, and Write review. Show uncertainty or unavailable data honestly and disable online writes clearly during catalog-only fallback.

### 9. Stall detail and menu

**Purpose:** understand the stall, location, operating context, and full menu.

Required:

- logo/stall image or representative menu image;
- building/floor/unit/address;
- hours/closure with source-aware state;
- paged or efficient menu list;
- directions and merchant claim only when enabled;
- missing/no-image/error/offline variants.

Prompt:

> Design a Hungry stall detail screen using stall logo or venue/representative menu imagery, clear building/floor/unit context, hours and closure state, menu items with dish images and prices, directions, and approved merchant actions. Avoid fake hygiene, open-now, or verification claims.

### 10. Review flow

**Purpose:** create an authenticated dish-level review with optional media.

Required:

- target dish/stall confirmation;
- rating, tags, text, recommendation state;
- media permissions/validation/upload progress;
- edit/back behavior;
- submission failure and retry;
- success/history link.

Prompt:

> Design a compact accessible Hungry review flow with clear progress, dish/stall context, rating and taste tags, optional media, validation, upload progress, and retry-safe submission. Success must appear only after the backend confirms the review.

### 11. Post composer

**Purpose:** publish authenticated food content with valid media and context.

Required:

- dish/stall selection;
- photo/video management;
- caption/tags/privacy controls supported by the implementation;
- upload/publish progress;
- permission denial, retry, draft, and failure states;
- no false published state.

Prompt:

> Design Hungry’s post composer with clear food context, media management, concise caption input, supported visibility controls, upload/publish progress, and recoverable permission or network failure states. Keep the Publish action unavailable until requirements are satisfied and never show success before backend confirmation.

### 12. Profile, favourites, history, and settings

**Purpose:** show one consistent authenticated identity and manage saved/account data.

Required:

- avatar/display name/taste identity;
- posts/reviews/favourites/history;
- edit profile;
- device versus account settings;
- privacy/support/account deletion/sign-out;
- empty/loading/error states.

Prompt:

> Design Hungry’s authenticated profile family with one consistent avatar and identity, taste summary, posts/reviews/favourites/history, edit profile, and orderly settings. Clearly separate device preferences from account/privacy controls. Include account deletion and sign-out as deliberate actions with accessible confirmation.

### 13. Map and location

**Purpose:** discover authenticated catalog records by location without blocking users who deny precise location.

Required:

- permission explanation;
- manual area selection;
- map/list fallback;
- accessible marker/result alternative;
- loading/error/offline states;
- no unsupported indoor/floorplan claims when disabled.

Prompt:

> Design Hungry’s map and location states with clear nearby context, filters, accessible list alternatives, manual area selection, and safe permission-denied behavior. Keep markers and selected-card treatment readable without relying on colour alone.

### 14. Activity and UGC safety

**Purpose:** surface relevant updates while preserving moderation and privacy.

Required:

- updates/messages only when the corresponding feature is enabled;
- report/block/delete-own-content/support actions;
- moderation and hidden-content states;
- no enabled-looking DM/comment/story UI when production-disabled.

Prompt:

> Design Hungry’s activity and UGC safety states with compact updates, clear moderation/report/block actions, and supportive error/empty states. Do not include messaging, comments, or stories unless the task explicitly confirms the feature is enabled and moderated.

### 15. Offline, unavailable, unauthorized, and not found

These are distinct states:

- authenticated read-only catalog fallback;
- internet required for account creation/sign-in;
- service/configuration unavailable;
- unauthorized merchant/admin role;
- disabled feature;
- missing dish/stall/link;
- legitimate no-results.

Prompt:

> Design a consistent Hungry recovery-state family that distinguishes read-only catalog continuity, authentication-required internet, service configuration failure, role denial, disabled features, missing content, and valid no-results. Each state should offer only actions that can actually succeed.

## Recommended generation batches

1. Splash, onboarding, mandatory account, verification/recovery.
2. Home, Discover, Search, Browse, Map.
3. Dish detail, Stall detail/menu, Decide For Me.
4. Review, Post composer, upload/permission/failure states.
5. Profile, favourites, history, settings, account lifecycle.
6. Offline/unavailable/unauthorized/not-found and accessibility variants.
7. Merchant/admin/advanced surfaces only when their current feature brief and role policy are attached.

## Review checklist for every generated design

- matches current authentication and feature policy;
- uses repository-relative/current source references;
- safe-area, keyboard, large-text, dark-mode, reduced-motion, and VoiceOver/TalkBack aware;
- all controls have clear states and actions;
- images and data claims are source-safe;
- loading/empty/error/offline/permission/no-results states are covered;
- no duplicate component pattern without a reason;
- implementation differences are documented before handoff.
