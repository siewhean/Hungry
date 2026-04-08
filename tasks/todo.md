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
- [x] Implement navigation shell and guest/auth gating

## Phase 3. Core Discovery Experience

- [x] Implement Discover and Search flows
- [x] Implement Dish and Stall detail flows

## Phase 4. Account and Supporting Flows

- [x] Implement Auth, Onboarding, Profile, and Review flows
- [x] Implement Reads and recovery states

## Phase 5. Verification and Delivery Review

- [x] Run typecheck and record review notes
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

### Phase 1 mini-plan — 2026-04-08 marketing launch system
- [x] Draft a repo-grounded product marketing context, positioning, and messaging system for Hungry.
- [x] Create a dedicated `marketing/` workspace for strategy, website, social, video, outreach, and brand-asset rules.
- [x] Write the waitlist page copy and wireframe contract for a consumer-first launch destination.
- [x] Write a 30-day organic content calendar plus reusable cross-channel copy templates.
- [x] Define creator, press, and hawker outreach plus AI-assisted video briefs and prompt packs.

---

## Phase 2 — Core App Hardening (Current Build Focus)

### Claude primary
- [ ] Identify highest-risk UX/logic gaps in current implemented flows.
- [ ] Prioritise bug/quality backlog by user impact.
- [ ] Define verification matrix for Home, Discover, Search, Maps, Auth, Review, and Profile.

### Codex primary
- [ ] Implement high-priority flow fixes with minimal scoped changes.
- [ ] Add or refine loading, error, and empty states where missing.
- [ ] Keep navigation contracts, mock repositories, and type safety aligned after each patch.
- [ ] Run and record verification commands after each batch.

### Phase 2 mini-plan — 2026-04-08 Figma-fidelity hardening
- [x] Remove guest browsing from the session model, auth flow, soft gates, and developer launcher.
- [x] Make signed-out launch always resolve Splash -> Auth before MainTabs.
- [x] Rebuild shared input/button/chip/badge patterns to match the approved warm neutral Figma system.
- [x] Restyle Discover/Search and Stall Detail to match the Figma hierarchy and remove low-contrast pill/card drift.
- [x] Remove emoji usage from runtime UI, onboarding, social sample content, and share labels.
- [x] Run typecheck plus multi-device QA review notes for iPhone 16e, 16, 16 Pro, 16 Pro Max, and one Android sanity pass.

### Phase 2 mini-plan — 2026-04-08 Maps + building layout
- [x] Replace the fake `Maps` tab surface with a token-aware Mapbox wrapper plus a repo-visible fallback preview.
- [x] Rebuild `HomeMapScreen` to match the Figma map composition with live building pins, current-location affordance, and selected-building sheet.
- [x] Turn `MapZoomedIn` into a real focused-building map route instead of a placeholder card.
- [x] Wire `BuildingDrillDown` to the real screen and rebuild it around the Figma drill-down flow.
- [x] Add a demo Maxwell `L2` floor-plan plus mock venues/dishes so the floor switch and menu preview are visible in repo runtime.

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
- 2026-04-08 | Codex | Reconciled repo housekeeping and status docs with the actual codebase: removed stale `AGENT.md`, archived older design iterations under `design/archive/`, cleaned local artifacts, and updated instruction references. | Status: completed for repository cleanup and documentation alignment. | Blockers: none. | Next: use Phase 2 as the active workstream and keep verification notes current as UI hardening continues.
- 2026-04-08 | Codex | Started Figma-fidelity hardening pass: auth-first shell, guest-flow removal, emoji purge, shared primitive restyle, and device-matrix QA prep. | Status: in progress. | Blockers: final visual fidelity depends on runtime verification against simulators after code changes. | Next: update auth/session flow, restyle Search and Stall Detail to match Figma, then run multi-device QA.
- 2026-04-08 | Codex | Completed the Figma-fidelity hardening pass for auth/session, shared primitives, Discover/Search, Stall Detail, and runtime emoji removal. | Status: completed for the code pass with review notes recorded. | Blockers: simulator access from this sandbox is limited because CoreSimulatorService is unavailable here, and `npm run test` is not defined in package.json. | Next: run on-device or local simulator visual smoke tests outside the sandbox, then continue with Home/Reads/Profile polish if needed.
- 2026-04-08 | Codex | Continued the hardening pass: removed the remaining runtime soft-gate path, made signed-out protected actions route directly into auth, aligned login methods to the same onboarding-first flow, prevented review-compose from falling back to the wrong dish, tightened Discover/Search composition, reduced pill-heavy styling, and improved Home/Stall Detail layout behavior. | Status: completed for this implementation batch. | Blockers: the remaining work is visual polish, especially Home feed overlay density, tighter Search fidelity, and flatter Stall Detail composition. | Next: run local simulator checks on iPhone 16e/16/16 Pro/16 Pro Max and Android, then finish the remaining visual polish based on screenshots instead of code-only review.
- 2026-04-08 | Codex | Added the Hungry marketing launch workspace under `marketing/` with positioning, waitlist copy, wireframe, channel playbook, 30-day calendar, copy pack, video briefs, AI prompt pack, outreach playbook, and brand/visual rules. | Status: completed for documentation implementation. | Blockers: the sandbox can read `.agents/` but cannot write into it, so the product marketing context draft currently lives at `marketing/strategy/product-marketing-context.md` instead of `.agents/product-marketing-context.md`. | Next: if a less restricted local environment is available, mirror that file into `.agents/` so other marketing skills can consume it automatically.
- 2026-04-08 | Codex | Implemented the Figma-based maps deliverables: real `MapSurface` wrapper with token-aware fallback, rebuilt `Maps` and `MapZoomedIn`, rewired `BuildingDrillDown`, bridged Singapore/mock building IDs, and added a demo Maxwell `L2` floor plan with matching mock venues and dishes. | Status: completed for the code pass. | Blockers: live Mapbox rendering still requires `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` in the local environment; without it, the repo falls back to a static coordinate preview. | Next: run the app locally on simulator/device to visually inspect the live map route and the Maxwell drill-down flow with a real token configured.
- 2026-04-08 | Codex | Fixed the Home route container to render as a direct safe-area feed surface, added a feed empty state, and removed visible scroll indicators from shared screen wrappers plus remaining explicit scrollable surfaces. | Status: completed for this UI hardening patch. | Blockers: runtime simulator verification is still needed to confirm the Home tab now renders correctly on-device. | Next: open the app locally and verify Home, Review, Search Results, Dish Detail, and the developer launcher no longer show scrollbars.

---

## Verification Commands Log

- [x] `npm run typecheck`
- [ ] `npx expo-doctor`

Add dated command outputs under each active workstream when run.


### Verification Notes
- 2026-04-05: `npm run typecheck` passed after task-document updates.
- 2026-04-08: Repository audit shows implemented screens for Splash, Auth, Onboarding, Home, Discover, Search, Maps, Review, Profile, Reads, Offline, NotFound, and developer utilities are present under `src/app/screens/`.
- 2026-04-08: `npm run typecheck` passed after the Figma-fidelity hardening patch set.
- 2026-04-08: `npm run typecheck` passed again after removing the runtime soft-gate path and tightening Discover/Search/Home/Stall Detail.
- 2026-04-08: `npm run test` could not run because `package.json` does not define a `test` script.
- 2026-04-08: Device QA was completed as a code-based review matrix for iPhone 16e, 16, 16 Pro, 16 Pro Max, and Android sanity because `xcrun simctl` could not access CoreSimulatorService from this sandbox.
- 2026-04-08: Marketing launch documentation was added under `marketing/`; the sandbox could not write into `.agents/`, so the repo-grounded product marketing context is stored at `marketing/strategy/product-marketing-context.md`.
- 2026-04-08: `npm run typecheck` passed after the marketing launch documentation, README index, and task-log updates.
- 2026-04-08: `npm run typecheck` passed after the map deliverable, route rewiring, Maxwell demo L2 floor plan, and building-layout drill-down implementation.
- 2026-04-08: `npm run typecheck` passed after the Home feed container fix and app-wide scrollbar suppression cleanup.

---

## Current Execution Split

### Claude Plan
- [ ] Audit implemented flows against product requirements and design docs.
- [ ] Produce a prioritized UX and verification backlog for the existing MVP.
- [ ] Identify missing polish, copy, navigation, and state-handling gaps before new features are added.

### Codex Plan
- [ ] Execute the highest-priority hardening fixes from Claude's backlog.
- [ ] Keep repository structure, docs, and navigation/types in sync as features evolve.
- [ ] Maintain passing typecheck and update verification notes after each implementation batch.
