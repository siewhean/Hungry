# Hungry App Screen QA/QC Checklist

> Product policy: mandatory authentication; no guest mode.  
> Status rule: a screen is not passed until its current implementation has automated and appropriate native evidence.  
> Use registered navigators and feature flags to generate the final inventory; do not rely on a static historical route list.

## 1. Entry and access matrix

```text
Fresh user: Splash → Onboarding → Create Account / Sign In → verification when required → authenticated app
Returning user: Splash → secure session restoration → authenticated app, or Login
```

- Signed-out users can mount only Splash, Onboarding, and Auth.
- MainTabs, details, search, map, reviews, posts, profile, merchant/admin, and advanced screens require authentication.
- Missing released-build Supabase configuration shows a blocking configuration state.
- Excel fallback is authenticated read-only catalog continuity for eligible catalog outages only.

## 2. Per-screen acceptance matrix

Complete one row for every registered screen, modal, sheet, dialog, tab, and deep-link state.

| Surface | iOS | Android | Web/Playwright | Loading | Empty/no-results | Error/retry | Offline/fallback | Permission denied | Auth/role/flag | Accessibility | Security/privacy | Result |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Splash/bootstrap | ☐ | ☐ | ☐ | ☐ | n/a | ☐ | ☐ | n/a | ☐ | ☐ | ☐ | ☐ |
| Onboarding family | ☐ | ☐ | ☐ | ☐ | n/a | ☐ | ☐ | location | mandatory auth next | ☐ | ☐ | ☐ |
| Create Account / Sign In | ☐ | ☐ | ☐ | ☐ | n/a | ☐ | internet required | n/a | signed-out only | ☐ | ☐ | ☐ |
| Verification/recovery | ☐ | ☐ | ☐ | ☐ | n/a | ☐ | ☐ | n/a | signed-out/callback | ☐ | ☐ | ☐ |
| Home | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | read/write behavior | n/a | authenticated | ☐ | ☐ | ☐ |
| Discover | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | authenticated Excel read-only | location | authenticated | ☐ | ☐ | ☐ |
| Search/Browse Dishes/Stalls | ☐ | ☐ | ☐ | ☐ | legitimate no-results | ☐ | authenticated Excel read-only | n/a | authenticated | ☐ | ☐ | ☐ |
| Dish detail | ☐ | ☐ | ☐ | ☐ | missing ID/data | ☐ | read-only fallback | n/a | authenticated | ☐ | ☐ | ☐ |
| Stall detail/menu | ☐ | ☐ | ☐ | ☐ | missing ID/data | ☐ | read-only fallback | map/location | authenticated | ☐ | ☐ | ☐ |
| Map/location | ☐ | ☐ | ☐ | ☐ | no markers | ☐ | supported fallback | location | authenticated | ☐ | ☐ | ☐ |
| Decide For Me/Wheel | ☐ | ☐ | ☐ | ☐ | no eligible result | ☐ | ☐ | location | authenticated + flag | ☐ | ☐ | ☐ |
| Review flow | ☐ | ☐ | ☐ | ☐ | target missing | ☐ | writes unavailable | media | authenticated | ☐ | ☐ | ☐ |
| Post composer | ☐ | ☐ | ☐ | ☐ | draft/target missing | ☐ | writes unavailable | media/camera | authenticated + flag | ☐ | ☐ | ☐ |
| Activity/social | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | notifications if used | authenticated + flags | ☐ | ☐ | ☐ |
| Profile/public profile | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | writes unavailable | media | authenticated/visibility | ☐ | ☐ | ☐ |
| Edit profile/avatar | ☐ | ☐ | ☐ | ☐ | n/a | ☐ | writes unavailable | media | authenticated | ☐ | ☐ | ☐ |
| Favourites/history | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | no false local success | n/a | authenticated | ☐ | ☐ | ☐ |
| Settings/privacy/deletion | ☐ | ☐ | ☐ | ☐ | n/a | ☐ | ☐ | notifications/location | authenticated | ☐ | ☐ | ☐ |
| Merchant routes | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | no false writes | media | merchant role + flag | ☐ | ☐ | ☐ |
| Admin/ops/developer | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | n/a | role/dev/production gate | ☐ | ☐ | ☐ |
| Offline/auth unavailable | ☐ | ☐ | ☐ | n/a | n/a | ☐ | canonical state | n/a | correct session policy | ☐ | ☐ | ☐ |
| Configuration unavailable | ☐ | ☐ | ☐ | n/a | n/a | ☐ | n/a | n/a | blocks app entry | ☐ | ☐ | ☐ |
| Unauthorized/disabled feature | ☐ | ☐ | ☐ | n/a | n/a | ☐ | n/a | n/a | correct role/flag | ☐ | ☐ | ☐ |
| Not found/invalid deep link | ☐ | ☐ | ☐ | n/a | ☐ | ☐ | n/a | n/a | auth + safe params | ☐ | ☐ | ☐ |

## 3. Mandatory checks for every surface

### Functionality

- [ ] Every visible button, tab, link, chip, menu, sheet, field, gesture, and retry action works.
- [ ] Navigation back/close/cancel behavior is deterministic.
- [ ] Route params are validated and missing data does not crash.
- [ ] Successful state appears only after the canonical backend confirms the operation.
- [ ] Optimistic state rolls back on failure.
- [ ] Repeated taps/submits do not duplicate writes.

### Data and integration

- [ ] Shared data comes from Supabase and rehydrates across session/device where intended.
- [ ] Zustand is cache/draft/optimistic state, not canonical shared storage.
- [ ] Profile/avatar identity is consistent across posts, reviews, activity, and public profile views.
- [ ] Cross-user visibility and RLS isolation both pass.
- [ ] Catalog pages are bounded, paged, deduplicated, and source/freshness aware.
- [ ] Successful empty search does not substitute unrelated fallback records.

### Images and media

- [ ] Dish cards use approved menu/gallery imagery.
- [ ] Stall cards use logo → stall/venue image → representative menu dish.
- [ ] No Unsplash or generic production placeholder host.
- [ ] Aspect ratio, crop, caching, transition, and broken-image state are correct.
- [ ] Upload validates MIME, size, duration/dimensions where relevant, and storage ownership.

### Accessibility and visual quality

- [ ] Safe areas, keyboard, custom tab bar, sheets and modals do not overlap content.
- [ ] Large text, dark mode and reduced motion work.
- [ ] VoiceOver/TalkBack names, roles, states, focus and announcements are correct.
- [ ] Touch targets and contrast pass.
- [ ] Loading skeletons match final geometry and do not flash for synchronous work.

### Security and privacy

- [ ] Signed-out/invalid-session users cannot mount the surface.
- [ ] Role/feature-disabled routes are not reachable through deep link, stale state, return route or notification.
- [ ] No private data or secret appears in UI, logs, screenshots, analytics or crash payloads.
- [ ] Permission requests are minimal and denial leaves an appropriate path.
- [ ] Public UGC includes required report/block/moderation/delete-own-content behavior.

### Performance

- [ ] No unbounded list or full-catalog hydration.
- [ ] Requests are cancellable/deduplicated where needed.
- [ ] Prefetch does not block navigation or bypass authorization.
- [ ] Long scrolling, repeated navigation, media and app lifecycle do not leak memory/listeners.
- [ ] Representative iOS and mid/lower Android performance evidence exists.

## 4. Required scenarios

1. Fresh install and mandatory authentication.
2. Valid returning session.
3. Failed auth and verification delay.
4. Explicit sign-out online/offline.
5. Invalid/revoked session.
6. Missing production Supabase configuration.
7. Supabase healthy catalog.
8. Authenticated targeted catalog outage and Excel fallback.
9. Signed-out outage with no fallback.
10. Legitimate no-results.
11. Location allow/deny/manual selection.
12. Media permission allow/deny and failed upload.
13. Cross-user post/review/favourite/profile visibility and isolation.
14. Merchant/admin correct and incorrect roles.
15. Production-disabled feature/deep-link attempts.

## 5. Evidence

For each completed row record:

```text
commit/build
platform/device/OS
account role
data source/environment
steps
expected/actual
screenshot/trace/video/log/query
result and issue ID
retest result
```

Playwright validates web behavior; Maestro and real simulator/device evidence validate native behavior. Source contracts alone do not pass a screen.

## 6. Verdict

This checklist remains **No-Go** until every production-enabled surface has current automated and appropriate native/manual evidence, all P0/P1 findings are resolved, and external store/security/privacy gates pass.
