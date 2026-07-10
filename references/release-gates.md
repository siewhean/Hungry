# release-gates.md — Hungry Store Submission Gates

## Scope

This checklist is the canonical release gate for Apple App Store and Google Play submission readiness.

## Required Technical Gates

1. `npm run typecheck` passes.
2. `npm run test` passes.
3. `npm run audit:supabase:static` passes.
4. `npm run audit:supabase:advisor-security` passes with no unexpected app-owned Advisor findings.
5. `HUNGRY_SUPABASE_ADVISOR_FAIL_ON_EXTERNAL=1 npm run audit:supabase:advisor-security` passes after Supabase Support/Dashboard actions clear the currently known external Advisor findings.
6. `npm run check:edge-functions` passes.
7. `npm run audit:assets` passes.
8. `npm run security:trufflehog` passes.
9. `npm run security:audit` passes.
10. `CI=1 NPM_CONFIG_CACHE=/tmp/hungry-npm-cache npx expo-doctor .` passes.
11. `npm run smoke:native:ios:prepared` passes on a prepared simulator/device.
12. Android evidence is attached separately: preview APK artifact proof, install/device smoke proof, Play internal-track proof, and production proof.
13. Live Supabase behavior smokes pass for chat/DM, social/gamification, Full Audit V1 readiness, and OCR.

## Required Product/Policy Gates

1. No reviewer-visible mock/placeholder behavior in release path.
2. App metadata accurately reflects shipped features and flows.
3. Privacy policy is public, accessible, and linked in-app.
4. Account deletion requirement is satisfied in-app and through a public external web path when account creation exists.
5. Apple App Store Connect privacy labels are consistent with real app behavior.
6. Google Play Data Safety and account-deletion answers are consistent with real app behavior.
7. Reviewer access/test steps are available for gated/authenticated flows.
8. Supabase leaked-password protection and remaining Security Advisor items are resolved or explicitly accepted by the owner with documented rationale.

## Required Evidence Surfaces

1. `tasks/backlog.md` rows for release blockers are updated with status.
2. `tasks/verification.md` includes dated rows for latest gate runs.
3. `tasks/session-log.md` includes release work log entries.
4. `tasks/Roadmap/claude-full-project-audit.md` names any remaining No-Go blockers.
5. `npm run release:ready` exits 0 only when local gates pass and every external blocker is backed by `tasks/release-evidence/full-audit-v1.env`.
6. `npm run release:ready:local` can be used for local gate rehearsal without claiming public-launch readiness.

## Verdict

- `Go`: all gates pass, no open ship blockers.
- `Conditional Go`: only explicitly waived non-blocking items remain.
- `No-Go`: any ship blocker is open or evidence is missing.
