# Hungry Mobile Frontend TODO

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

## Review

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
