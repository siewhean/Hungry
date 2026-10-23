# Hungry Release 0.1 — Week 6 Closed-Beta Iteration

> Status: Prepared, not executed. Week 6 begins after Week 5 has an active cross-platform cohort and at least one complete beta evidence set.

## Outcome

Convert beta evidence into a stable release candidate. Week 6 is a defect-resolution and confidence-building week, not a feature-development week.

## Rules

- No new major feature enters the beta.
- Every change must map to a tester defect, operational risk, privacy/security issue, or measured core-funnel problem.
- P0/P1 fixes receive new automated and native regression coverage.
- Every build is tied to an immutable implementation SHA.
- Catalog corrections use the controlled publish/quarantine process.
- A documentation-only evidence commit is recorded separately from the implementation SHA.

## Daily loop

1. Ingest crash, analytics, tester and catalog reports.
2. Deduplicate by root cause.
3. Classify severity and owner.
4. Reproduce on the same build/source/release where possible.
5. Fix the smallest root cause.
6. Add regression coverage.
7. Run local quality gates.
8. Publish a new beta build/update only after review.
9. Retest affected journeys on both platforms.
10. Update the scorecard and known-limitations list.

## Triage priority

1. security/privacy/auth/session correctness;
2. startup/crash/core-journey blockers;
3. wrong or unsafe catalog data/images;
4. source/fallback/no-results correctness;
5. account deletion/support;
6. accessibility;
7. performance and usability;
8. minor visual polish.

## Required regression suites

### Authentication

- fresh signup and verification;
- returning login;
- session restore;
- revoked session;
- sign-out online and offline;
- protected deep links.

### Catalog

- healthy Supabase;
- authenticated Excel fallback;
- no-results without substitution;
- three-page dishes and stalls under both sources;
- source-bound detail/menu navigation;
- pilot image and coordinate cases;
- clean reconnect.

### Account and legal

- profile edit success/failure;
- avatar upload failure and recovery;
- privacy/support links;
- account deletion success/failure;
- no disabled/deferred controls.

### Accessibility/performance

- VoiceOver and TalkBack primary journey;
- large text and reduced motion;
- low-end Android scroll and startup;
- p50/p95 startup, catalog and detail latency;
- memory stability during repeated browsing.

## Build cadence

- Maximum one routine beta build per platform per business day.
- Emergency incident fixes may bypass cadence only through the incident runbook.
- Publish release notes for every build.
- Retain at least one known-good rollback candidate.
- Never promote a build with unresolved P0 or unowned P1 issues.

## Exit criteria

Week 6 passes when:

- all P0 issues are closed and retested;
- all P1 issues are closed or explicitly accepted by the release owner with a dated resolution plan;
- two consecutive candidate builds introduce no new P0 regression;
- primary journey completion meets the approved threshold;
- crash-free sessions and startup success meet beta targets;
- catalog trust metrics meet the pilot threshold;
- no privacy/security/account-deletion blocker remains;
- the Release Candidate scope and known limitations are frozen.

## Week 6 QA/QC audit

| Area | Preparation | Execution |
|---|---:|---:|
| Triage and severity rules | Complete | Pending live reports |
| Regression matrix | Complete | Pending final builds |
| Metrics scorecard | Complete | Pending live data |
| Build-note template | Complete | Pending build cadence |
| Exit thresholds | Defined | Pending owner approval/live result |
| Production readiness | Not claimable | Go Candidate only after exit criteria |

## Stop conditions

Return to No-Go when:

- a security/privacy/auth defect is discovered;
- a build cannot be rolled back or replaced safely;
- catalog release provenance becomes uncertain;
- crash/startup/core-journey metrics regress materially;
- tester evidence is insufficient or tied to stale artifacts.
