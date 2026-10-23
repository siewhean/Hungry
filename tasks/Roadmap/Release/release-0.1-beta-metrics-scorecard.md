# Hungry Release 0.1 — Closed-Beta Metrics Scorecard

## Evidence identity

| Field | Value |
|---|---|
| Implementation SHA | |
| Evidence SHA | |
| iOS build ID | |
| Android build ID | |
| Catalog release ID | |
| Measurement window | |
| Active tester count | |

## Reliability

| Metric | Target | Actual | Source | Pass |
|---|---:|---:|---|---:|
| App startup success | ≥98% | | Sentry/analytics | ☐ |
| Crash-free sessions | ≥99.5% | | Sentry | ☐ |
| ANR rate | No material blocker | | Play Console | ☐ |
| Primary journey completion | ≥85% of attempted journeys | | Session reports | ☐ |
| Auth completion success | ≥95% excluding user-cancelled verification | | Analytics/auth logs | ☐ |
| Catalog request success or approved fallback | ≥95% | | Catalog diagnostics | ☐ |
| Excel fallback error rate | <1% | | Catalog diagnostics | ☐ |
| P0 open | 0 | | Issue tracker | ☐ |
| Unowned P1 open | 0 | | Issue tracker | ☐ |

## Performance

| Metric | Target | Actual | Device cohort | Pass |
|---|---:|---:|---|---:|
| Cold start to usable | <3.0 s p95 on representative device | | | ☐ |
| Warm start | <1.5 s p95 | | | ☐ |
| Catalog first page | <1.0 s p95 staging/normal network | | | ☐ |
| Search result | <0.8 s p95 | | | ☐ |
| Detail render | <0.8 s p95 | | | ☐ |
| Tab transition perceived | <300 ms | | | ☐ |
| Image failure on approved pilot cards | <2% | | | ☐ |

Targets are internal release targets and may be revised only with owner approval and documented evidence—not to make a failing build appear green.

## Product funnel

| Metric | Goal | Actual | Notes |
|---|---:|---:|---|
| First-session valid dish detail reached | ≥70% | | |
| Search or Discover interaction | ≥80% | | |
| Dish detail → stall detail | ≥50% | | |
| Directions opened | Baseline only | | |
| Legitimate no-results rate | Baseline + anomaly monitoring | | |
| Day-1 return rate | Observe | | |
| Day-7 return rate | Observe | | |

## Catalog trust

| Metric | Target | Actual | Pass |
|---|---:|---:|---:|
| Exact pilot record tests | 100% | | ☐ |
| Initial Discover dish cards with approved image | 100% | | ☐ |
| Initial Discover stall cards with approved logo/venue/representative image | 100% | | ☐ |
| Broken/blocked image URLs in tested pages | 0 | | ☐ |
| Mock/test IDs in active tested pages | 0 | | ☐ |
| Semantic duplicates in tested pages | 0 | | ☐ |
| Confirmed data defects unresolved at release | 0 P0/P1 | | ☐ |
| Median catalog issue resolution | <2 business days in beta | | ☐ |

## Accessibility and privacy

| Gate | Target | Actual | Pass |
|---|---|---|---:|
| VoiceOver primary journey | Complete without P0 | | ☐ |
| TalkBack primary journey | Complete without P0 | | ☐ |
| 200% text / largest supported text | Core journey usable | | ☐ |
| Reduced motion | No essential information lost | | ☐ |
| Account deletion | 100% approved test cases pass | | ☐ |
| Analytics/log prohibited-field tests | 100% pass | | ☐ |
| Privacy/legal owner sign-off | Complete | | ☐ |

## Decision

| Decision | Owner | Date | Rationale |
|---|---|---|---|
| Continue beta / Hold / Release Candidate | | | |
