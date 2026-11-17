# Authentication and recovery expert review — 20 October 2026

Independent cross-check correction: the Change Password route is reachable from Edit Profile; original missing-entry claims have been corrected below. See `crosscheck-accounts.md` for adjudication.

Reviewer: login/recovery UX designer, authentication/backend engineer, accessibility reviewer and debugger. Scope: all **11/11** `auth` manifest files; current dirty working tree based on `50b2223e3ee058618bc23db48a97fb9fafac41ee`. Audit only; no application changes, simulator navigation, live authentication, email sends or account writes.

## Judgment and evidence boundaries

**Not ready for release.** The newly registered Change Password screen breaks TypeScript and the production source-boundary check. Beyond those concrete gates, recovery status copy is false, guest taste transfer has an event-order defect, and password forms lack robust busy/keyboard/autofill behavior. These matter more than visual polish for a dish-discovery product: users should retain their taste choices and recover access confidently.

Governing design read first: `docs/audit/AUTH_SPEC.md` (April 2026). It specifies shared branding, errors, password visibility, verification and a real password-reset completion state. It is a partial textual specification, not current rendered-screen proof; it still describes 4/6-digit split OTP whereas `supabase/config.toml:29` now specifies eight digits. No auth-specific `design/figma-v2` HTML was found. Splash and Change Password lack a dedicated approved screen design in this scope. The product/auth direction in old docs is inconsistent with current guest browsing; current source governs this audit, not old mandatory-auth prose.

Inspected supporting paths: root navigation/linking, session/profile stores, bootstrap, profile transfer helper, service interfaces/provider, Supabase auth client and recovery/OAuth handlers, installed auth SDK event ordering, shared Screen/Input/Button, auth copy/validation and local Supabase auth configuration. Root verification artifacts read: `typecheck.log`, `source-tests.log`, `browser-smoke.log` in this directory. Browser smoke cannot prove app behavior because its browser executable is missing. No screenshot was inspected; contrast figures below are token calculations, not pixel measurements. Hosted redirect allowlist, SMTP delivery/templates, deployed email hook, RLS and device VoiceOver/TalkBack remain unverified.

## Complete page/support coverage

| File under `src/app/screens/` | User purpose / production reachability | Design and inspection | Findings / remaining runtime checks |
|---|---|---|---|
| `SplashScreen.tsx` | Bootstrap/brand entry in release; development initially uses launcher | Shared brand intent only; animations, bootstrap gate, timeout cleanup, onboarding/home reset inspected | AUTH-012; offline/bootstrap timing and Reduce Motion on device unverified |
| `auth/AuthProviderButton.tsx` | Shared provider action; renders in production but disabled there | Auth spec/shared button intent; labels, disabled semantics, touch size, haptic behavior inspected | AUTH-011; long labels/font scaling unverified |
| `auth/AuthScreenShell.tsx` | Layout for all auth routes | Auth spec; logo/title/footer, color overrides, scroll delegation inspected | AUTH-006; small phones, keyboard, large type, dark wordmark unverified |
| `auth/AuthStack.tsx` | Root-registered production auth stack | Navigation support, no standalone visual source; every route and error boundary inspected | AUTH-001/010; Change Password is reachable via EditProfileScreen.tsx:103–105,181–194 (independent cross-check correction) |
| `auth/ChangePasswordScreen.tsx` | Change credentials; registered in production stack; reachable from Profile → Edit profile → Change Password | No dedicated design; current-password reauth/service, all fields, busy state, validators inspected | AUTH-001/007/010; actual signed-in routing and provider-only accounts unverified |
| `auth/EmailVerificationScreen.tsx` | Signup code verification, production reachable from Sign Up | Auth spec plus current eight-digit config; missing-email redirect, input filtering, verify/resend/countdown, attribution, profile apply inspected | AUTH-002/005/009/012; delivery, expiry, background countdown, keyboard submit unverified |
| `auth/ForgotPasswordScreen.tsx` | Request reset email, production reachable from Login | Auth spec; generic account-existence response, send service, return routes inspected | AUTH-003/005; delivery, expired-link recovery, keyboard behavior unverified |
| `auth/LoginScreen.tsx` | Email login or guest continuation; production reachable on demand | Auth spec; validation/errors, guest root reset, service/profile/session flow, providers, recovery entry inspected | AUTH-002/005/006/007/008/009/011; keyboard/autofill/account-switch behavior unverified |
| `auth/ResetPasswordScreen.tsx` | New password after reset deep link; production reachable | Auth spec; PKCE code forwarding, recovery latch, confirm/visibility/requirements, success route inspected | AUTH-003/004/005/006/007/012; fresh/reused/failed-code cases unverified on device |
| `auth/ResetPasswordSuccessScreen.tsx` | Purports to finish reset; reachable from Reset Password and public deep link | Auth spec explicitly requires completion confirmation; every action/copy block inspected | AUTH-003; rendering after automatic root redirect unverified |
| `auth/SignUpScreen.tsx` | Create account, receive verification; production reachable | Auth spec; provider gates, terms/privacy, name/email/password, auto-confirm/null-session paths inspected | AUTH-002/005/007/011; legal-link availability, duplicate email and draft restoration unverified |

## Findings (ordered by severity)

### AUTH-001 — P1 — Registered Change Password screen blocks the app's validation gates

**Class:** confirmed compiler/contract defect, with focused behavioral repro. **Location:** `src/app/screens/auth/ChangePasswordScreen.tsx:88`, `:123`, import `:10`; eager registration `AuthStack.tsx:5,30`.

**Trigger/consequence:** run `npm run typecheck` on the current tree. `validateRequired` expects `(value, label)` and `validatePassword` expects `(value, minLength)`, but React Hook Form passes `(value, formValues)`. Both produce TS2322. In transpiled JavaScript the second form object bypasses minimum length: `validatePassword('Aa1!', formValues)` returns `true`, while the normal call returns the twelve-character error; blank required-field message becomes `[object Object] is required`. This is client validation failure, not proof the hosted server accepts a weak password. Direct import of Supabase internals also fails the repository's production source-boundary contract. The screen is eagerly imported and is user-reachable through Edit Profile; both build correctness and the signed-in journey are affected.

**Evidence:** root `typecheck.log` contains both TS2322 errors; `source-tests.log` names this exact file as the one failing source-boundary assertion. A read-only Node/TypeScript-transpile repro invoked the real validation module with the RHF second argument and obtained the outputs above (exit 0).

**Recommendation/owner:** auth engineer: wrap validators with explicit labels/minimums; consume supported service/config abstraction; add a form-level validation regression, not just tests of helpers with their default arguments. **Close:** both gates pass; form rejects a four-character mixed-class password and announces meaningful current-password validation. Separate root tsc failures in `supabase/functions/send-email/index.ts` must also be resolved by its owner.

### AUTH-002 — P2 — The auth event replaces guest preferences before the merge reads them

**Class:** confirmed source/event-order defect; device reproduction outstanding. **Location:** `src/hooks/useAppBootstrap.ts:318`, `src/store/useSessionStore.ts:325`, `src/store/useProfileStore.ts:416`, `src/features/auth/applySignedInProfile.ts:43`; entry `LoginScreen.tsx:57`.

**Trigger/consequence:** a guest completes taste/dietary choices and signs in. The installed `@supabase/auth-js/src/GoTrueClient.ts:1215` awaits `SIGNED_IN` subscribers before `signInWithPassword` resolves. Bootstrap immediately applies authenticated state and `syncProfile`; because guest ID differs, the profile store replaces the guest with the repository's neutral authenticated profile. Only after that does Login call `applySignedInProfile`, whose merge requires the profile still to be `guest-user`. Guest choices are therefore unavailable to its intended merge. OTP and provider flows also emit auth events and deserve the same regression coverage. This undermines Hungry's core personalization; it is not a claim of server-side preference deletion.

**Recommendation/owner:** auth/profile engineer: snapshot guest choices before starting authentication or make identity/profile transfer one coordinated transaction; avoid subscriber-driven destructive initialization during interactive authentication. **Close:** integration tests preserve distinctive taste and dietary values through email login, OTP and enabled OAuth with the real event order, plus device read-back after restart. Include already-personalized existing accounts and an explicit merge policy.

### AUTH-003 — P2 — Password reset completion shows the earlier email-request stage and fake actions

**Class:** confirmed behavior/copy defect. **Location:** `ResetPasswordScreen.tsx:42-45`, `ResetPasswordSuccessScreen.tsx:19,24,49,63`; `ForgotPasswordScreen.tsx:31-33`.

**Trigger/consequence:** after `auth.resetPassword` succeeds, the destination says instructions were just emailed and the link still needs using. Its “Resend link” only emits “Reset link resent.”; “Open email client” only shows a toast. Conversely the actual send-email step immediately returns to Login, so it never displays a useful inbox confirmation page. Current root auth redirection may bypass this completion UI after recovery authentication; that does not make its reachable public success route truthful.

**Recommendation/owner:** auth UX + engineer: use separate sent-email and password-updated states, with truthful CTAs. A completion screen should confirm the update and offer the chosen sign-in/continue outcome. Wire actual resend only to a stage with a retained email and service call; remove simulated success. **Close:** request → email → update → completion flow verified, including direct success deep link; no claimed action without a corresponding operation. Design spec section 3 already defines the appropriate completion message.

### AUTH-004 — P2 — A failed password update consumes the recovery code and loses its retry context

**Class:** confirmed source recovery-state defect; exact device transition unverified. **Location:** `src/lib/services/supabase/supabaseService.ts:2971`, recovery exchange `:1839-1879`; `ResetPasswordScreen.tsx:38-49`; `RootNavigator.tsx:582-600`.

**Trigger/consequence:** a valid PKCE code exchanges successfully, but `updateUser` fails (network/server password policy). Retry invokes `exchangeCodeForSession` again with the same one-use code rather than recognizing the established recovery session. Meanwhile every outcome clears `passwordRecoveryInProgress`; bootstrap has already treated the recovery session as authenticated, so the root effect is then allowed to reset to onboarding/home, removing the form even after a failure toast. The new latch only protects the in-flight call, not the complete recovery transaction.

**Recommendation/owner:** auth/navigation engineer: track a recovery session and code-consumed phase until update succeeds or the person explicitly cancels. Retry the update with the existing recovery session, and show actionable invalid/expired-link recovery. **Close:** fake exchange success + update failure → successful retry without a second exchange; device offline retry stays on the form and retains entries; cancellation and cold/warm links tested.

### AUTH-005 — P2 — Most authentication mutations have no busy guard

**Class:** confirmed source interaction/race weakness. **Location:** `LoginScreen.tsx:41,268`, `SignUpScreen.tsx:41,365`, `ForgotPasswordScreen.tsx:25,112`, `ResetPasswordScreen.tsx:32,189`; verification `EmailVerificationScreen.tsx:75` and resend `:49`.

**Trigger/consequence:** repeated taps during slow auth/send/update calls launch duplicate requests, duplicate navigation/toasts, and avoidable provider rate limits; nothing communicates progress on these four primary forms. OTP has a loading-disabled Button, but its keyboard callback directly re-enters `handleVerify` without an early busy check; resend also lacks in-flight exclusion. Change Password's `loading={isSubmitting}` is a useful existing pattern, although its validators are broken.

**Recommendation/owner:** auth engineer: expose form submitting state, disable/busy-label all conflicting actions, and guard handlers against re-entry (including keyboard submissions and resend). **Close:** deferred-promise screen tests show one request under rapid taps/keyboard submission; input remains available after failure, with no stale success after leaving.

### AUTH-006 — P2 — Login/reset layouts have no usable keyboard or short-height fallback

**Class:** confirmed layout configuration; physical occlusion is runtime-only until measured. **Location:** `LoginScreen.tsx:150-152`, `ResetPasswordScreen.tsx:61`, `AuthScreenShell.tsx:37`, `src/components/ui/Screen.tsx:98`.

**Trigger/consequence:** Login combines a non-scrolling shell, 64-point top offset, full logo, fields, primary CTA, two disabled production-provider rows and footer. Reset is also non-scrolling. Shared Screen uses plain View/ScrollView with no keyboard avoidance or inset adjustment; App has no enclosing keyboard avoidance. Small phones, landscape, keyboard and large text therefore have no explicit means to reveal covered controls. Signup scrolls, but lacks keyboard-tap persistence configuration and merits device testing.

**Recommendation/owner:** mobile UX engineer: scrollable keyboard-aware forms, responsive top/logo spacing, automatic scroll to first invalid field, focus/next/done actions. Keep guest access and reset navigation reachable. **Close:** smallest supported iPhone and Android, largest supported text, both orientations and open keyboard; every field/CTA reachable without dismissing/retyping. Do not call this visual clipping observed until that smoke exists.

### AUTH-007 — P2 — Password-manager semantics are absent, and showing passwords enables correction

**Class:** confirmed input-prop defect; OS effects unverified. **Location:** shared `src/components/ui/Input.tsx:58-61`; `LoginScreen.tsx:224`, `SignUpScreen.tsx:326`, `ResetPasswordScreen.tsx:92`.

**Trigger/consequence:** the shared Input defaults secure fields to `autoComplete='off'`; Login/signup/reset supply no current/new-password content types. When the eye toggle sets `secureTextEntry=false`, the same shared default switches `autoCorrect` and `spellCheck` on because it infers credential semantics solely from visibility. A visible password remains a credential. This increases typing friction and can produce platform-dependent corrections, while Change Password already shows how to annotate current/new-password autofill explicitly.

**Recommendation/owner:** shared component/auth engineer: keep credential semantics independent of masking; set correction/spellcheck/capitalization off and appropriate username/current/new-password hints on all credential fields. **Close:** test prop behavior masked and visible; real iCloud/Android password-manager fill and generated password accepted unchanged, with no second-entry surprises.

### AUTH-008 — P2 — Login overrides the accessible button foreground with low-contrast white

**Class:** confirmed token-derived contrast defect. **Location:** `LoginScreen.tsx:271-272`; `src/theme/tokens.ts:14,19,90,95`.

**Trigger/consequence:** Login forces white text and arrow on the orange primary button instead of shared Button's dark `textOnOrange`. Calculated sRGB contrast is **3.69:1** on light orange `#E8531E` and **2.80:1** on dark-theme orange `#F97316`; the normal 16-point button label loses legibility. These are exact token calculations, not a device/screenshot accessibility certification.

**Recommendation/owner:** auth/design-system engineer: use the shared foreground token consistently for text and icon; check all auth feedback/link contrasts in both themes. **Close:** measured actual rendered normal/busy/pressed/disabled states pass the project's contrast target and remain legible in device accessibility smoke.

### AUTH-009 — P2 — Unconfirmed sign-in has no direct recovery action

**Class:** confirmed UX/flow defect. **Location:** `LoginScreen.tsx:79-80`; `EmailVerificationScreen.tsx:28,49,142`.

**Trigger/consequence:** an existing unconfirmed user tries Login after the old code expires or on another device. The only response is “Please verify your email before signing in.” There is no route to verification/resend with the entered email. Existing email-verification UI is reachable from successful Sign Up and requires email params; users are pushed into recreating signup or hunting their original message. It is not an absolute account lockout, since other paths/email may still work.

**Recommendation/owner:** auth UX/engineer: provide a secure “Verify email / resend code” continuation with the normalized entered email and server-enforced throttling; preserve form work. **Close:** unconfirmed login → new code → verified session without creating a second account or re-entering display name/password.

### AUTH-010 — P2 — Delayed sign-out can terminate a newly established session

**Class:** source race, runtime reproduction outstanding. **Location:** `src/store/useSessionStore.ts:181-187,265`; `src/lib/services/supabase/supabaseService.ts:2913`.

**Trigger/consequence:** sign out, then sign in again before slow push unbind settles or the three-second timeout fires. Local sign-out clears immediately, but the deferred callback later calls singleton `client.auth.signOut()` against whichever session is current, with no original-user/generation check. The new login can be signed out unexpectedly. Independent cross-check corrected the original reachability subclaim: Edit Profile has a Change Password action; this does not alter the delayed sign-out defect.

**Recommendation/owner:** session engineer: serialize sign-out with subsequent login or capture/verify the original session generation before mutating auth. Treat push cleanup as account-bound. Settings/auth owners should agree a reachable change-password design before exposing it. **Close:** deferred-unbind test: A sign-out → B login → old cleanup resolves; B remains signed in and no B push binding is removed. Root settings review should deduplicate this shared-store finding.

### AUTH-011 — P3 — Production login spends substantial space on unavailable providers

**Class:** reasoned UX critique, not broken OAuth proof. **Location:** `LoginScreen.tsx:284-307`, `SignUpScreen.tsx:251-267`, `AuthProviderButton.tsx:34`; `featureFlags.ts:35`.

Both Google and Apple rows remain visibly disabled in production. Clear “unavailable” labels and disabled accessibility state are honest, but two dead actions dominate the small form, especially signup where they precede email registration. Hide the unavailable group (and divider) or use a compact explicit availability note if product research justifies it. Keep providers gated until credential/callback evidence exists. Owner: auth UX. Close: approved production composition and small-screen review; staging enabled-provider cancellation/error/success smoke remains separate.

### AUTH-012 — P3 — Smaller consistency/accessibility defects need focused cleanup

**Class:** confirmed source issues and bounded design critique. **Locations:** `EmailVerificationScreen.tsx:77` accepts six/seven digits despite eight-digit config/copy/maxLength; `ResetPasswordScreen.tsx:59,165` has no title and always shows a checked twelve-character requirement even for blank/short values; `SplashScreen.tsx:47-104` always animates with no Reduce Motion lookup.

Use one OTP-length contract, a visible reset heading, requirements that actually reflect input, and a reduced-motion splash path. Several text-only actions (forgot-password, signup/login footer, resend and legal text links) lack an explicit 44-point target; actual hit frames and screen-reader focus need device inspection. Signup's manual validation text also omits shared Input's error/live-region treatment and red border, unlike the governing spec. “Full name” is unnecessary for a public food profile when a display name is sufficient; clarify collection purpose. Owner: auth UX/accessibility engineer. Close: focused form/accessibility checks; do not treat every polish item as a release blocker.

## States, backend paths and security coverage

| Flow/state | What the source establishes | What still needs verification |
|---|---|---|
| Fresh launch / returning guest | Splash waits for auth-ready, timer clears; new onboarding vs guest home explicit | Auth restore duration/offline hard cases, no indefinite-looking splash |
| Email login / invalid credentials / unconfirmed | Central validation, generic invalid login copy, real Supabase sign-in, profile apply and session updates | AUTH-002/005/009; revoked/expired tokens on actual device |
| Signup confirmation required / auto-confirm | Null session goes to verification; active session proceeds onboarding; terms/privacy URLs allowlisted | Hosted confirm policy, delivery/template eight-digit token, duplicate-email privacy response |
| OTP empty / malformed / expired / resend | Digits filtered, eight max, missing-email redirect, 60s local resend countdown; `verifyOtp(type:'signup')` establishes session | Length mismatch, concurrent calls, background clock; server expiry is not pinned in config despite UI “60 minutes”; deployment proof |
| Forgot password / no account | Generic send response reduces email-existence disclosure; true service reset-email call | Hosted throttles/SMTP; no phishing/trusted-link certification inferred |
| Reset cold/warm/code missing/used/failed | Separate `hungry://auth/reset` path, safe code parser, PKCE exchange, fragment rejection; update requires server session | Same-device PKCE verifier persistence, cross-device mail opens, AUTH-003/004, old callback compatibility |
| Email-confirm callback | Explicitly routes Login; deliberate design expects a subsequent sign-in rather than implicit access | Hosted link actually confirms and returns, invalid-link messaging; no claim this path automatically authenticates |
| OAuth | Production flag disables providers; trusted callback/state checks inspected in service; PKCE and SecureStore-backed auth client | Provider credentials, cancellation and real device callback lifecycle only in enabled environments |
| Sign-out/session expiry/account changes | Account-scoped stores reset and token storage kept outside metadata persistence; bootstrap reconciles known null sessions | AUTH-010, stale profile hydration and store cleanup under rapid account transitions; hosted token revocation |
| Errors/offline/a11y | Error boundaries, local field errors, password visibility labels, OTP one-time-code hint, shared Button busy semantics exist | Boundaries catch rendering errors, not async failures; no network retry queue desired for credential mutations; screen reader/focus, keyboard, contrast and font scaling need smoke |

No server-side auth bypass, SQL authorization exploit, token exfiltration or hosted compromise was established. Local config and code cannot certify deployed RLS, redirect configuration, rate limiting or SMTP. `ChangePassword` reauth is a sensible security intent, but misclassifies all reauth errors as wrong-current-password (`supabaseService.ts:3002`), including connectivity; distinguish transport failures when implementing it. Password composition policy is a product/security tradeoff; do not claim longer/more complicated alone proves better protection.

## Comparison with current first-party app documentation

Sources browsed 20 October 2026; these are documentation comparisons, not claims of having operated competitors' current apps.

| Reference | Documented pattern | Hungry judgment / keep or change |
|---|---|---|
| [Burpple password recovery](https://help.burpple.com/hc/en-us/articles/4424128709389-How-can-I-reset-my-password-for-my-Burpple-account) | Explains account email → verification email and offers a support escalation path | Hungry's direct Forgot Password entry is fewer steps than the documented Tridentity/password-login route. Keep that simplicity; add clear sent/update states and a real failure/help path. Do not imitate extra identity-provider steps. |
| [Spotify reset/change troubleshooting](https://support.spotify.com/in-en/article/reset-password/) | Separates change-password from forgotten-password; gives missing-email, old-email, invalid-link and too-many-request recovery guidance | Hungry has both screen implementations but only reset has a discovered user entry. Its error toast often says only “try again.” Keep the same password visibility/confirm affordances; provide specific recovery when retry cannot work. Spotify's account/email requirements also demonstrate why a fake resend state is harmful. |
| [Google account recovery](https://support.google.com/accounts/answer/7682439?hl=en-en) | Provides distinct routes for forgotten password, forgotten email and other sign-in failures, with ownership checks | Hungry should match clarity of the next action, especially unconfirmed email, without expanding into Google's much larger identity-recovery system. Keep generic account-existence responses and server ownership verification; give a contextual secure next step instead of a dead-end toast. |

**Honest assessment:** understandable basic forms, consistent shared brand components, explicit guest option and truthful production provider disabling are strengths. Reliability and status integrity fall below these documented reference patterns. Auth is also generic “food lovers” branding rather than a concise explanation of why signing in preserves dishes/taste; improving that value statement is lower priority than preserving those choices in code. Current visual quality cannot be graded honestly without rendered device evidence.

## Verification record and prioritized closeout

- Root `npm run typecheck`: **failed**, including the two Change Password signature errors and five email-hook compilation errors. No claim the latter are caused by these pages.
- Root `npm test`: **695 total, 692 pass, 1 fail, 2 skipped**; sole failure is the Change Password production-boundary import. Most inspected auth guards are source-text assertions; their passing status does not cover guest event ordering or real recovery interactions.
- Focused read-only validator repro: **passed** as a defect demonstration, using `typescript.transpileModule` on the actual helper and RHF-shaped second argument; no app mutation/network.
- Token contrast calculation: **passed** as a deterministic calculation; white/light-orange 3.69:1, white/dark-orange 2.80:1.
- Root browser smoke: **blocked before meaningful execution**, missing Playwright browser executable; nine cases report failure for that infrastructure reason. No simulator or authenticated end-to-end result claimed here.

Priority: (1) resolve AUTH-001 and root gate failures; (2) protect guest preference transfer and recovery transaction state; (3) add asynchronous exclusion/progress and credible unconfirmed-email recovery; (4) fix keyboard/autofill/contrast and remove fake success actions; (5) reconcile the auth design/OTP contract and obtain targeted device evidence.

Production auth screens remain release-relevant even though social/merchant/OAuth features are gated. OAuth readiness is a separate enabled-environment question. Change Password is user-reachable from Edit Profile and eagerly imported; the original no-caller subclaim was rejected by independent cross-check. Independent reviewer should cross-check AUTH-002 event ordering and AUTH-004 recovery transitions before final severity aggregation; source tests alone cannot close them.
