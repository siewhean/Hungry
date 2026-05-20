# Hungry — Master Task Contract

> **Last updated:** 2026-04-25 | **Phase:** Sprint 10 Code-Complete → Staging Smoke Tests
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

## 2026-05-18 — Frontend Design Overhaul Merge-Safety Cleanup Ledger

Scope: `frontend-design-overhaul` merge-safety cleanup. Objective is reviewability and production safety, not new UX.

### Checkpoints and Main Sync

- Pre-merge scoped checkpoints created:
  - `bf259ace4` `wip(marketing-web): checkpoint current web-v2 edits`
  - `90e6d4350` `wip(app-home): checkpoint current Home feed edits`
  - `e3485ec70` `chore(logs): checkpoint task session notes`
  - `2c62beaa3` `chore(smoke): checkpoint screenshot flow file`
  - `5267c92ba` `wip(supabase-audit): checkpoint current audit edits`
  - `3512238b9` `wip(marketing-web): checkpoint remaining mockup styles`
  - `63ffc3704` `wip(audit-assets): checkpoint late audit and marketing edits`
- `git fetch origin` — passed after unrestricted retry; sandbox could not write `.git/FETCH_HEAD`.
- `git merge --no-ff origin/main -m "merge main into frontend-design-overhaul for cleanup baseline"` — passed; merge commit `4811a203f`.
- Extra isolated checkpoints after baseline:
  - `305fbe782` `wip(marketing-web): checkpoint residual responsive mockup styles`
  - `ea8fa20ce` `wip(native): checkpoint expo doctor dependency adjustment`
  - `0802b3e4c` `chore(scope): checkpoint audit notes and remove temp floorplan artifacts`
  - `3cf872a8b` `wip(release-hardening): checkpoint account deletion and policy edits`
  - `cd82ae3f2` `chore(frontend-overhaul): gate unfinished production surfaces`

### Batch Status

| Batch | Status | Evidence / blocker |
| --- | --- | --- |
| 0 Baseline verification | Complete | Baseline gates below; branch synced with `origin/main` using merge, not rebase. |
| 1 Scope hygiene | Partial | Deleted tracked temporary floorplan page extraction dirs `data/floorplans/hc-maxwell/tmp_page0..3`; retained root service-role smoke helpers because `src/lib/security/ci-supply-chain.test.ts` and security docs reference them. |
| 2 Route and feature flag safety | Complete | Added `gamificationEnabled`, `collectionsEnabled`, `storiesEnabled`; changed `commentsEnabled` to non-production; gated root routes and entry points for stories, collections, gamification, and comments. |
| 3 App shell QA contracts | Complete for source contracts | Source tests cover signed-out browsing, Profile auth gate, center create return routes, gated routes, and activity/detail comment gates. Manual swipe-vs-rail QA remains open. |
| 4 Core consumer UX | Partial | Added no-result/empty states for non-browse search results, Discover V2 trending rail, Discover V2 nearby stalls, and Search V2 visible result counts. Asset audit command now records the mobile Discover bundle risk; analytics audit remains open. |
| 5 Detail/data trust | Partial | Removed/neutralized misleading delivery, stall operating status, map-distance fallback, and closed-stall status-color claims. Broader hardcoded-claim audit remains in PR 2. |
| 6 Social safety | Partial | Comments remain production-disabled; Home/review/bite comment entry points are flag-gated, seeded story/review/detail social counts were neutralized, and hide/block actions now update session filters plus current Home/Profile feeds. Backend moderation launch readiness still open. |
| 7 Merchant mode | Deferred | Merchant remains flag-gated; role/verification launch gaps remain in PR 4. |
| 8 Gamification | Partial | Passport/Missions routes and profile entry points gated by `gamificationEnabled`; asset/bundle/a11y audit remains open. |
| 9 Maps/floorplan | Partial | Temp extraction artifacts removed; validation/overlay scripts blocked by missing OpenCV `cv2`; tap-accuracy QA open. |
| 10 Supabase/OCR | Partial | Added source contracts proving consumer Supabase reads do not query `dishes_draft` and draft access is confined to supply/merchant/ops-admin paths. Chat/OCR live smokes remain blocked by missing smoke env/credentials. |
| 11 Auth/onboarding | Partial | OAuth provider buttons are now production-disabled and labeled unavailable until live Supabase provider smoke is complete. Broader auth return-route and provider dashboard audit remains open. |
| 12 Native/iOS | Partial | Expo SDK 55 patch dependencies aligned and prepared iOS smoke passed on iPhone 17 Pro / iOS 26.1 once Metro was reachable. Broader native/iOS changes should still stay in a dedicated PR bucket. |
| 13 Assets/bundle/licensing | Partial | Added `npm run audit:assets` to inventory mobile Discover, Passport, and marketing food assets. Current evidence: `src/assets/discover` is 121.43 MiB with 98.16 MiB apparently unreferenced, Passport assets are 1.54 MiB all referenced, and marketing food images are 95.6 MiB web-only/referenced. Compression/removal and provenance sign-off remain open. |
| 14 CI/security | Partial | CI now runs Supabase static audit, edge-function static checks, and skip-safe migration dry-run; dependency audit is green after `ws` override patch. Broader security scans remain separate gate. |
| 15 RC decision | Open | Do not merge as one PR yet; use split below unless remaining gates are completed. |

### Verification Results

| Date | Command | Result | Notes |
| --- | --- | --- | --- |
| 2026-05-18 | `npm run typecheck` | Pass | `tsc --noEmit` completed. |
| 2026-05-18 | `npm run lint` | Pass | `eslint src/ --ext .ts,.tsx` completed. |
| 2026-05-18 | `npm run format:check` | Initial fail, then pass | Initial fail: `src/app/navigation/RootNavigator.tsx`; fixed with `npx prettier --write src/app/navigation/RootNavigator.tsx`; rerun passed. |
| 2026-05-18 | `npm run test` | Initial fail, then pass | Initial fail: stale `discover-v2-production-contracts.test.ts` regex after collection gating. Updated contract; final rerun passed with 335 total, 333 passing, 2 skipped. |
| 2026-05-18 | `NPM_CONFIG_CACHE=/tmp/hungry-npm-cache npx expo-doctor --non-interactive` | Fail | Exit 1: Expo Doctor `1.18.22` treats `--non-interactive` as a project path: `Project directory .../--non-interactive does not exist`. |
| 2026-05-18 | `NPM_CONFIG_CACHE=/tmp/hungry-npm-cache npx expo-doctor .` | Pass after unrestricted retry | Sandboxed run failed network checks (`ENOTFOUND exp.host`, React Native Directory response); unrestricted rerun passed 17/17. |
| 2026-05-18 | Focused route/source contracts | Pass | `node --import tsx --test` over feature flags, route readiness, nav contracts, story, profile, review, activity, and user coverage tests: 45 passing. |
| 2026-05-18 | `npm run smoke:native:ios:prepared` | Blocked | Maestro reported 0 connected devices; `.maestro/ios-chat-smoke.yaml` failed. |
| 2026-05-18 | `npm run smoke:supabase-chat` | Skipped | Command exited 0 with skip: missing `HUNGRY_SUPABASE_SMOKE_URL`, `HUNGRY_SUPABASE_SMOKE_SERVICE_ROLE_KEY`, `HUNGRY_SUPABASE_SMOKE_ANON_KEY`, and `HUNGRY_ALLOW_SERVICE_ROLE_SMOKE=1`. |
| 2026-05-18 | `python3 scripts/floorplan/score_validate_polygons.py --in data/floorplans/hc-maxwell/L1.raw.json --out /tmp/hungry-L1.validated.json --report /tmp/hungry-L1.validation-report.json` | Blocked | Python environment missing `cv2` / OpenCV. |
| 2026-05-18 | `python3 scripts/floorplan/render_qa_overlay.py --in data/floorplans/hc-maxwell/L1.validated.json --image data/floorplans/hc-maxwell/L1.rectified.png --out output/qa/floorplans/hc-maxwell-L1-overlay.png` | Blocked | Python environment missing `cv2` / OpenCV. |
| 2026-05-18 | `git diff --check` | Pass | No whitespace errors in the final cleanup diff. |
| 2026-05-18 | `npm run check:edge-functions` | Pass | Static Edge Function guard script completed; CI now has a concrete script for the referenced package command. |
| 2026-05-18 | `npm run audit:supabase:static` | Pass | Static audit found 40 migrations, 86 repo-created tables, 201 policies, and no anon write policies. |
| 2026-05-18 | `npm run typecheck` | Pass | Rerun after CI/security/auth follow-up edits completed. |
| 2026-05-18 | `npm run lint` | Pass | Rerun after CI/security/auth follow-up edits completed with 0 errors. |
| 2026-05-18 | `npm run format:check` | Pass | Rerun after CI/security/auth follow-up edits completed. |
| 2026-05-18 | `npm run test` | Pass | Rerun after CI/security/auth follow-up edits passed with 336 total, 334 passing, 2 skipped. |
| 2026-05-18 | `NPM_CONFIG_CACHE=/tmp/hungry-npm-cache npx expo-doctor .` | Pass after unrestricted retry | Sandboxed rerun failed network checks (`ENOTFOUND exp.host`, React Native Directory response); unrestricted rerun passed 17/17. |
| 2026-05-18 | `npx --no-install supabase db push --dry-run` | Pass after unrestricted retry | Sandboxed run failed DNS to the Supabase pooler; unrestricted dry-run succeeded and would push `0039` and `0040` without applying them. |
| 2026-05-18 | `HUNGRY_DISABLE_ASYNC_STORAGE=1 HUNGRY_DISABLE_SECURE_STORE=1 TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test src/app/screens/search-v2-production-contracts.test.ts src/app/screens/discover-v2-production-contracts.test.ts src/app/screens/detail-v2-data-contracts.test.ts src/app/screens/v2-trust-claims-contracts.test.ts src/app/user-mode-coverage-contracts.test.ts` | Pass | Batch 4/5 focused contracts passed 17/17 after empty-state and data-trust fixes. |
| 2026-05-18 | `npm run typecheck` | Pass | Rerun after Batch 4/5 component and detail-screen fixes completed. |
| 2026-05-18 | `npm run lint` | Pass | Rerun after Batch 4/5 component and detail-screen fixes completed with 0 errors. |
| 2026-05-18 | `git diff --check` | Pass | No whitespace errors after Batch 4/5 fixes. |
| 2026-05-18 | `npm run format:check` | Pass | Prettier check passed after Batch 4/5 fixes. |
| 2026-05-18 | `npm run test` | Pass | Full source suite passed after Batch 4/5 fixes with 338 total, 336 passing, 2 skipped. |
| 2026-05-21 | `HUNGRY_DISABLE_ASYNC_STORAGE=1 HUNGRY_DISABLE_SECURE_STORE=1 TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test src/app/screens/review-feed-bites-contracts.test.ts src/lib/security/security-hardening.test.ts src/app/navigation/nav-activity-contracts.test.ts src/app/screens/profile-social-post-detail-contracts.test.ts src/app/screens/sprint9-screen-contracts.test.ts src/constants/featureFlags.test.ts` | Pass | Batch 6 focused social safety contracts passed 42/42. |
| 2026-05-21 | `npm run typecheck` | Pass | Strict TypeScript gate passed after Batch 6 social safety edits. |
| 2026-05-21 | `npm run lint` | Pass | ESLint completed with 0 errors after Batch 6 social safety edits. |
| 2026-05-21 | `npm run format:check` | Pass | Prettier check passed after formatting touched Batch 6 files. |
| 2026-05-21 | `npm run test` | Pass | Full source suite passed with 339 total, 337 passing, 2 skipped. |
| 2026-05-21 | `NPM_CONFIG_CACHE=/tmp/hungry-npm-cache npx expo-doctor --non-interactive` | Fail | Exit 1: Expo Doctor `1.18.22` treats `--non-interactive` as a project path: `Project directory .../--non-interactive does not exist`. |
| 2026-05-21 | `CI=1 NPM_CONFIG_CACHE=/tmp/hungry-npm-cache npx expo-doctor .` | Fail after unrestricted retry | Sandboxed run failed two network-backed checks (`ENOTFOUND exp.host` and React Native Directory response). Unrestricted rerun reached the services but failed 1/17 checks because SDK patch versions are behind: `expo` expected `~55.0.25` found `55.0.24`, `expo-dev-client` expected `~55.0.35` found `55.0.34`, `expo-font` expected `~55.0.8` found `55.0.7`, `expo-updates` expected `~55.0.23` found `55.0.22`. |
| 2026-05-21 | `git diff --check` | Pass | No whitespace errors after Batch 6 social safety edits. |
| 2026-05-21 | `npm install expo@~55.0.25 expo-dev-client@~55.0.35 expo-font@~55.0.8 expo-updates@~55.0.23` | Pass | Updated Expo SDK 55 patch packages and lockfile; install changed 13 packages. |
| 2026-05-21 | `npm audit fix` | Partial, then resolved with override | Non-force audit fix removed the `brace-expansion` advisory and updated Supabase lockfile packages to `2.106.1`; remaining `ws` advisory was caused by the repo override pinning `8.20.0`. Updated override to `8.20.1` and reran `npm install`. |
| 2026-05-21 | `npm audit --audit-level=moderate` | Pass | 0 vulnerabilities after Expo patch alignment, Supabase lockfile refresh, and `ws` override update. |
| 2026-05-21 | `CI=1 NPM_CONFIG_CACHE=/tmp/hungry-npm-cache npx expo-doctor .` | Pass | Unrestricted run passed 17/17 checks after Expo SDK patch alignment. |
| 2026-05-21 | `npm run typecheck` | Pass | Strict TypeScript gate passed after dependency updates. |
| 2026-05-21 | `npm run lint` | Pass | ESLint completed with 0 errors after dependency updates. |
| 2026-05-21 | `npm run format:check` | Pass | Prettier check passed after dependency updates. |
| 2026-05-21 | `npm run test` | Pass | Full source suite passed with 339 total, 337 passing, 2 skipped after dependency updates. |
| 2026-05-21 | `npm run smoke:native:ios:prepared` | Initial fail, then pass | Sandbox run failed DNS to `github.com` while downloading Maestro; unrestricted first run reached iPhone 17 Pro / iOS 26.1 but app stayed on `Loading from Metro...`; rerun with Metro reachable at `127.0.0.1:8081/status` passed chat and media flows. |
| 2026-05-21 | `git diff --check` | Pass | No whitespace errors after dependency updates. |
| 2026-05-21 | `npm run test -- src/constants/featureFlags.test.ts src/app/navigation/route-production-readiness.test.ts src/app/screens/sprint9-screen-contracts.test.ts --watch=false` | Pass | NPM script expanded to the full source suite; 339 total, 337 passing, 2 skipped after adding the production OAuth provider gate. |
| 2026-05-21 | `npm run typecheck` | Pass | Strict TypeScript gate passed after adding the production OAuth provider gate. |
| 2026-05-21 | `npm run lint` | Pass | ESLint completed with 0 errors after adding the production OAuth provider gate. |
| 2026-05-21 | `npm run format:check` | Pass | Prettier check passed after adding the production OAuth provider gate. |
| 2026-05-21 | `npm run audit:assets` | Pass | Asset audit completed. `src/assets/discover`: 48 files / 121.43 MiB, 10 referenced / 23.28 MiB, 38 apparently unreferenced / 98.16 MiB. Passport: 10 files / 1.54 MiB all referenced. Marketing food: 38 files / 95.6 MiB all referenced and web-only. |
| 2026-05-21 | `node --check scripts/audit-assets.mjs` | Pass | Asset audit script syntax passed. |
| 2026-05-21 | `HUNGRY_DISABLE_ASYNC_STORAGE=1 HUNGRY_DISABLE_SECURE_STORE=1 TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test src/features/system/asset-audit-contracts.test.ts` | Pass | Focused asset-audit contract passed 1/1. |
| 2026-05-21 | `npx --no-install prettier --check package.json scripts/audit-assets.mjs src/features/system/asset-audit-contracts.test.ts` | Pass | Touched package/script/test formatting passed. Markdown ledger files were left in their existing table style to avoid unrelated table churn. |
| 2026-05-21 | `npm run typecheck` | Pass | Strict TypeScript gate passed after the asset audit script/contract and ledger update. |
| 2026-05-21 | `npm run lint` | Pass | ESLint completed with 0 errors after the asset audit script/contract and ledger update. |
| 2026-05-21 | `HUNGRY_DISABLE_ASYNC_STORAGE=1 HUNGRY_DISABLE_SECURE_STORE=1 TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test src/lib/services/supabase/ocr-draft-safety.test.ts` | Initial fail, then pass | Initial fail was a stale source-block boundary in the new contract; final run passed 2/2 and proves consumer Supabase reads stay off `dishes_draft` while draft access stays in supply/merchant/ops paths. |
| 2026-05-21 | `npx --no-install prettier --check src/lib/services/supabase/ocr-draft-safety.test.ts` | Initial fail, then pass | Prettier formatted the new OCR draft safety test; rerun passed. |
| 2026-05-21 | `npm run typecheck` | Pass | Strict TypeScript gate passed after adding the OCR draft safety contract. |
| 2026-05-21 | `npm run lint` | Pass | ESLint completed with 0 errors after adding the OCR draft safety contract. |

### Remaining Production Blockers

- Finish manual QA for bottom-tab swipes versus horizontal rails.
- Keep DMs, merchant centre, comments, stories, collections, and gamification production-disabled until backend moderation, role, and readiness gates are complete.
- Compress or remove the measured mobile Discover asset excess: `src/assets/discover` is 121.43 MiB, including 98.16 MiB apparently unreferenced copied food PNGs retained for now to avoid destabilizing the wider design branch; generated-art provenance sign-off remains open.
- Install/activate OpenCV for floorplan validation and generate overlay QA for `hc-maxwell:L1`.
- Run OCR staging smoke with required credentials. Repo-side source contracts now prove `dishes_draft` is not queried by consumer Supabase reads and is confined to supply/merchant/ops paths.
- Complete auth provider live-state audit; OAuth buttons are disabled and labeled unavailable in production until Supabase Google/Apple providers are proven live.

### Recommended PR Split

1. Branch Safety + Route Gates: checkpoints, scope cleanup, feature flags, route gates, navigation/source contracts, this ledger.
2. Core Consumer UX/Data Trust: empty states, prefetch checks, hardcoded factual-claim cleanup.
3. Social/Auth Safety: moderation readiness, report/block hardening, OAuth provider behavior, return-route tests.
4. Merchant Staging Mode: role/verification access, merchant readiness docs, launch blockers.
5. Gamification/Collections/Stories: assets, accessibility, bundle impact, production readiness.
6. Maps/Floorplan/Supabase/OCR: floorplan validation/fallback, OCR smoke, draft-dish leak checks, ops admin checks.
7. CI/Security/Native: CI gates, security scans, EAS behavior, iOS/native changes.
8. Marketing Web: `marketing/web/**`, `marketing/website/web-v2/**`, web-only assets, web verification.

## 🟠 ACTIVE — Sprint 11: Design System & UX Overhaul (Phase A, B & C)

> **Status:** Phase A & B complete. Phase C (Features) in progress — core Merchant mode and Review feed delivered.
> **Full plan:** `tasks/Roadmap/roadmap.md` and `tasks/Roadmap/phase-c-implementation.md`.
> **Owner:** Gemini (UI/UX + Implementation).

### Phase A — Critical Screen Fixes (V2 Prototypes)

- [x] **FIG-01 — DiscoverHomeScreenV2** — Unified Discovery (Variant A) with integrated search and intent chips. [Gemini]
- [x] **FIG-02 — DishSearchScreenV2** — High-fidelity search with category tabs and trending dishes. [Gemini]
- [x] **FIG-03 — StallDetailScreenV2** — Premium detail view with hero media and info clusters. [Gemini]
- [x] **FIG-04 — BuildingDrillDownScreenV2** — Segmented floor selector and building hero overlays. [Gemini]
- [x] **FIG-05 — QuickReviewSheetV2** — 4-step interactive review flow. [Gemini]
- [x] **FIG-06 — QuickBitesScreen (V1 Update)** — Edge-to-edge high-density food grid with collapsible filters. [Gemini]
- [x] **MAP-01 — Map Pin Overhaul** — Added 'restaurant' type and fixed tappability/navigation logic. [Gemini]

### Phase B — Design System Upgrades

- [x] **DS-01 — Typography: Fraunces Integration** — Merged Fraunces for display headings across all V2 surfaces. [Gemini]
- [x] **DS-02 — Dark Mode Persistence** — 3-way toggle (Light / Dark / System) with AsyncStorage persistence. [Gemini]
- [x] **DS-03 — Neutral Palette Migration** — Removed all 'Paper Warm' tones; app now pure white/neutral grey. [Gemini]
- [x] **DS-04 — Brand Assets V2** — SVG Logos (Wordmark, Icon, Logomark) and Mascot with expressions. [Gemini]
- [x] **DS-05 — Splash V2** — Two advanced animation variants (Bite scatter vs. Gravity rain). [Gemini]
- [x] **DS-06 — Food Icon Suite** — High-quality SVG illustrations for Wheel, Bowl, and Ramen. [Gemini]

### Phase C — Feature Additions

- [x] **C1 — Review Feed V2** — Pure user content feed with Rating/Location filters. [Gemini]
- [x] **C1 — Post Composer V2** — Redesigned composer with "Post to" destination toggle. [Gemini]
- [x] **C2 — Music Selection V2** — Vertical carousel with waveform indicators and simulated play. [Gemini]
- [x] **C3 — Merchant Mode** — Complete navigation stack (Dashboard, Menu, Analytics, Profile). [Gemini]
- [x] **C5 — Search History** — Persistent history grouped by time; swipe-to-delete. [Gemini]
- [ ] **C8 — Personalisation Habit Learning Engine** — Learn user habits from in-app interactions and recommend based on behavioral patterns (favourite meals/stalls, click behavior, day-of-week and time-of-day). [Codex]
  - Track events: dish/stall taps, saves/likes, review submissions, search terms, revisit frequency, and session timestamps.
  - Build habit profile per user: preferred stalls/dishes, recurring visit windows (e.g., weekday lunch), and intent clusters.
  - Recommendation pass: prioritize feed/discover cards using habit score + recency + diversity guardrail.
  - Privacy guardrail: add explicit settings toggle to enable/disable behavioral personalisation and clear learned history.
- [ ] **C9 — Realistic Floorplan Polygon Pipeline (Phase 1)** — Convert real floorplan assets into realistic stall polygons with canonical source contracts and app integration for one venue/floor (`hc-maxwell:L1`). [Codex]
  - Add CV extraction scripts (`prepare_floorplan.py`, `extract_polygons.py`, `score_validate_polygons.py`, `export_floorplan.py`, `render_qa_overlay.py`).
  - Add mapping workflow (`map_stalls.py`) to map `unitNumber -> venueId` and generate unresolved reports.
  - Add canonical `FloorPlanSourceV1` source contract + adapter and make `getFloorPlan()` prefer canonical sources before hardcoded/generic fallback.
  - Add repo artifacts at `data/floorplans/hc-maxwell/` (`L1.hungry.json`, `L1.geojson`, mapping CSV template).
- [ ] **C4 — Messaging Expansion** — Group chats, voice notes, and location sharing. [Gemini]
- [ ] **C6 — Gamification V2** — Achievements screen and interactive Passport stamps. [Gemini]
- [ ] **C7 — Carousel Overhaul** — Implement specific dish/stall photo rules for 5 carousels. [Gemini]

### Done gate

- [x] `npm run typecheck` passes. *(2026-04-23)*
- [x] Merchant mode accessible via Settings V2 and Developer Launcher.
- [x] Persona feedback integrated: Uncle Tan (high accessibility) and Sarah (vegetarian filters).
- [x] All new V2 features registered in navigation and protected by auth gates.
- [ ] Personalisation recommendations adapt to day/time habit patterns in staging and can be toggled off from Settings.
- [x] Polygon extraction pipeline generates schema-valid canonical floorplan JSON for `hc-maxwell:L1`. *(Added `data/floorplans/hc-maxwell/L1.hungry.json` + `L1.geojson` with `floorplan-source.v1` contract fields.)*
- [ ] Geometry validation passes (0 self-intersections/degenerate polygons, all polygons inside outline, no tenant overlap > 5%).
- [x] Unit mapping report is generated with coverage summary and unresolved reason tags. *(`map_stalls.py` smoke run produced `/tmp/L1.mapping-report.json` with coverage + unresolved reason tags.)*
- [ ] Visual overlay QA artifact is generated for manual review (`output/qa/floorplans/hc-maxwell-L1-overlay.png`).
- [ ] Map interaction QA passes (polygon taps open correct stall details >= 95% sampled pass rate; no redbox/fatal).

---

## 🔴 ACTIVE — Sprint 10: Supply Priming (Staging Smoke Tests)

> **Status:** Code complete (12/13 items). Remaining: 4 done-gate staging smoke tests + CLM-04 copy spec (Gemini).
> **Migrations on live Supabase:** `0001`–`0015` applied. Supply priming tables live under RLS dev-only gate.
> **Full plan:** `tasks/Roadmap/roadmap.md` §4.
> **Owner:** Codex runs staging smokes; Gemini authors CLM-04; Claude audits.

### Open security action (non-blocking for Sprint 10 code, required before public launch)

- [ ] **SEC-01 — Enable Leaked Password Protection** in Supabase dashboard → Authentication → Password security. Flagged in `SECURITY.md` as "Action required". [User — dashboard toggle] *(Blocked on Supabase FREE plan; control is Pro+ only. Compensating controls until upgrade: enforce strong password requirements, MFA for privileged users, and login rate limiting.)*
- [x] **SEC-02 — Add `supabase/.temp/` to `.gitignore`** — Supabase CLI local cache dir is excluded in repo root `.gitignore` (`supabase/.temp/`). [Codex]

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
- [x] **OCR-06 — Ops review queue at `/ops/dishes-draft`** for accept / reject / duplicate decisions before consumer display. [Codex] *(implemented as edge function `supabase/functions/ops-dishes-draft/index.ts` + local stub UI `ops/dishes-draft/index.html`; SEC-08 replaced the old `x-ops-api-key` gate with Supabase JWT + `app_ops_admins`.)*

### Consumer-surface supply capture (Codex primary, Gemini copy)

- [x] **CLM-03 — "Claim this stall" CTA on `StallDetailScreen`** — fires `merchant_claim_interests` insert + telemetry event `claim_this_stall_tapped`. [Codex] *(implemented in `StallDetailScreen` with `FEATURE_FLAGS.merchantClaimCtaEnabled` gate, in-flight disabled state, action-level auth check, analytics event, and `submitMerchantClaimInterest` service call mapped to success/info/error toast paths. Service contract + mock/supabase implementations added in `src/lib/services/types.ts`, `src/lib/services/mock/mockService.ts`, `src/lib/services/supabase/supabaseService.ts`.)*
- [x] **CLM-04 — Copy spec for CTA + verification explainer page** — sets expectation for SingPass Myinfo Business / NEA licence / video walkaround flow. [Codex] *(implemented in `tasks/merchant-claim-copy-spec.md` with `MerchantClaimExplainerScreen` linked from Stall Detail CTA.)*
- [x] **CLM-05 — Feature flag `merchantClaimCtaEnabled`** added to `src/constants/featureFlags.ts` — OFF production, ON staging. [Codex] *(implemented via `resolveFeatureFlags()` using `EXPO_PUBLIC_APP_ENV`; `true` only for `staging`, `false` for `production`/`development`. Covered by `src/constants/featureFlags.test.ts`.)*
- [x] **CLM-06 — Curated stall menu path decision** — consumer `StallDetailScreen` remains sourced from curated `dishes` only; no consumer exposure of `dishes_draft`. [Codex] *(confirmed contract in `StallDetailScreen` via `repository.listDishesByVenue(venue.id)` and no `dishes_draft`/draft queue reads.)*
- [x] **CLM-07 — Single-claim enforcement per account** — each account may submit only one stall claim total; repeat claims return existing-claim message. [Codex] *(implemented via profile-level dedupe in `submitClaimFromStall` and covered by claim helper tests.)*

### Done gate

- [ ] OCR pipeline processes a test menu photo end-to-end in staging within 30s (upload → Vision → extraction → `dishes_draft` row in ops queue).
- [x] "Claim this stall" CTA fires telemetry event AND inserts a `merchant_claim_interests` row in staging. *(2026-04-29 verification complete: staging insert confirmed with row `852e9988-b94f-45c3-a7f1-23e4bf57f082`; PostHog Event definitions shows `claim_this_stall_tapped` with `Last seen` ~2 minutes after live simulator tap, confirming telemetry delivery.)*
- [x] `npm run typecheck` passes. *(2026-04-22)*
- [x] `npm run test` passes. *(Latest full suite pass recorded 2026-04-29 via `npm test -- --watch=false`; Node 25 runtime trust notes documented in `tasks/node25-test-runtime.md`.)*
- [x] Feature flag `merchantClaimCtaEnabled` OFF in production, ON in staging (verified via automated flag contract tests + config assertions in `src/constants/featureFlags.test.ts` on 2026-04-29).

- [x] **CLM-07 — Single-claim enforcement per account** — each account may submit only one stall claim total; repeat claims return existing-claim message. [Codex] *(implemented via profile-level dedupe in `submitClaimFromStall` and covered by claim helper tests.)*

---

## 🔵 DEFERRED — Design Pass Phase 4: Marketing Website

> **Status:** ✅ MODERNISED 2026-04-23 — `marketing/web/` now ships a redesigned white-canvas homepage plus `/for-merchants`, `/about`, and `/privacy`.
> **Goal:** Stand up `marketing/web/` as a real site reusing the app's motif + tokens.
> **Owner:** Claude implemented; Gemini reviews visual parity; Codex deploys to Vercel.

### Scope

- 2026-04-23 mini-plan — Codex website modernization pass:
  - Rebuild the homepage in `marketing/web/` with a white main canvas, no emoji usage, and a materially different editorial layout.
  - Add the linked routes `/for-merchants`, `/about`, and `/privacy` in the same design language.
  - Clean up site infrastructure: canonicalize root `app/` + `components/`, add metadata/OG asset, mobile nav, and verification.
- [x] **WEB-01 — Initialise Next.js 16.2.4 App Router project** under `marketing/web/` with TypeScript + Tailwind. [Done 2026-04-22]
- [x] **WEB-02 — `app/layout.tsx`** — load Fraunces (display) + Nunito (body) + DM Mono via `next/font/google`; mirror app theme tokens. [Done 2026-04-22]
- [x] **WEB-03 — `tailwind.config.ts` + `globals.css`** — port palette from `src/theme/tokens.ts` via Tailwind v4 `@theme` variables (`--color-hungry-*`). [Done 2026-04-22]
- [x] **WEB-04 — `components/Hero.tsx`** — hero with floating dish pills, gradient orbs, Fraunces headline, inline waitlist form. [Done 2026-04-22]
- [x] **WEB-05 — `app/page.tsx` landing** — Navbar + Hero + ProblemSection + FeaturesSection + HowItWorks + LocalSection + HawkerSection + FaqSection + Footer. Copy from `marketing/website/waitlist-page-copy.md`. [Done 2026-04-22]
- [x] **WEB-06 — Waitlist form** — `components/WaitlistForm.tsx` with name/email/joining-as toggle, API call, success + error states. [Done 2026-04-22]
- [x] **WEB-07 — `app/for-merchants/page.tsx`** — merchant pitch page (value prop, verification tiers preview, waitlist form). [Done 2026-04-23]
- [x] **WEB-08 — `app/about/page.tsx`** — about + brand tagline + team. [Done 2026-04-23]
- [x] **WEB-09 — Waitlist form API route** — `app/api/waitlist/route.ts` → in-memory store (Supabase swap ready); POST with email validation + idempotency; GET for count. [Done 2026-04-22]
- [x] **WEB-10 — SEO + Open Graph** — full metadata in `layout.tsx` (title template, OG image, Twitter card, robots, locale `en_SG`). [Done 2026-04-22]
- [ ] **WEB-11 — Deploy to Vercel** with preview URLs on PRs. Link to `hungry.sg` domain. [Codex + user for DNS]

### Reusable assets from Phases 1–3

- `src/theme/tokens.ts` — palette + motif tokens to mirror in Tailwind config.
- `src/components/ui/HungryMotifHero.tsx` — reference implementation for the web port.
- Splash bite-the-u animation — reimplement as a hero Lottie/SVG on the landing page.
- Screenshots of the motif-ified Home, Discover carousels, and new Passport/Merchant/Messaging/Recents screens.

### Verification

- [x] `cd marketing/web && npm run build` passes. *(2026-04-22 — Exit code 0)*
- [x] `npm run dev` → localhost:3000 renders landing with motif + fonts. *(2026-04-22 — verified visually)*
- [x] `cd marketing/web && npm run lint` passes. *(2026-04-23 — no warnings)*
- [x] `cd marketing/web && npm run build` passes with routes `/`, `/for-merchants`, `/about`, `/privacy`, `/api/waitlist`. *(2026-04-23 — Exit code 0)*
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

- 2026-04-29 | Codex | Implemented Sprint 11 C9 Phase-1 realistic indoor layout pipeline for `hc-maxwell:L1`: added canonical `FloorPlanSourceV1` contracts, source adapter + precedence loading in `getFloorPlan()`, map polygon derivation from adapted floorplans, CV extraction scripts (`prepare_floorplan.py`, `extract_polygons.py`, `score_validate_polygons.py`, `export_floorplan.py`, `render_qa_overlay.py`), unit mapping workflow (`map_stalls.py`), and canonical artifacts under `data/floorplans/hc-maxwell/` (`L1.hungry.json`, `L1.geojson`, `L1.unit-map.csv`). Added adapter/fallback tests. | Status: implementation complete, QA checklist added; Expo dependency hygiene still open. | Verification: `python3 -m py_compile scripts/floorplan/*.py` pass; `npx tsx --test src/lib/geo/floorPlanSources.test.ts` pass (4/4); `npm run typecheck` pass; `npm run test` pass (90 pass, 0 fail). | Blockers: `npx expo-doctor` reports dependency mismatches (`@react-native-community/datetimepicker` expected 8.6.0 found 9.1.0, `expo` expected `~55.0.18` found `55.0.17`). | Next: run `npx expo install --check` and align SDK package versions before closing final done-gate.
- 2026-04-29 | Codex | Sprint 11 C9 follow-up: aligned Expo package versions to satisfy doctor gate (`expo` -> `~55.0.18`, `@react-native-community/datetimepicker` -> `8.6.0`) and reran verification suite. | Status: automated terminal gates closed. | Verification: `npm run typecheck` pass; `npm run test` pass (90 pass, 0 fail); `npx expo-doctor` pass (17/17). | Next: run manual polygon overlay QA + in-app interaction QA to close remaining C9 done-gate items.
- 2026-04-23 | Gemini | Completed core Phase C items: Implemented full Merchant mode (`Dashboard`, `Menu`, `Analytics`, `Profile`) with persona-driven accessibility for "Uncle Tan" (large fonts/buttons) and "Ahmad" (performance snapshots). Rebuilt the Review Feed (`ReviewFeedV2`) as a community-first tab with a "100% User Content" badge and specialized "Vegetarian" filters for "Sarah". Overhauled the Post Composer with a destination toggle and built the Music Selection library. Integrated persistent search history into the store. All V2 features verified with zero TypeScript errors and registered in the Developer Launcher. | Status: Phase C core features complete. | Verification: `npm run typecheck` pass; all V2 screens functional. | Next: Phase C4 (Messaging) and Phase C6 (Gamification).
- 2026-04-23 | Gemini | Completed Sprint 11 Phase A & B: Implemented 5 Figma V2 prototypes as new screens (`DiscoverV2`, `SearchV2`, `StallDetailV2`, `BuildingV2`, `QuickReviewV2`), added Fraunces typography for display headings, fully neutralized the palette (removed beige/warm tones), implemented persistent Dark Mode toggle in Settings V2, created V2 suite of brand assets (logos, mascot, food icons), and upgraded the Splash screen with advanced animation variants. Rebuilt the Quick Bites screen with a high-density, edge-to-edge grid and collapsible filters. | Status: Phase A & B code complete and verified. | Verification: `npm run typecheck` pass; all V2 screens functional via Developer Launcher. | Next: Phase C (Feature Additions).
- 2026-04-23 | Codex | Implemented the Hungry website modernization pass in `marketing/web`: replaced the original card-and-emoji landing page with a white-canvas editorial homepage, rewrote the shared website components (hero, contrast strip, dish-first proof, how-it-works, local proof, preview band, hawker module, FAQ, footer), added mobile navigation, converted the merchant/about route CTAs onto the shared waitlist system where applicable, bundled local Nunito + DM Mono fonts for deterministic builds, added a real OG asset/metadata base, and removed the duplicate `marketing/web/src` mirror tree. | Status: website redesign complete in code; Vercel deploy and Supabase-backed waitlist remain open. | Verification: `cd marketing/web && npm run lint` pass; `cd marketing/web && npx tsc --noEmit` pass; `cd marketing/web && npm run build` pass (`/`, `/about`, `/for-merchants`, `/privacy`, `/api/waitlist`). | Next: Lighthouse pass, preview/prod deployment, and optional waitlist persistence swap.
- 2026-04-22 | Claude (Sonnet 4.6) | Full codebase audit against `tasks/todo.md` + `SECURITY.md`. Findings: TOOL-01..04 all fully implemented (CI bot review comments were stale/incorrect — dismissed); SECURITY.md is correct and Hungry-specific (CmdTab references were in a stale cached version, not the actual file); Phase 7 provisioning complete — moved to Completed Archive; Sprint 10 promoted from NEXT to ACTIVE with 12/13 items done; 2 open security actions added (SEC-01 leaked-password-protection toggle, SEC-02 `.gitignore` for `supabase/.temp/`); Sprint 10 done gate annotated with Node 25/esbuild test blocker context. | Status: documentation updated, pushed to main. | Blockers: 4 staging smoke tests + CLM-04 copy (Gemini). | Next: run staging smokes for OCR e2e + claim CTA insert; fix Node 25 test runner issue; toggle SEC-01 in Supabase dashboard.
- 2026-04-22 | Codex | Implemented Sprint 10 Phase B (`CLM-03` + curated-menu `CLM-06` decision): added claim submission contracts to `HungryService.supply`, implemented idempotent claim submission mapping in Supabase (`submit_merchant_claim_interest` RPC `uuid|null` -> `created|already_exists`), mirrored idempotency in mock service by `(userId, venueId)` key, wired staging-gated one-tap CTA into `StallDetailScreen` (analytics + auth precheck + toast outcomes + in-flight disable), added analytics event `claim_this_stall_tapped`, and added Sprint 10 contract tests for CTA wiring and curated menu source. | Status: CLM-03 complete in code; CLM-06 implemented as curated-menu decision (no community draft consumer read). | Verification: `npm run typecheck` pass; `npx eslint src/app/screens/detail/StallDetailScreen.tsx src/lib/services/types.ts src/lib/services/supabase/supabaseService.ts src/lib/services/mock/mockService.ts src/lib/analytics/types.ts src/app/screens/sprint10-screen-contracts.test.ts` pass; `npm run test` remains blocked by existing Node 25/esbuild transform issue on React Native tests (`node_modules/react-native/index.js` unexpected `typeof`) with Sprint 10 contract tests passing. | Next: run staging runtime smoke for claim insert + telemetry, then move to CLM-04 copy spec and remaining Sprint 10 runtime done-gates.

- 2026-04-22 | Codex | Continued Sprint 5 done-gate verification. Removed Supabase repository mock fallback cache seeding (`supabaseRepository.ts`) and reran hard gates (`npm run typecheck`, `npx expo-doctor`). Revalidated production-path `mockRepository` usage via grep. Updated done-gate checklist with evidence-backed status only. | Status: done-gate now marked pass for `DataRepository live`, `review photo upload` (based on prior PROV-08 smoke evidence), `typecheck`, and `no mockRepository imports in production paths`; auth-E2E/onboarding, mock fallback runtime regression, and both manual crash-boundary checks remain open. | Verification: `npm run typecheck` pass; `npx expo-doctor` pass (17/17); grep `mockRepository` in production paths => no matches. | Next: run manual runtime verification on simulator/device for auth onboarding + crash-boundary checks and mock-mode runtime regression.
- 2026-04-22 | Codex | Implemented Sprint 10 Phase A (`OCR-02` + `CLM-05`): added secure storage migrations for `menu-photos` (`0014`, `0015`), added environment-derived `merchantClaimCtaEnabled` rollout flag, and added feature-flag unit tests. While running OCR smoke, fixed `submit_menu_photo` RPC parameter mismatch in `supabaseService` (`p_byte_size` -> `p_size_bytes`). | Status: OCR-02 and CLM-05 complete. | Verification: `npm run typecheck` pass; `npx tsx --test src/constants/featureFlags.test.ts` pass (3/3); `npx eslint src/constants/featureFlags.ts src/constants/featureFlags.test.ts src/lib/services/supabase/supabaseService.ts` pass; `npx supabase db push` applied `0014` and `0015`; `npx supabase db query --linked` confirms `storage.buckets.id='menu-photos'` with `public=false`, expected `menu_photos_*` policies on `storage.objects`, and authenticated upload smoke succeeded (`MENU_PHOTOS_UPLOAD_OK`) with object present in `storage.objects`. | Next: CLM-03 (`Claim this stall` CTA + telemetry insert) and CLM-06 (`Menu (community-sourced)` block on StallDetailScreen).
- 2026-04-22 | Codex | Continued Sprint 10 staging smokes: deployed supply edge functions and executed claim insert smoke with temp auth user + profile bootstrap to satisfy FK. | Status: claim insert smoke passed; OCR e2e blocked on missing vision secret. | Verification: `npx supabase functions deploy ingest-menu-photo --project-ref vlqfgmrsprbrgzteixsj` success; `npx supabase functions deploy ops-dishes-draft --project-ref vlqfgmrsprbrgzteixsj` success; staging claim smoke script returned `CLAIM_SMOKE_OK` with created `merchant_claim_interests.id` via `submit_merchant_claim_interest` RPC; `npx tsx --test src/constants/featureFlags.test.ts` pass (staging=true, production=false); function invoke check returned `{"error":"missing_vision_api_key"}`. | Next: set Supabase function secret `GOOGLE_CLOUD_VISION_API_KEY` (and optional `GEMINI_API_KEY`), rerun OCR e2e (upload→ingest→`dishes_draft`), then perform device CTA telemetry confirmation for `claim_this_stall_tapped`.
- 2026-04-22 | Codex | Completed Sprint 10 OCR staging smoke and fixed runtime reliability issue in edge function. Root cause of previous OCR failure was stack overflow from `String.fromCharCode(...imageBytes)` on large uploads. Patched `supabase/functions/ingest-menu-photo/index.ts` to use chunked byte→base64 conversion, redeployed function, and reran full staging smoke (storage upload + submission insert + ingest invoke + queue verification). | Status: OCR done-gate closed. | Verification: `npx supabase functions deploy ingest-menu-photo --project-ref vlqfgmrsprbrgzteixsj` success; smoke result `OCR_SMOKE_OK {"latencyMs":6794,"ocrStatus":"succeeded","extractedRows":8}` with sample extracted rows and persisted `dishes_draft` entries tied to submission `161f16cb-e1b5-46c3-afdc-b7a2d4ee3816`. | Next: run one device-level CTA tap to confirm runtime telemetry event `claim_this_stall_tapped`, then close final Sprint 10 claim done-gate.

- 2026-04-22 | Codex | Implemented Sprint 10 OCR-01..OCR-06 in developer-only flow: quick-review menu photo capture (`__DEV__` gated), supply service interface (`HungryService.supply`), menu-photo MIME/size validation + upload path, edge function `ingest-menu-photo` (Vision OCR + Gemini extraction + dedupe to `dishes_draft`), edge function `ops-dishes-draft` (list/review queue), and local ops stub UI at `ops/dishes-draft/index.html`. Updated `.env.example` with OCR/ops secrets. | Status: OCR-01, OCR-03, OCR-04, OCR-05, OCR-06 complete in code; OCR-02 bucket provisioning pending. SEC-08 later replaced the ops static-key model with Supabase JWT + `app_ops_admins` + allowed origins. | Verification: `npm run typecheck` pass. `npm run test` currently fails due existing environment/tooling issue (`esbuild` transform error at `node_modules/react-native/index.js` under Node v25), not from OCR files. | Next: deploy edge functions, create `menu-photos` bucket in Supabase, set secrets (`GOOGLE_CLOUD_VISION_API_KEY`, `GEMINI_API_KEY`, `OPS_DISHES_DRAFT_ALLOWED_ORIGINS`), seed `app_ops_admins`, then run staging E2E OCR smoke.

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

- [x] `cd marketing/web && npm run lint` — 2026-04-23 (website modernization pass)
- [x] `cd marketing/web && npx tsc --noEmit` — 2026-04-23 (website modernization pass)
- [x] `cd marketing/web && npm run build` — 2026-04-23 (website modernization pass)
- [x] `python3 -m py_compile scripts/floorplan/*.py` — 2026-04-29 (Sprint 11 C9 syntax gate)
- [x] `npx tsx --test src/lib/geo/floorPlanSources.test.ts` — 2026-04-29 (Sprint 11 C9 adapter/preference tests, 4/4)
- [x] `npm run typecheck` — 2026-04-29 (Sprint 11 C9 gate; clean)
- [x] `npm run test` — 2026-04-29 (Sprint 11 C9 gate; 90 pass, 0 fail)
- [x] `npx expo-doctor` — 2026-04-29 (Sprint 11 C9 gate; 17/17 checks passed)
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
