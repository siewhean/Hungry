# Hungry Release 0.1 — Week 7 Release Candidate

> Status: Prepared, not cut. Week 7 begins only after the closed-beta exit criteria are met.

## Outcome

Create one immutable Release Candidate from a frozen implementation SHA. No feature work enters the candidate. Only release-blocking fixes may replace it, and any replacement resets the affected evidence.

## Freeze rules

- Tag the exact implementation SHA as `release-0.1.0-rc.N`.
- Record a separate evidence SHA when reports are updated after testing.
- All iOS/Android artifacts, CI/Security results, Supabase evidence, catalog release and tester results must reference the same implementation SHA.
- No dependency, native configuration, migration, feature-flag or catalog change after the tag without a new RC.
- A documentation-only correction may update the evidence SHA but must not claim to change implementation behavior.

## Release Candidate sequence

1. Confirm branch is current with `main`, mergeable and clean.
2. Run all local quality gates.
3. Run secretless PR CI and Security successfully.
4. Dispatch the protected release-candidate workflow for the immutable SHA.
5. Run required/no-skip Supabase Advisor, migration dry run and staging smokes.
6. Run credentialed staging Playwright fallback/no-results scenarios.
7. Publish or select the approved catalog release.
8. Build iOS and Android internal/RC artifacts.
9. Install and execute the full regression matrix.
10. Complete accessibility, privacy/deletion, monitoring and rollback proof.
11. Fill the release evidence JSON.
12. Run:

```bash
node scripts/validate-release-01-evidence.mjs tasks/release-evidence/release-0.1-candidate.json
```

13. Hold a formal Go/No-Go review.

## Required code checks

```bash
npm ci
npm run typecheck
npm run lint
npm run format:check
npm run audit:assets
node scripts/audit-release-01-catalog.mjs
npm run test
npm run test:e2e
npm run test:e2e:merchant-catalog
npx expo-doctor
npm run audit:supabase:static
npm run check:edge-functions
npm run security:audit
npm run security:gitleaks
npm run security:trufflehog
git diff --check
```

## Required protected checks

- GitHub CI and Security green;
- merge compatibility green;
- protected environment approval recorded;
- Supabase capacity healthy;
- migration histories reconciled;
- Advisor required/no-skip pass;
- location/search/RLS/canonical/full/raw catalog smokes pass;
- staging fallback and no-results Playwright pass without skips;
- final iOS and Android artifacts installed;
- TestFlight/Play access instructions verified.

## Store submission rehearsal

Before submission:

- App Store and Play Store metadata are complete and accurate;
- screenshots use fictional/redacted accounts and current UI;
- support/privacy/account-deletion URLs work;
- App Privacy and Data Safety answers match released permissions/SDK behavior;
- demo/review account instructions work;
- backend is available for review;
- age/content rating is accurate;
- deferred features are not described or pictured;
- release notes and known limitations are approved.

## Exit criteria

Week 7 passes when:

- evidence validator reports `GO CANDIDATE`;
- all required checks are green on the same SHA;
- no P0 and no unowned P1 exists;
- two consecutive candidate builds have no new P0 regression;
- rollback targets are known and rehearsed;
- release owner, QA, security/privacy and product sign off;
- store submission packages are complete.

## Week 7 QA/QC audit

| Area | Preparation | Execution |
|---|---:|---:|
| Evidence validator | Implemented | Pending real evidence file |
| RC manifest | Ready | Pending immutable SHA/artifacts |
| Go/No-Go checklist | Ready | Pending review |
| Store rehearsal | Defined | Pending portal access |
| Freeze policy | Complete | Pending enforcement |
| Production readiness | Not claimable | Go Candidate only after validator and review pass |

## Automatic No-Go conditions

- mismatched artifact/evidence SHAs;
- failed or skipped mandatory check;
- unresolved security/privacy/account-deletion issue;
- unverified catalog release or unsafe imagery;
- no tested rollback target;
- missing final iOS or Android proof;
- stale store metadata or reviewer access;
- open P0 or unowned P1.
