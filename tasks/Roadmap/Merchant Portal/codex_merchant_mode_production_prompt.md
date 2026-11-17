# Codex Implementation Prompt — Hungry Merchant Mode Production Ready

You are Codex working in the Hungry repository.

## Non-negotiable branch requirement

Work on the branch:

```bash
frontend-design-overhaul
```

Before making any changes, verify:

```bash
git branch --show-current
git status --short
```

Do not implement against `main` unless explicitly instructed. If you are not on `frontend-design-overhaul`, stop and switch to it.

## Goal

Make the entire Hungry merchant mode production-ready. This must not be a simple prototype. It must be a realistic, ready-to-use merchant console with polished UI/UX, real Supabase-backed dynamic data, security/RLS, prefetching/caching, customer-mode parity, notifications, analytics, and release-readiness tests.

The previous merchant issues have been partially addressed on this branch, so do not blindly recreate old work. Audit the current implementation first, then complete everything that is missing or incomplete.

## Files and areas to inspect first

Inspect these files before editing:

```text
package.json
src/app/navigation/MerchantTabs.tsx
src/features/navigation/prefetch.ts
src/features/merchant/merchantReadiness.ts
src/components/merchant/OutletSwitcher.tsx
src/app/screens/merchant/MerchantDashboardScreen.tsx
src/app/screens/merchant/MerchantMenuScreen.tsx
src/app/screens/merchant/BusinessProfileEditorScreen.tsx
src/app/screens/merchant/MerchantSettingsScreen.tsx
src/app/screens/merchant/PromotionListScreen.tsx
src/app/screens/merchant/PromotionBuilderScreen.tsx
src/app/screens/merchant/MerchantAnalyticsScreen.tsx
src/app/screens/merchant/CustomerInboxScreen.tsx
src/app/screens/merchant/AIAssistantScreen.tsx
src/app/screens/merchant/MerchantProfileScreen.tsx
src/app/screens/merchant/FeaturedVisitorsScreen.tsx
src/app/screens/detail/DishDetailScreen.tsx
src/app/screens/detail/StallDetailScreen.tsx
src/components/stall/PopularVisitorsSection.tsx
src/lib/services/types.ts
src/lib/services/supabase/supabaseService.ts
src/types/domain.ts
supabase/migrations/
supabase/smoke/
security_report.md
```

Also inspect user-mode shared components and avoid duplicating components that already exist in user mode.

## Current branch reality to account for

The branch already includes many changes:

- Merchant dashboard uses the active outlet name.
- Merchant dashboard status chip exists.
- Dashboard top-right icon is removed.
- Incomplete profile and unreplied review cards are dynamic.
- Business type dropdown exists.
- Business profile device/gallery image upload exists.
- Settings has team invite name/email/role.
- Settings has low rating preference and weekly summary card.
- Switch to Customer Mode resets navigation.
- Promotions support new item vs existing menu item and price/discount fields.
- Performance hides the scroll indicator and has See More controls.
- Menu uses “Menu”, FAB plus action, inline search, and customer preview.
- Merchant bottom navigation labels are present.
- Dish detail records dish views.
- Featured Visitors feature exists.
- Supabase has core merchant RLS and column-guard migrations.

Do not undo these improvements. Finish and harden them.

---

# Phase 0 — Baseline checks

Run:

```bash
npm install
npm run typecheck
npm run lint
npm run test
npm run audit:assets
npm run audit:supabase:static
npm run check:edge-functions
npm run release:ready:local
```

If environment credentials exist, also run:

```bash
npm run smoke:supabase-full-audit-v1
npm run smoke:supabase-social-gamification
npm run smoke:ocr-staging
npm run audit:supabase:advisor-security:non-password
npm run audit:supabase:advisor-support-snapshot
```

Record current failures before changing code.

---

# Phase 1 — Supabase schema, RPC, and RLS completion

## Required verification

Search all migrations and confirm the following exist and are correctly secured:

- `merchant_dish_view_events` or equivalent analytics event table.
- `merchant_analytics_daily_rollups`.
- `merchant_promotions` with:
  - `promotion_item_type`
  - `original_price`
  - `promotional_price`
  - `final_price`
  - `discount_percentage`
  - `is_available`
  - analytics fields
- `merchant_promotion_events`.
- `merchant_notifications`.
- `merchant_email_queue` or equivalent.
- `merchant_weekly_summaries`.
- `merchant_popular_visitor_pins`.
- `merchant_roles` invite fields:
  - `display_name`
  - `email`
  - `invite_status`
  - `invited_at`
  - `accepted_at`
  - `removed_at`
- `merchant_audit_logs`.

Confirm these RPCs exist:

- `record_merchant_dish_view`
- `get_merchant_dish_view_counts`
- `get_merchant_analytics`
- `enqueue_merchant_team_invite_email`
- `enqueue_merchant_weekly_summary_email`

If anything is missing, add migrations.

## RLS rules

Implement/verify these rules:

- Owners can manage all merchant account/outlet data.
- Managers can manage profile, menu, promotions, replies, analytics.
- Staff can only perform the configured limited actions.
- Non-team members cannot read/write merchant-owned private data.
- Customers cannot directly insert analytics rows except through controlled RPCs.
- Merchants cannot access another outlet’s:
  - menu,
  - images,
  - promotions,
  - analytics,
  - notifications,
  - team,
  - visitor pins,
  - review reply fields.
- Merchants cannot mutate trust/aggregate/system fields.
- Email queue writes must be RPC-controlled.

Add smoke tests in `supabase/smoke/`.

---

# Phase 2 — Real merchant analytics

Replace synthetic analytics.

Current Supabase service logic must not keep using fake derived values such as:

- `profileVisits = Math.floor(dishViewTotal / 2)`
- `menuViews = dishViewTotal`
- zeros for saves/shares/contact/direction/social
- empty `peakDiscoveryHours`
- empty `customerTasteTags`
- zero previous-period comparison.

## Implement

1. Analytics event recording:
   - dish views,
   - stall profile views,
   - menu views,
   - direction taps,
   - contact taps,
   - social link taps,
   - saves,
   - shares,
   - promotion impressions/clicks/saves/profile visits/dish views.
2. Stable anonymous session ID:
   - no global `"anonymous"` dedupe bucket.
   - store anonymous session ID locally.
3. Deduplication:
   - per user/session, per entity, per time window.
   - no duplicate increments from rerenders.
   - preview mode must not count.
4. Rollups:
   - daily/hourly rollups for fast analytics.
   - previous-period comparisons.
   - peak discovery hours.
   - top dishes.
   - taste/customer tags from review/search/save events.
5. Performance details:
   - build real detail views for each See More section.
   - no Alert-only detail views in production.

## Acceptance

- Viewing a dish as a customer increments that dish’s merchant view count.
- Dashboard and Performance read the same source-of-truth data.
- Previous period comparison works.
- Empty/low-data stalls show helpful empty states.
- Merchant preview does not inflate analytics.

---

# Phase 3 — Merchant home/dashboard hardening

Complete the dashboard.

## Requirements

- Keep active outlet name.
- Keep status chip.
- Compute status from:
  - `isLive`,
  - structured opening hours,
  - current Asia/Singapore time,
  - temporary closure date range,
  - manual offline/pause mode.
- Incomplete profile card:
  - list exact missing fields.
  - hide when complete.
  - deep-link to correct section when possible.
- Unreplied reviews:
  - hide if none.
  - count only actual unreplied customer interactions.
- Remove hardcoded and synthetic values.
- Add dynamic cards:
  - today’s status,
  - views,
  - rating,
  - unreplied reviews,
  - menu issues,
  - top dish,
  - upcoming promotions,
  - weekly digest summary.
- Do not run low-rating notification creation as a screen-load side effect. Move to database trigger/job or service event pipeline.

---

# Phase 4 — Business Profile production polish

## Fix image removal

Currently image removal can fail because empty image values may not be sent to the service. Fix this.

Acceptance:

- Upload profile image.
- Replace profile image.
- Remove profile image.
- Upload cover image.
- Replace cover image.
- Remove cover image.
- Changes persist in Supabase and reflect in customer Stall Detail.
- Old removed images do not remain in `galleryUrls`.

## Add structured fields

Add or improve:

- structured opening hours editor,
- temporary closure date range,
- manual live/offline toggle,
- building/address/location picker,
- cuisine categories picker,
- dietary labels picker,
- taste tags picker,
- social links,
- delivery links,
- contact visibility controls.

## Upload UX

Add:

- file type validation,
- file size validation,
- compression/resizing,
- progress indicator,
- retry,
- error states,
- broken-image fallback.

---

# Phase 5 — Menu production polish

## Keep existing improvements

- Keep “Menu” title.
- Keep floating plus FAB.
- Keep camera/manual actions.
- Keep inline search.
- Keep preview as customer.

## Add missing production details

- Replace `ScrollView` list rendering with `FlashList` or `FlatList`.
- Search by:
  - dish name,
  - description,
  - ingredients,
  - category,
  - dietary flags,
  - taste tags.
- Add category grouping and filtering.
- Add bulk actions:
  - sold out,
  - available,
  - feature/unfeature,
  - delete/archive,
  - category assignment.
- Add reorder/sort order if customer menu order matters.
- Add dish health indicators:
  - missing image,
  - missing description,
  - missing ingredients,
  - hidden/sold-out/featured.
- Customer preview must open the correct current merchant stall/dish and have a safe return path.

---

# Phase 6 — Promotions customer-mode integration

## Validation

Add validation:

- title required and max length,
- description max length,
- start/end date valid,
- end after start,
- non-negative prices,
- discount 0 to 100,
- existing menu item requires target dish,
- price/discount consistency,
- active promotion must be available.

## Customer visibility

Implement active promotion rendering in user mode:

- Stall Detail menu cards.
- Dish Detail.
- Search/browse results if relevant.
- Promotion carousel/section if desired.
- Hide inactive, draft, scheduled-before-start, and expired promotions.
- Show original price, final price, and discount.

## New promotional product

For `promotionItemType = "new_item"`, either:

- create a real dish/menu item with promotional metadata, or
- create a promo-only item and render it properly in customer surfaces.

Do not leave new promotional products as merchant-only records.

## Analytics

Track:

- impressions,
- clicks,
- saves,
- profile visits,
- dish views,
- redemptions/orders if ordering exists.

---

# Phase 7 — Performance detail screens

Replace Alert-based See More flows.

Create detail screens or bottom sheets for:

- Visits/views detail.
- Menu views detail.
- Rating trend.
- Save/share performance.
- Discovery mix.
- Top dishes.
- Customer taste profile.
- Peak hours.
- Promotion performance.

Each detail view must use real data and have:

- loading state,
- empty state,
- error state,
- date-range switcher,
- previous-period comparison,
- clear explanation of how metrics are counted.

---

# Phase 8 — Customer inbox and review replies

## Fix source navigation

Replace Alert-only `View original` with real navigation to:

- source review,
- source post,
- dish detail,
- stall detail,
- customer profile where appropriate.

## Improve replies

- Merchant replies must persist.
- Merchant replies must show in customer review surfaces.
- Add AI reply tone presets:
  - friendly,
  - short,
  - apologetic,
  - professional.
- Add saved templates.
- Add safety checks:
  - no auto-send,
  - no aggressive language,
  - no personal data exposure.

## Review insights

Add topic-level insights:

- food quality,
- service,
- wait time,
- value,
- portion,
- cleanliness,
- ambience.

Use rules first; optional LLM later.

---

# Phase 9 — Team, notifications, and weekly summaries

## Team invites

Implement end-to-end invite flow:

- email queue,
- email delivery worker,
- in-app notification for existing users,
- accept/decline screen,
- link accepted member to verified user account,
- remove/deactivate flow,
- owner/manager/staff permissions.

## Low-rating notifications

Move low-rating notification generation to:

- review insert/update trigger,
- or scheduled/edge job.

Do not depend on dashboard/settings screen load.

Threshold default: 2 stars or below, but make configurable.

## Weekly summaries

Implement scheduled weekly summary:

- compute per outlet weekly metrics,
- store summary,
- notify all active team members,
- send email if opted in,
- show summary detail screen,
- dedupe by outlet/week/member.

## Notification center

Add a merchant notification inbox:

- all notifications,
- unread/read state,
- deep links,
- filters,
- empty/error states.

---

# Phase 10 — AI/business insight engine

Replace generic placeholder insights.

Implement rules-first insights from real data:

- profile gaps,
- missing images,
- top viewed dishes,
- high views but low saves,
- rating drop,
- negative review topics,
- unreplied low ratings,
- promotion performance,
- peak hour opportunity,
- search demand without matching dish,
- stale menu items.

Add persistent insight state:

- read,
- dismissed,
- generated_at,
- source metrics,
- severity,
- action target.

AI should never publish or reply automatically.

---

# Phase 11 — Featured Visitors hardening

Keep the feature but harden it.

- Verify migrations/RLS for `merchant_popular_visitor_pins`.
- Only allow owner/manager to pin/reorder/unpin.
- Only allow reviews from that outlet.
- Respect deleted/hidden/private reviews.
- Do not expose sensitive user data.
- Add customer-side empty states.
- Add analytics for Popular Visitor card taps.
- Add tests for pin limit, reorder, ownership, and privacy.

---

# Phase 12 — Prefetch, caching, and optimized code

## Build real merchant query cache

Implement cache hooks or service-level cache for:

- merchant account,
- dashboard bundle,
- menu,
- analytics,
- inbox,
- promotions,
- team,
- notifications,
- AI insights,
- featured visitors.

Requirements:

- TTL,
- stale-while-revalidate,
- mutation invalidation,
- optimistic updates where safe,
- abort/cancel on unmount,
- retry/backoff,
- prefetch instrumentation.

## Refactor shared components

Reuse user-mode components where possible:

- buttons,
- cards,
- chips,
- search bars,
- bottom navigation item styles,
- menu item cards,
- review cards,
- empty/error/loading states.

Remove duplicate merchant-only components when a shared component exists.

---

# Phase 13 — Website, legal, and support experience

Inspect both marketing web surfaces:

```text
marketing/web/
marketing/website/web-v2/
```

Add or verify:

- merchant landing page matches actual app functionality,
- claim/verification explainer,
- merchant help docs,
- team invite email templates,
- weekly digest email templates,
- account deletion/deactivation copy,
- merchant privacy terms,
- analytics/AI disclosure,
- user photo usage disclosure,
- support contact/issue reporting.

Run SEO and web readiness scripts where available.

---

# Phase 14 — Security and release readiness

Address residual security issues from `security_report.md`:

- Do not commit secrets.
- Keep local env files ignored.
- Rotate any exposed credentials outside code.
- Do not claim certificate pinning unless implemented.
- Keep safe URL allowlists.
- Keep signed uploads and storage policies.
- Keep RLS and column guards.
- Add new RLS tests for new merchant tables.
- Add CI/release checks for merchant mode.

Run:

```bash
npm run typecheck
npm run lint
npm run test
npm run audit:assets
npm run audit:supabase:static
npm run check:edge-functions
npm run security:audit
npm run release:ready:local
```

Where credentials exist:

```bash
npm run smoke:supabase-full-audit-v1
npm run smoke:supabase-social-gamification
npm run smoke:ocr-staging
npm run audit:supabase:advisor-security:non-password
npm run audit:supabase:advisor-support-snapshot
```

---

# Manual QA acceptance matrix

Test on iOS and Android.

## Roles

- Owner
- Manager
- Staff
- Unverified merchant
- User without merchant account
- Customer
- Anonymous customer

## Required flows

- Merchant home dashboard with complete and incomplete profile.
- Business profile edit and image upload/remove.
- Structured hours and status chip.
- Menu add/edit/sold-out/featured/search.
- Camera/OCR menu flow.
- Customer preview.
- Promotion create/edit/schedule/expire.
- Promotion appears in customer mode.
- Dish view increments merchant analytics.
- Performance detail screens.
- Customer inbox reply.
- Reply appears in customer review surface.
- Low-rating notification.
- Team invite email and in-app notification.
- Invite accept/decline.
- Weekly summary scheduled and manual send.
- AI insights with real data.
- Featured visitors pin/reorder/public display.
- Switch to customer mode cannot swipe/back into merchant mode.
- Unverified merchant gates.
- Non-owner blocked from owner-only settings.

---

# Deliverables

After implementation, provide:

1. Summary of files changed.
2. Supabase migrations added/changed.
3. RLS and smoke tests added.
4. UI screens added/changed.
5. User-mode surfaces updated.
6. New scripts or env vars required.
7. Manual QA checklist results.
8. Known limitations or follow-up issues.
9. Commands run and outputs/failures.

Do not mark this complete until merchant mode is genuinely production-ready with real dynamic data, secure backend rules, customer-mode reflection, and tested flows.
