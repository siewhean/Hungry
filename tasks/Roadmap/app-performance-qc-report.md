# Hungry App Performance QC Report

Updated: 2026-06-25
Verdict: **Partial**. Source-level performance patterns exist; device/runtime metrics are still required before public launch.

## Targets and Current Proof

| Area | Target | Current proof |
|---|---:|---|
| Cold start to usable | under 3s on modern device | pending measured proof |
| Tab switch | under 300ms perceived | pending measured proof |
| Search response | under 500ms p95 staging | pending staging metrics |
| Detail load | under 300ms p95 staging | pending staging metrics |
| Feed first page | under 700ms p95 staging | pending staging metrics |
| Image upload failure | under 2% staging smoke | pending staging smoke |
| Crash-free sessions | 99%+ before public launch | pending Sentry proof |
| 30-minute session | no crash/memory leak | pending runtime smoke |

## Source Evidence

| Area | Evidence | Status |
|---|---|---|
| Discovery/filter responsiveness | performance-prefetch contracts and Discover source | source coverage present ✅ |
| Detail hydration | detail hydration contracts | source coverage present ✅ |
| Feed refresh | preserve-ready refresh pattern in Home feed | source coverage present ✅ |
| Media picker | prepared native media smoke contract | source coverage present ✅ |
| Asset bundle | `npm run audit:assets` | ✅ pass |
| Load scripts | `scripts/load/*` and `npm run scaling:validate` | scaffold exists; real load proof pending |
| FlatList virtualization | 43 FlatList/FlashList usages; no ScrollView+map anti-pattern | source-verified ✅ |
| Console.log in production | 0 `console.log` in `src/` production code | source-verified ✅ |
| Component memoization | 529 React.memo/useMemo/useCallback usages | reasonable density |

## Known Performance Risks

| Risk | Severity | Status |
|---|---|---|
| 2,400 inline `style={{…}}` instances vs 124 `StyleSheet.create()` | medium | pre-launch hardening — static styles should move to `StyleSheet.create()` |
| `DiscoverHomeScreen.tsx` at 3,352 lines / `HomeFeedScreen.tsx` at 2,674 lines | medium | complex files; extract sub-feature components before v1.1 |
| 49 KB `src/lib/services/mock/data.ts` bundled in production JS | medium | mock data bundled even when `HUNGRY_DATA_SOURCE=supabase`; gate behind `__DEV__` |
| 22 Reanimated animations not gated by `reduceMotion` | low | accessibility + battery concern; `useReduceMotion()` hook hardening item |

## Required Runtime Proof

- iOS current-device smoke with cold/warm start timing notes
- Android low-end device or emulator smoke
- Staging Supabase search/detail timing sample (p50, p95)
- Feed scroll and repeated detail navigation session (30 min, no crash)
- Media upload success/failure smoke (upload retry and error recovery)
- Sentry performance/crash monitoring proof from staging build
- Memory profiling for HomeFeed and DiscoverHome (Flipper recommended)
