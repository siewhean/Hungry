# Settings expert review — 20 October 2026

Reviewer: `settings_expert`, applying account-lifecycle UX, privacy/security engineering, accessibility, backend, and debugging lenses. Scope: **1/1 assigned page files**, plus the controls' direct stores, services, shared rows, account-deletion hook/worker/SQL, links, and focused tests. Current dirty working tree at audit base `50b2223e3ee058618bc23db48a97fb9fafac41ee`; no app code changed.

**Scoped verdict: No-Go for public Settings/account controls until the P1 privacy and account-lifecycle defects are resolved.** Several preferences currently change their switch without changing the app. The account deletion backend is materially implemented, but source existence is not scheduled-production-deletion proof. No P0 found. Findings below are source-confirmed unless explicitly described as a source-supported race or UX critique; no native screen, assistive technology session, live account, or destructive backend action was exercised.

## Design and coverage

Governing source read before screen inspection: `docs/audit/PROFILE_READS_SPEC.md:29-34`. It specifies version placement and destructive account deletion, rather than a complete Settings interaction/layout design. No Settings-specific file was found in the bounded `design/` filename search or `design/figma-v2/*.html` content search. Therefore layout fidelity, current appearance, contrast, large-font clipping, and scroll/focus behavior are **unverified**, not passed. The spec's irreversible-deletion wording also predates the current 30-day grace design; product should reconcile the artifact.

| File/page or support surface | Purpose / reachability | Design / inspection | Findings / runtime gap |
|---|---|---|---|
| `src/app/screens/profile/SettingsScreen.tsx` | Account, privacy, discovery, device, data and support controls; registered in ProfileStack and RootNavigator, production reachable for authenticated users | PROFILE_READS_SPEC; all 605 lines and every handler/control inspected | SET-01–SET-14; actual presentation and platform dialogs unverified |
| `src/components/settings/SettingsRow.tsx` | All settings value/navigation/toggle rows; production | Shared themed row, row press, native switch, text layout | SET-08; unlabeled switch hierarchy needs VoiceOver/TalkBack proof |
| `src/components/settings/SettingsSection.tsx`, `src/app/screens/profile/ProfileScreenShell.tsx`, `src/components/ui/Screen.tsx` | Section grouping and scroll/safe-area/header shell; production | Section headings, scroll layout, width handling; no screenshot review | SET-08/14; header grouping/font-scale behavior unverified |
| `src/components/settings/StallAlertsSettings.tsx`, `src/lib/notifications/push.ts` | Production stall alerts (`stallAlertsEnabled=true`), independently of general `notificationsEnabled=false` | All preference loading/saving, permission/token registration, failure and quiet-hour copy | SET-10; real-device delivery/denial and Android channel behavior unverified |
| `src/store/useUIStore.ts`, `src/store/useSearchStore.ts` | Persist local preferences and search history | Full preference declarations/writes/partialization; all search-history writes; repository-wide consumer search | SET-01/02/07/09; persisted-device behavior unverified |
| `src/store/useProfileStore.ts` | Visibility, left-handed preference, cache and profile hydration | Relevant setters, optimistic rollback, authenticated synchronization, reset and persist paths | SET-03; server enforcement not live-tested |
| `src/store/useSessionStore.ts`, `src/store/persistStorage.ts` | Sign-out, account caches, metadata persistence | Account reset, async Supabase sign-out, storage migration/removal and returning-user tests | SET-04/05/07; SDK auth persistence on failed sign-out needs integration verification |
| `src/lib/services/supabase/supabaseService.ts` | Queue deletion; read/cancel deletion; visibility writes; push preference reads/writes | Exact auth, profile-privacy and push methods traced | SET-03–06/10; hosted migrations, RLS and worker deployment unverified |
| `src/features/auth/useAccountDeletionGracePrompt.ts`, RootNavigator hook call | Re-login recovery during deletion grace period; production | All hook logic and root integration | SET-06; deadline race/error recovery unverified on device |
| `src/features/profile/exportMyData.ts` | Profile + six independently loaded export sections | Full exporter and Share invocation | SET-11; large native share, truncation, pagination and real-account completeness unverified |
| `src/constants/links.ts`, `src/lib/security/safeLinking.ts` | Support/legal/data controls; production | HTTPS/mailto allowlists and failure alerts; live public pages opened | SET-02/06/14; mailbox operations and support response SLA unverified |
| `src/store/useLocationStore.ts` | Permission, manual location and GPS reset | Grant/deny/refresh/reset/persist paths | SET-12; resume reconciliation and GPS device smoke unverified |
| `src/hooks/useReduceMotion.ts`, shared Button/IconButton and haptic callers | Motion/haptic behavior | App/system motion combination; repository haptic call search | SET-09; motion compliance throughout all animations belongs to cross-page audit |
| `supabase/migrations/0017_store_policy_safety_controls.sql`, `0040_release_hardening_account_deletion_merchant_rpcs.sql`, `20261017120000_account_deletion_grace_period.sql`, `20261017130000_account_deletion_worker_cron.sql`, `supabase/functions/process-account-deletions/index.ts` | Deletion queue, service-role worker, anonymization, cancellation, scheduling | Owner insert/read boundaries; active-request uniqueness; service-role-only worker; locked claims; due-time gate; legal holds; cancel RPC; anonymize/delete/complete order; cron secrets prerequisite | SET-06/13; deployment, Vault configuration, due job execution and actual asset/data erasure unverified |
| `supabase/migrations/0023_integration_posts_privacy_chat.sql`, `0041_full_audit_social_safety.sql`, `20260522124728_security_advisor_rls_view_fixes.sql` | Account visibility enforcement and public projection | Privacy-setting write and author visibility helper; public profile RLS projection | Real visibility setting has a backend path; inert public-feed preference has none (SET-01) |

## Findings

### SET-01 — P2 — Public-feed switch is inert; intended privacy semantics need clarification

- **Class / owner:** confirmed inert-control defect; public-versus-personal-feed intent is ambiguous. Independent cross-check narrows severity to P2 and does not infer an actual privacy leak. Client privacy + social/backend owners.
- **Evidence:** `src/app/screens/profile/SettingsScreen.tsx:338-343` promises “Hide reviewed dishes from public feed.” `src/store/useUIStore.ts:130-132` only persists a local boolean. Repository-wide identifier search found no consumers outside this screen and UI store; no service/RLS/public-read path uses it.
- **Trigger / consequence:** enable this privacy control, then publish/read content from another account. The switch claims a privacy choice while visibility remains governed by the existing publication/account settings. This is not evidence of bypassing the separate real Profile visibility control.
- **Recommendation:** remove the promise until implemented, or define whether it hides the user's reviews from other people or hides reviewed dishes from the user's own feed. A public-audience promise requires a server-enforced preference and clear historical-content semantics.
- **Close with:** two-account/anonymous reads before and after toggle, existing/new review coverage, offline save failure, relaunch and second-device synchronization; behavior assertions rather than source regex.

### SET-02 — P2 — Search-history opt-out and five other discovery/browser controls have no effects

- **Class / owner:** confirmed preference defects; search/discovery + platform/client owners.
- **Evidence:** `SettingsScreen.tsx:386-391,403-417,427-432,514-519,532-537`; `useUIStore.ts:120-134`. No consumer exists outside Settings/store for `showLocationBadge`, `dietaryFiltersEnabled`, `activityFeedEnabled`, `showOnlyFavoriteDishes`, `openToExternalApps`, or `allowSearchHistory`. `useSearchStore.ts:113-142` always adds recent searches/history; `safeLinking.ts:43,55` always chooses its hardcoded opening method.
- **Trigger / consequence:** switch history off and search again: history write paths still execute. Disable external browsers, dietary filters, activity feed or badge, or enable favourite-only discovery: those surfaces are unaffected. History opt-out is especially trust-sensitive; users may reasonably expect future searches not to remain on the device.
- **Recommendation:** implement each preference at its actual read/write boundary, with explicit scope, or hide it. Clarify whether disabling history clears existing entries; offer a separate clear-history action. Do not confuse hiding controls with applying dietary restrictions.
- **Close with:** history-off/new-search/relaunch; each affected surface before/after; app-vs-external link destination; guest/account switch and documented preference persistence.

### SET-03 — P1 — A failed privacy save can leave “Private” displayed while server stays public

- **Class / owner:** confirmed optimistic-state race; profile/privacy client owner.
- **Evidence:** `useProfileStore.ts:535-555` optimistically changes visibility, logs failures without a toast, and rolls back only if the entire profile object still equals the captured optimistic object. `useProfileStore.ts:852-857` changes that object for left-handed mode; the server write is `supabaseService.ts:3389-3398`.
- **Trigger / consequence:** select Private, change left-handed mode (or another profile field) before a rejected/offline privacy request settles. The object guard skips rollback, leaving a private label despite failed backend change. Even without a concurrent update, silent rollback gives no actionable explanation.
- **Recommendation:** track save status/version per privacy field, serialize or reconcile writes, and show confirmed server state plus a visible save error/retry. Privacy updates should not appear accepted until durable confirmation.
- **Close with:** deterministic delayed/rejected write + unrelated profile update; assert visible state and backend agree, account switch does not roll back another user, and retry succeeds.

### SET-04 — P1 — Failed asynchronous sign-out is hidden and can preserve SDK credentials

- **Class / owner:** confirmed failure-handling defect with source-supported persistence consequence; auth/platform owner.
- **Evidence:** `SettingsScreen.tsx:278-284` resets UI immediately. `useSessionStore.ts:181-187` starts token unbind, delays up to three seconds, then signs out and swallows all errors. `supabaseService.ts:2915-2918` throws an SDK error. Installed SDK `node_modules/@supabase/auth-js/src/GoTrueClient.ts:3962` returns on non-401/403/404 API errors before `_removeSession()`.
- **Trigger / consequence:** a sign-out network/server failure leaves the provider's stored session intact while the app presents Login. A subsequent SDK restoration/refresh can authenticate again; UI reset alone does not establish signed-out security on a shared device. Failure/restore sequence was not executed against a live account.
- **Recommendation:** guarantee local token removal independent of remote revocation, preserve bounded best-effort remote/token unbinding, and surface a distinction if revocation cannot complete. Prevent late operations from signing out a newly signed-in session.
- **Close with:** force auth sign-out 5xx/offline while preserving stored session, restart and resume app; verify no SDK session can restore. Include fast re-login during the delayed sign-out and push-unbind timeout tests.
- **Cross-page linkage:** `AUTH-010` in `auth.md` independently covers the delayed cleanup signing out a newly authenticated account. Treat that race as one shared auth issue; SET-04 additionally covers swallowed revocation failure and retained SDK credentials.

### SET-05 — P2 — “On this device” sign-out actually requests global session revocation

- **Class / owner:** confirmed copy/behavior mismatch; auth owner.
- **Evidence:** `SettingsScreen.tsx:272` explicitly describes this device; `supabaseService.ts:2917` supplies no scope. Installed SDK defaults to global; [official Supabase sign-out documentation](https://supabase.com/docs/reference/javascript/auth-signout) confirms that default affects all devices.
- **Trigger / consequence:** sign out from a phone and the user's other devices lose refresh sessions unexpectedly.
- **Recommendation:** use local scope for the current copy; offer a separately named all-devices action only if product wants it. Deletion can independently require broader revocation.
- **Close with:** two-device session test proving current-device sign-out preserves the other session, or updated explicit all-devices confirmation and corresponding test.

### SET-06 — P1 — Deletion recovery can silently fail while the product promises sign-in keeps the account

- **Class / owner:** confirmed account-lifecycle failure handling; auth/privacy owner.
- **Evidence:** `SettingsScreen.tsx:148` says sign back in to keep the account. [Live privacy policy](https://usehungry.com/privacy) says signing back in cancels deletion. `useAccountDeletionGracePrompt.ts:31-37,75` latches the account before loading and silently ignores failure with no retry. A successful lookup actually requires an additional “Keep my account” choice. `:55-60` shows cancellation success for either `true` or `false`; `cancel_my_account_deletion()` returns false when no cancellable requested row remains (`20261017120000_account_deletion_grace_period.sql:105-113`).
- **Trigger / consequence:** sign in before deadline when the pending-request lookup fails, then continue using the app; the deletion request remains active without warning. A worker claim racing the keep-account action can return false yet display cancellation success. These can mislead users about irreversible deletion risk.
- **Recommendation:** reconcile copy with explicit confirmation; do not silently lose the pending-state check; retry and provide persistent recovery/status access. Require `true` before reporting cancellation and explain processing/deadline failure accurately.
- **Close with:** failed lookup then restored network, remount/resume, cancellation false, request-to-processing race and confirmed cancellation; assert no success message without cancelled backend state.

### SET-07 — P2 — Clear cache removes persisted session/profile/location metadata outside its stated scope

- **Class / owner:** confirmed scope/state-consistency defect; settings/store owner.
- **Evidence:** `SettingsScreen.tsx:254-264` describes searches and drafts but calls `purgePersistedAccountData()` (`:114-122`), which also removes session, profile and location keys. Only search and review draft stores are reset in memory. The SDK auth storage is separate; UI preferences, social/post stores, media caches and other draft stores are not comprehensively cleared.
- **Trigger / consequence:** clearing cache leaves the current profile/location onscreen but removes their persisted snapshot, so subsequent state can differ after restart. It can remove local-only preferences/location/onboarding metadata while implying a harmless cache operation; it also overstates that all cached app data was removed. Exact rehydration result depends on the SDK session and later store writes.
- **Recommendation:** separate disposable cache, search history, local drafts, account metadata and sign-out. Clear only the named state and update memory/persistence consistently. Say exactly which drafts will be lost.
- **Close with:** seed each named store, clear, inspect persistence and memory, then cold-start; assert auth/onboarding/profile/manual location remain intact for a cache-only action and only disclosed drafts disappear.

### SET-08 — P2 — Settings switches lack labels/roles and busy states in the accessibility tree

- **Class / owner:** confirmed missing semantics, runtime impact unverified; shared UI/accessibility owner.
- **Evidence:** `SettingsRow.tsx:44-59` has no accessibility role/label/state; nested `Switch` at `:113-119` has no accessible name. Its visible text is a sibling rather than an explicit label. Value-only rows remain Pressables; there is no disabled/busy prop. `SettingsSection.tsx:21-24` does not mark section headings as headers. Preparing export removes `onPress` but does not announce busy/disabled (`SettingsScreen.tsx:547-549`).
- **Trigger / consequence:** a screen reader may reach generic switches without enough context or encounter redundant/inert rows; users cannot reliably distinguish an active save/export from a nonresponsive control. Exact grouping varies by platform and requires testing.
- **Recommendation:** expose one coherent labeled switch target with checked/disabled/busy state; make pure values noninteractive; mark headings; announce changes/errors. Preserve the generous 56-point row target.
- **Close with:** VoiceOver and TalkBack accessibility-tree inspection and full keyboard/switch-control walkthrough; labels/values/roles, single activation, export/save busy announcement, large text and focus return after alerts.

### SET-09 — P2 — Haptic feedback Off is ignored by common controls

- **Class / owner:** confirmed preference/accessibility defect; shared interaction owner.
- **Evidence:** `SettingsScreen.tsx:496-501` sets `hapticFeedbackEnabled`; only social-store logic consumes it in the repository-wide non-test search. `Button.tsx:131-134`, `IconButton.tsx:84-87`, Chip, FloatingToast, Discover/map/composer/wheel and other direct callers trigger haptics independently.
- **Trigger / consequence:** disable haptics, then press Delete account/back/common app controls or interact with discovery: haptics still fire.
- **Recommendation:** centralize optional haptics behind one preference-aware helper; preserve distinct system accessibility behavior where appropriate. Audit every direct haptic call.
- **Close with:** mocked helper tests and physical-device tap verification across shared controls and representative production flows with preference on/off. Reduced motion is genuinely consumed by `useReduceMotion`; this finding does not allege that toggle is wholly inert.

### SET-10 — P2 — Alert preferences display invented defaults when loading fails and allow a load/save race

- **Class / owner:** confirmed state/error UX defect and source-supported async race; notifications owner.
- **Evidence:** `StallAlertsSettings.tsx:29-39` initially displays defaults and silently ignores read errors; no loading/error state disables controls. Its initial request can apply after a user's newer save (`:37` versus `:56-57`). Save errors do show a toast and `isSaving` guards subsequent renders, but no busy/disabled state is rendered.
- **Trigger / consequence:** open offline and see weekly picks/stall alerts defaults rather than known account preferences. Toggle while the initial request is pending: an older response can overwrite the displayed latest choice. A user trying to disable alerts needs an authoritative state.
- **Recommendation:** show loading/error/retry, disable edits until loaded or version responses, and expose saving state. Provide a direct OS-settings recovery action when permission is denied.
- **Close with:** delayed initial read resolving after save, failed read, saved preference opposite default, denied permission, non-device simulator explanation and real-device token/delivery tests.

### SET-11 — P2 — “Download my data” shares JSON text and hides partial failure until inside the payload

- **Class / owner:** confirmed behavior and UX gap; privacy/export owner.
- **Evidence:** `SettingsScreen.tsx:129-133` invokes Share with `message: JSON.stringify(...)`, no downloadable file or export summary. `exportMyData.ts:8-13,27-39` converts individual read failures into payload sections and still returns successfully. It honestly discloses that additional data requires support, but only inside the exported JSON.
- **Trigger / consequence:** one or several failed sections still open the ordinary share sheet, so users may believe they downloaded a complete copy; supported share destinations may handle large JSON text poorly. Native truncation/failure is a runtime concern, not demonstrated here.
- **Recommendation:** prepare a machine-readable file, show included/missing categories and retry options before export, and clearly state incomplete scope without making unsupported legal-compliance claims.
- **Close with:** partial section failure, all section failures after profile succeeds, large account, cancellation, native Files save and account/session change during export; verify file parses and category completeness.

### SET-12 — P2 — Reset location says GPS but uses the hardcoded default coordinate

- **Class / owner:** confirmed copy/behavior mismatch; location owner.
- **Evidence:** `SettingsScreen.tsx:237-247` says manual location will be cleared and GPS defaults used. `useLocationStore.ts:203-210` sets permission unknown, `currentLocation` to `1.2813,103.8458`, and badge live; it never requests or refreshes GPS. The location row also shows “Use GPS” when manual label is absent (`SettingsScreen.tsx:375`).
- **Trigger / consequence:** reset after a manual choice with granted OS permission; discovery can temporarily use the default Singapore coordinate while implying GPS until another flow reacquires location. Permission UI can also remain stale on return from OS Settings because this screen does not reconcile on focus.
- **Recommendation:** either reacquire permitted GPS and show locating/failure state, or explicitly describe clearing to a default area and mark location unknown. Re-read OS permission on focus/resume.
- **Close with:** manual/GPS/denied/approximate permission, reset with network/GPS failure, external OS permission change and resumed app; assert coordinates, label and switch agree.

### SET-13 — P2 — Deletion request success, local cleanup failure and navigation are conflated

- **Class / owner:** confirmed error-stage conflation; account/settings owner.
- **Evidence:** `SettingsScreen.tsx:156-173` uses one catch for an already-committed deletion request, local persistence purge, resets and navigation. It says the request could not be queued for any later failure. Storage is normally fail-soft, but browser storage removal can reject; navigation/local runtime errors remain in the same block. On success `:167` navigates to SignUp rather than displaying the scheduled date/status and a return-to-login path.
- **Trigger / consequence:** backend request succeeds, then cleanup fails: user sees a false deletion-request failure, may retry against active-request uniqueness, and lacks confirmation of an active deletion date. Successful deletion also gives an unnecessarily confusing account-creation destination.
- **Recommendation:** record committed request outcome separately; perform local cleanup robustly; show scheduled date, retention/cancel instructions and Login entry; make retries idempotent/status-aware.
- **Close with:** inject cleanup failure after committed insert, duplicate request, backend insert failure, sign-out failure and success; assert accurate request status and no active account-data screen remains in back history.

### SET-14 — P3 — Information hierarchy and theme interaction overcomplicate simple settings tasks

- **Class / owner:** reasoned UX critique; product/design owner.
- **Evidence:** `SettingsScreen.tsx:292-319` repeats display name in Edit Profile and a separate value row, shows a full profile UUID in the main list, and uses several discovery/privacy/app sections. Theme looks navigational but each press cycles three modes (`:182-186,475-485`); there is no overview of available choices. “Help Center” opens a support-contact page, and “Data controls” opens account-deletion instructions, as confirmed by the linked live pages.
- **Consequence / recommendation:** people must scan many low-value or misleadingly named rows to find safety/account controls. Keep Account, Discovery, Appearance/accessibility, Privacy/data and Support; move copyable account ID to support details, use a three-option theme picker, rename links to their actual outcomes, and preserve direct access to deletion/export. Avoid adding settings search until the list earns it.
- **Close with:** approved interaction design, short task-based usability checks (disable history, change appearance, export, delete), 200% text/small screen and visual review against that artifact.

## Control and edge-state accounting

| Control/state group | Actual effect / pass evidence | Remaining validation |
|---|---|---|
| Edit Profile; name/email/ID values | Correct route name is registered; name/email/ID sourced from profile; email has an honest Not linked fallback | Linked Edit Profile page is audited by profile agent; long email/UUID truncation and copyability |
| Profile visibility | Real authenticated service write to `privacy_settings`; backend author-content helper accounts for visibility/approved followers and blocks | SET-03; two-account + anonymous enforcement against deployed schema; private scope explanation |
| Public-feed hiding, history, badge, dietary, activity, favourites-only, external browser | No functional consumer of seven settings; inert state is durably stored | SET-01/02; no green functionality claim |
| Left-handed mode | Real consumers in FAB/Home; persisted profile field, local setter | Server/profile rehydrate retention, RTL interactions and ergonomic benefit; no claim of full app mirroring |
| Theme | Persists preference and theme provider uses it; system/light/dark guard present | Choice affordance, OS system mode change, dark/high contrast visual review |
| Reduced motion | `useReduceMotion` combines app opt-in with system reduced motion | Per-animation coverage belongs to page agents; screen itself adds no animation |
| Haptics | Social store checks preference; most direct callers do not | SET-09; physical device required |
| General push/mission notifications, gamification visibility | General push hidden because notifications flag false; mission/tier/passport/badges hidden in production because gamification false | Their boolean-only implementation is a gated-beta concern, not a current production blocker |
| Stall alerts and followed-stall navigation | Production enabled; authenticated only; service-backed reads/updates, quiet hours/cap copy, permission/token request, error toast, correct nested Profile navigation | SET-08/10; real-device push, timezone/cap backend smoke and stale state |
| Location toggle/manual picker/reset | Native permission request and OS-settings fallback exist; manual picker route is real; denying app permission stops refresh and opens OS settings | SET-12; disable toggle cannot itself revoke OS permission; exact manual picker behavior belongs to onboarding review |
| Clear cache | Confirmation exists, search and review draft memory reset | SET-07; other draft/media/account-state scope incomplete |
| Export | Busy label + duplicate tap suppressed after render; primary failure alert; category-by-category failures represented; bounded parallel section reads | SET-08/11; no live rights-request compliance or complete-all-data assertion |
| Sign out | Confirmation; local account caches cleared; Login reset; onboarding completion retained | SET-04/05; remote failure, SDK storage, fast re-login and multi-device scope |
| Delete account | Destructive button/loading guard; explicit 30-day/retained-menu-photo copy; authenticated insert; token-unbind/sign-out errors intentionally do not reject queue success | SET-06/13; no post-success receipt; Android alert cancel/back, duplicate taps, final worker run and assets |
| Legal/support/data links | HTTPS host and support-email allowlists; native open failure alert; all four public HTTP pages resolved during review | Public availability alone does not prove support operational response or policies match collected/deleted data |
| Offline/loading/error/accessibility | Local preferences render without network; export/deletion/native permission have explicit errors; visibility and alert-load errors are insufficient | SET-03/06/08/10; no screenshot/VoiceOver/TalkBack acceptance |

## Backend and release proof boundary

The deletion pipeline is substantive: own-account queue insert/read policies; active-request unique index; authenticated cancel RPC; service-role-only claims/anonymization/completion; `FOR UPDATE SKIP LOCKED`; due-date gate; bounded worker batches; legal-hold checks; a timing-safe worker token; auth-user deletion; retained menu submissions anonymized; and a cron every 15 minutes. This is stronger than a cosmetic Delete account control.

However, `20261017130000_account_deletion_worker_cron.sql` is explicitly a no-op until two Vault secrets exist. This review did not inspect secrets, deployed function configuration, scheduler invocations, production due requests or storage-object cleanup. No proof that the 30-day promise completes in production is available to this reviewer. Release owner must provide a non-personal test-account end-to-end deletion receipt (request, scheduled time, cancellation, legal hold, due claim, completion, failed retry, auth/profile/media read-back), and explicitly enumerate retention. Do not promote this static review or historical smoke rows into that proof. Apple/Google policy adjudication is owned by root's policy review; this report makes no compliance certification.

## Current first-party comparisons

Only documented outcomes are compared; no claim of hands-on competitor testing or aesthetic superiority.

| Product / current official source | Pattern/outcome documented | Hungry assessment and recommendation |
|---|---|---|
| [Google Maps — Manage your Maps history](https://support.google.com/maps/answer/3137804?hl=en), read 20 October 2026 | Separates individual/date/all-time history deletion, explains saved activity and lists what history deletion does not affect. Google itself notes ongoing settings changes. | Hungry's compact list is easier to scan initially, but its history switch currently does nothing and cache action mixes unrelated metadata. Keep simplicity; implement an honest history-off boundary and precise deletion scope rather than copying Google's complexity. |
| [Spotify — Data rights and privacy choices](https://support.spotify.com/td-en/article/data-rights-and-privacy-settings/), read 20 October 2026 | Describes account privacy controls, a machine-readable ZIP download with explanatory files, category scope and contact route for additional data requests. | Hungry already provides structured JSON and a support fallback, which are useful foundations. A native downloadable file, completeness summary and clear partial failure give users a more dependable result than a raw shared message. A long asynchronous export service is unnecessary unless volume demands it. |

Honest specialist assessment: **stronger in discoverability of data/deletion controls and specific menu-photo retention wording than in reliable control semantics.** Sectioned rows, native switches, generous row height, explicit destructive confirmation and feature-gated advanced settings should be kept. The current experience is materially below a trustworthy settings baseline because privacy/history preferences and haptic behavior do not match their labels. Visual quality is unscored without rendered evidence.

## Verification performed and limitations

- Read-only source/consumer tracing: `rg -n 'hideReviewedDishesFromFeed|showOnlyFavoriteDishes|activityFeedEnabled|showLocationBadge|dietaryFiltersEnabled|allowSearchHistory|openToExternalApps|leftHandedMode' src --glob '!*.test.ts'`; inspected all results. Seven of these preference keys appear only in Settings/store; left-handed mode has real consumers.
- Initial direct test attempt `node --import tsx --test src/store/useSessionStore.auth-persistence.test.ts` failed before tests because the normal app TS config imported React Native Flow syntax (`Unexpected typeof`). Corrected to the repository test configuration; no code/tooling change made.
- **Pass, 10/10:** `HUNGRY_DATA_SOURCE=mock HUNGRY_DISABLE_ASYNC_STORAGE=1 HUNGRY_DISABLE_SECURE_STORE=1 TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test src/store/useSessionStore.auth-persistence.test.ts`. Exit 0; Node emitted `DEP0205 module.register()` deprecation warning. This mix of source contracts and mock-store behavior verifies local session/cache/returning-user cases only; it does not test the newly identified privacy, offline SDK sign-out, alert race or deletion recovery failures.
- A bounded shell glob for nonexistent `scripts/run-tests*` returned a zsh no-matches diagnostic while locating the test harness; package.json provided the correct command. Not an app defect.
- Opened [privacy](https://usehungry.com/privacy), [deletion](https://usehungry.com/account/delete), [contact](https://usehungry.com/contact), and [terms](https://usehungry.com/terms) pages; all resolved with relevant content. Contact is an email support fallback, not an FAQ/help center. Policy/site claims were not legal or operationally certified.
- No broad suite, install/build, shared simulator navigation, app/UI edits or backend writes performed. Root owns current typecheck/runtime evidence and independent adjudication. Document-only diff check should be run after cross-review edits.

## Priority and owners

1. **Privacy/auth owners before public release:** eliminate SET-01; repair SET-03/04/06 with deterministic failure/race coverage. Keep labels tied to confirmed server/device outcomes.
2. **Client/platform owners:** remove or wire SET-02; correct sign-out scope (SET-05); separate cache from account metadata (SET-07); fix accessible switch semantics and haptic enforcement (SET-08/09).
3. **Notifications/privacy/location owners:** implement load/save/error state, export receipt/file, location truthfulness and staged deletion outcomes (SET-10–13).
4. **Release/backend owner:** provide deployed deletion-worker/Vault/cron and actual due-request/media cleanup evidence; independent two-account privacy and physical-device permission/push/session smoke. These are unverified prerequisites, not assumed production failures.
5. **Design/product:** approve a current full Settings design and lifecycle copy; address SET-14. Gated gamification/general notification preferences can remain out of production until their separate feature gates are reviewed.
