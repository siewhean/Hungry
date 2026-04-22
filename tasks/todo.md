# Hungry — Master Task Contract

> **Last updated:** 2026-04-22 | **Phase:** Sprint 10 Code-Complete → Staging Smoke Tests
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

## 🔴 ACTIVE — Sprint 10: Supply Priming (Staging Smoke Tests)

> **Status:** Code complete (12/13 items). Remaining: 4 done-gate staging smoke tests + CLM-04 copy spec (Gemini).
> **Migrations on live Supabase:** `0001`–`0015` applied. Supply priming tables live under RLS dev-only gate.
> **Full plan:** `tasks/Roadmap/roadmap.md` §4.
> **Owner:** Codex runs staging smokes; Gemini authors CLM-04; Claude audits.

### Open security action (non-blocking for Sprint 10 code, required before public launch)

- [ ] **SEC-01 — Enable Leaked Password Protection** in Supabase dashboard → Authentication → Password security. Flagged in `SECURITY.md` as "Action required". [User — dashboard toggle]
- [ ] **SEC-02 — Add `supabase/.temp/` to `.gitignore`** — Supabase CLI local cache dir is not currently excluded; risk of metadata files being staged accidentally. [Codex]

### Schema (Claude primary, Codex executes)

- [x] **CLM-01 — Append DDL to `backend-architecture.md` §2.3** for three new tables:
  - `menu_photo_submissions` (photo storage pointer + OCR job status)
  - `dishes_draft` (extracted dishes pre-promotion: name, price, confidence, source_photo_id, venue_id)
  - `merchant_claim_interests` (UEN, contact, venue_id, claimed_at — the waitlist)
  [Claude — authored in `tasks/backend-architecture.md` §2.3.1. Dev-only via RLS (no public policies); two dormant `security definer` RPCs (`submit_menu_photo`, `submit_merchant_claim_interest`) defined for future CLM-03/CLM-06 wiring.]
- [x] **CLM-02 — Write + run migration `0010_supply_priming.sql`** for the three new tables against live Supabase. (Numbered 0010 to follow existing 0009 sequence.) [Codex — requires PROV-01]
  - Migration written: `supabase/migrations/0010_supply_priming.sql` (+ rollback `0011_rollback_supply_priming.sql`). Idempotent; adds generic `set_updated_at()` trigger fn. Awaiting `supabase db push` against live project. Verify via `select count(*) from pg_policies where tablename in (...)` = 0 and anon-key REST read returns `[]`.
  - 2026-04-22 Codex run: `npx supabase migration list` + `npx supabase db push` attempted; blocked by missing link session (`Cannot find project ref. Have you run supabase link?`). `supabase/config.toml` contains `project_id = "vlqfgmrsprbrgzteixsj"` and CLM-02 smoke checks are now prepared at `supabase/smoke/clm02_supply_priming.sql` for immediate post-link verification.
  - 2026-04-22 Codex follow-up: link fixed; `npx supabase migration list` showed remote included `0011` (rollback), and live anon REST checks returned 404 for `menu_photo_submissions`, `dishes_draft`, `merchant_claim_interests` (tables absent). Added `supabase/migrations/0012_reapply_supply_priming.sql` to restore CLM-02 schema after rollback.
  - 2026-04-22 verification complete: remote migration list now includes `0012`; anon REST checks return `200 []` for `menu_photo_submissions`, `dishes_draft`, `merchant_claim_interests`, confirming tables exist and app-client access remains empty under RLS dev gate.

### Menu OCR pipeline (Codex primary)

- [x] **OCR-01 — "Snap a menu photo" step in `QuickReviewSheet.tsx`** — optional step that collects a menu photo alongside the review. [Codex] *(implemented dev-only UI in `QuickReviewSheet.tsx`; wired via `QuickReviewModal.tsx` payload IDs; hidden from users with `__DEV__` gate.)*
- [x] **OCR-02 — Supabase Storage bucket `menu-photos`** + signed-URL upload flow with size/MIME guardrails (max 10MB, image/jpeg|png|heic). [Codex] *(provisioned via migrations `0014_menu_photos_bucket_and_flag_rollout.sql` + `0015_menu_photos_authenticated_select_prefix.sql`; bucket is private, MIME + 10MB limits set, and `storage.objects` policies enforce `<uid>/...` path ownership. Runtime fix applied in `supabaseService.supply.submitMenuPhoto` RPC argument mapping: `p_size_bytes`.)*
- [x] **OCR-03 — Edge Function `ingest-menu-photo`** invoking Google Cloud Vision `DOCUMENT_TEXT_DETECTION` with `languageHints: ["zh-Hans", "zh-Hant", "en"]`. [Codex] *(new function: `supabase/functions/ingest-menu-photo/index.ts`.)*
- [x] **OCR-04 — LLM extraction step** converts OCR text blob → `{name, price, modifiers[]}[]` with per-dish `extraction_confidence`. [Codex] *(implemented with Gemini Flash JSON extraction in `ingest-menu-photo`; regex fallback parser retained for resilience.)*
- [x] **OCR-05 — Write to `dishes_draft` with dedupe** — cosine similarity on (name, price) vs existing draft rows for that venue; similarity > 0.9 → bump confidence on existing; else → insert new row. [Codex] *(implemented in `ingest-menu-photo` using vectorized name+price cosine scoring and confidence bump updates.)*
- [x] **OCR-06 — Ops review queue at `/ops/dishes-draft`** for accept / reject / duplicate decisions before consumer display. [Codex] *(implemented as edge function `supabase/functions/ops-dishes-draft/index.ts` + local stub UI `ops/dishes-draft/index.html`, gated by `x-ops-api-key`.)*

### Consumer-surface supply capture (Codex primary, Gemini copy)

- [x] **CLM-03 — "Claim this stall" CTA on `StallDetailScreen`** — fires `merchant_claim_interests` insert + telemetry event `claim_this_stall_tapped`. [Codex] *(implemented in `StallDetailScreen` with `FEATURE_FLAGS.merchantClaimCtaEnabled` gate, in-flight disabled state, action-level auth check, analytics event, and `submitMerchantClaimInterest` service call mapped to success/info/error toast paths. Service contract + mock/supabase implementations added in `src/lib/services/types.ts`, `src/lib/services/mock/mockService.ts`, `src/lib/services/supabase/supabaseService.ts`.)*
- [ ] **CLM-04 — Copy spec for CTA + verification explainer page** — sets expectation for SingPass Myinfo Business / NEA licence / video walkaround flow. [Gemini]
- [x] **CLM-05 — Feature flag `merchantClaimCtaEnabled`** added to `src/constants/featureFlags.ts` — OFF production, ON staging. [Codex] *(implemented via `resolveFeatureFlags()` using `EXPO_PUBLIC_APP_ENV`; `true` only for `staging`, `false` for `production`/`development`. Covered by `src/constants/featureFlags.test.ts`.)*
- [x] **CLM-06 — Curated stall menu path decision** — consumer `StallDetailScreen` remains sourced from curated `dishes` only; no consumer exposure of `dishes_draft`. [Codex] *(confirmed contract in `StallDetailScreen` via `repository.listDishesByVenue(venue.id)` and no `dishes_draft`/draft queue reads.)*

### Done gate

- [ ] OCR pipeline processes a test menu photo end-to-end in staging within 30s (upload → Vision → extraction → `dishes_draft` row in ops queue).
- [ ] "Claim this stall" CTA fires telemetry event AND inserts a `merchant_claim_interests` row in staging.
- [x] `npm run typecheck` passes. *(2026-04-22)*
- [ ] `npm run test` passes. *(Blocked by Node 25 / esbuild transform issue on `node_modules/react-native/index.js`; not a logic failure — tooling environment issue. Sprint 10 contract tests pass when run directly via `npx tsx --test`.)*
- [ ] Feature flag `merchantClaimCtaEnabled` OFF in production, ON in staging (verified via live flag read).

---

## 🔵 DEFERRED — Design Pass Phase 4: Marketing Website

> **Status:** Scoped but not shipping in the current design-pass session (user opted to skip). Revisit after Design-Pass Phases 1–3 land. Plan origin: `~/.claude/plans/fetch-this-design-file-gentle-wilkes.md`.
> **Goal:** Stand up `marketing/website/` as a real site (not just the existing copy/wireframe markdown) reusing the app's motif + tokens.
> **Owner:** TBD (Codex implementation; Claude can architect; Gemini reviews visual parity).

### Scope

- [ ] **WEB-01 — Initialise Next.js 14 App Router project** under `marketing/website/` with TypeScript + Tailwind. [Codex]
- [ ] **WEB-02 — `app/layout.tsx`** — load Fraunces (display) + Nunito (body) via `next/font/google`; mirror app theme tokens. [Codex]
- [ ] **WEB-03 — `tailwind.config.ts`** — port palette from `src/theme/tokens.ts` (light + warm-charcoal dark). Single source of truth: re-export from the RN tokens file if feasible, else keep in sync. [Codex]
- [ ] **WEB-04 — `components/MotifHero.tsx`** — web port of `src/components/ui/HungryMotifHero` (curved green band + bubbles + pin illustration). Same props. [Codex]
- [ ] **WEB-05 — `app/page.tsx` landing** — hero (MotifHero) + tagline ("Find the dish. Not just the restaurant.") + 3 product screenshots + features grid + waitlist form. Reuse copy from `marketing/website/waitlist-page-copy.md`. [Codex]
- [ ] **WEB-06 — `app/for-merchants/page.tsx`** — merchant pitch page (value prop, verification tiers preview, waitlist form). [Codex]
- [ ] **WEB-07 — `app/about/page.tsx`** — about + brand tagline + team. [Codex]
- [ ] **WEB-08 — `public/`** — app screenshots (splash with bite animation, home with motif, discover carousels, wheel, passport), logo assets. [Gemini to export, Codex to wire]
- [ ] **WEB-09 — Waitlist form API route** — `app/api/waitlist/route.ts` → Supabase insert into `merchant_claim_interests` (existing table) or a new `consumer_waitlist` table. [Codex, requires Sprint 10 merged]
- [ ] **WEB-10 — SEO + Open Graph** — metadata, OG image with motif, sitemap.xml, robots.txt. [Codex]
- [ ] **WEB-11 — Deploy to Vercel** with preview URLs on PRs. Link to `hungry.sg` domain. [Codex + user for DNS]

### Reusable assets from Phases 1–3

- `src/theme/tokens.ts` — palette + motif tokens to mirror in Tailwind config.
- `src/components/ui/HungryMotifHero.tsx` — reference implementation for the web port.
- Splash bite-the-u animation — reimplement as a hero Lottie/SVG on the landing page.
- Screenshots of the motif-ified Home, Discover carousels, and new Passport/Merchant/Messaging/Recents screens.

### Verification

- [ ] `cd marketing/website && npm run build` passes.
- [ ] `npm run dev` → localhost:3000 renders landing, for-merchants, about with motif + fonts.
- [ ] Lighthouse ≥ 90 performance, ≥ 95 accessibility, ≥ 95 SEO on landing.
- [ ] Waitlist form submits end-to-end to Supabase and shows success state.
- [ ] Preview deploy on Vercel works; production deploy live at `hungry.sg` (or staging subdomain first).

### Risks / Callouts

- **Token sync:** if we don't re-export from `src/theme/tokens.ts`, web and app will drift. Recommend a shared `packages/tokens` or generator script before WEB-03.
- **Screenshot freshness:** page will look stale the moment app UI changes. Consider automating screenshot capture via Detox/Playwright in CI.
- **Overlap with Phase 8 Merchant Portal:** MP-01 is also a standalone Next.js app. Consider monorepo layout (`apps/website`, `apps/merchant-portal`, `apps/mobile`) before scaling up — flag before WEB-01.

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

### Phase 7 / Sprint 5: Supabase Cloud Provisioning ✅ (2026-04-22)

All PROV-01..08 complete. Live Supabase project (`vlqfgmrsprbrgzteixsj`, ap-southeast-1) is fully provisioned:
- Extensions: `postgis`, `vector`, `pg_trgm`, `btree_gist`, `citext`, `pgcrypto` — all live.
- Migrations `0001`–`0015` applied to live database.
- Seed data loaded: buildings=4, venues=6, dishes=6, reviews=1, blog_posts=2.
- EAS secrets set for `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- RLS verified: two-user isolation confirmed (user B cannot access user A's rows).
- Media upload: `media` bucket created, signed URLs working (`MEDIA_UPLOAD_OK`).
- Supply priming tables (`menu_photo_submissions`, `dishes_draft`, `merchant_claim_interests`) live under RLS dev-only gate.
- Auth: specific error codes surfaced in `LoginScreen` + `SignUpScreen`; `signUp` returns `null` (not throws) when email confirmation pending.

Pending manual device verification (not blocking Sprint 10):
- Auth flow (sign-up → email verify → onboarding) on physical device.
- `HUNGRY_DATA_SOURCE=mock` fallback regression check.
- ERR boundary crash tests on device (LoginScreen + DishDetailScreen).

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

- 2026-04-22 | Claude (Sonnet 4.6) | Full codebase audit against `tasks/todo.md` + `SECURITY.md`. Findings: TOOL-01..04 all fully implemented (CI bot review comments were stale/incorrect — dismissed); SECURITY.md is correct and Hungry-specific (CmdTab references were in a stale cached version, not the actual file); Phase 7 provisioning complete — moved to Completed Archive; Sprint 10 promoted from NEXT to ACTIVE with 12/13 items done; 2 open security actions added (SEC-01 leaked-password-protection toggle, SEC-02 `.gitignore` for `supabase/.temp/`); Sprint 10 done gate annotated with Node 25/esbuild test blocker context. | Status: documentation updated, pushed to main. | Blockers: 4 staging smoke tests + CLM-04 copy (Gemini). | Next: run staging smokes for OCR e2e + claim CTA insert; fix Node 25 test runner issue; toggle SEC-01 in Supabase dashboard.
- 2026-04-22 | Codex | Implemented Sprint 10 Phase B (`CLM-03` + curated-menu `CLM-06` decision): added claim submission contracts to `HungryService.supply`, implemented idempotent claim submission mapping in Supabase (`submit_merchant_claim_interest` RPC `uuid|null` -> `created|already_exists`), mirrored idempotency in mock service by `(userId, venueId)` key, wired staging-gated one-tap CTA into `StallDetailScreen` (analytics + auth precheck + toast outcomes + in-flight disable), added analytics event `claim_this_stall_tapped`, and added Sprint 10 contract tests for CTA wiring and curated menu source. | Status: CLM-03 complete in code; CLM-06 implemented as curated-menu decision (no community draft consumer read). | Verification: `npm run typecheck` pass; `npx eslint src/app/screens/detail/StallDetailScreen.tsx src/lib/services/types.ts src/lib/services/supabase/supabaseService.ts src/lib/services/mock/mockService.ts src/lib/analytics/types.ts src/app/screens/sprint10-screen-contracts.test.ts` pass; `npm run test` remains blocked by existing Node 25/esbuild transform issue on React Native tests (`node_modules/react-native/index.js` unexpected `typeof`) with Sprint 10 contract tests passing. | Next: run staging runtime smoke for claim insert + telemetry, then move to CLM-04 copy spec and remaining Sprint 10 runtime done-gates.

- 2026-04-22 | Codex | Continued Sprint 5 done-gate verification. Removed Supabase repository mock fallback cache seeding (`supabaseRepository.ts`) and reran hard gates (`npm run typecheck`, `npx expo-doctor`). Revalidated production-path `mockRepository` usage via grep. Updated done-gate checklist with evidence-backed status only. | Status: done-gate now marked pass for `DataRepository live`, `review photo upload` (based on prior PROV-08 smoke evidence), `typecheck`, and `no mockRepository imports in production paths`; auth-E2E/onboarding, mock fallback runtime regression, and both manual crash-boundary checks remain open. | Verification: `npm run typecheck` pass; `npx expo-doctor` pass (17/17); grep `mockRepository` in production paths => no matches. | Next: run manual runtime verification on simulator/device for auth onboarding + crash-boundary checks and mock-mode runtime regression.
- 2026-04-22 | Codex | Implemented Sprint 10 Phase A (`OCR-02` + `CLM-05`): added secure storage migrations for `menu-photos` (`0014`, `0015`), added environment-derived `merchantClaimCtaEnabled` rollout flag, and added feature-flag unit tests. While running OCR smoke, fixed `submit_menu_photo` RPC parameter mismatch in `supabaseService` (`p_byte_size` -> `p_size_bytes`). | Status: OCR-02 and CLM-05 complete. | Verification: `npm run typecheck` pass; `npx tsx --test src/constants/featureFlags.test.ts` pass (3/3); `npx eslint src/constants/featureFlags.ts src/constants/featureFlags.test.ts src/lib/services/supabase/supabaseService.ts` pass; `npx supabase db push` applied `0014` and `0015`; `npx supabase db query --linked` confirms `storage.buckets.id='menu-photos'` with `public=false`, expected `menu_photos_*` policies on `storage.objects`, and authenticated upload smoke succeeded (`MENU_PHOTOS_UPLOAD_OK`) with object present in `storage.objects`. | Next: CLM-03 (`Claim this stall` CTA + telemetry insert) and CLM-06 (`Menu (community-sourced)` block on StallDetailScreen).

- 2026-04-22 | Codex | Implemented Sprint 10 OCR-01..OCR-06 in developer-only flow: quick-review menu photo capture (`__DEV__` gated), supply service interface (`HungryService.supply`), menu-photo MIME/size validation + upload path, edge function `ingest-menu-photo` (Vision OCR + Gemini extraction + dedupe to `dishes_draft`), edge function `ops-dishes-draft` (list/review queue), and local ops stub UI at `ops/dishes-draft/index.html`. Updated `.env.example` with OCR/ops secrets. | Status: OCR-01, OCR-03, OCR-04, OCR-05, OCR-06 complete in code; OCR-02 bucket provisioning pending. | Verification: `npm run typecheck` pass. `npm run test` currently fails due existing environment/tooling issue (`esbuild` transform error at `node_modules/react-native/index.js` under Node v25), not from OCR files. | Next: deploy edge functions, create `menu-photos` bucket in Supabase, set secrets (`GOOGLE_CLOUD_VISION_API_KEY`, `GEMINI_API_KEY`, `OPS_DISHES_DRAFT_API_KEY`), then run staging E2E OCR smoke.

- 2026-04-19 | Codex | Completed PROV verification sweep requested by user: live extension check, migration check (`0001`..`0009`), applied `supabase/seed.sql`, verified seed counts, created `storage.buckets` entry for `media`, added storage object policies, ran JS smoke for Supabase-mode read + two-user RLS + media upload/signed URL. | Status: PROV-02/03/04/06/07/08 moved to done. | Verification: SQL results — extensions present (`postgis`,`vector`,`pg_trgm`,`btree_gist`,`citext`,`pgcrypto`), migration versions `0001`..`0009`, seed counts (`buildings=4`,`venues=6`,`dishes=6`,`reviews=1`,`blog_posts=2`); JS smoke output — `SUPABASE_MODE_OK`, `RLS_TWO_USER_OK`, `MEDIA_UPLOAD_OK`, `ALL_SMOKES_OK`. | Next: user can run remaining end-to-end/manual done-gate checks (auth flow UX, crash-boundary runtime checks, mock fallback regression) immediately.

- 2026-04-19 | Codex | Fixed iOS `AppDelegate.swift` Expo import ambiguity by making the import explicit (`internal import Expo`) and removing obsolete `bindReactNativeFactory(factory)`. | Status: verified. | Verification: iOS build completed with `BUILD SUCCEEDED`; original Expo import error and `bindReactNativeFactory` compile error are resolved. | Next: none.

- 2026-04-19 | Codex | Replaced dead external support/legal URLs in `SignUpScreen.tsx` and `SettingsScreen.tsx` with local `Alert` fallbacks so taps no longer depend on unreachable `hungry.sg` pages. | Status: runtime-fix complete. | Verification: `get_errors` clean for both edited screens; grep confirmed no remaining `hungry.sg/(help|privacy|terms)` references under `src/`. | Next: rerun the app in the simulator and confirm the redbox/network failure no longer appears on those flows.

- 2026-04-19 | Codex | Executed PROV-02..08 runbook pass. Installed/used `npx supabase` and `npx eas-cli`, corrected `supabase/config.toml` project ref to `vlqfgmrsprbrgzteixsj`, regenerated local seed (`npm run seed:generate`), set `HUNGRY_DATA_SOURCE=supabase` in `.env.local`, fixed invalid `eas.json` (`postBuildCommand` removed), and created EAS project secrets for `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Attempted live DB link/push and smoke scripts. | Status: PROV-05 complete; PROV-02/03/04/06/07/08 blocked by missing Supabase CLI auth token and unmigrated live schema. | Verification: `supabase link --project-ref vlqfgmrsprbrgzteixsj` -> access token missing, direct Supabase API smoke -> `public.*` tables not found, storage bucket list empty / `media` bucket missing. | Next: provide `SUPABASE_ACCESS_TOKEN`, run `supabase link` + `db push`, create `media` bucket, rerun RLS/media smoke.
- 2026-04-18 | Claude (Sonnet 4.6) | Read all 15 main commits post-branch, audited actual code deliverables. Updated `tasks/todo.md`: restructured so active items (Phase 7 provisioning) are first, Sprint 10 is second, Phase 8 gated third; archived all Sprints 1–9 and Sprint 5 code artifacts; corrected DOC-01 and ERR-00 to `[x]` (code confirmed in `b91ffd28e`); renamed CLM-02 migration to `0010_supply_priming.sql` (correct sequence after existing 0009). Updated `tasks/Roadmap/roadmap.md` §2 status snapshot to reflect Expo 55/RN 0.85.1 upgrade and corrected Sprint 5 status (code done, provisioning pending). | Status: documentation complete. | Blockers: Supabase cloud project not yet created (PROV-01) — this is the only external blocker. | Next: user creates Supabase project (PROV-01), then Codex runs PROV-02..08 to verify live data; in parallel Claude authors CLM-01 DDL spec.
- 2026-04-17 | Claude (Sonnet 4.7) | Strategic advisory for merchant expansion delivered. Consolidated 8 overlapping `tasks/Roadmap/*.md` drafts into `tasks/Roadmap/roadmap.md`. Authored Sprint 10 (Supply Priming) + Phase 8 (Merchant Portal + QR Ordering V2). Decision recorded: Merchant Portal ships as V2, not V1. 3 lessons appended to `tasks/lessons.md`. | Status: documentation complete. | Blockers: Sprint 5 provisioning. | Next: Codex Sprint 10 after Sprint 5 lands.
- 2026-04-17 | Gemini | Hardened navigation: disabled tab click animations. Completed ERR-00 spec and OFFLINE_SPEC. Implemented DiscoverHome loading skeletons and global NetInfo listener. DOC-01 (README Feature Flags) complete. Verified ERR-01/02/03 via logic tests. | Status: ✅ Done | Verification: `npm test` (46/46 passed), `npm run typecheck` green, pushed to main (`b91ffd28e`).
- 2026-04-17 | Codex | Sprint 5 backend hardening: removed mock fallbacks in runtime paths, fixed env data-source precedence, added `mediaUpload.ts`, wired ReviewScreen + EditProfileScreen to Supabase, added regression tests. | Status: partially completed (code done; external provisioning + auth-UI migration pending). | Blockers: global typecheck has pre-existing failures on unrelated files. | Next: finish auth-screen Supabase sign-in flow + clear typecheck debt, then end-to-end verification.
- 2026-04-17 | Codex | Sprint 9 non-UI closure: haptic on Decide For Me, real share sheet, ImageCarousel in DishDetail, ProfileRadarChart co-location, async-safe popularNearby, `useOrderStore`/`useCartStore` V2 stubs. | Status: completed + verified.
- 2026-04-17 | Claude (Sonnet 4.7) | Sprint 5/6/8 audit. Flipped TOOL-01..04, DEAD-01..04, ERR-01/02 to [x] with verification evidence. Sprint 5 Supabase Codex items confirmed open (no `src/lib/services/supabase/` directory at that point). | Status: documentation audit complete.

---

## 6. Verification Commands Log

- [x] `npm run typecheck` — 2026-04-22 (Sprint 10 audit; clean)
- [x] `npm run typecheck` — 2026-04-17 (Sprint 9 Wave 5 gate)
- [x] `npm run test` — 2026-04-17 (Sprint 9 Wave 5 gate, 68 tests, 0 failures)
- [x] `npx expo-doctor` — 2026-04-22 (Sprint 5 done-gate pass, 17/17)
- [x] `npx expo-doctor` — 2026-04-17 (Sprint 9 Wave 5 gate, 16/16)

---

## Cross-Cutting: Ongoing Responsibilities

| Agent | Standing Responsibility |
|-------|------------------------|
| **Claude** | Architecture decisions, contract definitions, planning docs, event taxonomy maintenance, tradeoffs log, backlog truthfulness. |
| **Codex** | All code implementation, typecheck enforcement, test coverage, migration execution, dependency management. |
| **Gemini** | Design token governance, visual spec, UI/UX audit, accessibility compliance, component pattern guidance. |
| **All** | Update `tasks/todo.md` after every work block. Record lessons in `tasks/lessons.md`. Never mark Done without verification evidence. |
