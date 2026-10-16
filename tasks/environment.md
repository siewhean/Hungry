# environment.md — Tech Stack & Agent Working Environment

> Dictionary format. Every entry is a fact, constraint, or pointer.

---

## Stack Versions

| Package                | Version            | Notes                                             |
| ---------------------- | ------------------ | ------------------------------------------------- |
| Expo SDK               | 55                 | Use `expo` CLI, not bare React Native CLI         |
| React Native           | 0.83.6             |                                                   |
| TypeScript             | strict mode        | `tsconfig.json` — no relaxations                  |
| React Navigation       | v7                 | Native stack + bottom tabs                        |
| Zustand                | latest             | Only state management library in use              |
| React Hook Form        | latest             | Forms only — no Formik                            |
| Reanimated             | 3.x                | For animated gestures and transitions             |
| `@gorhom/bottom-sheet` | latest             | All bottom sheet UI                               |
| `@rnmapbox/maps`       | latest             | Map — mock surface available via `MapSurface.tsx` |
| `lucide-react-native`  | latest             | All icons — no other icon library                 |
| Nunito                 | Google Font (Expo) | All UI text                                       |
| DM Mono                | Google Font (Expo) | Prices and monospace values                       |

---

## Path Aliases

| Alias             | Resolves to                  |
| ----------------- | ---------------------------- |
| `@/`              | `src/`                       |
| `@/types/domain`  | `src/types/domain.ts`        |
| `@/theme`         | `src/theme/index.tsx`        |
| `@/components/ui` | `src/components/ui/index.ts` |
| `@/store/*`       | `src/store/*.ts`             |
| `@/constants/*`   | `src/constants/*.ts`         |
| `@/hooks/*`       | `src/hooks/*.ts`             |
| `@/features/*`    | `src/features/*.ts`          |

Configured in: `tsconfig.json` + `babel.config.js`

---

## Commands

| Command                                                         | What it does                                                                            | When to run                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install`                                                   | Install dependencies                                                                    | After any package.json change                                                                                                                                                                                                                                                                                                                      |
| `npm run typecheck`                                             | `tsc --noEmit`                                                                          | Broad/risky changes, commits, release gates, or TS contract/import/prop changes                                                                                                                                                                                                                                                                    |
| `npm run start`                                                 | Expo dev server                                                                         | Manual testing                                                                                                                                                                                                                                                                                                                                     |
| `npm run ios`                                                   | Build + launch iOS simulator                                                            | Native/runtime/navigation-risk verification or explicit request                                                                                                                                                                                                                                                                                    |
| `npm run android`                                               | Build + launch Android emulator                                                         | Native/runtime/navigation-risk verification or explicit request                                                                                                                                                                                                                                                                                    |
| `CI=1 NPM_CONFIG_CACHE=/tmp/hungry-npm-cache npx expo-doctor .` | Dependency and Expo config health check                                                 | After any dep install/upgrade; requires network access to Expo/RN Directory APIs                                                                                                                                                                                                                                                                   |
| `npm run test`                                                  | TSX/Node test suite                                                                     | Focused tests for bounded changes; full suite for broad/risky changes                                                                                                                                                                                                                                                                              |
| `npm run audit:assets`                                          | Mobile/Passport/marketing asset inventory                                               | Release and bundle-size gates                                                                                                                                                                                                                                                                                                                      |
| `npm run audit:supabase:static`                                 | Static Supabase migration/RLS/function audit                                            | Supabase/backend release gates                                                                                                                                                                                                                                                                                                                     |
| `npm run audit:supabase:advisor-security`                       | Live Supabase Security Advisor classifier                                               | Release gate guard for unexpected app-owned Advisor findings. Use `HUNGRY_SUPABASE_ADVISOR_FAIL_ON_EXTERNAL=1` after Supabase Support/Dashboard actions to prove the remaining known external PostGIS/Auth findings are gone. CI sets `SUPABASE_NPX_ALLOW_INSTALL=1` so the Supabase CLI can be resolved like the existing migration dry-run step. |
| `npm run check:edge-functions`                                  | Edge Function static safety checks                                                      | Supabase/backend release gates                                                                                                                                                                                                                                                                                                                     |
| `npm run release:ready`                                         | Full Audit V1 release gate wrapper                                                      | Runs local release gates and exits No-Go while external blockers remain. Use only when prepared for a broad release gate run.                                                                                                                                                                                                                      |
| `npm run release:ready:local`                                   | Full Audit V1 local release-gate rehearsal                                              | Runs local source/static/security gates without enforcing external Android/EAS, store-console, production-secret, and Supabase owner-action blockers.                                                                                                                                                                                              |
| `npm run smoke:supabase-chat`                                   | Live Supabase chat/RLS smoke                                                            | Requires smoke URL, anon key, service-role key, project ref, and `HUNGRY_ALLOW_SERVICE_ROLE_SMOKE=1`. Local runs can map `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` into the `HUNGRY_SUPABASE_SMOKE_*` variables without printing secret values.                                                 |
| `npm run smoke:supabase-social-gamification`                    | Live Supabase social safety and gamification smoke                                      | Requires the same smoke URL, anon key, service-role key, project ref, and `HUNGRY_ALLOW_SERVICE_ROLE_SMOKE=1` guard as chat smoke. Verifies report/moderation/block paths plus FoodCred, stall interactions, mission progress, and direct-write denials.                                                                                           |
| `npm run smoke:supabase-full-audit-v1`                          | Linked Full Audit V1 schema/control smoke for social safety and gamification migrations | Requires linked Supabase project and network access                                                                                                                                                                                                                                                                                                |
| `npm run smoke:ocr-staging`                                     | Live OCR upload/ingest smoke                                                            | Requires Supabase smoke env, OCR image path, service-role smoke opt-in, and Vision Edge Function config. The script omits `Origin` by default for non-browser smoke runs; set `HUNGRY_OCR_SMOKE_ORIGIN` only when intentionally testing CORS.                                                                                                      |
| `npm run smoke:native:ios:prepared`                             | Prepared Maestro iOS smoke                                                              | Requires a connected/booted iOS simulator or device; proven local path uses `HUNGRY_METRO_USE_WATCHMAN=0 npm run start -- --host lan --port 8081`, then `HUNGRY_NATIVE_SMOKE_METRO_URL=exp://<LAN-IP>:8081 HUNGRY_NATIVE_SMOKE_METRO_STATUS_URL=http://<LAN-IP>:8081/status npm run smoke:native:ios:prepared`                                     |

---

## File Structure

```
/
├── App.tsx                        # Root component — loads fonts, theme, navigator
├── index.ts                       # Expo entry point
├── app.json                       # Expo app config
├── tsconfig.json                  # TypeScript config
├── babel.config.js                # Babel config (path aliases)
├── AGENTS.md                      # Master harness dictionary ← you are here
├── CLAUDE.md                      # Workflow rules
├── PROJECT_INSTRUCTIONS.md        # Design & copy rules
├── README.md                      # Project state
│
├── src/
│   ├── types/
│   │   └── domain.ts              # ← CANONICAL types (do not duplicate)
│   ├── theme/
│   │   ├── tokens.ts              # ← CANONICAL design tokens
│   │   └── index.tsx              # useHungryTheme() hook
│   ├── constants/
│   │   ├── featureFlags.ts        # FEATURE_FLAGS object
│   │   └── taste.ts               # NEUTRAL_TASTE_VECTOR, TASTE_KEYS
│   ├── store/
│   │   ├── useSessionStore.ts     # Auth + onboarding state machine
│   │   ├── useDiscoveryStore.ts   # Map/discover state
│   │   ├── useSearchStore.ts      # Search query + filters
│   │   ├── useProfileStore.ts     # User profile + favourites
│   │   ├── useReviewDraftStore.ts # Review compose draft
│   │   ├── useLocationStore.ts    # Device location
│   │   └── useUIStore.ts          # Toast, review success modal, global UI state
│   ├── lib/services/mock/
│   │   ├── data.ts                # ← ALL fixture data (buildings, venues, dishes, etc.)
│   │   └── repositories.ts        # Mock repository functions (wrap data.ts)
│   ├── features/                  # Screen-scoped content/config (non-component logic)
│   │   ├── auth/authContent.ts
│   │   ├── discovery/discovery.ts
│   │   ├── home/feed.ts
│   │   ├── profile/profileContent.ts
│   │   ├── reads/feed.ts
│   │   ├── review/reviewContent.ts
│   │   └── search/search.ts
│   ├── hooks/
│   │   └── useAppBootstrap.ts     # App init logic
│   ├── components/
│   │   ├── ui/                    # Primitive shared components
│   │   ├── dish/                  # Dish-specific components
│   │   ├── stall/                 # Stall/venue components
│   │   ├── map/                   # Map components
│   │   └── review/                # Review components
│   └── app/
│       ├── navigation/            # Navigators + param types
│       └── screens/               # All screens (see tasks/screens.md)
│
├── tasks/                         # Agent working documents
│   ├── todo.md
│   ├── lessons.md
│   ├── environment.md             # ← this file
│   ├── design-system.md
│   ├── screens.md
│   ├── data-contracts.md
│   └── test-harness.md
│
├── Research/                      # Source PRDs + guidelines (.docx, .pdf)
├── design/                        # HTML prototypes
│   ├── archive/                   # Archived design iterations
│   ├── figma-v2/                  # Active v2 screens
│   └── stitch/                    # Active Stitch briefs + design prompts
└── data/                          # Raw Singapore stalls data
```

---

## Environment Constraints

| Constraint             | Detail                                                                                                                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mock-first local data  | Default local app mode uses `src/lib/services/mock/data.ts`; Supabase-backed integrations are staged behind `HUNGRY_DATA_SOURCE=supabase` and release smoke gates                                     |
| Service boundary       | App screens/features must use `getDataRepository()` or `getHungryService()`; do not call Supabase, fixtures, or network clients directly from UI code                                                 |
| Backend posture        | Supabase schema, RLS, storage, Edge Functions, and smoke scripts exist for staged/release integrations; production behavior still requires the documented live smoke credentials and device gates     |
| Web posture            | Consumer app target is iOS + Android; marketing website work lives under `marketing/website/web-v2/` and should remain separate from mobile release claims                                            |
| No new state libraries | Zustand only                                                                                                                                                                                          |
| No new nav libraries   | React Navigation only                                                                                                                                                                                 |
| TypeScript strict      | `any` requires a comment justification                                                                                                                                                                |
| Mock map               | `mockMapboxEnabled: false` → real Mapbox SDK; set `true` for CI/test env                                                                                                                              |
| Secrets in env files   | Tracked `.env.development/.staging/.production` hold public/build config only; server secrets go in untracked `.env.local`, EAS/CI secrets, or Supabase function secrets (`.env.example` lists names) |

## Account Deletion Worker (ACCDEL-01)

Nothing inside Supabase schedules `process-account-deletions`; the host must. No pg_cron dependency.

- Function secrets (Supabase secret store / self-hosted edge-runtime env): `ACCOUNT_DELETION_WORKER_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- `supabase/config.toml` sets `verify_jwt = false` for this function (the bearer is the worker token, not a JWT). On self-hosted, the edge-runtime main router must not enforce JWT for it (global `VERIFY_JWT=false`, or exempt this function).
- Runner: `scripts/run-account-deletion-worker.mjs` (Node 22, no deps). Env file on the VM, root-owned `chmod 600`, e.g. `/etc/hungry/account-deletion-worker.env`, with names only from `.env.example`: `ACCOUNT_DELETION_WORKER_TOKEN`, `SUPABASE_URL` (or `ACCOUNT_DELETION_WORKER_URL`), optional `ACCOUNT_DELETION_WORKER_LIMIT`, `ACCOUNT_DELETION_WORKER_MAX_BATCHES`.
- VM crontab (every 15 min; well inside the 30-day promise on `/account/delete`):
  `*/15 * * * * /usr/bin/node --env-file=/etc/hungry/account-deletion-worker.env /opt/hungry/scripts/run-account-deletion-worker.mjs >> /var/log/hungry/account-deletion.log 2>&1`
- Exit codes: `0` ok/empty queue, `1` a request or the call failed (alert on this), `2` missing config. Logs carry request ids only.
- Per request: anonymize (0040 RPC) -> `purge_account_deletion_residual_data` (post-0040 tables, avatar URL) -> delete `<uid>/` objects in avatars, review-media, bites-media, post-media, menu-photos, user-stall-submission-images (accepted stall-submission images kept) -> `auth.admin.deleteUser` -> complete. Idempotent; failures retry next run; after 10 attempts a request stops auto-claiming and needs manual review (`last_error`, `account_deletion_processing_events`).

## Self-Hosted Supabase Targets

Hungry's Supabase runs self-hosted (docker compose); there is no linked Supabase Cloud project or Management API. Set values locally or as CI secrets only, never in the repo.

| Env var                         | Used by                                                                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SUPABASE_DB_URL`               | Postgres connection string for `supabase db query/advisors/push --db-url` (DB smokes, Advisor classifier/snapshot, catalog publish, staging chunks, release-candidate dry run) |
| `HUNGRY_SUPABASE_ALLOWED_HOSTS` | Comma-separated API hostnames that service-role smoke/import scripts may target; `*_PROJECT_REF` is still honoured only for `*.supabase.co` URLs                               |

Leaked-password protection is a self-host auth setting (`GOTRUE_PASSWORD_HIBP_ENABLED`); `npm run security:supabase:enable-leaked-password` is retired.

### Auth email redirect URLs

Self-hosted GoTrue must allow both app deep links in `ADDITIONAL_REDIRECT_URLS` (`GOTRUE_URI_ALLOW_LIST`), or confirmation/reset emails fall back to `SITE_URL`:

| Deep link                | Client env override (optional)          | Purpose                                                        |
| ------------------------ | --------------------------------------- | -------------------------------------------------------------- |
| `hungry://auth/callback` | `EXPO_PUBLIC_AUTH_REDIRECT_URL`         | Password reset (and OAuth) PKCE callback → `ResetPassword`     |
| `hungry://auth/confirm`  | `EXPO_PUBLIC_AUTH_CONFIRM_REDIRECT_URL` | Sign-up email confirmation PKCE callback → `EmailVerification` |

---

## TypeScript Strict Rules

```ts
// WRONG — never do this
const style: any = { color: 'red' }

// WRONG — never hardcode tokens
<View style={{ padding: 16, borderRadius: 12 }} />

// RIGHT — always use theme
const { palette, spacing, radii } = useHungryTheme()
<View style={{ padding: spacing[4], borderRadius: radii.md }} />

// WRONG — never redeclare domain types
interface MyDish { id: string; name: string }

// RIGHT — import from canonical source
import type { DishSummary } from '@/types/domain'
```

---

## Common Import Patterns

```ts
// Domain types
import type { DishSummary, VenueSummary, TasteVector } from "@/types/domain";

// Theme
import { useHungryTheme } from "@/theme";

// UI primitives
import { AppText, Button, Card, Screen } from "@/components/ui";

// Icons
import { Star, Heart, MapPin } from "lucide-react-native";

// Stores
import { useSessionStore } from "@/store/useSessionStore";

// Feature flags
import { FEATURE_FLAGS } from "@/constants/featureFlags";

// Navigation
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
```
