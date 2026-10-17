# Hungry App Final Go / No-Go Checklist

Updated: 2026-07-23  
Production status: **No-Go**

## 1. Evidence rule

This file distinguishes historical proof from proof for the final reconciled release commit.

- A prior passing command or binary remains useful history but does not certify new #44/#45 changes.
- A skipped, credential-blocked, simulator-blocked, externally blocked or failing check is not a pass.
- **Go** requires current evidence for the final commit/build plus every required external proof.
- **Go Candidate** may describe a fully green candidate awaiting a small defined external set; the current branches have not reached that state.

## 2. Current change lines

| PR | Scope | Current state |
|---|---|---:|
| #44 | Mandatory auth, session/configuration hardening, authenticated read-only Excel fallback, catalog reconciliation | open; current automated/native/staging proof incomplete |
| #45 | Repository/document organization and safe generated-output cleanup | draft; current automated proof incomplete |

The branches overlap in policy documentation and must be updated/reconciled against `main` before final verification.

## 3. Current mandatory gates

| Gate | Status | Required proof |
|---|---:|---|
| Mandatory onboarding → account flow | pending | fresh install on current iOS/Android builds |
| No unauthenticated MainTabs/content | pending | source, Playwright, native and deep-link proof |
| Secure session restore/invalidation | pending | valid, missing, invalid, revoked and signed-out scenarios |
| Missing production configuration | pending | blocking state; no mock/Excel app-entry bypass |
| Supabase authority for writes | pending | service/RLS/runtime proof; no false local success |
| Authenticated Excel catalog fallback | pending | targeted catalog outage while auth remains valid |
| Legitimate no-results | pending | no unrelated fallback substitution |
| Feature/role/deep-link isolation | pending | consumer, merchant, wrong-merchant, admin/ops matrices |
| Typecheck/lint/format/tests | pending | final reconciled commit |
| Playwright | pending | mandatory-auth, route, catalog, merchant/admin suites |
| Expo Doctor/assets/static audits | pending | final reconciled commit/environment |
| Security scans | pending | npm audit, gitleaks, TruffleHog, Supabase/edge checks |
| Live Supabase proof | pending | RLS/storage/RPC/function/advisor staging evidence |
| iOS current build and smoke | pending | preview/production candidate, TestFlight and native scenarios |
| Android current build and smoke | pending | AAB/internal track/install/pre-launch/native scenarios |
| VoiceOver/TalkBack smoke | blocked | current manual iOS and Android proof |
| Production monitoring proof | blocked | release/source maps, controlled error, alert routing |
| Store/legal/privacy proof | blocked | consoles, policies, URLs, demo account, image rights, sign-off |
| Rollback rehearsal | blocked | OTA, binary, web and database forward-fix/rollback evidence |

## 4. Historical evidence retained for context

| Evidence | Historical status | Current limitation |
|---|---:|---|
| Android/EAS proof | preview artifact pass | `ANDROID_EAS_PROOF=1` records an earlier preview artifact; it does not prove install/device/internal-track/production readiness or the current mandatory-auth commit |
| Earlier iOS simulator smoke | prior development smoke | does not prove current release binary, mandatory auth, fallback or TestFlight |
| Earlier repository checks | previously reported passes | must be rerun after #44/#45 reconciliation |
| Earlier Supabase and monitoring checks | mixed prior evidence | must be tied to the final environment/schema/release and current privacy policy |

## 5. Release evidence keys

These remain conservative. A `1` may represent reusable historical evidence only where the note above says so; the final release decision still requires current-commit linkage.

```text
NATIVE_MAESTRO_IOS_PROOF=0
IOS_EAS_PROOF=0
IOS_RELEASE_BUILD_PROOF=0
TESTFLIGHT_SMOKE_PROOF=0
ANDROID_EAS_PROOF=1
NATIVE_MAESTRO_ANDROID_PROOF=0
PRODUCTION_SECRET_PROOF=0
PRODUCTION_WEBSITE_SECRET_PROOF=1
STORE_CONSOLE_PROOF=0
APP_STORE_CONNECT_PROOF=0
PLAY_CONSOLE_PROOF=0
ASO_METADATA_APPROVAL_PROOF=0
REVIEWER_NOTES_APPROVAL_PROOF=0
STORE_SCREENSHOT_RIGHTS_PROOF=0
STORE_POLICY_CHECKLIST_APPROVAL_PROOF=0
PUBLIC_PRIVACY_URL_PROOF=0
PUBLIC_ACCOUNT_DELETION_URL_PROOF=0
SUPABASE_OWNER_PROOF=0
PUSHED_CI_PROOF=0
DIRTY_WORKTREE_RECONCILED=0
SEC_06_RUNTIME_PROOF=0
SEC_08_RUNTIME_PROOF=0
MER_PORTAL_01_RUNTIME_PROOF=0
MERCH_P0_ANALYTICS_PROOF=0
SENTRY_STAGING_CRASH_PROOF=0
SENTRY_PRODUCTION_SOURCEMAP_PROOF=0
POSTHOG_STAGING_PROOF=0
RELEASE_TRACKING_PROOF=0
ALERT_ROUTING_PROOF=0
POST_COMPOSER_ERROR_BOUNDARY=1
ANDROID_PERMISSIONS_COMPLETE=1
UGC_MODERATION_PROOF=0
ROLLBACK_REHEARSAL_PROOF=0
```

## 6. Repository commands required on the final commit

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

Run current credential-backed Supabase advisor/full-audit checks and current iOS/Android build/device flows separately. Record commit, build ID, environment, account role, steps, evidence and exact result.

## 7. External proof still required

- App Store Connect metadata and App Privacy.
- Google Play listing, Data Safety, content/permissions declarations and pre-launch report.
- Public support, privacy and account-deletion URLs.
- Reviewer/demo account and account-requirement explanation.
- Final screenshot and in-app media rights approval.
- Legal/privacy/community/account-deletion sign-off.
- Owner-controlled production app/web/Supabase/EAS/monitoring secrets and access proof.
- Sentry release/source maps/alert routing and privacy-safe controlled error.
- VoiceOver/TalkBack and representative-device manual QA.
- UGC moderation/report/block/delete proof for every enabled public surface.
- Rollout, stop thresholds, on-call owner and rollback/forward-fix rehearsal.

## 8. Verdict rule

- **Go:** every applicable gate is current-pass and every external proof is attached.
- **Go Candidate:** final commit is green and only a clearly enumerated non-code release action remains.
- **No-Go:** any P0/P1, current test/build/staging/native gap, branch reconciliation gap or required external proof remains.

Current verdict: **No-Go**.
