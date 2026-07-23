# Hungry Release 0.1 — Internal Alpha Checklist

Updated: 2026-07-24  
Build profile: `internal-alpha`  
Production status before completion: **No-Go**

## Owner prerequisites

- [ ] EAS project access works with `EXPO_TOKEN` or interactive owner login.
- [ ] Apple signing/internal-distribution credentials are available.
- [ ] Android signing credentials are available.
- [ ] Staging Supabase URL and anon key are configured in the EAS staging/internal-alpha environment.
- [ ] A verified staging user account exists.
- [ ] A second staging user exists for isolation/cross-user checks where required.
- [ ] A controlled catalog-RPC failure mechanism exists without disabling authentication.
- [ ] At least one iPhone simulator/device and one Android emulator/device are available.
- [ ] Five internal testers have accepted access.

Do not store tester passwords or private keys in the repository.

## Build commands

```bash
npm ci
npm run typecheck
npm run lint
npm run format:check
npm run audit:assets
node scripts/audit-release-01-catalog.mjs
npm run test
npm run test:e2e
npm run test:e2e:merchant-catalog
npx expo-doctor --non-interactive

eas build --profile internal-alpha --platform ios
eas build --profile internal-alpha --platform android
```

Record:

```text
Commit SHA:
iOS build ID/artifact:
Android build ID/artifact:
Build timestamp:
Staging catalog release ID:
Excel source checksum:
```

## Install matrix

| Platform | Device | OS | Install | Launch | Tester |
|---|---|---|---:|---:|---|
| iOS | recent iPhone |  | [ ] | [ ] |  |
| iOS | oldest supported representative |  | [ ] | [ ] |  |
| Android | recent Pixel/representative |  | [ ] | [ ] |  |
| Android | lower-end representative |  | [ ] | [ ] |  |

## Scenario A — Fresh install and mandatory authentication

- [ ] Clear app data or reinstall.
- [ ] Splash appears.
- [ ] Onboarding completes.
- [ ] Mandatory Create Account / Sign In appears.
- [ ] No Continue as Guest control exists.
- [ ] No Skip Login control exists.
- [ ] Protected deep links remain behind auth.
- [ ] Failed login/signup does not open MainTabs.
- [ ] Successful auth opens the Release 0.1 app.

## Scenario B — Valid session restore and sign-out

- [ ] Kill and reopen with valid session.
- [ ] Main app restores without repeating onboarding.
- [ ] Sign out.
- [ ] Auth flow appears.
- [ ] Catalog routes cannot reopen after sign-out.
- [ ] Reopen while offline after sign-out; auth remains required.

## Scenario C — Healthy Supabase catalog

- [ ] Discover loads live catalog.
- [ ] Jurong East results are relevant to selected/manual location.
- [ ] Real menu dish images display.
- [ ] Venue imagery follows logo → venue image → representative dish priority.
- [ ] Browse Dishes loads at least three pages without accidental duplicate IDs.
- [ ] Browse Stalls loads at least three pages without accidental duplicate IDs.
- [ ] Search by dish works.
- [ ] Search by stall works.
- [ ] Search by area works.
- [ ] Dietary/cuisine/price filters work where exposed.
- [ ] Dish detail retains the same release/source.
- [ ] Stall detail and menu retain the same release/source.
- [ ] Legitimate nonexistent query shows no-results.
- [ ] No Unsplash/generic placeholder image appears.

## Scenario D — Authenticated catalog outage

Keep authentication healthy and fail catalog RPC/network access only.

- [ ] Discover shows `Offline catalog` / Excel source.
- [ ] Read-only dish and stall results remain available.
- [ ] Search works against Excel.
- [ ] Browse paging works against Excel.
- [ ] Dish detail opens from Excel release ID.
- [ ] Stall detail and menu open from Excel release ID.
- [ ] Save/profile and every enabled write show unavailable/retry or remain disabled.
- [ ] No write is displayed as successful without Supabase confirmation.

## Scenario E — Invalid session and missing configuration

- [ ] Revoke/expire the staging session.
- [ ] Sensitive account state clears.
- [ ] App returns to auth.
- [ ] Excel catalog becomes inaccessible.
- [ ] Production-like build without required public Supabase config shows blocking configuration state.
- [ ] Missing configuration never enters MainTabs.

## Visual and accessibility smoke

For Discover, Browse, dish detail, stall detail, Profile, and Settings:

- [ ] safe areas and notch/Dynamic Island spacing;
- [ ] no tab-bar overlap;
- [ ] text truncation acceptable;
- [ ] 200%/large text usable;
- [ ] dark mode usable;
- [ ] reduced motion respected;
- [ ] VoiceOver/TalkBack labels understandable;
- [ ] keyboard does not obscure search/auth fields;
- [ ] loading, empty, error, and offline states are clear;
- [ ] images preserve aspect ratio and fall back safely.

## Evidence bundle

Attach to the Week 1–2 completion report:

- [ ] screenshots for each scenario;
- [ ] simulator/device logs;
- [ ] network/catalog source evidence;
- [ ] three-page ID lists;
- [ ] audit JSON;
- [ ] exact command results;
- [ ] tester names or IDs without passwords;
- [ ] issue list with severity and disposition.

## Tester script

Ask each internal tester to complete only:

1. create/sign into an account;
2. set or deny location and select Jurong East manually if needed;
3. find one named dish;
4. open the dish and its stall;
5. save the dish if favourites are enabled;
6. report one incorrect, missing, or broken item.

## Exit criteria

Internal alpha is complete only when:

- every P0 scenario passes on iOS and Android;
- no tester is blocked from the primary journey;
- no visible control is dead or misleading;
- no authentication or fallback bypass exists;
- no P0 data-quality issue remains in the pilot manifest;
- every blocker has an owner and resolution date;
- a new build is cut after beta-found P0/P1 fixes.
