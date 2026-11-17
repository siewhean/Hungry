# Hungry Merchant Mode Production Readiness Audit

**Repository:** `siewhean/Hungry`
**Branch reviewed:** `frontend-design-overhaul`
**Audit date:** 2026-05-25
**Audit type:** Static repository audit from GitHub branch files, service contracts, Supabase service code, migrations, and security documentation. I did not run the app, run migrations, or execute the full test suite locally in this environment.

---

## Executive verdict

The `frontend-design-overhaul` branch is substantially more complete than the earlier prototype described in the previous prompt. Many visible merchant-mode issues have already been partially or fully addressed in the branch:

- Merchant home now uses the active outlet name instead of a personal greeting.
- Merchant home uses an outlet status chip instead of the old “Stall is live and discoverable” banner.
- The top-right merchant home icon has been removed.
- Incomplete profile and unreplied reviews cards are now data-driven and hidden when not relevant.
- Business type has been changed to a dropdown.
- Business profile image upload from device/gallery has been added.
- Merchant settings now includes team invite fields, low-rating preference, weekly summary section, and reset navigation when switching to customer mode.
- Promotion builder now supports new-item vs existing-menu-item flows and price/discount fields.
- Performance now hides the scroll indicator and has “See More” controls.
- Menu now uses title “Menu”, has a floating plus action, inline search, and customer preview.
- Merchant bottom navigation labels are present.
- Dish detail now records dish-view analytics through the service layer.
- Supabase has meaningful merchant RLS and column-guard migrations.

However, **merchant mode is not production-ready yet**. The remaining gaps are not mostly cosmetic. The biggest production blockers are backend/data completeness, customer-mode parity, analytics correctness, end-to-end notifications/email delivery, AI insight quality, promotion surfacing, and advanced merchant operations. Several branch features are “wired” at the UI/service-call level but still need schema/RPC verification, scheduled jobs, delivery workers, true analytics event models, RLS smoke coverage, and detailed UX states.

---

## Evidence base reviewed

Key branch files reviewed:

- `package.json`
- `src/app/navigation/MerchantTabs.tsx`
- `src/features/navigation/prefetch.ts`
- `src/features/merchant/merchantReadiness.ts`
- `src/components/merchant/OutletSwitcher.tsx`
- `src/app/screens/merchant/MerchantDashboardScreen.tsx`
- `src/app/screens/merchant/MerchantMenuScreen.tsx`
- `src/app/screens/merchant/BusinessProfileEditorScreen.tsx`
- `src/app/screens/merchant/MerchantSettingsScreen.tsx`
- `src/app/screens/merchant/PromotionListScreen.tsx`
- `src/app/screens/merchant/PromotionBuilderScreen.tsx`
- `src/app/screens/merchant/MerchantAnalyticsScreen.tsx`
- `src/app/screens/merchant/CustomerInboxScreen.tsx`
- `src/app/screens/merchant/AIAssistantScreen.tsx`
- `src/app/screens/merchant/MerchantProfileScreen.tsx`
- `src/app/screens/merchant/FeaturedVisitorsScreen.tsx`
- `src/app/screens/detail/DishDetailScreen.tsx`
- `src/app/screens/detail/StallDetailScreen.tsx`
- `src/components/stall/PopularVisitorsSection.tsx`
- `src/lib/services/types.ts`
- `src/lib/services/supabase/supabaseService.ts`
- `src/types/domain.ts`
- `supabase/migrations/0020_merchant_rls_hardening.sql`
- `supabase/migrations/0022_merchant_catalog_column_guards.sql`
- `supabase/migrations/0024_merchant_catalog_metadata_rls.sql`
- `security_report.md`

External product/research signals used for feature benchmarking:

- Uber Eats 2025 AI menu descriptions, AI review summaries, image enhancement, user-submitted food photos, and Live Order Chat.
- Yelp AI Review Insights for food quality, service, ambiance, and wait-time sentiment.
- Research patterns for aspect-based restaurant review analysis, smart replies, and demand forecasting.

---

## Production readiness scorecard

| Area | Current branch status | Production readiness |
|---|---|---|
| Merchant home page | Many prior UI issues fixed and dynamic cards introduced | **Close, but analytics/status data not production-grade** |
| Business profile | Dropdown and device image picker exist | **Partial; image removal, structured fields, validation, and upload UX need work** |
| Settings | Team invites, weekly summary, low-rating preference, customer-mode reset exist | **Partial; delivery automation, accept flow, notification center, and advanced settings missing** |
| Promotion | Existing-item/new-item flow and pricing fields exist | **Partial; validation and customer-mode surfacing need major work** |
| Performance | Scroll indicator removed, See More exists | **Partial; See More opens alerts and analytics are incomplete** |
| Menu | FAB, inline search, preview, layout improvements exist | **Good start; needs long-list optimization, categories/ingredients, and bulk workflows** |
| Customer inbox | Reviews/unreplied filters, replies, AI suggestion exist | **Partial; source navigation, thread detail, moderation state, and review-topic insights missing** |
| AI assistant | UI exists | **Prototype logic; service returns generic weekly insight only** |
| Featured visitors | Good new feature with pin/reorder UX | **Promising; verify RLS, public rendering, privacy, and moderation** |
| Supabase/RLS | Strong baseline for core merchant edits | **Good foundation; new tables/RPCs/queues need verification and tests** |
| Prefetch/performance | Idle prefetch and route preload exist | **Partial; no real data cache/TTL/invalidation and some lists use ScrollView maps** |
| User-mode reflection | Profile/menu updates partly reflect via linked venues/dishes; dish views recorded | **Partial; promotions, replies, metrics, and active status need parity checks** |
| Website experience | Branch adds marketing and release/security scripts | **Needs merchant-specific support/claim/ops polish** |

---

## P0 production blockers

### P0-1. Analytics are not fully dynamic or accurate

The branch added dish-view tracking, but merchant analytics are still not production-grade.

Current implementation signals:

- `DishDetailScreen.tsx` calls `getHungryService().discovery.recordDishView(dish.id, { userId })`.
- Supabase `recordDishView` calls RPC `record_merchant_dish_view`.
- Merchant analytics calls RPC `get_merchant_dish_view_counts`.
- `getAnalytics` then derives several values artificially:
  - `profileVisits = Math.floor(dishViewTotal / 2)`
  - `menuViews = dishViewTotal`
  - `directionTaps = 0`
  - `saves = 0`
  - `shares = 0`
  - `contactTaps = 0`
  - `socialLinkTaps = 0`
  - `peakDiscoveryHours = []`
  - `customerTasteTags = []`
  - `previousPeriodComparison` is all zero.

This violates the requirement that all merchant values must be dynamic and reflect real data.

Required production work:

1. Create a real analytics event model:
   - `merchant_analytics_events`
   - or separate event tables such as:
     - `merchant_dish_view_events`
     - `merchant_stall_view_events`
     - `merchant_menu_view_events`
     - `merchant_direction_tap_events`
     - `merchant_contact_tap_events`
     - `merchant_share_events`
     - `merchant_save_events`
     - `merchant_promotion_events`
2. Add server-side RPCs:
   - `record_merchant_dish_view`
   - `record_merchant_stall_view`
   - `record_merchant_menu_view`
   - `record_merchant_action_event`
   - `get_merchant_analytics`
   - `get_merchant_dish_view_counts`
3. Use a stable anonymous session ID. Current fallback `"anonymous"` risks deduplicating every anonymous user together if the RPC dedupes by session.
4. Add dedupe/throttling rules:
   - Do not count the same dish repeatedly from rerenders.
   - Count at most once per session/user per dish in a defined window.
   - Do not count merchant preview views unless explicitly marked as preview.
5. Add daily/hourly rollups:
   - `merchant_analytics_daily_rollups`
   - `merchant_dish_analytics_daily`
6. Compute real previous-period deltas.
7. Compute peak hours from event timestamps.
8. Compute customer taste tags from reviewed dishes, search interactions, saves, and review tags.
9. Add fallback empty states for low-data stalls.
10. Add smoke tests verifying that customer dish views are reflected in merchant analytics.

Acceptance criteria:

- Viewing a dish in customer mode increments only that dish’s view count.
- Merchant Performance shows real `dishViews`, `menuViews`, `profileVisits`, `saves`, `shares`, `contactTaps`, `directionTaps`, and previous-period trends.
- The dashboard and performance page show the same source-of-truth totals.
- Previewing as a merchant does not inflate customer analytics unless intentionally configured.
- All analytics queries are scoped by outlet ownership.

2026-05-25 implementation note:

- `MERCH-P0-ANALYTICS-01` landed the Supabase analytics foundation in `supabase/migrations/20260525120301_merchant_analytics_foundation.sql`: event tables, promotion events, daily rollups, dish daily analytics, weekly summaries, audit logs, `record_merchant_action_event`, `get_merchant_analytics`, and weekly-summary persistence.
- Supabase merchant analytics now reads `get_merchant_analytics` instead of deriving profile/menu values from dish views, and anonymous customer analytics use a generated stable runtime session id instead of the global `"anonymous"` fallback.
- Stall/dish profile-view, save, and share emitters were wired in the detail screens. Remaining follow-up: add emitters for any menu, direction, contact, and social-link controls that exist or are introduced, then apply the migration and run live Supabase smoke.

---

### P0-2. Supabase schema/RPC coverage must be verified and completed

The service layer references tables/RPCs that must exist in migrations and have RLS:

- `merchant_promotions`
- extended promotion columns:
  - `promotion_item_type`
  - `original_price`
  - `promotional_price`
  - `final_price`
  - `discount_percentage`
  - `is_available`
  - analytics columns
- `merchant_notifications`
- `merchant_roles` invite columns:
  - `display_name`
  - `email`
  - `invite_status`
  - `invited_at`
  - `accepted_at`
  - `removed_at`
- `merchant_popular_visitor_pins`
- `merchant_weekly_summaries`
- `merchant_email_queue` or equivalent
- `record_merchant_dish_view`
- `get_merchant_dish_view_counts`
- `enqueue_merchant_team_invite_email`
- `enqueue_merchant_weekly_summary_email`

The branch has strong existing RLS foundations in migrations `0020`, `0022`, and `0024`, but those visible migrations do not by themselves prove the new branch-added merchant feature tables/RPCs are fully provisioned.

Required production work:

1. Search all Supabase migrations on `frontend-design-overhaul`.
2. For every service-referenced table/RPC, confirm:
   - migration exists,
   - RLS is enabled where appropriate,
   - policies are owner/manager/staff-specific,
   - column guards exist for sensitive columns,
   - smoke tests exist.
3. If missing, add migrations.
4. If present but incomplete, harden them.
5. Add smoke SQL under `supabase/smoke/`.
6. Add TypeScript contract tests under `src/lib/services/supabase/`.

Acceptance criteria:

- A clean Supabase project can be created from migrations and the app compiles without missing-table/RPC runtime failures.
- `npm run audit:supabase:static` passes.
- `npm run smoke:supabase-full-audit-v1` passes where environment variables are available.
- Merchant staff cannot invite/remove team members.
- Merchant staff cannot alter billing/security-sensitive settings.
- Merchants cannot edit another outlet’s dishes, images, promotions, reviews, notifications, or visitor pins.

---

### P0-3. Team invite and notification delivery are not fully end-to-end

Settings now lets owners enter name, email, and role. The service creates `merchant_roles`, inserts a notification, and calls `enqueue_merchant_team_invite_email`.

This is not enough for production unless there is a working delivery worker, invite acceptance flow, and user-account linking.

Required production work:

1. Add or verify a team invite email queue:
   - `merchant_email_queue`
   - dedupe key
   - status: queued/sent/failed
   - retry count
   - last error
   - provider message ID
2. Add an Edge Function or backend job to send email:
   - `send-merchant-email-queue`
   - provider adapter, for example Resend, SendGrid, Postmark, or Supabase-compatible SMTP worker.
3. Add invite acceptance flow:
   - secure invite token or magic-link flow,
   - accept/decline screen,
   - installs/open app deep link,
   - account creation if needed,
   - link existing user by verified email only.
4. Add in-app notifications for existing users:
   - resolve existing `user_profiles.email` or auth users,
   - set `recipient_user_id`,
   - display in notification center,
   - support read/unread state.
5. Add permission matrix:
   - owner: all settings, team, profile, menu, promotions, analytics.
   - manager: menu, promotions, replies, analytics; no team ownership/security.
   - staff: menu availability/replies only, if desired.
6. Add audit logs:
   - invited, accepted, role changed, removed.

Acceptance criteria:

- Owner invite sends a real email.
- Existing user receives in-app notification.
- Pending member cannot manage until accepted unless intentionally allowed.
- Removed member loses access immediately.
- Non-owner cannot add/remove/modify team members at the database layer.

---

### P0-4. Promotions are not fully customer-visible and validated

The promotion builder has new-item/existing-menu-item selection, price fields, active status, and runtime status. However, it still needs production validation and customer-mode surfacing.

Required production work:

1. Validate:
   - title/description length,
   - date format and timezone,
   - end date must be after start date,
   - price fields must be non-negative,
   - discount must be between 0 and 100,
   - existing-menu-item promotions require `targetDishId`,
   - final price and discount must be consistent,
   - active promotions require availability.
2. For “new promotional product/item”:
   - either create a real dish/menu item with promotional metadata,
   - or clearly model it as a promo-only item that customer mode knows how to render.
3. Customer mode must display active promotions:
   - Stall detail menu cards,
   - Dish detail,
   - Discover/feed promotional surfaces,
   - Search results, if relevant.
4. Expired promotions must not show as active.
5. Scheduled promotions must not show before start date.
6. Promotion metrics must be real:
   - impressions,
   - clicks,
   - saves,
   - dish views,
   - profile visits,
   - redemptions/orders if ordering exists.
7. Add promotion preview as customer.

Acceptance criteria:

- Merchant creates a promotion for an existing menu item.
- Customer sees the promotional price/badge only during the valid time window.
- Customer dish detail shows original price, final price, and discount.
- Promotion analytics update after customer views/clicks/saves.
- Expired promotions disappear from customer-active surfaces but remain in merchant history.

2026-05-25 implementation note:

- `MERCH-P0-PROMO-01` landed the validation half of P0-4: title/description length, date parsing/order, non-negative prices, discount range and price consistency, existing-menu-item dish selection, active availability, builder error surfacing, mock/Supabase service validation, and Supabase check constraints.
- Follow-up hardening closed the QA gaps in that validation slice: dates now reject invalid calendar rollover and unqualified datetimes, existing-menu-item targets are checked against the merchant outlet menu in mock/Supabase services and by a Supabase trigger, mock/Supabase final-price rules now agree when the original price is `0`, and Supabase partial price updates write the derived `final_price`.
- 2026-06-07 follow-up implemented the customer-visible repo side of P0-4 for customer detail surfaces: active promotions are filtered through a shared valid-window helper, `DishDetailScreen` and `StallDetailScreen` render active promotion cards with original/final pricing, expired/scheduled/unavailable promotions are hidden, and customer promotion impression, dish-view, profile-visit, click, and save events are recorded through the merchant action analytics service. Supabase support is represented by `list_customer_active_promotions(...)` in migration `20260607120000_customer_active_promotions.sql`, and mock/Supabase services expose `discovery.listActivePromotionsForTarget(...)`.
- Remaining P0-4 work is external/live proof and broader placement: apply the new migration to the target Supabase project, run customer-mode stall/dish smoke with real merchant promotions, verify analytics rows update live, and decide whether Discover/feed/search should carry promotional placements for MVP.

---

### P0-5. AI insights are currently mostly placeholder/rule-lite

The AI Assistant UI is present and polished, but Supabase `getAIInsights` currently returns a generic weekly summary based on review count and top dishes. This does not meet the requirement for realistic AI/business insights.

Required production work:

1. Implement a rules-first insight engine using real data:
   - missing profile fields,
   - missing dish images,
   - low-rated dishes,
   - unreplied negative reviews,
   - high-view/low-save dishes,
   - stale menu items,
   - top search keywords with no matching dish,
   - promotion performance changes,
   - sudden rating drop,
   - peak-hour opportunities.
2. Add review topic extraction:
   - food quality,
   - portion/value,
   - wait time,
   - service,
   - cleanliness,
   - taste,
   - price.
3. Add AI reply drafts:
   - tone presets,
   - safety guardrails,
   - short/long reply options,
   - never auto-send.
4. Add confidence/insufficient-data states.
5. Store insights with:
   - type,
   - source data snapshot,
   - severity,
   - recommendation,
   - action target,
   - dismiss/read state.

Acceptance criteria:

- AI Assistant shows actionable insights from real merchant data.
- Empty state is useful when data is insufficient.
- Insights navigate to the correct fix screen.
- Dismissals persist.
- No hallucinated metrics or placeholder advice.

---

## P1 high-priority gaps

### P1-1. Outlet status does not parse actual opening hours

`getMerchantOutletStatus` currently uses:

- no outlet -> `offline`
- `!isLive` -> `offline`
- temporary closure -> `closed`
- otherwise -> `open`

It does not parse operating hours, special hours, holiday closures, manual pause, stock status, or timezone.

Production requirement:

- Add structured opening hours instead of only free-text.
- Compute Open/Closed from day/time in Asia/Singapore.
- Allow manual “pause online” / offline mode.
- Allow temporary closure date range.
- Surface the same status to customer mode.
- Avoid showing “Open” when the stall is verified but currently outside hours.

---

### P1-2. Business profile image removal is likely broken

The business profile form supports Remove, but submit only includes `profilePhotoUrl` / `coverPhotoUrl` when the trimmed value is truthy:

```ts
...(profilePhotoUrl ? { profilePhotoUrl } : {})
...(coverPhotoUrl ? { coverPhotoUrl } : {})
```

That means clearing an image may not persist to Supabase. `galleryUrls` also merges the previous outlet gallery, which can reintroduce removed images.

Production requirement:

- Persist image removal explicitly by sending `profilePhotoUrl: ""` or `null`.
- Remove cleared image from `galleryUrls`.
- Optionally delete or orphan-clean old storage objects.
- Add tests for remove/replace flows.

---

### P1-3. Image upload needs production upload UX and validation

Current branch has device picker and Supabase upload, but it still needs:

- MIME type validation before upload,
- file size validation before upload,
- upload progress,
- compression/resizing,
- retry state,
- replace/remove confirmation,
- broken-image fallback,
- storage cleanup strategy,
- privacy/visibility decision for `merchant-stall-images`.

---

### P1-4. Performance “See More” uses alerts, not detail screens

Merchant Performance currently opens Alert dialogs for “See More”. This is useful for a prototype, but not production.

Production requirement:

- Add real detail screens or bottom sheets:
  - Views detail,
  - Menu views detail,
  - Rating/reviews trend,
  - Saves/shares detail,
  - Dish performance,
  - Discovery mix,
  - Taste profile,
  - Peak hours,
  - Promotion performance.
- Use charts and lists from real analytics.
- Allow date-range switching and consistent comparison periods.

---

### P1-5. Merchant Menu still needs long-list optimization and richer editing

The menu screen is improved, but still uses `ScrollView` + `.map`. That can become sluggish for larger menus.

Production requirement:

- Use `FlashList` or `FlatList`.
- Add category grouping.
- Add search by:
  - dish name,
  - description,
  - ingredients,
  - category,
  - dietary/allergen labels,
  - availability.
- Add bulk actions:
  - mark sold out,
  - mark available,
  - feature/unfeature,
  - reorder,
  - apply category.
- Add drag-and-drop or explicit sort order if customer menu order matters.
- Add image/description completion badges.
- Add “last updated” and “customer-visible” state.

---

### P1-6. Customer inbox needs real source navigation and review-topic insights

Customer Inbox currently supports filters, AI suggestion, reply, report, and sentiment summary.

Remaining issues:

- “View original” shows an Alert with source ID instead of navigating to the actual review/post/dish/stall.
- Sentiment is only rating-based, not topic-based.
- No conversation/thread detail screen.
- No assignment/status/escalation.
- No SLA or unresolved state.
- No moderation result tracking.
- AI reply generation is generic.

Production requirement:

- Navigate source IDs to review/post/dish/stall.
- Show merchant replies on customer-visible review surfaces.
- Add topic summaries: food quality, wait time, service, value, cleanliness.
- Add saved reply templates.
- Add reply tone presets.
- Add moderation case status for reported interactions.

---

### P1-7. User-mode parity needs full verification

Some parity exists:

- Business profile updates propagate to linked `venues` for key fields.
- Menu changes update `dishes`.
- Dish detail records view events.
- Stall detail renders `PopularVisitorsSection`.

Still verify and implement:

- Merchant profile image/cover image appear in customer Stall Detail.
- Merchant opening status appears in customer Stall Detail.
- Merchant dish edits appear immediately in customer menu and dish detail.
- Merchant sold-out status appears in customer menu/dish detail.
- Merchant featured dish appears in customer surfaces.
- Merchant promotions appear in customer surfaces.
- Merchant reply appears below the customer review.
- Merchant pinned popular visitors appear in customer Stall Detail.
- Merchant preview mode does not mutate analytics.
- All customer-visible merchant changes obey verification/live/draft rules.

---

### P1-8. Prefetch exists but is not a real data cache

`prefetch.ts` has idle prefetching and route preloading. It dedupes prefetches with Sets, but successful merchant prefetch keys are not TTL-invalidated, and fetched data is mostly discarded unless the service itself caches internally.

Production requirement:

- Introduce a real query cache or service cache for merchant data:
  - analytics,
  - menu,
  - inbox,
  - promotions,
  - team,
  - notifications,
  - AI insights.
- Add TTL and invalidation on mutation.
- Add stale-while-revalidate behaviour for focus events.
- Add abort/cancel support for screen unmounts.
- Add retry/backoff for transient Supabase failures.
- Ensure prefetch does not create duplicate notification sync writes.
- Add performance instrumentation to measure whether prefetch actually improves screen load.

---

### P1-9. Advanced settings are missing

Production merchant settings should include:

- Business availability:
  - open/closed/offline,
  - temporary closure date range,
  - special hours,
  - holiday mode.
- Notification thresholds:
  - low rating threshold,
  - review alert frequency,
  - weekly digest recipients,
  - AI insight frequency.
- Team permissions:
  - owner/manager/staff matrix,
  - role editing,
  - remove/deactivate,
  - transfer owner.
- Customer contact:
  - phone visibility,
  - email visibility,
  - social links,
  - delivery links.
- Ordering settings, if applicable:
  - pickup enabled,
  - order link,
  - menu availability,
  - out-of-stock behaviour.
- Privacy/data:
  - export data,
  - delete/deactivate merchant account,
  - audit log.
- Support:
  - help center,
  - report an issue,
  - verification appeal.

---

## Page-by-page audit

### Merchant Home / Dashboard

Implemented well:

- Active outlet name is used.
- Status chip exists.
- Header icon removed.
- Incomplete profile is computed from actual outlet/menu.
- Unreplied reviews are computed from inbox.
- Metrics load from merchant analytics.
- Business tools and quick actions navigate to key screens.
- Low-rating notification sync is invoked.

Needs improvement:

- Status must use real operating hours, manual offline, and temporary closure windows.
- Analytics currently depends on incomplete service-level event data.
- Low-rating notification sync should not be performed opportunistically on every dashboard load; move to trigger/job.
- Recent feedback should handle comments, questions, mentions, and empty states cleanly.
- Actionable cards should deep-link to exact missing profile sections when possible.
- Add dashboard sections:
  - today’s open/close status,
  - menu issues,
  - low-stock/sold-out,
  - top dish this week,
  - rating change,
  - newest review,
  - upcoming promotions,
  - customer messages,
  - weekly digest summary.

---

### Outlet switcher

Implemented well:

- Active outlet name can wrap to two lines.
- Bottom sheet switcher shows all outlets.
- Business type and unit number are shown.

Needs improvement:

- Add search if merchants can later manage many outlets.
- Add status chip per outlet in the switcher.
- Add “current outlet” accessibility state.
- Make the bottom sheet height adapt to long names and large font sizes.
- Since current product says one merchant account owns one stall, decide whether to keep multi-outlet support or simplify while preserving future extensibility.

---

### Business Profile

Implemented well:

- Business type dropdown with human-readable labels.
- Device/gallery picker added for profile and cover image.
- Preview, error states, and image preview exist.
- Supabase service uploads local images.

Needs improvement:

- Persist image removal.
- Add client-side file validation and compression.
- Add progress indicator.
- Add structured fields:
  - building/address picker,
  - postal code,
  - exact map pin,
  - opening-hours editor,
  - special-hours editor,
  - social/delivery links,
  - cuisine/taste/dietary selectors,
  - contact visibility toggles.
- Add save-changes dirty-state confirmation.
- Add preview banner explaining that preview is customer mode and may not count analytics.
- Add field-specific validation.

---

### Settings

Implemented well:

- Role chip removed from Business Account.
- Owner can invite by name/email/role.
- Non-owner sees owner-only message.
- Notification preferences exist.
- Weekly summary UI exists.
- Payouts/Billing section has been removed from settings.
- Switch to customer mode resets the navigation stack.

Needs improvement:

- Team invitation needs end-to-end email/push/in-app delivery and accept/decline flow.
- In-app notification list should be a full inbox, not just the latest 3 in Settings.
- Weekly summary should be scheduled, not only manually sent.
- Low-rating alerts should be created by review insert/update triggers/jobs, not screen load.
- Add advanced settings listed above.
- Add audit logs for team/settings changes.
- Confirm RLS owner-only enforcement for team invites and removals.

---

### Promotions

Implemented well:

- Existing menu item vs new item selector exists.
- Promotion fields include title, description, date, target audience, original/final price, discount, availability.
- Price preview exists.
- Toggle buttons no longer turn the full card orange.
- Runtime status helper exists.

Needs improvement:

- Add validation rules.
- Add date picker rather than free-text only.
- Existing menu item list should be searchable for long menus.
- New promotional product should create a customer-visible item or be rendered in customer promo surfaces.
- Customer mode must display active promotions.
- Add redemption/click/impression analytics.
- Add pause/resume/delete/archive.
- Add promotion preview as customer.
- Add expired/scheduled state handling at the backend/query level.

---

### Performance

Implemented well:

- Scroll indicator hidden.
- Uses data-trust disclosure.
- Cards have See More controls.
- Discovery mix, top dishes, taste profile, peak hours are represented.

Needs improvement:

- See More should open real detail screens/modals.
- Analytics service must stop returning synthetic/zero values.
- Add charts for daily trend and comparison.
- Add drilldowns:
  - view source,
  - dish performance,
  - customer actions,
  - review topics,
  - promotion funnel.
- Add export/share weekly summary.
- Add “not enough data yet” state per card.

---

### Menu

Implemented well:

- Title is `Menu`.
- Floating plus button opens camera/manual options.
- Search is inline.
- Preview as customer exists.
- Layout issue from old footer is addressed.

Needs improvement:

- Replace `ScrollView` mapping with `FlashList`.
- Add category/ingredient search.
- Add category filters.
- Add bulk edit.
- Add menu ordering.
- Add image completion and dish health indicators.
- Add customer-visible status for sold-out/hidden/featured.
- Preview should support:
  - stall menu preview,
  - selected dish preview,
  - return to merchant mode,
  - analytics-safe preview mode.

---

### Customer Inbox

Implemented well:

- All/unreplied/reviews/comments/mentions filters.
- Sentiment summary.
- Reply composer.
- AI reply suggestion.
- Report flow.

Needs improvement:

- “View original” must navigate, not Alert.
- AI reply should be context-aware and editable with tone options.
- Merchant reply should appear in customer review surfaces.
- Reported interactions need status.
- Add review-topic insights and filters.
- Add notifications for new reviews/questions.
- Add empty states for comments/questions if those types are not supported yet.

---

### AI Assistant

Implemented well:

- Screen exists.
- Weekly digest card exists.
- Actionable insight card UI exists.
- Dismiss UI exists locally.

Needs improvement:

- Service insight generation is not meaningful enough.
- Dismiss should persist.
- Use real analytics, review-topic extraction, menu gaps, photo quality, and promotion performance.
- Add “why am I seeing this?” data explanation.
- Add confidence and insufficient-data states.
- Add safe AI guardrails for replies/descriptions.

---

### Featured Visitors

Implemented well:

- Merchant can pin/unpin/reorder up to 6 review-backed visitor cards.
- Customer Stall Detail renders `PopularVisitorsSection`.

Needs improvement:

- Verify full Supabase migrations/RLS for `merchant_popular_visitor_pins`.
- Enforce review ownership by outlet.
- Add moderation/privacy rules:
  - only public reviews,
  - handle deleted/hidden reviews,
  - respect private user profiles,
  - avoid exposing sensitive user data.
- Add customer-side empty/fallback states.
- Add analytics for clicks on popular visitor cards.

---

### Merchant Profile

Implemented well:

- Payouts/Billing was removed here on this branch.
- Switch to customer mode resets stack.
- Sign out exists.
- Basic profile summary is clean.

Needs improvement:

- Avoid duplication with Settings.
- Add status/verification/account health.
- Add direct links to advanced settings.
- Add a merchant “public profile preview” summary.

---

## Supabase and security audit

### Existing strong foundations

The branch has several important security controls already documented or implemented:

- Merchant review update guard limits merchant review updates to reply fields.
- Customer interaction reports are restricted to merchant-managed review venues.
- Notification preferences are split between member read and owner/manager write/delete.
- Venue/dish column guards prevent merchant clients from altering trust, aggregate, identity, or live fields.
- Merchant-owned dish images, taste vectors, and dietary flags have RLS policies.
- Security report documents prior remediation around secrets, storage, OCR edge functions, ops authorization, analytics privacy scrubbing, safe links, CI gates, and merchant verification evidence.
- Security report still lists residual owner actions:
  - rotate exposed credentials,
  - enable leaked-password protection when available,
  - address historical gitleaks findings,
  - run manual signed-in merchant smoke tests.

### Supabase work still required

Add or verify migrations and RLS for every new branch-level feature:

1. `merchant_dish_view_events`
2. `merchant_analytics_daily_rollups`
3. `merchant_promotions` extended columns
4. `merchant_promotion_events`
5. `merchant_notifications`
6. `merchant_email_queue`
7. `merchant_weekly_summaries`
8. `merchant_popular_visitor_pins`
9. `merchant_roles` invite fields
10. `merchant_audit_logs`
11. RPCs:
    - `record_merchant_dish_view`
    - `get_merchant_dish_view_counts`
    - `get_merchant_analytics`
    - `enqueue_merchant_team_invite_email`
    - `enqueue_merchant_weekly_summary_email`
    - `send_merchant_weekly_summary`
12. Edge Functions:
    - email queue sender,
    - weekly summary scheduler,
    - notification fanout,
    - optional AI insights generator.

### Suggested RLS rules

- Owners can manage everything for their merchant account.
- Managers can manage outlet profile/menu/promotions/inbox but not owner/team-sensitive settings unless explicitly allowed.
- Staff can update availability/reply only if that is the intended role.
- Customers can only insert analytics events through security-definer RPCs, not directly into merchant event tables.
- Merchant analytics reads must be scoped to a merchant’s own outlet.
- Merchant notifications must only be visible to the relevant recipient or account member.
- Popular visitor pins can only be mutated by owner/manager of the linked outlet.
- Email queue writes should be via RPC only; direct client insert should be blocked unless explicitly safe.

---

## Prefetch, performance, and optimized code

### Current strengths

- Route preloading exists.
- Image prefetch exists with memory-disk cache.
- Merchant tab prefetch exists.
- Idle scheduling is used to avoid blocking the UI.
- Branch includes more release and audit scripts.

### Weaknesses

- `merchantPrefetches` has no TTL invalidation after successful prefetch.
- Prefetched merchant data is not stored in an obvious screen-consumable cache.
- Mutations do not consistently invalidate prefetched data.
- Some screens still use `ScrollView` with `.map` for potentially large lists.
- Several screens compute derived data inline; these should be moved to selectors/hooks.
- Some data fetches are fire-and-forget and may hide failures.

### Required production work

1. Add `useMerchantQuery` / service cache:
   - key,
   - TTL,
   - stale-while-revalidate,
   - mutation invalidation,
   - loading/error states,
   - optimistic updates.
2. Add list virtualization:
   - menu,
   - inbox,
   - promotions,
   - featured visitors,
   - analytics drilldowns.
3. Add cancellation:
   - abort in-flight fetches on unmount/focus change.
4. Add logging:
   - non-blocking prefetch failures to debug/Sentry in non-PII form.
5. Add performance budget:
   - first dashboard render,
   - tab switch under warm cache,
   - image load budget,
   - memory budget.

---

## Website experience audit

The branch includes marketing/website work, SEO scripts, release readiness scripts, and legal/account deletion surfaces. Merchant production readiness should include the web and support experience too.

Required website/ops additions:

- Merchant landing page that matches actual app capability.
- Merchant claim/verification explainer.
- Help articles for:
  - profile setup,
  - photo upload,
  - menu editing,
  - promotions,
  - replying to reviews,
  - team invites,
  - weekly summaries,
  - low rating alerts.
- Email templates for team invites and weekly digest.
- Deep links that open the correct merchant screens.
- Privacy/terms wording for merchant analytics, AI assistance, user-submitted photos, and public replies.
- Account deletion/deactivation path for merchant accounts.
- Status/support contact for merchant issues.
- Release checklist that includes merchant-mode E2E flows, not only general app health.

---

## Current feature research and recommended integrations

### Patterns observed in current apps

1. **AI menu assistance**
   - Current delivery platforms are adding AI-generated menu item descriptions and image quality enhancements.
   - Integrate this into Hungry’s Dish Editor with merchant approval only.

2. **AI review summaries and review-topic insights**
   - Current local/restaurant apps summarize review sentiment by topics like food quality, service, ambiance, and wait time.
   - Integrate this into Merchant Dashboard, Customer Inbox, and Performance.

3. **Live customer chat / issue resolution**
   - Current food platforms increasingly support real-time merchant-customer communication for substitutions, dietary questions, and issue resolution.
   - Hungry can start with a customer Q&A/inbox thread model before full ordering is built.

4. **User-submitted food photos**
   - Platforms allow customers to upload food photos and may use selected photos to improve menu listings.
   - Hungry already has social/review media primitives; add merchant approval for customer-submitted dish photos.

5. **Smart replies**
   - Smart reply systems can speed up repetitive customer responses.
   - Hungry’s reply composer already has AI suggestion UI; make it contextual and safe.

6. **Demand forecasting and peak-hour recommendations**
   - Use analytics to recommend staffing/menu/promotion timing.
   - Start with rules from peak views, search demand, and promotion performance before advanced ML.

### Feature set to add for production merchant mode

- Review-topic dashboard:
  - Food,
  - Service,
  - Wait time,
  - Value,
  - Portion,
  - Cleanliness,
  - Ambience.
- Photo quality score and “fix photo” checklist.
- Missing menu metadata checklist.
- Promotion recommendations based on slow-moving dishes and peak hours.
- Customer photo approval queue.
- Saved reply templates and AI tone presets.
- Weekly digest with clear metrics and actions.
- Real-time notification center.
- Team permissions matrix.
- Structured opening hours and closure mode.
- Menu health score.
- Customer-visible preview with explicit preview banner.
- Exportable weekly report.
- Merchant audit log.

---

## Test plan

### Unit/contract tests

Add or update tests for:

- `getMerchantOutletStatus` with structured hours, manual offline, temporary closures.
- `getMerchantProfileGaps`.
- promotion pricing and runtime status.
- promotion validation.
- analytics event dedupe.
- previous-period analytics calculations.
- notification dedupe.
- team invite permissions.
- image removal persistence.
- customer-mode data reflection.
- AI insights rules.
- prefetch TTL/invalidation.

### Supabase smoke tests

Add smoke SQL for:

- merchant analytics event insert via RPC.
- merchant cannot read another outlet analytics.
- merchant cannot mutate another outlet promotion.
- staff cannot invite/remove team members.
- owner can invite/remove team members.
- merchant reply can only update reply fields.
- customer cannot forge merchant reply.
- popular visitor pin limited to merchant-owned outlet.
- active promotions query returns only valid scheduled window.
- image storage path ownership.

### Manual QA matrix

Run on iOS and Android:

| Role | Scenarios |
|---|---|
| Owner | Full settings, team invite, profile edit, menu edit, promotions, replies, analytics |
| Manager | Allowed profile/menu/promo/reply; blocked from owner-only settings |
| Staff | Only configured staff permissions |
| Unverified merchant | Verification gate and limited screens |
| No merchant account | Access gate and claim flow |
| Customer | Sees merchant changes, promotions, replies, popular visitors |
| Anonymous customer | Can view public content; analytics dedupe works safely |

### Release commands

Run the branch’s release and audit scripts after implementation:

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

Where Supabase credentials are available, also run:

```bash
npm run smoke:supabase-full-audit-v1
npm run smoke:supabase-social-gamification
npm run smoke:ocr-staging
npm run audit:supabase:advisor-security:non-password
npm run audit:supabase:advisor-support-snapshot
```

Add a dedicated merchant E2E smoke script that covers:

- merchant dashboard,
- profile completion,
- image upload,
- menu add/edit/sold-out,
- promotion creation,
- reply to review,
- team invite,
- weekly summary,
- customer preview,
- customer-mode reflection.

---

## Implementation roadmap

### Phase 0 — Confirm branch and baseline

- Checkout `frontend-design-overhaul`.
- Pull latest.
- Run install, typecheck, lint, tests.
- Run existing release/audit scripts.
- Create a failing checklist for every missing merchant production requirement.

### Phase 1 — Supabase schema/RLS foundation

- Add/verify all merchant tables/RPCs.
- Add RLS and column guards.
- Add smoke tests.
- Add local seed data for owner, manager, staff, unverified merchant, and customer.

### Phase 2 — Analytics event model

- Implement event recording and rollups.
- Replace synthetic analytics.
- Add customer-mode event tracking.
- Add analytics detail screens.

### Phase 3 — Profile/menu/customer parity

- Fix profile image remove/replace.
- Add structured opening hours.
- Add social/delivery/order settings.
- Ensure user mode reflects all approved merchant changes.

### Phase 4 — Promotions

- Add validation.
- Make promo items customer-visible.
- Add promotion analytics.
- Add promotion customer preview.

### Phase 5 — Notifications/team/weekly digest

- Implement email queue and worker.
- Implement invite accept/decline flow.
- Implement notification center.
- Implement scheduled weekly summaries.
- Implement review-triggered low-rating alerts.

### Phase 6 — AI/business insights

- Implement rules engine.
- Add review-topic extraction.
- Add persistent dismiss/read state.
- Improve AI reply drafts.

### Phase 7 — UX/performance polish

- Virtualize long lists.
- Add query caching and invalidation.
- Refactor shared components with user mode.
- Add accessibility pass.
- Add empty/error/loading states everywhere.

### Phase 8 — Production release hardening

- Run full release gates.
- Run manual QA.
- Fix warnings.
- Update docs/help/legal.
- Create app-store/simulator smoke evidence.

---

## Assumptions and limitations

- This audit is based on static code inspection of `frontend-design-overhaul`.
- I did not execute the app, Supabase migrations, or E2E tests here.
- Some missing-table/RPC risks must be confirmed by running a fresh Supabase migration stack or searching the full migration directory locally.
- Existing security documentation reports many controls as already remediated, but new merchant features still need their own migration/RLS/test verification.
- The production target assumes Hungry wants a real merchant operating console, not only a claim/edit prototype.
