# App Security QC Report

Updated: 2026-06-21  
Status: **No-Go until live and external proof is attached.**

## Repo-Side Checks

| Area | Status | Evidence |
|---|---:|---|
| service-role client exposure | static gate required | `security-hardening.test.ts`, prelaunch contracts |
| token storage | source-ready | SecureStore auth adapter |
| logout cleanup | source-ready | session store clears account-scoped stores |
| media upload validation | source-ready | Supabase media upload validation |
| deep-link safety | source-ready | linking contracts |
| supply-chain audit | pass | `npm audit --audit-level=moderate` reports 0 vulnerabilities; gitleaks and TruffleHog pass |
| Supabase RLS/storage/OCR | pass for current smoke scope | live full-audit, location, search, RLS, social/gamification, chat, OCR, and canonical food-business staging smokes |

## No-Go Blockers

- npm audit proof is attached in the latest prelaunch rerun: 0 vulnerabilities.
- Live RLS/storage/OCR smoke proof is attached for current service-role smoke scope.
- Supabase app-owned Advisor proof is attached; Supabase Auth leaked-password protection remains a dashboard proof item.
- Sentry issue access and cleanup proof is attached: `SENTRY_AUTH_TOKEN_2` listed unresolved groups, resolved 28 release/smoke/proof groups, and the unresolved queue now returns `No issues found`.
- Store production secrets/EAS env proof is not attached.

## Latest Command Evidence

- `npm run security:gitleaks` -> pass, no leaks found.
- `npm run security:trufflehog` -> pass, 0 verified and 0 unverified secrets.
- `npm audit --audit-level=moderate` -> pass, found 0 vulnerabilities.
- `npm run audit:supabase:static` -> pass.
- `npm run check:edge-functions` -> pass.
