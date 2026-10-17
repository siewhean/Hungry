# Hungry Playwright Pre-Launch Report

> Product policy: mandatory authentication; no guest mode.  
> Runtime implementation line: PR #44  
> Status: **No-Go / verification pending.**

Playwright covers Expo web and the web workspaces. It does not prove native iOS/Android permissions, lifecycle, secure storage, deep links, media loading, accessibility, or store binaries.

## Required suites

| Scenario | Current or target coverage | Required result |
|---|---|---|
| Fresh onboarding → mandatory auth | `tests/e2e/mandatory-onboarding-auth.spec.ts` on PR #44 | No guest/skip path; app shell absent before auth |
| Auth failure/success | auth suites and helpers | Failed auth stays signed out; successful real/mock test auth opens only the permitted test shell |
| Protected routes/deep links | route/auth-gate suites | Signed-out route becomes onboarding/login; malformed or unsafe return route discarded |
| Production feature flags | `tests/e2e/production-route-gating.spec.ts` and source contracts | No developer/prototype/disabled merchant/social route exposure |
| Search/discovery/detail | route/search/catalog suites | Paged, deduplicated, real no-results, safe missing IDs |
| Authenticated catalog outage | `tests/e2e/authenticated-excel-fallback.spec.ts` on PR #44 | Target catalog RPC failure only; auth remains valid; Excel reads work; writes do not falsely succeed |
| Signed-out outage | mandatory-auth/fallback suites | No MainTabs, catalog, details, or fallback access |
| Reviews/posts/profile | feature suites | Supabase/service-backed success, failure rollback, cross-user evidence where staging is used |
| Merchant/admin RBAC | merchant/admin web and app route suites | Correct role passes; consumer/wrong merchant fails |
| Accessibility smoke | scoped web accessibility tests | Names, roles, focus, keyboard and obvious contrast/layout defects |
| Public website/SEO | website workspace Playwright/contracts | Public pages, private route isolation, forms, metadata and navigation |

The historical `tests/e2e/guest-browsing.spec.ts` name and guest expectations are obsolete. PR #44 must replace or rename the runtime suite; PR #45 only corrects documentation and repository policy.

## Execution requirements

Run from a checkout that can bind localhost:

```bash
npm run test:e2e
npm run test:e2e:merchant-catalog
```

For staging-backed suites, provide owner-controlled credentials through the approved environment/secret mechanism. Do not put credentials in test source or prompts.

Collect on failure:

- Playwright trace;
- screenshot and video;
- browser console and page errors;
- network requests/responses with secrets redacted;
- test project, commit SHA, environment and account role.

## Current evidence

The repository has a Playwright server configuration and prior focused merchant-catalog evidence, but the current #44/#45 state has not produced a complete green Playwright run. GitHub Actions for the active branches have also failed before returning usable step logs.

Therefore:

- previous guest-era evidence is not current release proof;
- prior focused passes do not certify the mandatory-auth implementation;
- no Playwright suite is marked current-pass in this report until rerun on the reconciled branch.

## Exit criteria

- [ ] PR #44 and PR #45 are sequenced/reconciled against current `main`.
- [ ] Obsolete guest suites and helpers are removed or renamed.
- [ ] All required Chromium/mobile-web projects pass.
- [ ] Authenticated fallback uses targeted RPC interception rather than disabling authentication.
- [ ] Legitimate no-results remains empty.
- [ ] Production route and role gates pass.
- [ ] Traces/screenshots are attached for resolved failures where useful.
- [ ] Native Maestro/device evidence is recorded separately.

Final status remains **No-Go** until these checks pass.
