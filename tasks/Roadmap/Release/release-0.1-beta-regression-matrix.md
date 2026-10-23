# Hungry Release 0.1 — Beta Regression Matrix

> Run against every beta candidate. Mark blocked when evidence cannot be produced; never convert blocked to pass.

## Identity

| Field | Value |
|---|---|
| Implementation SHA | |
| iOS build ID | |
| Android build ID | |
| Catalog release ID | |
| Tester/date | |

## Functional regression

| ID | Scenario | Automated | iOS | Android | Result | Evidence |
|---|---|---:|---:|---:|---:|---|
| REG-AUTH-01 | Fresh install → onboarding → mandatory account | ☐ | ☐ | ☐ | | |
| REG-AUTH-02 | Existing login opens shell | ☐ | ☐ | ☐ | | |
| REG-AUTH-03 | Email verification cannot be manually bypassed | ☐ | ☐ | ☐ | | |
| REG-AUTH-04 | Force-quit restores valid session | ☐ | ☐ | ☐ | | |
| REG-AUTH-05 | Revoked session returns to auth | ☐ | ☐ | ☐ | | |
| REG-AUTH-06 | Sign-out clears protected state and fallback access | ☐ | ☐ | ☐ | | |
| REG-ROUTE-01 | Protected deep link while signed out | ☐ | ☐ | ☐ | | |
| REG-ROUTE-02 | Disabled feature route fails closed | ☐ | ☐ | ☐ | | |
| REG-CAT-01 | Healthy Supabase Discover/Search/Browse | ☐ | ☐ | ☐ | | |
| REG-CAT-02 | Three pages of dishes and stalls, no duplicates | ☐ | ☐ | ☐ | | |
| REG-CAT-03 | Dish/stall detail remains source/release-bound | ☐ | ☐ | ☐ | | |
| REG-CAT-04 | Legitimate no-results remains empty | ☐ | ☐ | ☐ | | |
| REG-CAT-05 | Authenticated RPC timeout → Excel fallback | ☐ | ☐ | ☐ | | |
| REG-CAT-06 | Authenticated full disconnect retains current route | ☐ | ☐ | ☐ | | |
| REG-CAT-07 | Reconnect returns future reads to Supabase safely | ☐ | ☐ | ☐ | | |
| REG-CAT-08 | Signed-out offline state exposes no catalog | ☐ | ☐ | ☐ | | |
| REG-IMG-01 | Initial Discover images approved/neutral | ☐ | ☐ | ☐ | | |
| REG-IMG-02 | Browse/detail image failure does not break layout | ☐ | ☐ | ☐ | | |
| REG-PROF-01 | Profile edit succeeds only after backend confirmation | ☐ | ☐ | ☐ | | |
| REG-PROF-02 | Avatar upload failure preserves old avatar | ☐ | ☐ | ☐ | | |
| REG-LEGAL-01 | Privacy/terms/support links open safely | ☐ | ☐ | ☐ | | |
| REG-DEL-01 | Account deletion completes and clears session | ☐ | ☐ | ☐ | | |
| REG-DEL-02 | Deletion failure is recoverable and truthful | ☐ | ☐ | ☐ | | |

## Non-functional regression

| ID | Scenario | iOS | Android | Result | Evidence |
|---|---|---:|---:|---:|---|
| REG-A11Y-01 | VoiceOver/TalkBack primary journey | ☐ | ☐ | | |
| REG-A11Y-02 | Large text and dynamic type | ☐ | ☐ | | |
| REG-A11Y-03 | Reduced motion | ☐ | ☐ | | |
| REG-UI-01 | Dark/light mode and safe areas | ☐ | ☐ | | |
| REG-PERF-01 | Cold/warm startup | ☐ | ☐ | | |
| REG-PERF-02 | Search/catalog/detail p95 | ☐ | ☐ | | |
| REG-PERF-03 | 30-minute browse memory/scroll session | ☐ | ☐ | | |
| REG-SEC-01 | Secret and dependency scans | n/a | n/a | | CI evidence |
| REG-PRIV-01 | Analytics/log redaction | ☐ | ☐ | | |
| REG-ROLL-01 | OTA rollback rehearsal | ☐ | ☐ | | |
| REG-ROLL-02 | Catalog rollback rehearsal | ☐ | ☐ | | |

## Defect retest

| Issue | Severity | Fix SHA | Regression test | iOS retest | Android retest | Closed by |
|---|---|---|---|---:|---:|---|
| | | | | ☐ | ☐ | |

## Decision

- P0 open: 
- P1 open: 
- New regressions: 
- Candidate accepted: ☐
- Release owner/date: 
