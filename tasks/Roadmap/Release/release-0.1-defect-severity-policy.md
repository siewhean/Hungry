# Hungry Release 0.1 — Defect Severity and Response Policy

## Severity definitions

### P0 — Release blocker / incident

Includes:

- auth bypass or cross-user data access;
- credential or private-data exposure;
- destructive data loss;
- crash loop or startup failure;
- primary journey blocked for most users;
- account deletion falsely succeeds or cannot be completed;
- unsafe catalog data/media shown broadly;
- invalid session retains protected/Excel access.

Response:

- stop rollout immediately;
- assign owner within 15 minutes during an active test/release window;
- use incident runbook;
- fix, add regression test and retest all affected platforms;
- no release with an open P0.

### P1 — Major release blocker

Includes:

- required action broken without an acceptable workaround;
- major source/fallback/no-results inconsistency;
- repeated wrong details, paging duplicates or broken approved images;
- VoiceOver/TalkBack cannot complete core journey;
- material performance regression;
- monitoring/rollback unavailable.

Response:

- owner assigned same business day;
- target fix before next beta candidate;
- requires automated and native retest;
- no Release Candidate with an unaccepted P1.

### P2 — Degraded with workaround

Includes:

- isolated data issue;
- minor navigation friction;
- visual/layout problem that does not block the journey;
- non-critical performance issue.

Response:

- owner and target milestone required;
- may enter Release Candidate only with explicit release-owner acceptance and no trust/safety impact.

### P3 — Polish or suggestion

Includes minor copy, spacing, cosmetic and future-feature requests.

Response:

- backlog after Release 0.1 unless the change is extremely low risk and does not disturb the freeze.

## Required issue fields

- implementation SHA;
- build ID/platform/device;
- route and source/release ID where applicable;
- reproduction steps;
- expected and actual result;
- severity rationale;
- privacy-safe evidence;
- owner and target date;
- regression-test plan.

## Closure requirements

A defect is closed only when:

1. root cause is documented;
2. fix is linked to an implementation SHA;
3. regression coverage is added where practical;
4. iOS and Android retest status is recorded when relevant;
5. catalog/data corrections are verified against source/provenance;
6. no stale artifact is used as evidence;
7. release notes and known limitations are updated.

## Release rules

- Open P0: No-Go.
- Unowned P1: No-Go.
- Accepted P1: requires product, QA and release-owner sign-off plus a dated remediation plan.
- P2/P3 counts and trends remain visible in the beta scorecard.
- Severity may not be lowered solely to meet a release date.
