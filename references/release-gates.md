# release-gates.md — Hungry Store Submission Gates

## Scope

This checklist is the canonical release gate for Apple App Store and Google Play submission readiness.

## Required Technical Gates

1. `npm run typecheck` passes.
2. `npm test -- --watch=false` passes.
3. `NPM_CONFIG_CACHE=/tmp/hungry-npm-cache npx expo-doctor` passes.
4. Manual app smoke on iOS and Android for critical paths:
- Auth (login/signup/forgot/reset)
- Discover -> Stall -> Dish navigation
- Review creation and submission
- Post composer open/create/cancel flow

## Required Product/Policy Gates

1. No reviewer-visible mock/placeholder behavior in release path.
2. App metadata accurately reflects shipped features and flows.
3. Privacy policy is public, accessible, and linked in-app.
4. Account deletion requirement is satisfied (in-app and external web path) when account creation exists.
5. Google Play Data safety answers are consistent with real app behavior.

## Required Evidence Surfaces

1. `tasks/backlog.md` rows for release blockers are updated with status.
2. `tasks/verification.md` includes dated rows for latest gate runs.
3. `tasks/session-log.md` includes release work log entries.

## Verdict

- `Go`: all gates pass, no open ship blockers.
- `Conditional Go`: only explicitly waived non-blocking items remain.
- `No-Go`: any ship blocker is open or evidence is missing.
