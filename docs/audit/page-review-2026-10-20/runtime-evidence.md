# Verification evidence and limits

Scope: current dirty source checkout at base HEAD `50b2223e3ee058618bc23db48a97fb9fafac41ee`; read-only app audit. No app fixes, dependency installs, provider writes, release, or deployment performed. `source-fingerprints.json` records 113 assigned TSX plus four shared source files.

## Current-source checks

- `npm run typecheck`: **FAIL**, exit 2. Seven diagnostics: ChangePasswordScreen.tsx lines 88/123 supply validators with incompatible second arguments; untracked Supabase send-email Edge Function introduces npm: import, Deno globals, implicit-any and string assignment errors into the root compilation. Full output: `typecheck.log`.
- `npm test`: **FAIL**, exit 1; 695 tests total, 692 pass, 1 fail, 2 skip. Failure: production service-boundary contract detects ChangePasswordScreen directly importing Supabase internals. These include source contracts and mock tests; passing results do not establish native/live behavior. Full output: `source-tests.log`.
- Initial Chromium browser smoke: blocked before app execution because Playwright's bundled executable is absent. Nine harness failures do not represent nine app regressions. `browser-smoke.log`.
- Installed Chrome fallback: first audit-only overlay config started from its own directory and failed to find root scripts; corrected by setting webServer cwd to repo root. Kept `browser-chrome-smoke.log` as harness-error evidence; that retry then hit missing Playwright ffmpeg before page execution (`browser-chrome-smoke-retry.log`). Disabling optional video recording avoided that tool dependency without installing software.
- Current-source Chrome mock route/guest smoke with video disabled: **8 pass, 1 fail** in 18.5 minutes (`browser-current-source.log`). The failed test expects `Welcome back` after fresh entry; its captured screen instead shows the implemented onboarding Welcome with Get started and Sign in controls. `SplashScreen.tsx` routes users without completed onboarding to OnboardingStack, so this is a stale test/entry-contract mismatch, not a reproduced app crash. The remaining guest-public-detail assertion in that failed test did not execute. Six developer route loads, the environment-dependence annotation test, and protected-create login redirect passed. Browser fixture filters selected known warnings; no global error-free claim. A separate audit-only follow-up checks the observed Welcome → existing-account Sign in path; see `browser-entry-followup.log`: **1/1 passed** (59.6s), at 390×844 Chrome viewport. Captured current-source mock-web Welcome and Login screenshots in `runtime/current-web-welcome.png` and `runtime/current-web-login.png`. This confirms the revised entry journey only; it does not turn the original suite green or establish native authentication success.

## Existing iOS artifact

- Simulator `C643EFF0-479E-4643-A62B-B6ECB277D823`, iOS 26.5; installed bundle `app.hungry.mobile` exists. An initial query used an incorrect assumed bundle ID and returned file-not-found; corrected after reading app.json.
- Read-only XcodeBuildMCP runtime snapshot succeeded: 172 accessibility elements, 17 likely tap targets, four scroll areas. Discover rendered with populated discovery categories and an offline banner. Screenshot: `runtime/installed-discover.png`; existing binary identity: `runtime/installed-artifact.json`.
- Visually observed: offline banner overlays the location heading. This is an installed-artifact observation, not a current-source regression reproduction.
- `xcrun simctl spawn <udid> log show --last 3m --style compact --predicate 'process == "Hungry" AND (messageType == error OR messageType == fault)'`: exit 0; no matching Hungry error/fault entries in the queried window. The command emitted `getpwuid_r did not find a match for uid 501`; this is a tooling warning, not a clean terminal transcript.
- The installed binary predates this audit and has not been matched to the current dirty source. No app restart, signout, local-state reset, screenshot-driven interaction flow, fresh native build, Android/device acceptance, VoiceOver/TalkBack interaction, large-type, dark-mode, offline/retry, provider-auth or long-duration soak proof was collected.

## Interpretation

This is broad source review plus bounded verification. Terminal errors currently exist, and complete simulator acceptance remains unproven. Do not mark the app error-free, visually certified, or ready for public release from these results.
