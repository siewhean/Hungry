# Hungry Maestro and Native Smoke Report

> Product policy: mandatory authentication; no guest mode.  
> Runtime implementation line: PR #44  
> Status: **No-Go / native execution pending.**

Maestro validates native interaction against an installed build. It must be paired with Xcode/Android build evidence, simulator/device inspection, runtime logs, and manual accessibility testing.

## Required current flows

| Flow | Target file on PR #44 | Platform |
|---|---|---|
| Fresh install and mandatory authentication | `.maestro/ios-mandatory-auth-smoke.yaml` | iOS |
| Fresh install and mandatory authentication | `.maestro/android-mandatory-auth-smoke.yaml` | Android |
| Authenticated catalog fallback | `.maestro/ios-authenticated-fallback-smoke.yaml` or equivalent | iOS |
| App launch/bootstrap | current launch flow | iOS/Android |
| Valid session restore and sign-out | current auth/session flow | iOS/Android |
| Location denied/manual selection | current location flow | iOS/Android |
| Media permission denied/allowed | current media flow | iOS/Android |
| Review/post submission and failure | current review/post flow | iOS/Android |
| Deep-link auth and safe return route | current link flow | iOS/Android |
| Invalid/revoked session | current session-invalid flow | iOS/Android |
| Missing release configuration | production-like configuration flow | iOS/Android |
| Legitimate no-results | authenticated search flow | iOS/Android |

The historical guest-browse Maestro files and package-script names on `main` are obsolete product behavior. PR #44 owns their removal/replacement. Do not count a developer-launcher guest preset as release evidence.

## Required XcodeBuildMCP sequence

In an environment exposing Build iOS Apps tools:

1. `list_sims` and select a booted supported simulator.
2. Set workspace/project, scheme, configuration and simulator defaults.
3. Build and run the current branch.
4. Inspect the rendered UI hierarchy and take an initial screenshot.
5. Start console/runtime log capture.
6. Execute each scenario below.
7. Fix failures, rebuild and repeat.

Equivalent Android work must use a representative emulator/device and the production-candidate application ID/build profile.

## Mandatory scenarios

### A. Fresh installation

- Splash appears.
- Local onboarding completes.
- Mandatory Create Account / Sign In appears.
- No Continue as Guest or Skip Login exists.
- Protected deep links remain behind onboarding/auth.

### B. Account and session lifecycle

- Signup, verification and login work with staging.
- MainTabs mount only after a real authenticated session.
- Onboarding preferences migrate to the account.
- Kill/reopen restores a valid secure session.
- Sign-out clears account-scoped state and returns to Login.
- Invalid/revoked session clears access and fallback state.

### C. Supabase healthy

- Home, Discover, Search, Browse Dishes/Stalls, details, menu and map work.
- At least three pages load without accidental duplicate records.
- Menu-derived dish images and stall logo/venue/representative-dish images display.
- No Unsplash/generic placeholder appears.
- A deliberately nonexistent query remains a no-results state.

### D. Authenticated catalog outage

- Start from a valid restored Supabase session.
- Fail only catalog RPC/network/release access, not authentication.
- Read-only Excel Discover/Search/Browse/detail/menu/map works.
- Source/freshness indication is visible and accessible.
- Save, Review, Post, Like, Follow, Comment, Profile, Account and Merchant writes are unavailable and never look successful.

### E. Signed-out outage and missing configuration

- Signed-out offline relaunch remains in auth and cannot open Excel content.
- A production-like build without Supabase public configuration shows a blocking configuration/service-unavailable state.
- The full Excel or mock provider is not selected as an app-entry bypass.

## Visual and accessibility inspection

For each production-enabled screen inspect:

- safe area, Dynamic Island/notch, home indicator and custom tab bar;
- keyboard and input focus;
- loading, empty, error, offline/fallback and permission states;
- large text, dark mode and reduced motion;
- VoiceOver/TalkBack names, roles, states, announcements and focus;
- image crop/failure/cache behavior;
- scrolling, memory and repeated navigation stability.

Capture commit/build, device/OS, account role, environment, screenshots, video where useful, logs and exact result.

## Current evidence

No current #44/#45 native simulator/device run has been completed in this audit environment. The available repository connector does not expose XcodeBuildMCP or Android device tools. Historical guest-era or developer-launcher smoke evidence does not certify the current mandatory-auth architecture.

## Exit criteria

- [ ] Obsolete guest flows/package scripts/source contracts are removed or updated on PR #44.
- [ ] Current iOS preview/production-candidate build passes all mandatory scenarios.
- [ ] Current Android preview/production-candidate build passes equivalent scenarios.
- [ ] VoiceOver and TalkBack manual smoke passes.
- [ ] Runtime logs contain no critical crash, unhandled rejection, auth bypass or false write success.
- [ ] Evidence is attached to the task audit and `tasks/verification.md`.

Final status remains **No-Go** until current native proof exists.
