# Hungry Mobile Frontend Task Requirements & Shared Checklist

This document is the shared execution contract for both Claude and Codex.

## Planning + Update Rules (Mandatory)

- [ ] Keep this file as the single source of truth for delivery status.
- [ ] Before implementing any non-trivial task (3+ steps), add a scoped mini-plan under the relevant phase.
- [ ] During active implementation, update checklist progress at least once per focused work block (or before ending a session).
- [ ] Do not mark a task as done until a verification step is recorded.
- [ ] Add blockers/decisions in the session log section so the next agent can continue without re-discovery.

---

## Project-Fit Requirements (Updated for current Hungry development)

### Current Product Scope (Now)
- Consumer mobile app only (Expo + React Native).
- Frontend-first, mock-first execution.
- No live backend/payment/security deployment in this phase.

### Near-Term Priorities (Next)
1. Stabilise and polish current user journeys (Discover, Search, Details, Auth, Profile, Reviews).
2. Improve data quality and fixture realism for Singapore food discovery.
3. Introduce backend-ready contracts progressively (without blocking frontend demoability).
4. Define a social analytics-ready event taxonomy now, even before backend rollout.

### Future Expansion (Later)
- Digital ordering + payment + vendor tooling.
- Crowd/queue analytics derived from active order volume.
- Social and trend analytics surfaces.

---

## Implementation Phases with Claude/Codex Ownership

## Phase 1 — Product + Architecture Planning

### Claude primary
- [ ] Define/refresh architecture notes for mock-first now vs backend-connected later.
- [ ] Produce feature-level acceptance criteria for critical flows.
- [ ] Define event taxonomy for future social analytics (events, attributes, ownership).
- [ ] Record tradeoffs/decisions directly in README (or linked docs).

### Codex primary
- [ ] Convert architecture decisions into concrete repository tasks.
- [ ] Create/update typed interfaces and TODO anchors matching planned contracts.
- [ ] Ensure implementation tasks are granular and checkable in this file.

### Done criteria
- [ ] Planning artifacts are committed and discoverable.
- [ ] Every in-progress build task maps to a planned requirement.

---

## Phase 2 — Core App Hardening (Current Build Focus)

### Claude primary
- [ ] Identify highest-risk UX/logic gaps in current implemented flows.
- [ ] Prioritise bug/quality backlog by user impact.
- [ ] Define verification matrix for each critical flow.

### Codex primary
- [ ] Implement high-priority flow fixes with minimal scoped changes.
- [ ] Add/adjust loading, error, and empty states where missing.
- [ ] Keep type safety and lint hygiene intact after each patch.
- [ ] Run and record verification commands after each batch.

### Done criteria
- [ ] Critical user journeys run end-to-end in mock mode.
- [ ] Verification commands are green and logged.

---

## Phase 3 — Data + Analytics Readiness

### Claude primary
- [ ] Specify analytics KPIs and dashboard-ready metric definitions.
- [ ] Define event-to-metric mapping and data quality expectations.
- [ ] Propose phased rollout path for backend/event ingestion.

### Codex primary
- [ ] Add event instrumentation hooks in frontend service/store boundaries.
- [ ] Keep analytics hooks mock-safe (no backend dependency required).
- [ ] Add data validation helpers for fixture integrity checks.

### Done criteria
- [ ] Event schema is documented and instrumentation is implemented for key flows.
- [ ] Mock data quality checks are executable and recorded.

---

## Phase 4 — Ordering + Payments Preparation (Future)

### Claude primary
- [ ] Break down ordering system architecture (consumer, vendor, platform analytics).
- [ ] Document payment/provider tradeoffs and compliance constraints.
- [ ] Define queue-time/crowd-estimation model assumptions.

### Codex primary
- [ ] Scaffold frontend contracts and placeholders for order/cart/checkout flows.
- [ ] Add feature flags for future ordering capabilities.
- [ ] Maintain separation between MVP shell and future ordering modules.

### Done criteria
- [ ] Future-facing contracts exist without destabilising current MVP.
- [ ] Feature flags gate unfinished modules cleanly.

---

## Shared Session Log (Claude + Codex must append)

- [ ] Session log maintained with: date, actor (Claude/Codex), tasks touched, status, blockers, next step.

### Session Entries
- 2026-04-05 | Codex | Updated project-fit task requirements, phased Claude/Codex ownership checklist, and planning cadence. | Status: completed for documentation update. | Blockers: none. | Next: keep this checklist current during implementation sessions.

---

## Verification Commands Log

- [x] `npm run typecheck`
- [ ] `npx expo-doctor`

Add dated command outputs under each active workstream when run.


### Verification Notes
- 2026-04-05: `npm run typecheck` passed after task-document updates.
