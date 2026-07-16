# PR-106 production bundle exclusion evidence

Date: 2026-07-17

Candidate: `codex/order-integrity-hardening` (implementation SHA pending)

Verdict: repo-local pass; public launch remains No-Go

## Scope and result

Production Metro now selects Supabase-only service, route-loader, store, and component entrypoints. The deterministic source-map audit fails if a production Hermes export contains mock/Excel providers, developer launchers, prototype routes, disabled social/gamification/merchant modules, or their excluded assets. Disabled roadmap code remains retained in the repository and is excluded at build time rather than deleted.

| Artifact | Baseline iOS | Candidate iOS | Candidate Android |
| --- | ---: | ---: | ---: |
| Mapped sources | 4,679 | 4,534 | 4,543 |
| Assets | 98 | 88 | 89 |
| Hermes bytecode | 13 MB | 7.1 MB | 7.1 MB |
| Deterministic exclusion audit | Fail | Pass | Pass |

The iOS candidate removes 145 mapped sources, 10 assets, and approximately 45% of Hermes bytecode size from the audited baseline. Platform source counts differ because React Native resolves platform-specific modules.

## Runtime truth behavior

- Home throws into its existing recovery boundary when the live social feed cannot be reached and no source-backed/cached posts exist.
- Discover displays a live-data recovery state and explicitly says that no sample dishes were substituted.
- Search shortcuts, popular fixture dishes, fixture prices, and recommendation rails are hidden while the live Discover request is unavailable.
- Retry remains actionable on both surfaces.

## Verification

- `npm run audit:bundle:production:test`: 3/3 pass.
- iOS production `expo export` plus `npm run audit:bundle:production -- --platform ios`: pass, 4,534 sources and one Hermes bundle.
- Android production `expo export` plus `npm run audit:bundle:production -- --platform android`: pass, 4,543 sources and one Hermes bundle.
- Production-boundary Playwright on iPhone 14 and Pixel 7 viewports: 2/2 pass with no fixture dish/price leakage and working recovery.
- Mock Discover truth Playwright on iPhone 14 and Pixel 7 viewports: 2/2 pass, including image health and exact cuisine/price/distance assertions.
- Source-boundary and focused publishing/feed/Supabase contracts: 27/27 pass.
- Full source suite: 682 total, 680 pass, 2 credential-gated skips, 0 failures.
- `npm run typecheck`, `npm run lint -- --quiet`, `npx expo-doctor` (18/18), and `git diff --check`: pass.

## Reviewed screenshots

- `production-home-recovery-ios.png`
- `production-discover-recovery-ios.png`
- `production-home-recovery-android.png`
- `production-discover-recovery-android.png`

The screenshots preserve the FDO navigation, typography, colors, full-height background, all five tab controls, and recovery actions while proving that unavailable live data is not replaced with production-visible fixtures. Independent QA found and remediation removed an initial short-content black canvas before these final receipts were captured; the final recheck returned `No findings`.

## Residual boundary

This evidence closes repo-local finding PR-106 only. It does not prove signed installs, device-native bundle inspection, staging/live Supabase parity, store delivery, Deep Scan closeout, device performance/accessibility, or deployed web performance.
