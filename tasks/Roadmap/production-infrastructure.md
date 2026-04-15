# Production Infrastructure Plan

> **Sprint 4 Claude deliverables** — environment strategy, observability integration, launch readiness

---

## 1. Environment Strategy

### 1.1 Variable Sets

Three environment files are committed to the repo as templates (secrets are never committed — CI injects them):

| File | Purpose | Secret values |
|------|---------|--------------|
| `.env.development` | Local dev + simulator | Placeholder / dev-project keys |
| `.env.staging` | Expo EAS `preview` channel, internal testers | Staging Supabase project, staging PostHog key |
| `.env.production` | Expo EAS `production` channel, App Store / Play Store | Production keys |

### 1.2 Full Variable Catalogue

```bash
# ── Supabase ────────────────────────────────────────────────────────────────
EXPO_PUBLIC_SUPABASE_URL=          # e.g. https://abcdef.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=     # public anon key (safe to expose in JS bundle)
SUPABASE_SERVICE_ROLE_KEY=         # server-side only — NEVER in Expo public bundle

# ── Mapbox ──────────────────────────────────────────────────────────────────
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=   # pk.eyJ1... — public Mapbox token
MAPBOX_SECRET_TOKEN=               # sk.eyJ1... — used in EAS native build only

# ── PostHog ─────────────────────────────────────────────────────────────────
EXPO_PUBLIC_POSTHOG_API_KEY=       # phc_xxxx — project API key
EXPO_PUBLIC_POSTHOG_HOST=          # https://us.i.posthog.com (or EU endpoint)

# ── Sentry ──────────────────────────────────────────────────────────────────
EXPO_PUBLIC_SENTRY_DSN=            # https://xxx@oXX.ingest.sentry.io/yyy
SENTRY_AUTH_TOKEN=                 # CI-only: used for source map upload during EAS build
SENTRY_ORG=                        # slug from Sentry organisation settings
SENTRY_PROJECT=                    # project slug

# ── EAS ─────────────────────────────────────────────────────────────────────
EXPO_TOKEN=                        # CI secret — EAS account token for GitHub Actions
```

### 1.3 Routing Rules

| Prefix | Bundled in JS? | Accessible in RN? | Safe to log? |
|--------|---------------|-------------------|-------------|
| `EXPO_PUBLIC_*` | Yes | Yes (`process.env.EXPO_PUBLIC_*`) | Treat as public |
| No prefix | No | No (server/CI only) | Never |

**Rule:** Any key the user can extract from the APK/IPA decompile is public. Supabase anon key and PostHog project key are intentionally public — their security model (Row-Level Security; project-scoped ingestion) tolerates exposure. Service role keys and Sentry auth tokens are CI-only and never enter the JS bundle.

### 1.4 `.gitignore` Additions

```
.env
.env.local
.env.*.local
.env.development.local
.env.staging.local
.env.production.local
```

The committed `.env.development`, `.env.staging`, `.env.production` files contain **only placeholder values** (no real keys). Real keys live in:
- **Local:** developer's shell `export` or `direnv` `.envrc` (gitignored)
- **CI:** GitHub Actions repository secrets
- **EAS cloud builds:** EAS Secrets (set via `eas secret:create`)

---

## 2. CI/CD Pipeline

### 2.1 Existing Implementation

`/.github/workflows/ci.yml` is already wired with two jobs:

| Job | Trigger | Gates |
|-----|---------|-------|
| `quality-gates` | Every push + PR to `main` | `npm run typecheck` → `npm run test` → `npx expo-doctor` |
| `eas-build-gate` | Push to `main` only, when `EXPO_TOKEN` is set | `eas build --platform all --profile preview --no-wait` |

### 2.2 Required GitHub Secrets

Configure in **Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|-------|
| `EXPO_TOKEN` | Output of `npx eas-cli token:create --scope build` |
| `SENTRY_AUTH_TOKEN` | From Sentry → Settings → Auth Tokens |
| `SENTRY_ORG` | Sentry organisation slug |
| `SENTRY_PROJECT` | Sentry project slug |

### 2.3 EAS Build Profiles

`eas.json` should define three profiles:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": { "HUNGRY_DATA_SOURCE": "mock" }
    },
    "preview": {
      "distribution": "internal",
      "channel": "staging",
      "env": { "HUNGRY_DATA_SOURCE": "supabase" }
    },
    "production": {
      "autoIncrement": true,
      "channel": "production",
      "env": { "HUNGRY_DATA_SOURCE": "supabase" }
    }
  }
}
```

---

## 3. Sentry Integration Plan

### 3.1 What Codex Shipped

- `@sentry/react-native` installed
- `Sentry.init({ dsn: EXPO_PUBLIC_SENTRY_DSN })` called in `App.tsx`
- `Sentry.ErrorBoundary` wraps the root tree

### 3.2 Source Map Upload (EAS Build Hook)

Add to `eas.json` under `build.production`:

```json
"postBuildCommand": "npx @sentry/wizard@latest -i reactNative --skip-connect-react-native-version-check"
```

Or configure the Sentry Expo plugin in `app.config.js`:

```js
plugins: [
  [
    "@sentry/react-native/expo",
    {
      organization: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
    },
  ],
],
```

This uploads source maps automatically on every EAS production build, enabling symbolicated crash reports.

### 3.3 Error Boundary Strategy

| Surface | Boundary | Fallback |
|---------|----------|---------|
| Root tree | `Sentry.ErrorBoundary` (root) | Full-screen error with "Restart" |
| Home feed | `FeedErrorBoundary` | Empty feed with retry |
| Reads feed | `FeedErrorBoundary` | Same |
| Map surface | Inline try/catch in `MapSurface` | Static coordinate overlay |
| Individual screens | Not wrapped — root boundary catches | Root fallback |

### 3.4 Performance Monitoring

Enable in `Sentry.init`:

```typescript
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: __DEV__ ? 0 : 0.1,  // 10% of production sessions
  environment: __DEV__ ? "development" : "production",
  beforeSend: (event) => {
    // Strip PII before sending (no email/displayName in events)
    if (event.user) {
      delete event.user.email;
      delete event.user.username;
    }
    return event;
  },
});
```

---

## 4. PostHog Integration Plan

### 4.1 What Codex Shipped

- `posthog-react-native` installed
- `posthogSink.ts` — `AnalyticsSink` implementation
- `identifyPostHogUser` / `resetPostHogUser` called on auth events
- `setAnalyticsSink(posthogSink)` wired in bootstrap

### 4.2 Must-Ship Events for Launch

From the P1-03 taxonomy, these are the minimum events required before any marketing spend:

| Priority | Event | Why it matters |
|----------|-------|---------------|
| P0 | `app_launched` | DAU/MAU computation |
| P0 | `onboarding_completed` | Activation funnel gate |
| P0 | `taste_quiz_completed` | Personalisation readiness |
| P0 | `sign_up_completed` | Top-of-funnel |
| P0 | `dish_viewed` | Core engagement signal |
| P1 | `decide_for_me_triggered` | Feature adoption |
| P1 | `decide_for_me_result_shown` | Recommendation quality |
| P1 | `delivery_link_tapped` | Revenue signal |
| P1 | `review_submitted` | Content generation signal |
| P1 | `dish_favourited` | Retention signal |

### 4.3 Identity Linking

```
Anonymous pre-auth  →  posthog.capture(event, { distinct_id: anonymousId })
Sign-up / Login     →  posthog.identify(userId, { tasteVector, dietaryPreferences, area })
Sign-out            →  posthog.reset()   // generates new anonymous ID
```

User properties to set on identify:
- `taste_vector_*` (6 axes) — enables cohort analysis by flavour preference
- `dietary_flags` — dietary cohort segmentation
- `area` — geographic cohort (hawker centre zone)
- `onboarding_completed_at` — lifecycle date

### 4.4 Core Funnels to Monitor in PostHog

```
Funnel 1 — Activation:
  app_launched → onboarding_started → taste_quiz_completed → onboarding_completed

Funnel 2 — Decide For Me adoption:
  app_launched → decide_for_me_triggered → decide_for_me_result_shown → dish_viewed

Funnel 3 — Review:
  dish_viewed → review_started → review_step_completed(step=4) → review_submitted

Funnel 4 — Revenue intent:
  dish_viewed → delivery_link_tapped
```

---

## 5. Launch Readiness Checklist

### 5.1 Legal & Compliance

| Item | Owner | Status |
|------|-------|--------|
| Privacy Policy (covers: data collected, third parties, PDPA/GDPR) | Legal | Draft required |
| Terms of Service (use, prohibited conduct, content ownership) | Legal | Draft required |
| Cookie/tracking disclosure (PostHog, Sentry) | Legal | Mention in Privacy Policy |
| Singapore PDPA compliance (data residency, breach notification) | Legal | Confirm Supabase ap-southeast-1 region |
| Dietary information disclaimer ("Not a substitute for medical advice") | Product | Add to dietary preferences screen footer |

### 5.2 App Store (iOS)

| Item | Notes |
|------|-------|
| App name | `Hungry — Hawker Food Finder` (≤30 chars) |
| Subtitle | `Discover hawker dishes near you` (≤30 chars) |
| Keywords | `hawker, food, Singapore, dish, restaurant, foodie, halal, vegetarian` |
| Age rating | 4+ (no objectionable content) |
| Screenshots | Required: 6.7" (iPhone 16 Pro Max), 6.5" (iPhone 14 Plus), 5.5" (iPhone 8 Plus); iPad optional |
| App preview video | 15–30s, same device sizes |
| Privacy labels | Location (precise, coarse), Identifiers (user ID), Usage Data (PostHog events) |
| App Tracking Transparency | Required if using IDFA — PostHog's `posthog-react-native` does NOT use IDFA by default; no ATT prompt needed |
| TestFlight internal → external | Beta test with ≥20 users before submission |
| Review notes | Explain mock data mode if reviewer cannot log in with real credentials |

### 5.3 Play Store (Android)

| Item | Notes |
|------|-------|
| Target SDK | API 34 (Android 14) |
| Permissions | `ACCESS_FINE_LOCATION`, `CAMERA` (review photos), `READ_MEDIA_IMAGES` |
| Data safety section | Declare: location (collected, shared with Firebase/Supabase), reviews (user generated, stored) |
| Content rating | ESRB: Everyone (food/dining app) |
| Short description | ≤80 chars: `Find hawker dishes you'll love, near you` |
| Full description | ≤4000 chars |

### 5.4 Pre-Launch Smoke Tests

```
□ Auth: sign up → verify email → complete onboarding → reach Home
□ Auth: login with existing account → reach Home (not onboarding)
□ Auth: forgot password → reset → login
□ Decide For Me: FAB → result within 2s → "Try another" → different result
□ Search: type query → results appear < 1s → tap dish → DishDetail
□ Maps: tap building pin → bottom sheet → "View stalls" → BuildingDrillDown → tap stall → StallDetail
□ Review: Review tab → select venue → rate 4★ → pick tags → submit → success modal
□ Profile: Favourites shows dishes → tapping navigates to DishDetail
□ Deep links: GrabFood / Foodpanda buttons launch correct app or fallback URL
□ Dark mode: device system setting switches theme consistently
□ Offline: disable network → app shows offline screen → restore network → app recovers
```
