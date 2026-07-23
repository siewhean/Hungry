# Hungry App Final Pre-Launch Go / No-Go

Updated: 2026-07-23  
Final status: **No-Go**

## 1. Current change lines

| PR | Purpose | State |
|---|---|---:|
| #44 | Mandatory authentication, fail-closed session/configuration behavior, authenticated read-only Excel catalog fallback, catalog reconciliation | open / implementation and verification incomplete |
| #45 | Repository organization, current documentation, stale PR closure, generated-output cleanup | draft / verification incomplete |

Both branches start from current `main` but overlap in policy documentation. Rebase/update and resolve deliberately before either merge. Do not let #45 overwrite newer runtime-specific #44 content.

## 2. Store-readiness repository drafts

| Workstream | Status | Evidence |
|---|---:|---|
| ASO metadata drafts | repo-complete draft | `tasks/Roadmap/app-store-submission-qc-report.md`, `tasks/Roadmap/google-play-submission-qc-report.md` |
| Reviewer-note template | repo-complete draft | store submission reports and policy checklist |
| Store policy checklist | repo-complete draft | `tasks/Roadmap/app-store-google-play-prelaunch-qaqc-checklist.md` |
| Data Safety / App Privacy mapping | repo-complete draft | `tasks/Roadmap/app-store-data-safety-mapping.md` |
| Release evidence template | repo-complete draft | `tasks/release-evidence/full-audit-v1.example.env` |
| Local release checklist wiring | repo-complete draft | `scripts/release_ready_checklist.sh` |

Repo-complete means the repository contains a draft, checklist, contract or evidence template for owner review. It does **not** mean the active implementation is green, the native binaries were tested, the store consoles were completed, the live Supabase project passed, or legal/privacy approval exists.

## 3. Mandatory product gates

The approved flow is:

```text
Splash → Onboarding → Create Account / Sign In → verification when required → authenticated app
```

The following must be proven on the final reconciled commit:

- [ ] No guest/skip/session bypass exists.
- [ ] MainTabs and all app data surfaces remain unmounted before authentication.
- [ ] A valid SecureStore-backed Supabase session is required for restoration.
- [ ] Signed-out, missing, invalid and revoked sessions return to auth and clear account-scoped state.
- [ ] Missing production Supabase configuration blocks app entry.
- [ ] Supabase remains authoritative for authentication and every shared write.
- [ ] Excel is available only to an already authenticated user for eligible catalog network/RPC/release outages.
- [ ] Successful empty searches remain no-results.
- [ ] Excel fallback exposes no write path and no failed write appears successful.
- [ ] Deep links, return routes, feature flags, merchant roles and admin roles cannot be bypassed.

## 4. Repository-local gates

No current reconciled branch has complete green evidence. GitHub Actions for recent #44/#45 commits have failed before returning usable job steps/logs, and this audit environment has no local checkout to run the commands.

| Gate | Current status |
|---|---:|
| Typecheck | pending current reconciled commit |
| Lint | pending current reconciled commit |
| Format check | pending current reconciled commit |
| Unit/integration/source contracts | pending current reconciled commit |
| Full Playwright | pending mandatory-auth suite and runnable localhost environment |
| Merchant/admin Playwright | pending current roles/environment |
| Expo Doctor | pending current environment and accepted external-check evidence |
| Asset audit | pending current reconciled commit |
| Supabase static audit | pending current reconciled commit |
| Edge Function check | pending current reconciled commit |
| npm audit | pending current lockfile/registry access |
| Gitleaks | pending current branch |
| TruffleHog | pending current branch |
| Release-ready local | pending all preceding gates |
| Database location/search/RLS smoke | pending approved staging configuration |
| Security/Performance Advisor | pending owner-controlled Supabase evidence |

Historical passes are useful context but do not certify the new mandatory-auth and cleanup diffs.

## 5. Native and runtime gates

| Evidence | Status |
|---|---:|
| Fresh install → onboarding → mandatory account | missing current build proof |
| Valid session restore | missing current build proof |
| Failed auth/verification/recovery | missing current build proof |
| Signed-out and revoked-session denial | missing current build proof |
| Supabase healthy catalog | missing current build proof |
| Authenticated targeted catalog outage | missing current build proof |
| Signed-out outage with no Excel access | missing current build proof |
| Missing release configuration block | missing current build proof |
| Legitimate no-results | missing current build proof |
| iOS VoiceOver / large text / reduced motion | missing |
| Android TalkBack / large text / reduced motion | missing |
| iOS EAS/TestFlight artifact | missing |
| Android EAS/AAB/pre-launch report | missing |

## 6. External required evidence

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
| live Supabase RLS/storage/function smoke | missing |
| Supabase Advisor owner proof | missing |
| Sentry staging error/source-map/release proof | missing |
| full-platform UGC moderation proof | missing |
| merchant/admin RBAC live proof | missing |
| SMTP/auth email delivery proof | missing |
| legal/privacy sign-off | missing |
| documented rollout/rollback owner proof | missing |

## 7. Apple account requirement risk

Hungry currently requires authentication before app entry. App Review notes must explain the significant account-based core functionality truthfully: synced taste/profile state, personalised recommendations, saved content, reviews/posts, privacy and moderation identity, and cross-device continuity. This does not guarantee Apple acceptance; any reviewer objection requires owner/product/legal response rather than silently reintroducing guest mode.

## 8. Required final verification

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

Then complete current iOS and Android preview/production-candidate builds, device/simulator scenarios, store-console declarations and external approvals.

## 9. Verdict

The repository is better organised and the active mandatory-auth/catalog direction is clearer, but Hungry is not ready for production or store submission. The correct status is **No-Go** until #44 and #45 are reconciled, every repository-local gate passes, current native evidence exists, live Supabase/security proof passes, and all store, monitoring, image-rights and legal/privacy evidence is attached.
