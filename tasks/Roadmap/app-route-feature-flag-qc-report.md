# Hungry Route, Authentication, Role, and Feature-Flag QC Report

Updated: 2026-07-23  
Status: **No-Go — target policy documented; final automated and native proof pending.**

## 1. Route policy

```text
Signed out: Splash, Onboarding and Auth only
Authenticated: approved consumer routes
Authenticated + role: merchant/admin/ops routes
Authenticated + feature flag: approved advanced routes
Development only: developer/prototype routes
```

No mobile Home, Discover, Search, Browse, detail, map, review, post, activity, profile, settings, merchant, admin, Passport or advanced route is public/guest accessible.

## 2. Production feature policy

| Surface | Production default | Required proof before enabling |
|---|---:|---|
| DeveloperLauncher, DesignGallery and prototypes | off/unregistered | never in public store binary |
| Merchant centre and claim tools | off unless launch-approved | merchant role, outlet isolation, audit, uploads, native/web/store notes |
| Direct messages and chat | off | realtime integrity, report/block, moderation, rate limits, privacy |
| Stories and comments | off | UGC moderation, reporting, blocking, delete-own-content, admin queue |
| Passport and gamification | off | backend unlock integrity, no misleading progress/rewards |
| Collections, checklists and portfolios | off unless separately approved | ownership/collaboration/privacy/RLS/native proof |
| Floorplans and experimental drill-down | off | geometry, data identity, map, performance and accessibility proof |
| OAuth providers | off unless configured/approved | trusted callback/state/PKCE, provider console and Apple review requirements |
| OCR/AI/ops/admin tools | private/off | role isolation, audit logs, data privacy, cost/safety controls |

## 3. Bypass paths to test

For every route test:

- direct stack/tab navigation;
- deep link and malformed deep link;
- auth return route;
- stale persisted navigation/session state;
- push notification payload where supported;
- developer launcher shortcut;
- background/foreground and killed-app open;
- signed-out, valid user, wrong merchant, correct merchant, ops and admin accounts;
- development, staging and production builds.

Expected behavior:

- fresh signed-out user → onboarding;
- onboarded signed-out user → Login;
- safe target may resume only after successful auth;
- unsafe, disabled or unauthorized target is discarded;
- authentication never overrides role or feature denial;
- missing production configuration blocks app entry;
- signed-out/invalid-session users cannot use Excel fallback.

## 4. Required automated coverage

- route inventory/type/registration contracts;
- mandatory-auth and deep-link contracts on PR #44;
- production feature-flag resolution tests;
- Playwright production route gating;
- merchant/admin web and app role tests;
- app-store prelaunch native-flow contracts;
- source search proving guest smoke and guest route expectations are removed.

## 5. Required native proof

- installed iOS and Android production-candidate builds;
- fresh install and returning session;
- deep-link attempts for every protected route class;
- notification route attempts where implemented;
- missing configuration, signed-out outage and invalid-session cases;
- production build contains no developer/prototype entry;
- screenshots/logs tied to commit/build/device/account role.

## 6. Current blockers

- PR #44 runtime implementation is not fully verified.
- PR #45 documentation cleanup is not fully verified.
- Current GitHub Actions runs have not returned usable step evidence.
- iOS/Android installed-build route matrices are missing.
- Merchant/admin live role credentials and proof are missing.

Production remains **No-Go**.
