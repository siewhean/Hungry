# Hungry Mobile Frontend TODO

- [x] Create root Expo app scaffold and repo bootstrap docs
- [x] Install app dependencies and verify typecheck
- [x] Build shared theme, tokens, types, stores, and mock services
- [x] Implement navigation shell and guest/auth gating
- [x] Implement Discover and Search flows
- [x] Implement Dish and Stall detail flows
- [x] Implement Auth, Onboarding, Profile, and Review flows
- [x] Implement Reads and recovery states
- [x] Run typecheck and record review notes

## Review

- `npm run typecheck` passes.
- `npx expo-doctor` passes after adding `react-native-worklets` and running a dedupe pass.
- The app is frontend-only and mock-first; no backend or security work was started.

---

## Future Features Roadmap

### 🛒 Digital Ordering & Payments *(Future Implementation)*

In-app ordering and payment for hawker centres, food courts, and restaurants. Designed to reduce queue friction for diners and give vendors actionable data.

**Diner-facing**
- [ ] Browse stall menu and add items to cart within the app
- [ ] Checkout and pay on device (PayNow / card / e-wallet)
- [ ] Order confirmation with estimated wait time
- [ ] Order history and reorder shortcut

**Vendor-facing (Stall Portal)**
- [ ] Receive and acknowledge incoming orders
- [ ] Mark items as sold out / unavailable
- [ ] Analytics dashboard: top dishes, peak hours, revenue trend, average order value
- [ ] Export order data (CSV) for inventory planning

**Crowd & Queue Monitoring**
- [ ] Real-time busyness indicator per stall (derived from active order volume)
- [ ] "Expected wait" estimate shown on stall card in-feed and on map
- [ ] Crowd heat map overlay on indoor floor plan
- [ ] Push notification: "Queue has cleared at [stall]"

**Data & Analytics (Platform-level)**
- [ ] Aggregate dish popularity rankings across hawker centres
- [ ] Trend detection: dishes spiking in order volume
- [ ] Building-level footfall analytics for mall operators
- [ ] Anonymised data export for F&B research / NEA partnerships

**Implementation Notes**
- Scope: future phase — not in current MVP
- Payment integration candidates: Stripe (card), PayNow QR (SGD), GrabPay
- Order backend: separate microservice; consumer app uses optimistic UI + polling/WebSocket for status
- Crowd monitoring MVP: order count per stall per time window (no hardware sensors required)
- Regulatory: SFA food handler data and GST registration may be required for live transactions
