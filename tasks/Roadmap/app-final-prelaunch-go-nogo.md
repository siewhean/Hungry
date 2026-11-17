# App Final Prelaunch Go / No-Go

Updated: 2026-06-21
Final status: **No-Go**

## Store-Readiness Repo-Side Status

| Workstream | Status | Evidence |
|---|---:|---|
| ASO metadata drafts | repo-complete draft | `tasks/Roadmap/app-store-submission-qc-report.md`, `tasks/Roadmap/google-play-submission-qc-report.md` |
| Reviewer-note template | repo-complete draft | `tasks/Roadmap/app-store-submission-qc-report.md`, `tasks/Roadmap/app-store-google-play-prelaunch-qaqc-checklist.md` |
| Store policy checklist | repo-complete draft | `tasks/Roadmap/app-store-google-play-prelaunch-qaqc-checklist.md` |
| Data Safety / App Privacy mapping | repo-complete draft | `tasks/Roadmap/app-store-data-safety-mapping.md` |
| Release evidence key template | repo-complete draft | `tasks/release-evidence/full-audit-v1.example.env` |
| Local release checklist wiring | repo-complete draft | `scripts/release_ready_checklist.sh` |

Repo-complete means the repository now has the draft/checklist/template surface needed for owner review. It does **not** mean App Store Connect, Play Console, EAS, legal/privacy, live Supabase, or production monitoring proof exists.

## Repo-Local Gates

| Gate | Status |
|---|---:|
| prelaunch source contracts | pass: 5/5 |
| native/release evidence contracts | pass: 5/5 |
| typecheck | pass |
| lint | pass |
| format check | pass |
| unit/integration tests | pass: 533 total / 531 passing / 2 skipped |
| Playwright e2e | not rerun in full; repo-side webServer prompt blocker fixed, sandbox localhost bind remains environment-limited |
| merchant catalog e2e | pass when run with localhost bind access; sandbox bind remains environment-limited |
| Expo Doctor | blocked: compatible `CI=1 npx expo-doctor .` reaches the CLI, but remote Expo API / React Native Directory checks fail in this environment and the app-config common-issues warning remains |
| asset audit | pass |
| Supabase static audit | pass |
| edge function check | pass |
| database smoke scripts | skipped: missing Supabase smoke URL / anon key |
| security scans | pass: npm audit 0 vulnerabilities, gitleaks pass, TruffleHog pass |
| release ready local | not rerun after latest Expo config/report updates; previous run passed source/static checks before older npm-audit network blocker |

## External Required Evidence Blocking Store Submission

| Evidence | Status |
|---|---:|
| App Store Connect metadata/privacy proof | missing |
| Google Play listing/Data Safety proof | missing |
| public privacy/account deletion URL proof | missing |
| final ASO metadata owner approval | missing |
| final reviewer notes/demo account approval | missing |
| final screenshot/image rights approval | missing |
| store policy checklist owner/legal approval | missing |
| iOS EAS/TestFlight artifact | missing |
| Android EAS/AAB/pre-launch report | missing |
| live Supabase RLS/storage smoke | missing |
| Supabase Advisor owner proof | missing |
| Sentry staging crash capture | missing |
| full-platform UGC moderation smoke | missing |
| merchant/admin RBAC live smoke | missing |
| legal/privacy sign-off | missing |

## Verdict

Hungry is not store-submission ready until all repo-local gates pass and every external evidence item above is attached. The repo-side store-submission drafts are ready for owner review, but public submission remains blocked by store-console, legal/privacy, EAS/TestFlight/Play, live Supabase, monitoring, UGC, and runtime smoke proof. This report is intentionally conservative for Apple and Google review.

## Safe Deployment Handoff

Direct external deploy was not attempted in this handoff. The current app-store prelaunch changes are separable from the pre-existing website visual/content changes and can be committed as their own app-store readiness group while leaving `marketing/website/web-v2/**` unstaged.

Recommended app-store prelaunch staging group:

```bash
git add app.config.js package.json playwright.config.ts scripts/release_ready_checklist.sh scripts/run-expo.cjs scripts/run-maestro-smoke.mjs src/app/app-store-prelaunch-contracts.test.ts src/app/e2e-webserver-contracts.test.ts src/app/release-evidence-contracts.test.ts tasks/release-evidence/full-audit-v1.example.env .maestro/android-app-launch-smoke.yaml .maestro/android-guest-browse-smoke.yaml .maestro/android-media-permission-smoke.yaml .maestro/ios-app-launch-smoke.yaml .maestro/ios-auth-smoke.yaml .maestro/ios-guest-browse-smoke.yaml .maestro/ios-location-denied-smoke.yaml .maestro/ios-review-post-smoke.yaml tasks/Roadmap/app-file-cleanup-inventory.md tasks/Roadmap/app-final-prelaunch-go-nogo.md tasks/Roadmap/app-maestro-native-smoke-report.md tasks/Roadmap/app-playwright-prelaunch-report.md tasks/Roadmap/app-prefetch-qc-report.md tasks/Roadmap/app-privacy-permissions-qc-report.md tasks/Roadmap/app-route-feature-flag-qc-report.md tasks/Roadmap/app-security-qc-report.md tasks/Roadmap/app-store-data-safety-mapping.md tasks/Roadmap/app-store-google-play-prelaunch-qaqc-checklist.md tasks/Roadmap/app-store-submission-checklist.md tasks/Roadmap/app-store-submission-qc-report.md tasks/Roadmap/app-ugc-moderation-qc-report.md tasks/Roadmap/google-play-submission-qc-report.md tasks/session-log.md tasks/verification.md
```

Separate website visual/content group, if the owner wants it committed later:

```bash
git add marketing/website/web-v2/src/components/sections/Hero.module.css marketing/website/web-v2/src/components/sections/Hero.tsx marketing/website/web-v2/src/components/sections/LocalGuide.module.css marketing/website/web-v2/src/content/site.ts marketing/website/web-v2/src/styles/tokens.css
```

Expo config coexistence check: `app.config.js` intentionally imports and clones `app.json`, then strips development-only or unjustified release settings only for `EXPO_PUBLIC_APP_ENV=production`; `app.json` remains the static base config for development and shared metadata.

## Latest Command Evidence

- `npm run typecheck` -> pass.
- `npm run lint` -> pass.
- `npm run format:check` -> pass.
- `npm run test` -> pass, 533 total / 531 passing / 2 skipped.
- `npm run audit:assets` -> pass.
- `npm run audit:supabase:static` -> pass.
- `npm run check:edge-functions` -> pass.
- `npm run security:gitleaks` -> pass, no leaks found.
- `npm run security:trufflehog` -> pass, 0 verified and 0 unverified secrets.
- `npm run smoke:database:location` / `search` / `rls` -> skipped without Supabase smoke env.
- `npm audit --audit-level=moderate` -> pass, found 0 vulnerabilities.
- `EXPO_NO_DOTENV=1 CI=1 NPM_CONFIG_CACHE=/tmp/hungry-npm-cache npx expo-doctor .` -> blocked with 15/18 checks passed; failures are Expo API fetch `getaddrinfo ENOTFOUND exp.host`, React Native Directory response, and the app-config common-issues warning despite default dynamic config matching `app.json`.
- Repo-side Expo webServer prompt blocker -> fixed in `scripts/run-expo.cjs`; sandbox localhost bind can still return `EPERM`.
- Elevated `E2E_PORT=8082 npm run test:e2e:merchant-catalog -- --reporter=line` -> pass, 1/1.
- `npm run release:ready:local` -> previous run passed typecheck/tests/static checks/edge/assets/TruffleHog before failing at an older npm-audit DNS blocker; rerun after npm-audit recovery is still pending because Expo Doctor remains blocked.
- Current store-readiness repo-side pass -> `bash -n scripts/release_ready_checklist.sh` pass; focused prelaunch/release-evidence contracts pass 6/6; touched-file `git diff --check` pass.

## Current Store Draft Evidence

- App Store ASO and reviewer-note drafts -> repo-complete draft; final App Store Connect approval missing.
- Google Play listing draft -> repo-complete draft; final Play Console approval missing.
- Data Safety/App Privacy mapping -> repo-complete draft; final legal/store-console answers missing.
- Release evidence template/checklist -> repo-complete draft; external proof keys remain `0` until captured.
