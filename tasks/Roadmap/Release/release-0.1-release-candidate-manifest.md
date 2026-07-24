# Hungry Release 0.1 — Release Candidate Manifest

## Identity

| Field | Value |
|---|---|
| RC tag | `release-0.1.0-rc.` |
| Implementation SHA | |
| Evidence SHA | |
| Merge/base SHA | |
| iOS EAS build ID | |
| Android EAS build ID | |
| iOS version/build | |
| Android version code | |
| EAS Update ID/channel/runtime | |
| Catalog release ID | |
| Supabase migration head | |
| Release owner | |
| Candidate created | |

## Scope

### Included

- mandatory onboarding/authentication;
- Discover, Search, Browse Dishes/Stalls;
- source-bound dish/stall/menu details;
- directions when data is valid;
- essential Profile/Settings;
- privacy, support, account deletion and sign-out;
- authenticated read-only Excel fallback.

### Deferred/disabled

- social feed, posts, reviews, comments and DMs;
- Activity, Reads, Map, Wheel and Crave;
- stories, gamification, collections and floorplans;
- merchant surfaces and claims;
- favourites unless the completed write gate explicitly re-enables it;
- prototype, admin and developer routes.

## Evidence links

| Evidence | URL/path | SHA verified |
|---|---|---:|
| CI | | ☐ |
| Security | | ☐ |
| Protected release workflow | | ☐ |
| Supabase Advisor/migration/RLS | | ☐ |
| Staging Playwright | | ☐ |
| Catalog pilot/paging/images | | ☐ |
| iOS QA | | ☐ |
| Android QA | | ☐ |
| Accessibility | | ☐ |
| Privacy/account deletion | | ☐ |
| Closed-beta scorecard | | ☐ |
| Rollback rehearsal | | ☐ |
| Store metadata review | | ☐ |

## Metrics

| Metric | Target | Actual | Pass |
|---|---:|---:|---:|
| Startup success | ≥98% | | ☐ |
| Crash-free sessions | ≥99.5% | | ☐ |
| Primary journey completion | ≥85% | | ☐ |
| Exact pilot cases | 100% | | ☐ |
| Initial Discover approved-image coverage | 100% | | ☐ |
| Completed non-developer tester journeys | ≥15 | | ☐ |
| Open P0 | 0 | | ☐ |
| Unowned P1 | 0 | | ☐ |

## Known limitations

- 

## Accepted risks

No P0 risk may be accepted.

| Severity | Risk | User impact | Owner | Expiry/fix date | Approval |
|---|---|---|---|---|---|
| | | | | | |

## Rollback targets

| Layer | Target | Rehearsed | Evidence |
|---|---|---:|---|
| Native build | | ☐ | |
| EAS Update | | ☐ | |
| Catalog release | | ☐ | |
| Feature flags | | ☐ | |
| Database recovery/forward fix | | ☐ | |

## Sign-off

| Role | Name | Date | Decision |
|---|---|---|---|
| Engineering | | | |
| QA | | | |
| Security/privacy | | | |
| Catalog/data owner | | | |
| Product owner | | | |
| Release owner | | | |
