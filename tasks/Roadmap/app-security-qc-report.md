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
| Supabase RLS | pending live proof | static + smoke scripts |

## No-Go Blockers

- npm audit proof is attached in the latest prelaunch rerun: 0 vulnerabilities.
- Live RLS/storage smoke is not attached.
- Supabase Advisor owner proof is not attached.
- Sentry staging crash proof is not attached.
- Store production secrets/EAS env proof is not attached.

## Latest Command Evidence

- `npm run security:gitleaks` -> pass, no leaks found.
- `npm run security:trufflehog` -> pass, 0 verified and 0 unverified secrets.
- `npm audit --audit-level=moderate` -> pass, found 0 vulnerabilities.
- `npm run audit:supabase:static` -> pass.
- `npm run check:edge-functions` -> pass.
