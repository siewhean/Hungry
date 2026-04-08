# Hungry Mobile Frontend Task Requirements & Shared Checklist

This file is the shared execution checklist for both Claude and Codex.

## Shared Planning Rules

- Before any non-trivial implementation, update the relevant phase checklist with the intended work.
- While working, mark checklist items as they move and add short notes when scope or sequencing changes.
- Before ending a session, update the review, verification, or phase notes so the next agent can continue without re-discovery.
- Do not mark work complete without verification appropriate to the change.

## Phase 1. Repo Bootstrap

- [x] Create root Expo app scaffold and repo bootstrap docs
- [x] Install app dependencies and verify typecheck

## Phase 2. Shared App Foundations

- [x] Build shared theme, tokens, types, stores, and mock services
- [] Implement navigation shell and guest/auth gating

## Phase 3. Core Discovery Experience

- [] Implement Discover and Search flows
- [] Implement Dish and Stall detail flows

## Phase 4. Account and Supporting Flows

- [] Implement Auth, Onboarding, Profile, and Review flows
- [] Implement Reads and recovery states

## Phase 5. Verification and Delivery Review

- [] Run typecheck and record review notes
This document is the shared execution contract for both Claude and Codex.

## Planning + Update Rules (Mandatory)

- Mock discovery dataset expanded to include additional food courts and hawker centres with broader stall and dish coverage.
- `npm run typecheck` passes.
- `npx expo-doctor` passes after adding `react-native-worklets` and running a dedupe pass.
- The current app remains frontend-only and mock-first; no backend or security implementation has started in the shipped phases above.

---

## Future Delivery Phases

### Phase 6. Ordering MVP Foundations

- [ ] Browse stall menu and add items to cart within the app
- [ ] Order confirmation with estimated wait time
- [ ] Order history and reorder shortcut
- [ ] Receive and acknowledge incoming orders
- [ ] Mark items as sold out or unavailable

### Phase 7. Payments and Order State

- [ ] Checkout and pay on device (PayNow / card / e-wallet)
- [ ] Define the consumer app contract for optimistic order state plus polling or WebSocket updates
- [ ] Confirm regulatory and operational requirements for live transaction rollout

### Phase 8. Vendor Operations and Analytics

- [ ] Analytics dashboard for top dishes, peak hours, revenue trend, and average order value
- [ ] Export order data (CSV) for inventory planning
- [ ] Aggregate dish popularity rankings across hawker centres
- [ ] Trend detection for dishes spiking in order volume

### Phase 9. Crowd Signals and Indoor Map Integration

- [ ] Real-time busyness indicator per stall derived from active order volume
- [ ] Expected wait estimate shown on stall card in-feed and on map
- [ ] Crowd heat map overlay on indoor floor plan
- [ ] Push notification when queues clear at a stall

### Phase 10. Platform Data Expansion

- [ ] Building-level footfall analytics for mall operators
- [ ] Anonymised data export for F&B research or NEA partnerships

## Future Phase Notes

- Scope: all future phases remain out of the current MVP.
- Payment integration candidates: Stripe for cards, PayNow QR for SGD, and GrabPay.
- Order backend should live as a separate service from the consumer mobile frontend.
- Crowd monitoring MVP should be derived from order count per stall per time window rather than hardware sensors.
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
- 2026-04-06 | Codex | Audited app screen inventory, research docs, and design artifacts; created Stitch-ready design-system and screen-brief files under `design/stitch/`. | Status: completed for design planning artifact. | Blockers: direct Stitch editing is not available in this environment. | Next: generate remaining screens in Stitch using `design/stitch/DESIGN.md` and `design/stitch/STITCH_BRIEFS.md`, then sync the chosen outputs back into Figma and code.

---

## Verification Commands Log

- [x] `npm run typecheck`
- [ ] `npx expo-doctor`

Add dated command outputs under each active workstream when run.


### Verification Notes
- 2026-04-05: `npm run typecheck` passed after task-document updates.
