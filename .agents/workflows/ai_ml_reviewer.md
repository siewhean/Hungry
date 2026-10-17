---
description: AI/ML reviewer — audit Hungry recommendation correctness, data quality, fairness, and explainability
---

# AI/ML Reviewer Agent

Audit the recommendation and taste-profile system that exists in the current branch. Do not assume function names, a Jest setup, or mock-only data. Inspect the canonical domain/service contracts and existing Node test harness first.

## Scope

Depending on the task, inspect:

- `src/lib/ai/`;
- recommendation and taste-profile service contracts;
- onboarding/profile calibration flows;
- canonical catalog taxonomy, dietary flags, taste vectors, location/availability inputs;
- analytics/feedback updates;
- Supabase functions/RPCs or Edge Functions used for ranking;
- user-visible explanations and confidence/match copy.

## Review dimensions

### 1. Mathematical correctness

Test relevant functions for:

- identical, orthogonal, zero, missing, malformed, and boundary vectors;
- finite outputs and documented ranges;
- deterministic ordering for identical inputs;
- stable tie-breaking and pagination;
- calibration/update direction, bounds, convergence, and recency/weight handling;
- no division-by-zero, NaN, overflow, or accidental truthiness fallback.

Use the repository’s existing test runner and canonical `TasteVector` type.

### 2. Data validity

- Recommendations use approved canonical dish/stall records, not placeholders or mock-only fixtures in released builds.
- Missing taste vectors, dietary flags, prices, coordinates, hours, images, and verification state have explicit behavior.
- Dietary and safety constraints are filters or hard constraints when required, not merely soft ranking signals.
- Invalid/closed/excluded/non-consumer records are not surfaced.
- Supabase and authenticated Excel fallback produce compatible ranking inputs without pretending fallback data is live.

### 3. Ranking quality

Build representative evaluation sets for:

- neutral and strongly expressed taste profiles;
- common dietary restrictions;
- different Singapore areas and distance ranges;
- budget and availability intents;
- new/low-signal users;
- sparse and dense catalog conditions;
- legitimate no-results.

Measure at least relevance/constraint violations, diversity, repetition, coverage, and deterministic stability. Do not substitute unrelated fallback items for no-results.

### 4. Fairness and representation

Check whether ranking or data coverage systematically disadvantages:

- cuisines or cultural food groups;
- hawker stalls versus larger chains;
- lower-priced venues;
- less-reviewed but eligible stalls;
- regions with thinner data;
- users with dietary constraints;
- new merchants or newly imported records.

Separate algorithm bias from source-data coverage and verification bias. Do not force quotas without a product decision; report the measured trade-off and mitigation options.

### 5. Explainability and claims

User-facing explanations must:

- be non-empty and grounded in actual inputs;
- identify useful factors such as taste, distance, dietary fit, price, or availability;
- avoid unsupported percentages or “AI knows you” language;
- distinguish live/verified versus fallback/stale context where material;
- avoid exposing private profile attributes or precise location unnecessarily.

### 6. Feedback and privacy

- Explicit and implicit feedback is authenticated, scoped to the correct user, and validated.
- Updates do not allow another user to poison a profile.
- Analytics events are scrubbed and do not include unnecessary PII/precise coordinates.
- Model/ranking changes are versioned or measurable enough to compare before/after behavior.
- Cold-start defaults and reset/delete behavior are documented.

### 7. Performance and resilience

- Ranking is bounded and does not materialize the full catalog on-device.
- Expensive work is server-side/batched where appropriate.
- Timeouts, empty input, catalog outage, and partial data fail safely.
- Prefetch/cache behavior does not cause stale ranking or cross-user leakage.

## Execution

1. Inventory actual ranking/calibration functions and existing tests.
2. Add focused `node:test`/repository-harness tests beside the implementation rather than creating a new Jest structure.
3. Validate against a rights-approved representative catalog sample and, where allowed, staging RPC results.
4. Capture baseline metrics before changing behavior.
5. Apply focused fixes and rerun the same evaluation set.
6. Record findings, datasets, assumptions, metrics, and residual risk in the task-specific AI/recommendation audit and `tasks/verification.md`; do not create a loose root `ai_ml_report.md`.

## Pass criteria

- Mathematical edge cases and documented ranges pass.
- Dietary/safety/location/availability constraints behave as designed.
- Ranking is deterministic, bounded, and performant.
- No measured P0/P1 representation or privacy issue remains unexplained.
- Explanations are grounded and not misleading.
- Evaluation evidence uses current canonical/staging data, not only hand-picked mock fixtures.
