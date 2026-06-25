# Project Security Strict Audit - 2026-06-24

Scope: entire Hungry repository, mobile app, Supabase backend files, Edge Functions, CI/security gates, and public website code. This is a repo-local static/security-gate audit. It did not mutate production services or print secret values.

Remediation update, 2026-06-25: all locally actionable findings from this report have been addressed in the repository. The remaining items are external/manual proof gates: dirty worktree reconciliation, production deployment-env proof, Supabase dashboard proof, and Sentry unresolved proof when a token is exported in the active shell.

Codex Security note: the plugin's full exhaustive mode expects per-file/candidate ledgers and app scan artifacts. This pass used the available repo-local path and validated findings with direct commands. Treat this as a strict issue register, not a completed exhaustive Codex Security workspace scan.

## Executive Summary

Verdict: **Repo-local security hardening complete for the listed actionable findings, but not public-launch clean until external proof and dirty-worktree reconciliation are done.**

What passed:
- Root dependency audit: `npm run security:audit` -> 0 moderate+ vulnerabilities.
- Root TypeScript/lint/tests: `npm run typecheck`, `npm run lint`, and `npm run test` -> pass.
- Supabase static audit: `npm run audit:supabase:static` -> pass; 91 migrations, 117 created tables, no missing RLS detected.
- Supabase RLS smoke: `npm run smoke:database:rls` -> pass, including anonymous negative checks for service-only tables.
- Edge Function static check: `npm run check:edge-functions` -> pass.
- Website route security contracts: `npm --prefix marketing/website/web-v2 run security:audit` -> pass.
- Website dependency audit after lockfile update: `npm --prefix marketing/website/web-v2 audit --audit-level=moderate` -> 0 vulnerabilities.
- Nonignored-file gitleaks scan: `npm run security:gitleaks` -> scanned tracked plus unignored untracked files below the 25 MB per-file cap and found no leaks. One large OSM binary was intentionally skipped by gitleaks and remains covered by TruffleHog.
- TruffleHog full repo scan: `npm run security:trufflehog` -> 4.34 GB scanned, 0 verified/unverified secrets.
- Tracked env templates contain blank secret placeholders rather than committed secret values in the scanned output.

Remaining blockers/improvements:
- Release/security proof remains incomplete while EAS/store/Supabase-dashboard/production-secret gates are external or skip when credentials are absent.
- The repo still has a broad dirty worktree from ongoing release work; do not deploy/push as a release candidate until it is reconciled into reviewed commits.
- Live Sentry unresolved proof is wired but skipped locally unless `SENTRY_AUTH_TOKEN` or `SENTRY_AUTH_TOKEN_2` is exported in the active shell.

## Commands Run

| Command | Result | Evidence |
|---|---:|---|
| `npm run security:audit` | Pass | `found 0 vulnerabilities` |
| `npm run audit:supabase:static` | Pass | no missing RLS; 302 policies; anon write policy limited to website waitlist insert |
| `npm run check:edge-functions` | Pass | `Edge Function static checks passed.` |
| `npm --prefix marketing/website/web-v2 run security:audit` | Pass | `Website security route contracts passed.` |
| `npm --prefix marketing/website/web-v2 audit --audit-level=moderate` | Pass | after `audit fix`: `found 0 vulnerabilities` |
| `npm run security:gitleaks` | Pass | nonignored-file scan below 25 MB/file cap; latest run scanned 1,569 files / ~43.8 MB, skipped one large OSM binary, no leaks |
| `npm run security:trufflehog` | Pass | scanned ~4.34 GB, `verified_secrets: 0`, `unverified_secrets: 0` |
| `npm --prefix marketing/website/web-v2 run env:validate` | Skipped | skipped unless deployment proof env is set |
| `npm run smoke:database:rls` | Pass | service-only anonymous reads returned zero rows or 401; anonymous writes rejected |
| `npm run typecheck` | Pass | app TypeScript check excludes Deno Edge Function runtime files |
| `npm run lint` | Pass | app ESLint passed |
| `npm run test` | Pass | 541 passed, 2 skipped |
| `npm --prefix marketing/website/web-v2 run lint` | Pass | website ESLint passed |
| `npm run monitoring:sentry:unresolved` | Skipped locally | token not exported in active shell; required mode fails closed in release gate |

## Remediation Status - 2026-06-25

| ID | Status | Resolution | Current Verification |
|---|---|---|---|
| SEC-001 | Fixed | Ran `npm --prefix marketing/website/web-v2 audit fix` and kept the package manifest stable while updating the lockfile. | `npm --prefix marketing/website/web-v2 audit --audit-level=moderate` -> 0 vulnerabilities; website lint/security contracts pass. |
| SEC-002 | Fixed | Replaced staged-only release gitleaks with `scripts/run-gitleaks-nonignored.mjs`, which scans tracked plus unignored untracked files below a 25 MB per-file cap. Kept staged protect as `security:gitleaks:staged`; large binary coverage is handled by TruffleHog. | `npm run security:gitleaks` scanned 1,569 files / ~43.8 MB, skipped one large OSM binary, and found no leaks; `npm run security:trufflehog` remains the large-file/history scan. |
| SEC-003 | Partially fixed / external | CI now fails closed for main-branch Supabase dry-run and EAS build proof when required credentials are absent. Local release checklist has required-mode deployment env and Sentry proof commands. Store/EAS/dashboard proof remains external. | CI config updated; local external credentials still required before launch. |
| SEC-004 | Fixed | Extended `scripts/smoke_rls.mjs` with service-only negative checks. It accepts RLS-filtered 200 responses only when anonymous reads return zero rows, and still requires anonymous writes to be denied. | `npm run smoke:database:rls` -> pass. |
| SEC-005 | Fixed repo-side | Removed `// @ts-nocheck` from all Supabase Edge Functions and made `scripts/check-edge-functions.mjs` fail on future reintroduction. Root app `tsconfig` excludes Deno Edge Functions from app `tsc`; Edge Functions remain covered by the dedicated static gate. | `npm run check:edge-functions` -> pass; `npm run typecheck` -> pass. |
| SEC-006 | Fixed | Account deletion worker no longer returns `userId` or raw per-request error details in routine JSON responses. Internal failure details still go to the protected processing/audit path. | `npm run check:edge-functions` -> pass; source diff verified. |
| SEC-007 | Fixed | Removed local `.DS_Store`, `.watchman-cookie-*`, and `supabase/.temp` files. Added `scripts/check-release-hygiene.mjs` and wired it into release readiness. | `npm run security:release-hygiene` -> pass. |
| SEC-008 | Remaining release blocker | Not safe to auto-resolve because the dirty files include broader user/agent work outside this security pass. Must be organized into reviewed commits or stashes before release. | `git status --short` still dirty. |
| SEC-009 | Fixed | Retired legacy `marketing/web` waitlist API route with HTTP 410 and added `scripts/check-legacy-marketing-web.mjs` to prevent service-role key references returning there. | `npm run security:legacy-web` -> pass. |
| SEC-010 | Partially fixed / external | Release checklist now includes required-mode production env validation. Actual proof requires deployment environment variables. | `HUNGRY_REQUIRE_DEPLOY_ENV_PROOF=1 HUNGRY_DEPLOY_ENV=production npm --prefix marketing/website/web-v2 run env:validate` must run in deployment/proof shell. |
| SEC-011 | Manual proof required | Supabase dashboard controls cannot be proven from repo-local source. | Capture dashboard/advisor/backups/Auth evidence before public launch. |
| SEC-012 | Wired / external token required | Added `scripts/check-sentry-unresolved.mjs` and `monitoring:sentry:unresolved`; release required mode fails closed if token is missing or unresolved issues exist. | Local run skipped because no Sentry token was exported in this shell. |

## Findings

| ID | Severity | Area | Issue | Evidence | Recommended Fix | Verification |
|---|---|---|---|---|---|---|
| SEC-001 | P1 | Website dependencies | Fixed. `web-v2` dependency audit no longer reports moderate+ advisories after the lockfile update. | Initial audit found `js-yaml` and `@babel/core` advisories; current audit is clean. | Keep `npm --prefix marketing/website/web-v2 audit --audit-level=moderate` in release checks. | `npm --prefix marketing/website/web-v2 audit --audit-level=moderate` -> 0 vulnerabilities. |
| SEC-002 | P1 | Secret scanning | Fixed. Local release gitleaks now scans tracked plus unignored untracked files below its 25 MB per-file cap instead of staged-only content. | `scripts/run-gitleaks-nonignored.mjs`; latest run scanned 1,569 files / ~43.8 MB, skipped one large OSM binary, and found no leaks. | Keep pairing `npm run security:gitleaks` with `npm run security:trufflehog` for large-file/history coverage. | `npm run security:gitleaks`; `npm run security:trufflehog`. |
| SEC-003 | P1 | Release gates | Production security proof can still be skipped or remain external: Supabase dry-run skips without credentials, EAS skips without `EXPO_TOKEN`, deployment env validation skips unless proof flags are set. | `.github/workflows/ci.yml` has credential-skipping gates; `tasks/Roadmap/app-final-go-no-go-checklist.md` still records `PRODUCTION_SECRET_PROOF=0` | For release branches, require proof flags/credentials or mark release blocked. Add a release-only CI job that fails closed when production proof env vars are missing. | `npm run release:ready:local`; CI run with proof envs; updated go/no-go checklist |
| SEC-004 | P1 | Supabase RLS verification | Fixed. Service-only tables now have negative live REST smoke coverage. Anonymous reads must return zero rows or a denied status; anonymous writes must be denied. | `scripts/smoke_rls.mjs` service-only table checks. | Keep this smoke in release gates and add tables to the list when new service-only surfaces appear. | `npm run smoke:database:rls` -> pass. |
| SEC-005 | P1 | Edge Functions | Fixed repo-side. Edge Function `@ts-nocheck` bypasses were removed and future reintroduction fails the Edge Function static check. | `scripts/check-edge-functions.mjs` rejects `// @ts-nocheck`; source functions no longer contain it. | Add Deno-native type checks later if the CI image supports Deno. | `npm run check:edge-functions`; `npm run typecheck`. |
| SEC-006 | P1 | Account deletion worker | Fixed. The account deletion worker no longer returns `userId` or raw per-request error text in routine responses. | `supabase/functions/process-account-deletions/index.ts` now returns request IDs/status only. | Keep detailed failure data only in protected processing/audit paths. | `npm run check:edge-functions`; source diff. |
| SEC-007 | P1 | Repo hygiene | Fixed. Ignored metadata files were removed and release hygiene now fails if Finder/watchman/Supabase temp files reappear. | `scripts/check-release-hygiene.mjs`; `supabase/.temp` removed locally. | Keep `npm run security:release-hygiene` in release gates. | `npm run security:release-hygiene` -> pass. |
| SEC-008 | P1 | Release integrity | The worktree is broadly dirty with many modified/untracked/deleted files before this audit. That blocks trustworthy security closeout because reviewed code may not match what is deployed or pushed. | `git status --short` showed modified env templates, app files, docs, tests, Supabase migration, and many untracked page-agent files | Reconcile into organized commits or stashes before release. Do not deploy from an unreconciled dirty checkout. | `git status --short` clean or intentionally scoped before release |
| SEC-009 | P1 | Legacy website surface | Fixed. The older `marketing/web` waitlist route is explicitly retired and returns HTTP 410; service-role waitlist behavior was removed. | `marketing/web/app/api/waitlist/route.ts`; `marketing/web/README.md`; `scripts/check-legacy-marketing-web.mjs`. | Keep `marketing/web` retired or bring it under full active-site gates before any deployment. | `npm run security:legacy-web` -> pass. |
| SEC-010 | P2 | Deployment env proof | `web-v2` deployment env validation is present but skipped locally without proof flags. This is correct for dev but leaves production proof manual. | `npm --prefix marketing/website/web-v2 run env:validate` skipped without `HUNGRY_REQUIRE_DEPLOY_ENV_PROOF=1` / `VERCEL_ENV` | Add a documented production verification command and run it in CI/deploy with `HUNGRY_REQUIRE_DEPLOY_ENV_PROOF=1`. | `HUNGRY_REQUIRE_DEPLOY_ENV_PROOF=1 HUNGRY_DEPLOY_ENV=production npm --prefix marketing/website/web-v2 run env:validate` |
| SEC-011 | P2 | Supabase dashboard controls | Some controls cannot be proven from repo alone: leaked-password protection, MFA posture, backup/PITR, storage bucket dashboard settings, and advisor status after deploy. | Prior release docs list Supabase Auth leaked-password protection as dashboard proof item | Capture dashboard screenshots/exported advisor output and store redacted evidence in release docs. | Supabase Advisor/security evidence attached; release checklist updated |
| SEC-012 | P2 | Monitoring proof | Sentry unresolved queue was previously cleared, but the next build/runtime smoke should re-check it. | `tasks/verification.md` records Sentry cleanup; no new Sentry query was run in this audit | Add Sentry unresolved check to post-smoke release routine without generating synthetic unresolved issues that remain open. | `npx sentry-cli issues list --org hungry-3z --project react-native --query is:unresolved` |

## Security Strengths Observed

- Website Console access uses env-backed Basic Auth with constant-time comparison and fails closed when credentials are missing.
- Merchant routes have cookie-backed session handling, same-origin checks, CSRF header/cookie validation, JSON content-type checks, and login rate limiting.
- Supabase service-role usage in `web-v2` is centralized in server-side code and the website security contract forbids service-role key usage elsewhere in `src`.
- Supabase security-definer functions reported by the static audit include `search_path` coverage.
- TruffleHog did not find verified or unverified secrets in the local repo scan.
- `.gitignore` covers `.env.local`, `.env.*.local`, `.DS_Store`, `.watchman-cookie-*`, and `supabase/.temp/`.

## Priority Fix Plan

### P0 - Must Fix Before Public Launch

No repo-local P0 exploit survived this pass. Public launch should still remain blocked until the P1 items below and external proof gates are resolved.

### P1 - Fix Before Launch Candidate

1. Reconcile the dirty worktree into organized commits before deploy/push.
2. Keep `npm run security:gitleaks` and `npm run security:trufflehog` paired in release gates because gitleaks intentionally skips very large binaries.
3. Collect the external proof gates listed below before launch candidate.

### P2 - Improve After Launch Candidate

1. Make production env validation fail-closed in deployment/release proof mode.
2. Attach Supabase dashboard proof for leaked-password protection, backups, and advisor status.
3. Re-run Sentry unresolved checks after each native/web release smoke.
4. Run the full Codex Security workspace scan with candidate ledgers for exhaustive coverage.

## Suggested Commands

```bash
npm --prefix marketing/website/web-v2 audit fix
npm --prefix marketing/website/web-v2 audit --audit-level=moderate
npm --prefix marketing/website/web-v2 run lint
npm --prefix marketing/website/web-v2 run build
npm --prefix marketing/website/web-v2 run security:audit
```

```bash
gitleaks detect --redact --source .
npm run security:trufflehog
npm run audit:supabase:static
npm run check:edge-functions
```

```bash
find . -path './node_modules' -prune -o -path './.git' -prune -o \
  -path './marketing/website/web-v2/node_modules' -prune -o \
  \( -name '.DS_Store' -o -name '.watchman-cookie-*' -o -path './supabase/.temp/*' \) -print
```

## Manual Proof Still Required

- Supabase Auth leaked-password protection and MFA posture.
- Supabase backup/PITR and advisor status in the linked project after deploy.
- App Store Connect and Google Play data/privacy/account-deletion evidence.
- EAS Android/iOS preview or production build artifacts.
- Production environment secret proof for website, mobile, Supabase, Sentry, and EAS.
