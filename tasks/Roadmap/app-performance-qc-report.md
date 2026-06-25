# Hungry App Performance QC Report

Updated: 2026-06-25
Verdict: **Partial / No-Go for public launch**. Source-level performance patterns and several QC gates pass; unmeasured device/runtime performance metrics are still blockers.

## Targets and Current Proof

| Area | Target | Current proof |
|---|---:|---|
| Cold start to usable | under 3s on modern device | pending measured proof |
| Tab switch | under 300ms perceived | pending measured proof |
| Search response | under 500ms p95 staging | pending staging metrics |
| Detail load | under 300ms p95 staging | pending staging metrics |
| Feed first page | under 700ms p95 staging | pending staging metrics |
| Image upload failure | under 2% staging smoke | pending staging smoke |
| Crash-free sessions | 99%+ before public launch | partial: Sentry staging crash proof passes, but crash-free session rate is still unmeasured |
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

## Runtime and QC Evidence

| Gate | Local evidence | Status |
|---|---|---|
| Sentry staging crash proof | `tasks/verification.md` 2026-06-25 row; `tasks/Roadmap/app-final-go-no-go-checklist.md` `SENTRY_STAGING_CRASH_PROOF=1` | ✅ pass: unresolved queue clean |
| Playwright page-agent + feature/prefetch coverage | `tasks/verification.md` 2026-06-25 row | ✅ pass: 13/13 documented |
| iOS prepared native smoke | `tasks/verification.md`; `tasks/Roadmap/app-native-build-readiness-report.md` | ✅ pass: `npm run smoke:native:ios:prepared` |
| Android preview APK | `tasks/Roadmap/app-native-build-readiness-report.md` | partial: preview build `b04ac43f-9a06-43f9-9f38-709cbc17e418` finished with APK artifact |
| Android install smoke | `tasks/Roadmap/app-native-build-readiness-report.md` | pending: no Android device/emulator attached |
| PostComposerScreen error boundary | `tasks/Roadmap/app-final-go-no-go-checklist.md` | ✅ pass: `POST_COMPOSER_ERROR_BOUNDARY=1` |
| Android permissions completeness | `tasks/Roadmap/app-final-go-no-go-checklist.md`; `tasks/Roadmap/app-native-build-readiness-report.md` | ✅ pass: `ANDROID_PERMISSIONS_COMPLETE=1` |

## Known Performance Risks

| Risk | Severity | Status |
|---|---|---|
| 2,400 inline `style={{…}}` instances vs 124 `StyleSheet.create()` | medium | pre-launch hardening — static styles should move to `StyleSheet.create()` |
| `DiscoverHomeScreen.tsx` at 3,352 lines / `HomeFeedScreen.tsx` at 2,674 lines | medium | complex files; extract sub-feature components before v1.1 |
| 49 KB `src/lib/services/mock/data.ts` bundled in production JS | medium | mock data bundled even when `HUNGRY_DATA_SOURCE=supabase`; gate behind `__DEV__` |
| 22 Reanimated animations not gated by `reduceMotion` | low | accessibility + battery concern; `useReduceMotion()` hook hardening item |
| p95/load/memory/bundle runtime measurements | high | pending measured staging/device proof; do not treat source coverage as performance pass |

## Required Runtime Proof

- iOS current-device smoke with cold/warm start timing notes
- Android low-end device or emulator smoke
- Staging Supabase search/detail timing sample (p50, p95)
- Feed scroll and repeated detail navigation session (30 min, no crash)
- Media upload success/failure smoke (upload retry and error recovery)
- Sentry performance/crash monitoring trend proof from staging build; crash-capture proof passes, but trend metrics remain pending
- Memory profiling for HomeFeed and DiscoverHome (Flipper recommended)
- Android install smoke for finished preview APK
