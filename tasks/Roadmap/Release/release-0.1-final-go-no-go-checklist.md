# Hungry Release 0.1 — Final Go/No-Go Checklist

> Every P0 row must pass against the same implementation SHA. Blocked, skipped, stale or undocumented evidence is a No-Go.

## Candidate identity

| Field | Value |
|---|---|
| Implementation SHA | |
| Evidence SHA | |
| RC tag | |
| iOS build ID | |
| Android build ID | |
| Catalog release ID | |
| Migration head | |

## P0 gates

| Gate | Result | Evidence |
|---|---:|---|
| Worktree clean and branch current/mergeable | ☐ | |
| Local typecheck/lint/format/tests/E2E | ☐ | |
| GitHub CI green | ☐ | |
| GitHub Security green | ☐ | |
| Merge compatibility green | ☐ | |
| Protected release workflow approved | ☐ | |
| Supabase capacity healthy | ☐ | |
| Migration history reconciled | ☐ | |
| Security Advisor required/no-skip pass | ☐ | |
| RLS/location/search/canonical/full/raw smokes | ☐ | |
| Mandatory auth/no guest verified | ☐ | |
| Authenticated Excel fallback verified | ☐ | |
| Signed-out/invalid-session fallback denied | ☐ | |
| Successful no-results remains empty | ☐ | |
| Exact pilot catalog and three-page paging pass | ☐ | |
| Initial Discover approved-image coverage 100% | ☐ | |
| No mock/duplicate/non-consumer tested rows | ☐ | |
| Zero visible dead/deferred controls | ☐ | |
| Profile/avatar writes truthful | ☐ | |
| Account deletion end to end | ☐ | |
| Monitoring/source maps/alerts verified | ☐ | |
| iOS artifact installed and matrix passed | ☐ | |
| Android artifact installed and matrix passed | ☐ | |
| VoiceOver/TalkBack/large text/reduced motion | ☐ | |
| Rollback rehearsed | ☐ | |
| Privacy/terms/support/store declarations approved | ☐ | |
| Closed-beta exit metrics pass | ☐ | |
| Open P0 = 0 | ☐ | |
| Unowned P1 = 0 | ☐ | |

## Store readiness

| Item | iOS | Android | Evidence |
|---|---:|---:|---|
| Listing text accurate | ☐ | ☐ | |
| Screenshots current/redacted | ☐ | ☐ | |
| Privacy URL | ☐ | ☐ | |
| Support URL | ☐ | ☐ | |
| Account-deletion URL/path | ☐ | ☐ | |
| Data/privacy declarations | ☐ | ☐ | |
| App access/demo account | ☐ | ☐ | |
| Age/content rating | ☐ | ☐ | |
| Backend available for review | ☐ | ☐ | |
| Review notes/known limitations | ☐ | ☐ | |

## Decision meeting

Questions:

1. Does the core journey work for target users on both platforms?
2. Is the catalog accurate and safe enough for the pilot promise?
3. Can the team detect, support and roll back a failure?
4. Are privacy, deletion and store declarations truthful?
5. Are all artifacts and evidence tied to one immutable SHA?
6. Is there any reason the release would harm user trust?

## Decision

| Role | Go / No-Go | Name | Date | Notes |
|---|---|---|---|---|
| Engineering | | | | |
| QA | | | | |
| Security/privacy | | | | |
| Catalog/data | | | | |
| Product | | | | |
| Release owner | | | | |

Final decision: **GO / NO-GO**

Reason:

Rollback owner and target:
