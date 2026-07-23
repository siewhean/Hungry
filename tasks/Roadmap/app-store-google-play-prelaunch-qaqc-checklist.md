# Hungry App Store and Google Play Pre-Launch QA/QC Checklist

> Integration base: `main`  
> Current product policy: mandatory authentication; no guest mode  
> Status rule: **No production submission until every P0 gate passes and current store-console policy checks are complete.**

Store policies are living documents. Re-check the official Apple and Google policy pages immediately before submission; this checklist is an implementation/evidence map, not legal advice or a substitute for the consoles.

## 1. Store-policy risk specific to Hungry

Hungry requires an account before entering the app:

```text
Splash → Onboarding → Create Account / Sign In → verification when required → authenticated app
```

Apple’s current App Review Guidelines say apps without significant account-based features should allow use without login. Hungry therefore needs a clear, truthful reviewer explanation of why its core functionality is account-based—for example synced taste/profile state, personalised recommendations, saved content, reviews/posts, privacy controls, moderation identity, and cross-device continuity. Do not add a guest bypass merely to satisfy review without a product/security decision, but treat an Apple rejection on this point as a real launch risk requiring owner/legal/product response.

Mandatory technical policy:

- Supabase is required for authentication and shared writes.
- Missing production configuration blocks app entry.
- Excel is an authenticated, read-only catalog fallback for eligible catalog outages only.
- Signed-out, missing-session, invalid/revoked-session, failed-auth, and legitimate no-results states cannot use Excel fallback.
- Disabled, unmoderated, or unfinished features remain unavailable in production.

## 2. Official policy sources

Verify the latest versions during release:

- Apple App Review Guidelines: `https://developer.apple.com/app-store/review/guidelines/`
- Apple account deletion guidance: `https://developer.apple.com/support/offering-account-deletion-in-your-app/`
- Google Play User Data policy: `https://support.google.com/googleplay/android-developer/answer/10144311`
- Google Play Data safety guidance: `https://support.google.com/googleplay/android-developer/answer/10787469`
- Google Play UGC policy: `https://support.google.com/googleplay/android-developer/answer/9876937`
- Android vitals: `https://developer.android.com/topic/performance/vitals/`
- Expo EAS Build and Update: `https://docs.expo.dev/build/introduction/` and `https://docs.expo.dev/eas-update/introduction/`
- OWASP MASVS: `https://mas.owasp.org/MASVS/`

## 3. P0 submission gates

| Gate | Required evidence |
|---|---|
| Source quality | Typecheck, lint, format, tests, Expo Doctor, asset/static/security gates pass |
| iOS binary | Production-candidate EAS/Xcode build installs and passes TestFlight smoke |
| Android binary | Production-candidate AAB installs and passes internal/closed-track smoke |
| Fresh launch | Splash/onboarding/auth flow works with no crash or guest bypass |
| Session lifecycle | Login, verification, recovery, restore, invalidation, sign-out, deletion work |
| Apple login justification | Review notes explain significant account-based core functionality |
| Backend availability | Reviewer demo account and accessible review backend exist |
| Supabase/RLS | Security Advisor plus user/merchant/storage isolation smoke pass |
| Missing configuration | Released app blocks entry; it does not select mock/Excel app mode |
| Catalog fallback | Valid authenticated session only; read-only; no false writes; no-results preserved |
| UGC safety | Enabled posts/reviews/profiles/comments/chat have required moderation controls |
| Account deletion | In-app initiation and public web request path work; associated data policy is accurate |
| Privacy | Apple App Privacy and Google Data Safety match app, SDK, server, and web behavior |
| Permissions | Every requested permission has a current feature, clear purpose, and denial path |
| Media rights | Catalog/store screenshots and in-app images have approved provenance/rights |
| Monitoring | Staging controlled error appears with correct release/source map and no sensitive data |
| Store metadata | Descriptions, screenshots, age/content ratings, support/privacy URLs, notes are accurate |
| Legal | Terms/privacy/community/account-deletion owner/legal sign-off complete |
| Rollback | OTA and binary/database forward-fix/rollback owners and steps documented |

Any unresolved P0 keeps the verdict **No-Go**.

## 4. Mandatory authentication QA

### Fresh install

- [ ] Splash completes without exposing app content.
- [ ] Onboarding is local and usable offline where intended.
- [ ] Final onboarding action opens mandatory Create Account / Sign In.
- [ ] No Continue as Guest, Skip Login, guest session, or unauthenticated MainTabs path exists.
- [ ] Protected deep links route to onboarding/login and retain only a validated safe return route.

### Signup and verification

- [ ] Email/name/password validation is accessible and server-aligned.
- [ ] Verification-required accounts cannot enter the app before confirmation.
- [ ] Resend is rate-limit aware and does not expose provider internals.
- [ ] Auto-confirm and OAuth paths establish a real Supabase session before MainTabs.
- [ ] Failed or cancelled auth remains in the auth shell.

### Returning, expired, and signed-out sessions

- [ ] Valid SecureStore-backed session restores the app.
- [ ] Persisted user ID without a valid Supabase session does not authenticate.
- [ ] Invalid/revoked token clears sensitive/account-scoped state and returns to Login.
- [ ] Sign-out works online and locally clears access even when the remote request fails.
- [ ] Signed-out offline relaunch cannot open Excel catalog or MainTabs.

## 5. Catalog, search, location, and media

### Supabase healthy

- [ ] Discover, Search, Browse Dishes, Browse Stalls, detail, menu, and map use bounded authenticated reads.
- [ ] Paging is stable and deduplicated; the full catalog is not mounted at once.
- [ ] Search by dish, stall, area, cuisine, dietary flag, price, and supported availability works.
- [ ] A deliberately nonexistent query shows a legitimate no-results state.
- [ ] Missing/deleted IDs show safe not-found behavior.

### Authenticated catalog outage

- [ ] Force catalog network/RPC/release failure while preserving the valid auth session.
- [ ] Permitted read-only surfaces use the bundled Excel catalog.
- [ ] Source/freshness is clear.
- [ ] Paging, filtering, detail, menu, and map remain coherent on one fallback release ID.
- [ ] Save, Review, Post, Like, Follow, Comment, Profile, Account, and Merchant writes are unavailable and never look successful.
- [ ] Sign-out or session rejection immediately removes fallback access.

### Images

- [ ] Dish images come from rights-approved menu/gallery sources.
- [ ] Stall imagery uses logo → stall/venue image → representative menu dish.
- [ ] No Unsplash or generic stock/placeholder host appears in production catalog cards.
- [ ] Broken/expired remote media produces a neutral safe state.
- [ ] App/store screenshots contain no real private user data and use licensed assets.

### Location

- [ ] Permission purpose is explained before/with the native request.
- [ ] Denial leaves manual area selection and core authenticated browsing usable.
- [ ] No background location permission exists without a reviewed core need.
- [ ] Precise/approximate collection and analytics behavior match privacy disclosures.

## 6. User-generated content and social safety

Apple currently requires UGC apps to provide filtering, reporting with timely response, blocking of abusive users, and published contact information. Google Play UGC requirements must also be checked in the current policy console.

For every enabled public content type:

| Capability | Required proof |
|---|---|
| Create | Authenticated, validated, rate-limited, storage-owned |
| View | RLS/visibility/moderation filters applied |
| Edit/delete own | Correct owner and associated-media handling |
| Report content/user | Backend-backed and enters moderation workflow |
| Block user | Prevents the intended interactions/content exposure |
| Filter/hide | Reported/removed/blocked content does not leak through feeds/search/details |
| Moderation | Role-restricted actions, audit trail, support response owner |
| Contact | Published, working support/contact path |
| Terms/community rules | Available before/at UGC use and accurate |
| Account deletion | Associated posts, reviews, photos, videos, and profile data handled as disclosed |

Disable comments, stories, chat/DMs, public merchant tools, or other UGC surfaces that do not meet this bar.

## 7. Privacy, Data Safety, and App Privacy mapping

Create/maintain `tasks/Roadmap/app-store-data-safety-mapping.md` from actual code and SDK behavior.

Review at minimum:

| Data | Potential Hungry use |
|---|---|
| Email, display name, user ID | Account management/auth/profile |
| Avatar/photos/videos | Profile, reviews, posts, merchant content |
| Precise/approximate location | Nearby discovery and map results |
| Search history and app interactions | Functionality, personalisation, analytics if retained |
| Taste/dietary preferences | Personalisation; potentially sensitive in user context |
| Reviews/posts/likes/saves/follows | User-generated content and app activity |
| Messages | Only if chat is enabled |
| Crash logs/diagnostics | Stability/performance monitoring |
| Device/app identifiers | Analytics, security, fraud prevention where actually used |
| Merchant/business data | Merchant account and catalog management |

For every type record:

- collected off-device or on-device only;
- first-party/service-provider/third-party destination;
- purpose;
- required or optional;
- linked to identity;
- retention/deletion behavior;
- encryption and access controls;
- user control;
- Apple and Google declaration.

Include Sentry, PostHog, Supabase, Mapbox, Expo, OAuth providers, email/SMTP, webviews, and any other SDK/server processor. The owner remains responsible for accurate declarations, including third-party SDK collection.

## 8. Account deletion

- [ ] Delete-account initiation is easy to find in app settings.
- [ ] It requests deletion of the account rather than only deactivation.
- [ ] Public web deletion/request URL works without requiring the app.
- [ ] Confirmation explains timing and any legally retained data.
- [ ] Auth tokens/session/access are revoked appropriately.
- [ ] Profile, private data, media, UGC, analytics identity, merchant membership, and derived data behavior matches the policy.
- [ ] Support/admin processing has an owner, SLA, and audit evidence.
- [ ] Apple and Google console URLs/declarations match the implementation.

## 9. Security and native configuration

Run and review:

```bash
npm run security:audit
npm run security:gitleaks
npm run security:trufflehog
npm run audit:supabase:static
npm run check:edge-functions
npm run smoke:database:rls
```

Verify:

- service-role/private secrets absent from client source and bundle;
- auth tokens use secure storage;
- HTTPS and allowlisted deep/external links;
- minimum native permissions and accurate purpose strings;
- media validation and storage ownership;
- production developer/prototype features absent;
- release build not debuggable and signing/update channels correct;
- analytics/crash payloads scrub PII and precise location;
- dependency and workflow risks resolved or explicitly accepted.

## 10. Accessibility and performance

### Manual accessibility

Complete VoiceOver and TalkBack core flows:

- onboarding/auth/verification/recovery;
- Home/Discover/Search/Browse/detail/map;
- review/post/media permission;
- profile/settings/deletion;
- no-results, error, offline, fallback, invalid-session, and configuration states.

Test large text, contrast, reduced motion, touch targets, focus/announcement behavior, dark mode, and keyboard/focus on web surfaces.

### Performance and stability

Measure on representative iOS and mid/lower Android release candidates:

- cold/warm start;
- time to usable authenticated content;
- search/detail/feed latency and error rate;
- list and map jank;
- memory during paging/long sessions;
- image cache/failure behavior;
- upload performance;
- background/battery/network behavior;
- crash/ANR evidence and Android vitals/pre-launch report.

Do not use development-mode timings as release proof.

## 11. Playwright, Maestro, and device matrix

Playwright validates Expo web and web workspaces; it does not replace native verification.

Required automated coverage:

- fresh onboarding and mandatory auth;
- auth failure and success;
- protected direct/deep-link routes;
- production feature flags;
- legitimate no-results;
- authenticated catalog fallback through targeted RPC interception;
- merchant/admin role isolation;
- accessibility and security route smoke.

Required native coverage:

- iOS and Android fresh install;
- verification and session restoration;
- location/camera/photo/media permission allow/deny;
- deep links;
- app background/foreground/kill/reopen;
- healthy Supabase and targeted catalog outage;
- signed-out outage and invalid session;
- native image loading, keyboard, safe areas, large text, VoiceOver/TalkBack;
- preview/release binaries, not only dev launcher paths.

## 12. Store submission evidence

### Apple

- [ ] Accurate name, subtitle, description, category, age rating, screenshots, and preview.
- [ ] Privacy policy and support URLs work.
- [ ] App Privacy answers match code/SDK/server behavior.
- [ ] Demo account and live review backend supplied.
- [ ] Review notes explain mandatory account-based core functionality and non-obvious features.
- [ ] UGC moderation and account deletion notes are ready.
- [ ] No placeholder content, fake data, broken links, or unavailable advertised feature.

### Google Play

- [ ] Accurate listing, screenshots, target audience/content rating, ads and permissions declarations.
- [ ] Data Safety form and privacy policy match code/SDK/server behavior.
- [ ] In-app and web account deletion paths supplied.
- [ ] App access/reviewer credentials supplied.
- [ ] Internal/closed track install and Play pre-launch report reviewed.
- [ ] Android vitals/crash/ANR/permission issues reviewed.
- [ ] AAB, signing, target SDK, update behavior, and rollout/rollback plan verified.

## 13. Required repository checks

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run test:e2e
npm run test:e2e:merchant-catalog
npx expo-doctor --non-interactive
npm run audit:assets
npm run audit:supabase:static
npm run check:edge-functions
npm run security:audit
npm run security:gitleaks
npm run security:trufflehog
npm run release:ready:local
npm run smoke:database:location
npm run smoke:database:search
npm run smoke:database:rls
```

With approved staging credentials:

```bash
npm run audit:supabase:advisor-security:non-password
npm run smoke:supabase-canonical-food-business-staging
npm run smoke:supabase-full-audit-v1
```

Run the current Maestro/EAS scripts from `package.json`; obsolete guest smoke names are not valid evidence.

## 14. Final verdict template

```text
Commit/build:
Environments:
Accounts/roles:
Automated checks:
Staging/database checks:
iOS evidence:
Android evidence:
Store-console evidence:
Legal/privacy evidence:
Open P0/P1 blockers:
Accepted risks and owner:
Verdict: Go / Go Candidate / No-Go
```

Do not mark Go while any P0 gate, current policy check, native proof, store-console declaration, monitoring proof, legal sign-off, or rollback owner is incomplete.
