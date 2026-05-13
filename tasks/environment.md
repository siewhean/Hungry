# environment.md — Tech Stack & Agent Working Environment

> Dictionary format. Every entry is a fact, constraint, or pointer.

---

## Stack Versions

| Package | Version | Notes |
|---------|---------|-------|
| Expo SDK | 55 | Use `expo` CLI, not bare React Native CLI |
| React Native | 0.83.6 | |
| TypeScript | strict mode | `tsconfig.json` — no relaxations |
| React Navigation | v7 | Native stack + bottom tabs |
| Zustand | latest | Only state management library in use |
| React Hook Form | latest | Forms only — no Formik |
| Reanimated | 3.x | For animated gestures and transitions |
| `@gorhom/bottom-sheet` | latest | All bottom sheet UI |
| `@rnmapbox/maps` | latest | Map — mock surface available via `MapSurface.tsx` |
| `lucide-react-native` | latest | All icons — no other icon library |
| Nunito | Google Font (Expo) | All UI text |
| DM Mono | Google Font (Expo) | Prices and monospace values |

---

## Path Aliases

| Alias | Resolves to |
|-------|------------|
| `@/` | `src/` |
| `@/types/domain` | `src/types/domain.ts` |
| `@/theme` | `src/theme/index.tsx` |
| `@/components/ui` | `src/components/ui/index.ts` |
| `@/store/*` | `src/store/*.ts` |
| `@/constants/*` | `src/constants/*.ts` |
| `@/hooks/*` | `src/hooks/*.ts` |
| `@/features/*` | `src/features/*.ts` |

Configured in: `tsconfig.json` + `babel.config.js`

---

## Commands

| Command | What it does | When to run |
|---------|-------------|-------------|
| `npm install` | Install dependencies | After any package.json change |
| `npm run typecheck` | `tsc --noEmit` | Broad/risky changes, commits, release gates, or TS contract/import/prop changes |
| `npm run start` | Expo dev server | Manual testing |
| `npm run ios` | Build + launch iOS simulator | Native/runtime/navigation-risk verification or explicit request |
| `npm run android` | Build + launch Android emulator | Native/runtime/navigation-risk verification or explicit request |
| `npx expo-doctor` | Dependency health check | After any dep install/upgrade |
| `npm run test` | Jest test suite | Focused tests for bounded changes; full suite for broad/risky changes |

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

| Constraint | Detail |
|-----------|--------|
| No network calls | All data from `src/lib/services/mock/data.ts` |
| No backend | No API endpoints, no auth server, no database |
| No web | iOS + Android only |
| No new state libraries | Zustand only |
| No new nav libraries | React Navigation only |
| TypeScript strict | `any` requires a comment justification |
| Mock map | `mockMapboxEnabled: false` → real Mapbox SDK; set `true` for CI/test env |

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
import type { DishSummary, VenueSummary, TasteVector } from '@/types/domain'

// Theme
import { useHungryTheme } from '@/theme'

// UI primitives
import { AppText, Button, Card, Screen } from '@/components/ui'

// Icons
import { Star, Heart, MapPin } from 'lucide-react-native'

// Stores
import { useSessionStore } from '@/store/useSessionStore'

// Feature flags
import { FEATURE_FLAGS } from '@/constants/featureFlags'

// Navigation
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '@/app/navigation/navigationTypes'
```
