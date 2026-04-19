# Hungry — Master Task Contract

> **Last updated:** 2026-04-18 | **Phase:** Backend Live → Supply Priming
> Shared execution contract between Claude, Codex, and all agents.
> Read `tasks/lessons.md` before any implementation session.
> **Roadmap:** `tasks/Roadmap/roadmap.md` — single entry point for phase/sprint sequencing.

---

## How to Use This File

- Open items are ordered by priority. Work top-to-bottom.
- Before any non-trivial task: add a scoped mini-plan under the relevant sprint.
- During work: check off items as you go. Add inline notes for scope changes.
- Before ending a session: record a session log entry. Never mark done without a verification step.
- Source of truth precedence: Figma > `product-context.md` > this file > memory.

---

## 🔴 ACTIVE — Phase 7 / Sprint 5: Supabase Cloud Provisioning (BLOCKER)

> **Status:** Code artifacts complete on main. Only cloud provisioning and live-DB verification remain.
> **What's already shipped** (all in `src/lib/services/supabase/`, committed to main):
> - `supabaseRepository.ts` — full `DataRepository` implementation against Supabase client
> - `supabaseService.ts` — full `HungryService` implementation (auth, discovery, reviews, profile, social, content, ai)
> - `client.ts` — lazy Supabase client with `HUNGRY_DATA_SOURCE=mock|supabase` toggle
> - `mediaUpload.ts` — signed-URL photo upload helper
> - `serviceProvider.ts` — updated with env-driven provider swap
> - `useSessionStore.ts` — `applyAuthStateFromSession` + Supabase `onAuthStateChange` bridge
> - Migrations `0001`–`0009` written in `supabase/migrations/`
> - Seed SQL in `scripts/seed/generateSeedSQL.ts` + `supabase/seed.sql`
> **What remains:** external provisioning actions that require Supabase cloud access.

### Remaining actions (Codex + user)

- [ ] **PROV-01 — Create Supabase project** in ap-southeast-1 region via Supabase dashboard. Record `SUPABASE_URL` and `SUPABASE_ANON_KEY`. [User]
- [ ] **PROV-02 — Enable extensions** on the live project: PostGIS, pgvector, pg_trgm, btree_gist, citext. Run via Supabase SQL editor or `supabase db push`. [User/Codex]
- [ ] **PROV-03 — Apply migrations** `0001`–`0009` to the live database. Run `supabase db push` or apply SQL files in order via Supabase SQL editor. [Codex]
- [ ] **PROV-04 — Run seed data** via `node scripts/seed/generateSeedSQL.ts` output or `supabase db seed`. Verify buildings, venues, dishes, reviews load into Supabase tables. [Codex]
- [ ] **PROV-05 — Set env vars** in `.env.local` (dev) and EAS secrets (staging/prod): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Update `.env.example` template. [Codex]
- [ ] **PROV-06 — Smoke test `HUNGRY_DATA_SOURCE=supabase`** — launch app locally with real env vars. Verify home feed loads from Supabase, auth sign-up/login works end-to-end, profile saves persist. [Codex]
- [ ] **PROV-07 — Verify RLS policies** — sign in as two different users, confirm each user can only read/write their own reviews and profile. [Codex]
- [ ] **PROV-08 — Media upload smoke** — upload a review photo. Confirm it reaches Supabase Storage bucket and CDN URL renders in app. [Codex]

### Done gate

- [ ] All `DataRepository` methods return live data from Supabase (not mock).
- [ ] Auth flow (sign-up → email verify → onboarding → main app) works end-to-end against Supabase Auth.
- [ ] `HUNGRY_DATA_SOURCE=mock` still works as fallback — no regression.
- [ ] Review photo upload stores to Supabase Storage and displays via CDN URL.
- [ ] `npm run typecheck` passes.
- [ ] No `mockRepository` imports remain in production code paths.
- [ ] Manual crash test (ERR boundary): trigger a JS throw in `LoginScreen` render — app shows fallback UI, does not white-screen. *(Runtime smoke — do alongside PROV-06.)*
- [ ] Manual crash test (ERR boundary): trigger a JS throw in `DishDetailScreen` render — app shows fallback UI. *(Runtime smoke — do alongside PROV-06.)*

---

## 🟢 NEXT — Sprint 10: Supply Priming (starts after PROV-01 lands)

> **Owner:** Codex executes; Claude scopes contracts; Gemini scopes UX copy.
> **Depends on:** PROV-01 (Supabase project created) before CLM-02 migration can run.
> CLM-01 (DDL spec authoring) has no dependency — Claude can start immediately.
> **Full plan:** `tasks/Roadmap/roadmap.md` §4.

### Schema (Claude primary, Codex executes)

- [ ] **CLM-01 — Append DDL to `backend-architecture.md` §2.3** for three new tables:
  - `menu_photo_submissions` (photo storage pointer + OCR job status)
  - `dishes_draft` (extracted dishes pre-promotion: name, price, confidence, source_photo_id, venue_id)
  - `merchant_claim_interests` (UEN, contact, venue_id, claimed_at — the waitlist)
  [Claude — no Supabase dependency, start now]
- [ ] **CLM-02 — Write + run migration `0010_supply_priming.sql`** for the three new tables against live Supabase. (Numbered 0010 to follow existing 0009 sequence.) [Codex — requires PROV-01]

### Menu OCR pipeline (Codex primary)

- [ ] **OCR-01 — "Snap a menu photo" step in `QuickReviewSheet.tsx`** — optional step that collects a menu photo alongside the review. [Codex]
- [ ] **OCR-02 — Supabase Storage bucket `menu-photos`** + signed-URL upload flow with size/MIME guardrails (max 10MB, image/jpeg|png|heic). [Codex]
- [ ] **OCR-03 — Edge Function `ingest-menu-photo`** invoking Google Cloud Vision `DOCUMENT_TEXT_DETECTION` with `languageHints: ["zh-Hans", "zh-Hant", "en"]`. [Codex]
- [ ] **OCR-04 — LLM extraction step** (Gemini Flash or Claude Haiku) converts OCR text blob → `{name, price, modifiers[]}[]` with per-dish `extraction_confidence`. [Codex]
- [ ] **OCR-05 — Write to `dishes_draft` with dedupe** — cosine similarity on (name, price) vs existing draft rows for that venue; similarity > 0.9 → bump confidence on existing; else → insert new row. [Codex]
- [ ] **OCR-06 — Ops review queue at `/ops/dishes-draft`** — internal Next.js stub (admin-protected route) for accept / edit / reject of extracted dishes before consumer display. [Codex]

### Consumer-surface supply capture (Codex primary, Gemini copy)

- [ ] **CLM-03 — "Claim this stall" CTA on `StallDetailScreen`** — fires `merchant_claim_interests` insert + telemetry event `claim_this_stall_tapped`. [Codex]
- [ ] **CLM-04 — Copy spec for CTA + verification explainer page** — sets expectation for SingPass Myinfo Business / NEA licence / video walkaround flow. [Gemini]
- [ ] **CLM-05 — Feature flag `merchantClaimCtaEnabled`** added to `src/constants/featureFlags.ts` — OFF production, ON staging. [Codex]
- [ ] **CLM-06 — "Menu (community-sourced)" block on `StallDetailScreen`** — renders accepted `dishes_draft` rows so consumers get value from their own uploads. [Codex]

### Done gate

- [ ] OCR pipeline processes a test menu photo end-to-end in staging within 30s (upload → Vision → extraction → `dishes_draft` row in ops queue).
- [ ] "Claim this stall" CTA fires telemetry event AND inserts a `merchant_claim_interests` row in staging.
- [ ] `npm run typecheck` passes.
- [ ] `npm run test` passes.
- [ ] Feature flag `merchantClaimCtaEnabled` OFF in production, ON in staging (verified via live flag read).

---

## 🔵 FUTURE — Phase 8: Merchant Portal & QR Ordering (V2)

> **Gate — do NOT start until ALL five are green:**
> 1. ≥500 active consumer WAU sustained 4 consecutive weeks.
> 2. ≥20 hawker centres with ≥80% venue coverage.
> 3. ≥50 rows in `merchant_claim_interests`.
> 4. ≥5 merchants committed to pilot onboarding (phone-confirmed, not just waitlist).
> 5. Sprint 5 Supabase provisioning fully green (staging + prod).
>
> **Full plan:** `tasks/Roadmap/roadmap.md` §5–§6.

### Sprint 11 — Merchant Portal skeleton + Verification

- [ ] **MP-01 — Standalone Next.js merchant portal app** (separate deploy; orthogonal to consumer app auth/session/bundling). [Codex + Claude architect]
- [ ] **MP-02 — SingPass Myinfo Business integration (Tier 1)** — instant ACRA pull by UEN. Primary verification path for registered businesses. [Codex]
- [ ] **MP-03 — NEA licensed hawker lookup adapter (Tier 2)** — licence number + stall address match against NEA dataset. [Codex]
- [ ] **MP-04 — Video walkaround upload + ops review queue (Tier 3)** — 30s stall walk; ops reviews ≤48h. Replaces postcard. [Codex]
- [ ] **MP-05 — `vendor_profiles.kyc_status` state machine** — `pending → in_review → verified | rejected`. DDL in `backend-architecture.md`. [Claude spec, Codex impl]
- [ ] **MP-06 — Verification explainer page + merchant FAQ.** [Gemini]

### Sprint 12 — Merchant Menu Editor + Claim Promotion

- [ ] **MP-07 — Merchant menu editor** — `dishes_draft` review → accept/edit/reject → promote to `dishes`. [Codex]
- [ ] **MP-08 — Modifier group editor** — wire `modifier_groups`, `modifier_options`, `dish_modifier_groups` from `backend-architecture.md`. [Codex]
- [ ] **MP-09 — Claim review workflow** — merchant claim → ops review → "Verified" badge on `StallDetailScreen`. [Codex]
- [ ] **MP-10 — Pilot onboarding cohort** — 5–10 hawkers from `merchant_claim_interests` top of waitlist. [Claude facilitates]

### Sprint 13 — Payment Rails

- [ ] **PAY-01 — Stripe Connect Express onboarding** — merchant hosted KYC; weekly payouts. Primary rail. [Codex]
- [ ] **PAY-02 — SGQR/PayNow secondary rail** — requires bank partnership (DBS/OCBC); 2026-Q4 deliverable. Don't block Sprint 13. [Claude scopes, Codex impl]
- [ ] **PAY-03 — Payout scheduling + bank account linking flow.** [Codex]
- [ ] **PAY-04 — GST 9% + service-fee calculation** — `order.tax_cents`, `order.service_fee_cents`. [Claude spec]

### Sprint 14 — QR Session + Consumer Order Flow

- [ ] **QR-01 — QR session issuance API** — `POST /api/merchant/qr-sessions`. [Codex]
- [ ] **QR-02 — Printable QR asset generator** — PNG + PDF with Hungry branding. [Codex]
- [ ] **QR-03 — Consumer deep-link handler** — `hungry://order?venueId=X&qrSessionId=Y&table=A3` → cart. [Codex]
- [ ] **QR-04 — Cart + checkout screens** — dish list, modifiers, totals, tax/service-fee breakdown. [Codex + Gemini design]
- [ ] **QR-05 — Stripe PaymentSheet in Expo** — `@stripe/stripe-react-native`. [Codex]
- [ ] **QR-06 — Order creation API + idempotency keys.** [Codex]

### Sprint 15 — Merchant Order Inbox + Lifecycle

- [ ] **QR-07 — Merchant order inbox** — realtime via Supabase Realtime subscribed to merchant's `vendor_id` partition. [Codex]
- [ ] **QR-08 — Order status lifecycle UI** — `placed → accepted → preparing → ready → collected`. [Codex + Gemini]
- [ ] **QR-09 — Push notifications** — order accepted (consumer), order ready (consumer), new order (merchant). [Codex]
- [ ] **QR-10 — Refund flow** — `refunds` table + Stripe refund API. [Codex]
- [ ] **QR-11 — Weekly Stripe payout confirmation email.** [Codex]

---

## ✅ Completed Archive

> Items below are done. Kept for context and audit trail only.

### Sprints 1–9 ✅

All consumer-facing phases shipped. Summary:
- **Phase 1–3:** Repo bootstrap, core screens (auth, home, discover, maps, profile, reviews, reads), hardening pass 1.
- **Phase 4–6:** Maps rebuild (Mapbox + drill-down), marketing launch kit, AI food engine (taste vectors, cosine ranking, `decideForMe`).
- **Sprint 7 (P0):** All dead-end routes wired, typecheck passing.
- **Sprint 8 (P1):** Empty states, review persistence, auth error feedback, service layer, discovery presets, skeleton screens, offline route trigger, error boundaries (`FeedErrorBoundary` on auth + detail screens), ERR_BOUNDARY_SPEC.md, offline connectivity listener in `useAppBootstrap`.
- **Sprint 9 (P2):** Unit test coverage (68 tests), deep linking, haptics, share sheet, photo carousel, font fallback, `useOrderStore`/`useCartStore` V2 stubs.
- **Expo 55 / React Native 0.85.1 upgrade** (2026-04-18): iOS pods updated, Hermes 0.85, multiple patches applied, PR #20 fixed lazy-load Supabase TypeError.

### Sprint 5 Code Artifacts ✅ (provisioning pending → see ACTIVE section)

All code written and on main. Cloud provisioning is the remaining external action:
- `src/lib/services/supabase/supabaseRepository.ts` — DataRepository implementation.
- `src/lib/services/supabase/supabaseService.ts` — HungryService implementation.
- `src/lib/services/supabase/client.ts` — lazy Supabase client + `HUNGRY_DATA_SOURCE` toggle.
- `src/lib/services/supabase/mediaUpload.ts` — signed-URL upload helper.
- `serviceProvider.ts` — env-driven provider swap.
- `useSessionStore.ts` — `applyAuthStateFromSession` + Supabase `onAuthStateChange` bridge.
- Migrations `0001`–`0009` in `supabase/migrations/`.
- Seed SQL in `scripts/seed/generateSeedSQL.ts` + `supabase/seed.sql`.

### Sprint 6 ✅

All items completed. Verification evidence in session log:
- TOOL-01..04: ESLint flat config, Prettier, husky pre-commit, lint-staged CI step — all verified 2026-04-17.
- DEAD-01..04: Stale files removed in Sprint 7 commit `00f03e256`.
- ERR-00: `docs/audit/ERR_BOUNDARY_SPEC.md` + logic tests (commit `b91ffd28e`).
- ERR-01/02: `FeedErrorBoundary` on 5 auth + 2 detail screens (verified 2026-04-17).
- DOC-01: Feature Flags section in README.md (commit `b91ffd28e`).
- LES-01: 4 lessons appended to `tasks/lessons.md`.
- Loading/error states audit: `docs/audit/OFFLINE_SPEC.md` authored (Gemini, commit `df4bbe773`).

---

## 5. Shared Session Log (Claude + Codex must append)

- [x] Session log maintained with: date, actor (Claude/Codex), tasks touched, status, blockers, next step.

### Session Entries (recent — full history in git log)

- 2026-04-18 | Claude (Sonnet 4.6) | Read all 15 main commits post-branch, audited actual code deliverables. Updated `tasks/todo.md`: restructured so active items (Phase 7 provisioning) are first, Sprint 10 is second, Phase 8 gated third; archived all Sprints 1–9 and Sprint 5 code artifacts; corrected DOC-01 and ERR-00 to `[x]` (code confirmed in `b91ffd28e`); renamed CLM-02 migration to `0010_supply_priming.sql` (correct sequence after existing 0009). Updated `tasks/Roadmap/roadmap.md` §2 status snapshot to reflect Expo 55/RN 0.85.1 upgrade and corrected Sprint 5 status (code done, provisioning pending). | Status: documentation complete. | Blockers: Supabase cloud project not yet created (PROV-01) — this is the only external blocker. | Next: user creates Supabase project (PROV-01), then Codex runs PROV-02..08 to verify live data; in parallel Claude authors CLM-01 DDL spec.
- 2026-04-17 | Claude (Sonnet 4.7) | Strategic advisory for merchant expansion delivered. Consolidated 8 overlapping `tasks/Roadmap/*.md` drafts into `tasks/Roadmap/roadmap.md`. Authored Sprint 10 (Supply Priming) + Phase 8 (Merchant Portal + QR Ordering V2). Decision recorded: Merchant Portal ships as V2, not V1. 3 lessons appended to `tasks/lessons.md`. | Status: documentation complete. | Blockers: Sprint 5 provisioning. | Next: Codex Sprint 10 after Sprint 5 lands.
- 2026-04-17 | Gemini | Hardened navigation: disabled tab click animations. Completed ERR-00 spec and OFFLINE_SPEC. Implemented DiscoverHome loading skeletons and global NetInfo listener. DOC-01 (README Feature Flags) complete. Verified ERR-01/02/03 via logic tests. | Status: ✅ Done | Verification: `npm test` (46/46 passed), `npm run typecheck` green, pushed to main (`b91ffd28e`).
- 2026-04-17 | Codex | Sprint 5 backend hardening: removed mock fallbacks in runtime paths, fixed env data-source precedence, added `mediaUpload.ts`, wired ReviewScreen + EditProfileScreen to Supabase, added regression tests. | Status: partially completed (code done; external provisioning + auth-UI migration pending). | Blockers: global typecheck has pre-existing failures on unrelated files. | Next: finish auth-screen Supabase sign-in flow + clear typecheck debt, then end-to-end verification.
- 2026-04-17 | Codex | Sprint 9 non-UI closure: haptic on Decide For Me, real share sheet, ImageCarousel in DishDetail, ProfileRadarChart co-location, async-safe popularNearby, `useOrderStore`/`useCartStore` V2 stubs. | Status: completed + verified.
- 2026-04-17 | Claude (Sonnet 4.7) | Sprint 5/6/8 audit. Flipped TOOL-01..04, DEAD-01..04, ERR-01/02 to [x] with verification evidence. Sprint 5 Supabase Codex items confirmed open (no `src/lib/services/supabase/` directory at that point). | Status: documentation audit complete.

---

## 6. Verification Commands Log

- [x] `npm run typecheck` — 2026-04-17 (Sprint 9 Wave 5 gate)
- [x] `npm run test` — 2026-04-17 (Sprint 9 Wave 5 gate, 68 tests, 0 failures)
- [x] `npx expo-doctor` — 2026-04-17 (Sprint 9 Wave 5 gate, 16/16)

---

## Cross-Cutting: Ongoing Responsibilities

| Agent | Standing Responsibility |
|-------|------------------------|
| **Claude** | Architecture decisions, contract definitions, planning docs, event taxonomy maintenance, tradeoffs log, backlog truthfulness. |
| **Codex** | All code implementation, typecheck enforcement, test coverage, migration execution, dependency management. |
| **Gemini** | Design token governance, visual spec, UI/UX audit, accessibility compliance, component pattern guidance. |
| **All** | Update `tasks/todo.md` after every work block. Record lessons in `tasks/lessons.md`. Never mark Done without verification evidence. |
