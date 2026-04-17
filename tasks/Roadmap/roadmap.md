# Hungry — Master Roadmap

> Single source of truth for phase/sprint sequencing across the Hungry program.
> Last updated: **2026-04-17**
> Replaces ad-hoc reading across `tasks/Roadmap/*.md` as the READ-FIRST entry point.
> Source documents remain on disk for auditability — see §11 Archive Map for deep-read references.

---

## 0. How to read this doc

This roadmap is the READ-FIRST document for any strategic, planning, or sequencing question about Hungry. It replaces the "pick one of eight overlapping docs" problem.

**Reading pattern**
- Skim §1 (Phase Index) to locate the phase you care about.
- Read §2 (Status Snapshot) for current-state truth.
- Jump into §3–§6 for phase detail.
- Use §7 (Architecture References) when you need canonical specs — this doc DOES NOT duplicate DDL, DB schema, or infra runbooks. It links out.
- Check §10 (Decisions Log) before proposing strategy changes.
- Check §11 (Archive Map) if you want the original source doc for a given section.

**Rules of the road**
- Roadmap changes require an entry in §10 Decisions Log on the same commit.
- Tactical task rows live in `tasks/todo.md`, not here. This doc is the plan; `todo.md` is the ledger.
- Source docs under `tasks/Roadmap/*.md` are NOT deleted when folded — they stay for audit trail and deep-reads.

---

## 1. Phase Index

| Phase | Name | Status | Primary Output |
|------|------|--------|---------------|
| Phase 1 | Consumer MVP | ✅ Shipping (beta) | Consumer app, AI feed, maps, venue directory |
| Phase 2 | Supply Priming (V1.5 Prep) | 🟢 Next | Menu OCR pipeline + "Claim this stall" waitlist |
| Phase 3 | Merchant Portal (V1.5) | 🔵 Deferred | Merchant web app, SG verification, menu editor |
| Phase 4 | QR Ordering (V2) | 🔵 Deferred | Stripe Connect, QR sessions, order lifecycle |

Phases 3 and 4 are gated on demand-side proof points — see §4.2.

---

## 2. Active Status Snapshot (as of 2026-04-17)

**Consumer MVP — Phase 1**
- Phases 1–3 (bootstrap, core screens, hardening): **Done** — folded Sprints 1–3.
- Phases 4–6 (maps, launch kit, AI engine): **Done** — folded Sprints 4-launch work and AI engine design.
- Sprint 6 (tooling + dead code + error boundaries): **Done** — TOOL-01..04, DEAD-01..04, ERR-01/02 verified 2026-04-17.
- Sprint 7 (UI overhaul + navigation refactor + mock service layer): **Done** — PR #19 merged.
- Sprint 8 (P1 beta hardening): **Mostly done** — offline connectivity listener remaining item audited.
- Sprint 5 (Supabase backend migration): **🟡 Open** — Codex executes; specced in `backend-migration-plan.md`.

**Supply Priming — Phase 2**
- Sprint 10: **🟢 Scoped, not started.** Gates Phase 3 start.

**Merchant Portal — Phase 3**
- Sprints 11–12: **🔵 Blocked.** Gate criteria in §4.2 not yet satisfied.

**QR Ordering — Phase 4**
- Sprints 13–15: **🔵 Blocked.** Requires Phase 3 complete + payment rails decision committed.

**Critical open path**
Sprint 5 Supabase migration must land before any Phase 2 / Phase 3 / Phase 4 work can execute against a real backend. OCR pipeline (Sprint 10) inserts into `dishes_draft` and `menu_photo_submissions`, which don't exist until Sprint 5 provisions Supabase and Sprint 10 runs its own DDL migration (`0004_supply_priming.sql`).

---

## 3. Phase 1 — Consumer MVP

### 3.1 Done — Bootstrap, Core Screens, Hardening (Phases 1–3)

Covered historical Sprints 1–3. The Expo SDK 54 / React Native 0.81 / TypeScript strict stack was bootstrapped; core screens (Feed, Discover, Map, Profile, Venue Detail) were built; Zustand stores and mock data contracts were frozen as "protected paths" in `CLAUDE.md`.

Canonical spec: see `mvp_audit_and_v1_roadmap.md` §1–3.

### 3.2 Done — Maps + Launch Kit + AI Engine (Phases 4–6)

- **Maps (Phase 4):** Mapbox SDK integration, hawker centre polygons for 17 malls / 936 F&B tenants dataset, venue clustering, venue detail deep-link (`hungry://venue/:id`).
- **Launch Kit (Phase 5):** App store assets, marketing site stubs, beta distribution (TestFlight + Internal App Sharing).
- **AI Recommendation Engine (Phase 6):** Two-tower retrieval + reranker design, pgvector embedding store, Quick Review → taste-vector update loop, latency budget <250ms p95. Canonical spec: `AI Food Recommendation Engine Design.md`.

### 3.3 Done — Sprint 6 Tooling / Sprint 7 UI Overhaul / Sprint 8 P1 Hardening

**Sprint 6 — Tooling & Dead Code & Error Boundaries (merged)**
- TOOL-01..04: ESLint flat config, Prettier, husky pre-commit, lint-staged — verified 2026-04-17.
- DEAD-01..04: stale `_archive/` trees + unused `src/utils/legacyFeed*` removed in Sprint 7 commit `00f03e256`.
- ERR-01/02: `FeedErrorBoundary` wrapped on 5 auth screens + 2 detail screens — verified 2026-04-17.

Historical reference: `chief-of-staff-report-2026-04-15.md` (folded into this section) and `state_of_the_union.md` (folded into §2).

**Sprint 7 — UI Overhaul + Navigation Refactor + Mock Service Layer (PR #19 merged)**
- Navigation refactored to React Navigation v7 typed routes.
- Mock data moved behind `src/services/mock/` façade so a real Supabase client can drop in without touching screens.
- Visual refresh on Feed, Profile, Venue Detail.

Historical reference: `hashed-conjuring-adleman.md` (folded into this section).

**Sprint 8 — P1 Beta Hardening (mostly done)**
- Crash reporting (Sentry), analytics (PostHog), feature flags module (`src/constants/featureFlags.ts`).
- Offline connectivity listener: **open** — tracked in `todo.md` under Sprint 8 residuals.

### 3.4 Active — Sprint 5 Supabase Backend Migration

**Owner:** Codex primary; Claude specifies contracts.
**Canonical spec:** `backend-migration-plan.md`.

Sprint 5 provisions Supabase (PostgreSQL 16 + PostGIS + pgvector + pg_trgm + btree_gist + citext) in `ap-southeast-1`, applies V2 DDL from `backend-architecture.md` (vendor_profiles, qr_sessions, orders, modifier_groups, …), migrates mock data → real tables, and swaps the mock service façade for Supabase client calls.

**Until Sprint 5 lands, Sprints 10+ cannot execute.** This is the critical-path item for the entire merchant expansion program.

---

## 4. Phase 2 — Supply Priming (NEW)

### 4.1 Sprint 10: Menu OCR + "Claim this stall" CTA + waitlist

**Why this phase exists**

Hungry is a two-sided marketplace. Shipping a merchant portal before consumer demand exists is the classic chicken-and-egg failure mode — merchants sign up, see empty order inbox, churn. The solution: **prime supply passively during consumer-only V1**, so by the time Phase 3 launches the merchant portal, there is a warm waitlist of interested merchants AND a pre-populated draft menu database.

**What Sprint 10 ships**

1. **Menu OCR pipeline** — Quick Review flow gains an optional "snap a menu photo" step. Photos land in Supabase Storage, trigger `ingest-menu-photo` Edge Function → Google Cloud Vision DOCUMENT_TEXT_DETECTION (SimpChinese + TradChinese + English) → Gemini Flash / Claude Haiku extraction into `{name, price, modifiers[]}` → insert into `dishes_draft` with confidence score + dedupe via cosine similarity on (name, price).
2. **"Claim this stall" CTA** — consumer-facing call-to-action on `StallDetailScreen` that inserts a row into `merchant_claim_interests` (the waitlist). Ships behind feature flag `merchantClaimCtaEnabled` (OFF in production until public launch; ON in staging).
3. **Community-sourced menu block** — `StallDetailScreen` renders accepted `dishes_draft` rows as "Menu (community-sourced)" so consumers get immediate value from their own photo uploads.
4. **Ops review queue** — internal Next.js stub at `/ops/dishes-draft` lets a human reviewer accept/reject extracted dishes before they render to consumers.

**New tables (DDL goes into `backend-architecture.md` §2.3 via CLM-01)**
- `menu_photo_submissions` — photo storage pointer + OCR job status.
- `dishes_draft` — extracted dishes pre-promotion; (name, price, confidence, source_photo_id, venue_id).
- `merchant_claim_interests` — UEN, contact, venue_id, claimed_at.

**Cost envelope**

Google Cloud Vision DOCUMENT_TEXT_DETECTION ≈ US$1.50 per 1k images. Gemini Flash extraction ≈ US$0.075 per 1k requests. At 10k images/month (optimistic V1 volume) the OCR + extraction bill is **~US$25/month** — negligible.

### 4.2 Gate criteria to advance to Phase 3

Phase 3 (Merchant Portal) does **not** start until ALL five gates are green:

1. ≥500 active consumer WAU (weekly active users) sustained for 4 consecutive weeks.
2. ≥20 hawker centres with ≥80% venue coverage (stall directory completeness).
3. ≥50 rows in `merchant_claim_interests`.
4. ≥5 merchants committed to pilot onboarding (qualitative — phone calls, not just waitlist signups).
5. Sprint 5 Supabase migration fully green (staging + production environments).

If any gate fails, the fix is to iterate on consumer growth and OCR coverage — NOT to start the merchant portal anyway.

---

## 5. Phase 3 — Merchant Portal (V1.5)

### 5.1 Sprint 11 — Merchant Portal skeleton + Verification

**Standalone Next.js app, separate deploy** (not embedded in consumer app). Keeps merchant-side auth, session, and bundling orthogonal to consumer app.

**Singapore verification tiering**

Benchmarking Grab Food (ACRA + NEA + video), Google Business Profile (postcard — performs poorly in SG context), and foodpanda (manual KYC + NEA licence):

- **Tier 1 — SingPass Myinfo Business (UEN holders, instant).** User logs in with Singpass → consents to Myinfo Business pull → ACRA business info (UEN, business name, registration status, business activities) arrives pre-verified. **This is the primary path** for any merchant with a registered business entity. Zero manual review.
- **Tier 2 — NEA Licensed Hawker Lookup (licence number + address match).** Singapore NEA publishes a list of licensed hawker stalls. Merchant enters licence number + stall address; we match against NEA's dataset. Passes → auto-verify. Fails → escalate to Tier 3.
- **Tier 3 — Video walkaround (escalation).** Merchant films a 30-second walk through their stall showing signage, menu board, and point-of-sale. Ops reviews within 48h. This replaces the postcard pattern Google inherited from the US — postcards work poorly in SG hawker centres (shared mail, no street-level addressing at stall level).
- **SFA Food Shop Licence (supplementary).** For non-hawker F&B (cafés, restaurants), pull Singapore Food Agency licence as secondary verification.

**Verification state machine**

```
pending → in_review → verified
                    → rejected → (merchant can re-submit with new evidence)
```

Stored on `vendor_profiles.kyc_status`. Canonical DDL already in `backend-architecture.md` §2.3.

### 5.2 Sprint 12 — Merchant Menu Editor + Claim Promotion

- Merchant menu editor: review `dishes_draft` seeded by Sprint 10 OCR → accept/edit/reject → promote to authoritative `dishes` table.
- Modifier group editor wires `modifier_groups` and `modifier_options` from `backend-architecture.md` §2.3.
- Claim review workflow: merchant claims stall → ops reviews → "Verified" badge renders on consumer `StallDetailScreen`.
- Pilot onboarding cohort: 5–10 hawkers drawn from the top of the `merchant_claim_interests` waitlist.

### 5.3 Verification-flow state machine

See §5.1. State transitions audited in `order_status_history` pattern (separate table `vendor_kyc_history` — DDL added in Sprint 11 scope).

---

## 6. Phase 4 — QR Ordering (V2)

Canonical architecture: `mvp_audit_and_v2_roadmap.md` §2.2 (QR flow) — not duplicated here.

### 6.1 Sprint 13 — Payment Rails

- **Primary: Stripe Connect Express.** Merchant onboarding via Stripe hosted flow. Stripe handles KYC layering (we've already done business verification in Sprint 11; Stripe adds payment-grade KYC). Weekly payouts to merchant bank account.
- **Secondary: SGQR/PayNow.** SG-native rail. Requires bank partnership (DBS or OCBC) and likely a 2026-Q4 deliverable — not Sprint 13 critical path. Scope as optional rail; don't block on it.
- **Phase 2 rails (later):** GrabPay for consumer convenience; DBS PayLah! for one-tap payment. Both deferred past Sprint 13.
- Tax (GST 9%) + service-fee calculation lives on `order.tax_cents` / `order.service_fee_cents` — DDL already in `backend-architecture.md`.

### 6.2 Sprint 14 — QR Session Issuance + Cart/Checkout

- `POST /api/merchant/qr-sessions` issues a `qr_sessions` row with `token`, `venue_id`, optional `table_label`, `expires_at`. Printable QR asset generator outputs PNG + PDF with Hungry branding.
- Consumer deep-link: `hungry://order?venueId=X&qrSessionId=Y&table=A3`. App parses → resolves menu from `dishes` → renders cart.
- Cart + checkout screens integrate Stripe PaymentSheet in Expo. Order creation API uses idempotency keys to dedupe double-taps.

### 6.3 Sprint 15 — Merchant Order Inbox + Order Lifecycle

- Realtime merchant order inbox via Supabase Realtime subscribed to `orders` partition for that `vendor_id`.
- Order status lifecycle: placed → accepted → preparing → ready → collected. Each transition audited in `order_status_history`.
- Push notifications: order accepted (consumer), order ready (consumer), new order (merchant).
- Refund flow: `refunds` table + Stripe refund API + merchant-initiated partial/full refund UI.
- Weekly Stripe payout confirmation email to merchant.

---

## 7. Cross-Cutting Architecture References

This doc intentionally does NOT duplicate schemas, infra configs, or AI engine specs. Deep-read the canonical docs:

| Topic | Canonical source |
|-------|------------------|
| Backend DDL (vendor_profiles, qr_sessions, orders, modifier_groups, …) | `tasks/backend-architecture.md` §2 |
| AI retrieval + reranker + pgvector design | `tasks/Roadmap/AI Food Recommendation Engine Design.md` |
| Production env + observability + runbooks | `tasks/Roadmap/production-infrastructure.md` |
| Sprint 5 Supabase migration step-by-step | `tasks/Roadmap/backend-migration-plan.md` |
| V2 QR order flow architecture | `tasks/Roadmap/mvp_audit_and_v2_roadmap.md` §2.2 |

---

## 8. Merchant Verification Benchmark & SG Context

**What competitors do**

| Platform | Primary verification |
|----------|---------------------|
| Grab Food | ACRA pull via UEN + NEA licence + optional video |
| Google Business Profile | Postcard to physical address (slow, ~2 weeks in SG) + optional video |
| foodpanda | Manual KYC + NEA licence upload + bank account verification |

**Where Google's postcard pattern breaks in SG**

- Hawker stalls share centre-level mailing addresses — stall number rarely routes mail correctly.
- Hawker operators are frequently at the stall, not a mailing address — no one to receive postcards.
- 2-week verification latency loses merchants to competitors.

**Hungry's approach: 3-tier instant-first flow**

1. **SingPass Myinfo Business (instant, 0 ops touch).** Covers any merchant with a registered UEN — the majority of formally incorporated F&B businesses.
2. **NEA Licensed Hawker Lookup (instant when licence + address match).** Covers the hawker long tail without requiring UEN.
3. **Video walkaround (48h ops review).** Fallback for edge cases. Replaces postcards entirely.

**Supplementary rails**
- SFA Food Shop Licence lookup for non-hawker F&B.
- Future: IRAS GST registration status for tax-compliance signal on consumer-facing verification badge.

**Decision rationale**

SG's identity infrastructure (SingPass Myinfo Business) is best-in-class globally. Any SG-first product that doesn't use it is leaving instant-verification UX on the table. Postcard is a US pattern — don't import it.

---

## 9. Menu Ingestion Pipeline

**Goal:** pre-populate `dishes_draft` during consumer-only V1 so merchants onboarding in Phase 3 see a draft menu they only have to edit, not create from scratch.

**Pipeline**

```
Consumer snaps menu photo
    ↓ (Quick Review flow, optional step)
Upload via signed URL to Supabase Storage bucket "menu-photos"
    ↓
Edge Function ingest-menu-photo triggered on upload
    ↓
Google Cloud Vision DOCUMENT_TEXT_DETECTION
    (SimpChinese + TradChinese + English — covers SG hawker reality)
    ↓
Raw text blob → Gemini Flash / Claude Haiku extraction
    (prompt: "Extract dishes as JSON array of {name, price, modifiers[]}")
    ↓
For each extracted dish:
    - Compute cosine similarity on (name, price) vs existing dishes_draft for that venue
    - If similarity > 0.9 → increment confidence on existing row
    - Else → insert new row with confidence = extraction_confidence * 1.0
    ↓
Ops review queue at /ops/dishes-draft
    - Accept → renders on StallDetailScreen as community-sourced menu
    - Reject → soft-delete with reason code
    - Edit → normalizes name / price / modifiers before accepting
    ↓
Phase 3 merchant onboarding:
    - Merchant sees dishes_draft for their claimed stall
    - Accepts / edits / promotes to authoritative dishes table
```

**Not in scope for Sprint 10**

- Food-blog scraping (deferred — legal review needed on each blog's ToS).
- Google Maps menu parsing (API doesn't expose structured menu data).
- Instagram / Xiaohongshu menu photo mining (considered, deferred — high noise, low precision).

---

## 10. Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-17 | Merchant Portal deferred to V2 (Phase 3), NOT V1 launch | Two-sided marketplace gating: consumer demand must exist before supply side ships, else merchants churn from empty order inbox. |
| 2026-04-17 | V1 primes supply passively via Menu OCR + "Claim this stall" waitlist CTA | So Phase 3 launches to a warm waitlist with pre-populated draft menus, not a cold start. |
| 2026-04-17 | Menu OCR greenlit for Sprint 10 | Cost envelope (~US$25/month at 10k images) is negligible; upside is pre-populated draft menus at Phase 3 launch. |
| 2026-04-17 | Payment rails: Stripe Connect Express primary, SGQR/PayNow secondary | Stripe ships today; SGQR/PayNow requires bank partnership with long lead time — don't block on it. |
| 2026-04-17 | Verification: SingPass Myinfo Business Tier 1, NEA lookup Tier 2, video walkaround Tier 3 | Postcard pattern fails in SG hawker context (shared addresses, operator-not-at-address). Instant SG-native rails win. |
| 2026-04-17 | Roadmap consolidation: single `roadmap.md` entry point, source docs preserved on disk | Preserves audit trail while eliminating "which of 8 docs is current?" problem. |

---

## 11. Archive Map

Source documents under `tasks/Roadmap/` are preserved unchanged. This roadmap folds them here:

| Source file | Folded into | Kept for |
|-------------|-------------|----------|
| `mvp_audit_and_v1_roadmap.md` | §3 Phase 1 (historical reference) | Sprint-level detail on Phases 1–3 |
| `mvp_audit_and_v2_roadmap.md` | §6 Phase 4 (canonical QR + messaging spec) | Deep-read for QR order flow internals |
| `backend-migration-plan.md` | §3.4 Sprint 5 (canonical Codex spec) | Step-by-step Supabase migration playbook |
| `production-infrastructure.md` | §7 (canonical env + observability) | Runbooks, env vars, alert policies |
| `AI Food Recommendation Engine Design.md` | §7 (canonical AI spec) | Retrieval, reranker, embedding store design |
| `chief-of-staff-report-2026-04-15.md` | §3.3 Sprint 6 history | Historical narrative on Sprint 6 close |
| `state_of_the_union.md` | §2 Status Snapshot | Prior-snapshot audit trail |
| `hashed-conjuring-adleman.md` | §3.3 Sprint 7 closure | Sprint 7 closure narrative |

Deep-read any source file directly when you need detail this roadmap omits. This doc summarizes; the sources specify.
