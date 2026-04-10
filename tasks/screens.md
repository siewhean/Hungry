# screens.md — Screen Inventory & Navigation Map

> Dictionary format. Every screen has a path, purpose, params, and state dependencies.

---

## Navigation Architecture

```
Root Stack (RootNavigator)
├── Splash                          # App init / loading
├── AuthStack                       # Auth screens (modal-style)
│   ├── Login
│   ├── SignUp
│   ├── ForgotPassword
│   ├── ResetPassword
│   └── EmailVerification
├── OnboardingStack                 # First-run only
│   ├── LocationPermission
│   ├── TasteQuiz
│   └── DietaryPreferences
├── MainTabs (Bottom Tabs)
│   ├── Home          → HomeFeedScreen
│   ├── Discover      → DiscoverNavigator (Stack)
│   │   ├── DiscoverHome → DishSearchScreen
│   │   ├── TasteFilter  → TasteFilterScreen
│   │   └── SearchResults → SearchResultsScreen
│   ├── Maps          → MapsNavigator (Stack)
│   │   ├── MapsHome     → HomeMapScreen
│   │   ├── BuildingDrillDown → BuildingDrillDownScreen
│   │   └── DecideForMeResult → DecideForMeResultScreen
│   ├── Review        → ReviewStack
│   │   ├── ReviewHub
│   │   ├── ReviewRating
│   │   ├── ReviewTags
│   │   └── ReviewCompose
│   └── Profile       → ProfileStack (auth-required)
│       ├── ProfileHome
│       ├── ProfileScreen
│       ├── Settings
│       ├── Favourites
│       └── ReviewHistory
├── DishDetail                      # Global modal — any tab can push
├── StallDetail                     # Global modal — any tab can push
├── BlogPost                        # Global modal — from Reads or Home
├── ReviewStack                     # Also accessible as root-level modal
├── Offline                         # Network error state
└── NotFound                        # 404 state
```

---

## Navigation Param Types

Source: `src/app/navigation/navigationTypes.ts`

| Screen Name | Params |
|-------------|--------|
| `Splash` | none |
| `AuthStack` | `{ screen: AuthScreenName }` |
| `OnboardingStack` | none |
| `MainTabs` | none |
| `DishDetail` | `{ dishId: string }` |
| `StallDetail` | `{ venueId: string }` |
| `BlogPost` | `{ postId: string }` |
| `ReviewStack` | none |
| `Offline` | none |
| `NotFound` | none |

---

## Screen-by-Screen Reference

### Splash

| Key | Value |
|-----|-------|
| File | `src/app/screens/SplashScreen.tsx` |
| Purpose | App boot — loads fonts, checks session, routes to correct initial screen |
| Transitions to | `MainTabs` (returning user) · `OnboardingStack` (first run) · `AuthStack` (session expired) |
| State reads | `useSessionStore` — `isAuthenticated`, `hasCompletedOnboarding` |

---

### Auth Screens

| Screen | File | Purpose |
|--------|------|---------|
| `Login` | `src/app/screens/auth/LoginScreen.tsx` | Email + password login |
| `SignUp` | `src/app/screens/auth/SignUpScreen.tsx` | Account creation |
| `ForgotPassword` | `src/app/screens/auth/ForgotPasswordScreen.tsx` | Request password reset |
| `ResetPassword` | `src/app/screens/auth/ResetPasswordScreen.tsx` | Enter new password |
| `EmailVerification` | `src/app/screens/auth/EmailVerificationScreen.tsx` | Verify email after sign-up |

| Key | Value |
|-----|-------|
| Shell | `src/app/screens/auth/AuthScreenShell.tsx` — shared layout wrapper |
| Stack | `src/app/screens/auth/AuthStack.tsx` |
| On success | `useSessionStore.completeAuth()` → navigate to `OnboardingStack` or `MainTabs` |
| Forms | React Hook Form throughout |

---

### Onboarding Screens

| Screen | File | Purpose |
|--------|------|---------|
| `LocationPermission` | `src/app/screens/onboarding/LocationPermissionScreen.tsx` | Request device location |
| `TasteQuiz` | `src/app/screens/onboarding/TasteQuizScreen.tsx` | Set taste vector sliders |
| `DietaryPreferences` | `src/app/screens/onboarding/DietaryPreferencesScreen.tsx` | Select dietary flags |

| Key | Value |
|-----|-------|
| Shell | `src/app/screens/onboarding/OnboardingScreenShell.tsx` |
| Stack | `src/app/screens/onboarding/OnboardingStack.tsx` |
| On complete | `useSessionStore.completeOnboarding()` → `MainTabs` |
| Can skip quiz | `completeOnboarding(true)` sets `hasSkippedTasteQuiz: true` |

---

### Home Tab — HomeFeedScreen

| Key | Value |
|-----|-------|
| File | `src/app/screens/home/HomeFeedScreen.tsx` |
| Tab icon | `House` (lucide) |
| Purpose | Personalised dish feed + stall posts |
| Key components | `DishCard`, `DecideForMeCard`, `StallCard` |
| State reads | `useProfileStore` (taste vector), `useSessionStore` |
| Navigates to | `DishDetail`, `StallDetail`, `BlogPost`, `DecideForMeResult` |
| Content source | `src/features/home/feed.ts` |

---

### Discover Tab — DishSearchScreen

| Key | Value |
|-----|-------|
| File | `src/app/screens/search/DishSearchScreen.tsx` |
| Tab icon | `Compass` (lucide) |
| Purpose | Text search + category filters entry point |
| Navigates to | `TasteFilter`, `SearchResults` |
| State reads | `useSearchStore` |

### TasteFilterScreen

| Key | Value |
|-----|-------|
| File | `src/app/screens/search/TasteFilterScreen.tsx` |
| Purpose | Slider-based taste vector filter |
| Navigates to | `SearchResults` |
| State writes | `useSearchStore.setTasteValues()` |

### SearchResultsScreen

| Key | Value |
|-----|-------|
| File | `src/app/screens/search/SearchResultsScreen.tsx` |
| Purpose | Filtered dish list |
| State reads | `useSearchStore` |
| Navigates to | `DishDetail` |
| Content source | `src/features/search/search.ts` |

---

### Maps Tab — HomeMapScreen

| Key | Value |
|-----|-------|
| File | `src/app/screens/discover/HomeMapScreen.tsx` |
| Tab icon | `MapPinned` (lucide) |
| Purpose | Singapore map with hawker/food court pins |
| Key components | `MapSurface`, `BuildingPin`, `ClusterPin`, `MapBottomSheet` |
| State reads | `useDiscoveryStore`, `useLocationStore` |
| Navigates to | `BuildingDrillDown` |

### BuildingDrillDownScreen

| Key | Value |
|-----|-------|
| File | `src/app/screens/discover/BuildingDrillDownScreen.tsx` |
| Purpose | Floor-plan / stall list inside a building |
| Key components | `FloorSelector`, `StallCard` |
| Navigates to | `StallDetail`, `DishDetail`, `DecideForMeResult` |

### DecideForMeResultScreen

| Key | Value |
|-----|-------|
| File | `src/app/screens/discover/DecideForMeResultScreen.tsx` |
| Purpose | Random dish pick from current context |
| Navigates to | `DishDetail` |

---

### Review Tab — ReviewStack

| Screen | File | Purpose |
|--------|------|---------|
| `ReviewHub` | `src/app/screens/review/ReviewHubScreen.tsx` | Choose venue + dish to review |
| `ReviewRating` | `src/app/screens/review/ReviewRatingScreen.tsx` | Star rating input |
| `ReviewTags` | `src/app/screens/review/ReviewTagsScreen.tsx` | Taste tag multi-select |
| `ReviewCompose` | `src/app/screens/review/ReviewComposeScreen.tsx` | Text + photo compose |

| Key | Value |
|-----|-------|
| Stack | `src/app/screens/review/ReviewStack.tsx` |
| Shell | `src/app/screens/review/ReviewScreenShell.tsx` |
| State | `useReviewDraftStore` — draft persists across steps |
| Tab icon | `NotebookPen` (lucide) |
| Auth required | No — soft-gate on submit, not on entry |

---

### Profile Tab — ProfileStack

| Screen | File | Purpose |
|--------|------|---------|
| `ProfileHome` | `src/app/screens/profile/ProfileHomeScreen.tsx` | Overview: stats, radar chart, quick links |
| `ProfileScreen` | `src/app/screens/profile/ProfileScreen.tsx` | Full profile view |
| `Settings` | `src/app/screens/profile/SettingsScreen.tsx` | App settings, sign-out |
| `Favourites` | `src/app/screens/profile/FavouritesScreen.tsx` | Saved dishes |
| `ReviewHistory` | `src/app/screens/profile/ReviewHistoryScreen.tsx` | Past reviews |

| Key | Value |
|-----|-------|
| Stack | `src/app/screens/profile/ProfileStack.tsx` |
| Shell | `src/app/screens/profile/ProfileScreenShell.tsx` |
| Tab icon | `User` (lucide) |
| Auth gate | Tab press redirects signed-out users directly to `AuthStack/Login`; no browse-mode soft gate |
| Guards | `src/app/screens/profile/profileGuards.ts` |
| State reads | `useProfileStore`, `useSessionStore` |
| Key components | `ProfileRadarChart` |

---

### Global Modals

| Screen | File | Trigger |
|--------|------|---------|
| `DishDetail` | `src/app/screens/detail/DishDetailScreen.tsx` | Any `DishCard` tap |
| `StallDetail` | `src/app/screens/detail/StallDetailScreen.tsx` | Any `StallCard` tap |
| `BlogPost` | `src/app/screens/reads/BlogPostWebViewScreen.tsx` | Blog post tap |
| `Offline` | `src/app/screens/detail/OfflineStateScreen.tsx` | No network / data unavailable |
| `NotFound` | `src/app/screens/detail/NotFoundScreen.tsx` | Bad deep link / missing entity |

---

### Reads (Feature-Flagged)

| Key | Value |
|-----|-------|
| Flag | `FEATURE_FLAGS.readsEnabled` (default `true`) |
| Feed screen | `src/app/screens/reads/ReadsFeedScreen.tsx` |
| WebView screen | `src/app/screens/reads/BlogPostWebViewScreen.tsx` |
| Content | `src/features/reads/feed.ts` |
| Note | Reads tab is not in MainTabs by default — access via Home feed or BlogPost modal |

---

## Navigation Rules

| Rule | Detail |
|------|--------|
| All screen params declared in `navigationTypes.ts` | Never pass untyped params |
| `DishDetail` and `StallDetail` are root-level | Any tab can navigate to them without going through tab stacks |
| `ReviewStack` accessible from tab AND as root modal | Don't duplicate navigation logic — check `RootNavigator.tsx` |
| Profile tab uses event listener gate | See `listeners.tabPress` in `RootNavigator.tsx` |
| `FloatingToast` is global | Mounted in `RootNavigator` outside navigation tree |
| Deep link return routes | `useSessionStore.setReturnRoute()` — used after auth redirects |
