# Hungry Release 0.1 — First 14 Days Operating Calendar

## Day 0 — Launch

- complete final preflight and Go decision;
- open smallest cohort;
- verify install/auth/catalog/details/settings/deletion entry;
- confirm monitoring and rollback targets;
- hold first health review within two hours.

## Day 1

- review startup, crash, auth and catalog metrics;
- triage every report;
- sample initial Discover and Jurong East exact records;
- hold rollout unless the evidence is clearly healthy.

## Day 2

- inspect no-results and fallback rates;
- review iOS/Android device distribution;
- fix only P0/P1 issues;
- update support known-issues response.

## Day 3

- accessibility spot check from real builds;
- review account deletion/support journeys;
- verify source maps and alert routing;
- rehearse a catalog rollback if not already done.

## Day 4

- review performance p50/p95 and low-end Android behavior;
- verify image failure rates;
- catalog-quality sampling and correction review.

## Day 5

- decide hold/expand/pause using the dashboard;
- publish an approved fix only when required;
- update release notes and evidence.

## Day 6

- weekend/on-call readiness check;
- confirm incident owners and rollback access;
- reduce rollout if staffing is insufficient.

## Day 7 — First weekly review

- compute seven-day metrics;
- review D1 retention and primary journey completion;
- audit P0/P1/P2 trends;
- decide whether to remain at current cohort or expand cautiously.

## Day 8

- verify new-cohort install and auth health;
- inspect search terms only through privacy-safe aggregates;
- sample catalog source/release identity.

## Day 9

- review support burden and catalog resolution time;
- validate privacy and deletion request handling;
- check store reviews/feedback only if public listing is visible.

## Day 10

- performance and battery/network review;
- inspect fallback frequency and Supabase health;
- review capacity trend and alerts.

## Day 11

- catalog image, duplicate and non-consumer audit;
- confirm no stale/mock content reached production;
- review correction provenance.

## Day 12

- second accessibility and device coverage sweep;
- test latest OS/device combinations available;
- verify no deferred feature leaked through links or stale state.

## Day 13

- prepare two-week report;
- verify all incidents have postmortem/follow-up;
- confirm rollback artifacts remain accessible.

## Day 14 — Expansion review

Decide one:

- **Hold:** core value is working but more evidence is needed;
- **Iterate:** reliability/data/support issues require another controlled cycle;
- **Expand:** thresholds, operations and trust support a larger cohort/geography;
- **Pause:** risk or user value does not justify continued rollout.

Document the decision, owner, evidence window, next scope and explicit non-goals.
