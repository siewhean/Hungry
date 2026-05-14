# Merchant Centre — Implementation Plan

Mobile-first business management area inside the Hungry app. 9 sections, 10 phases, 36 tasks across Gemini (UI/copy) and Codex (contracts/implementation/tests).

## User Review Required

> [!IMPORTANT]
> **Navigator pattern**: Existing code has a separate `MerchantTabs` bottom tab navigator with 4 tabs (Dashboard, Menu, Analytics, Profile). The planning doc specifies 9 sections. Options:
> 1. **Expand `MerchantTabs`** to 5 primary tabs + stack screens within each (e.g., Dashboard tab → Verification, Inbox, Promotions, AI, Settings as stack pushes)
> 2. **Replace with stack navigator** accessible from Profile tab, using a scrollable section grid as the landing page (GrabMerchant-style)
>
> Recommend **Option 2** — stack navigator with section grid — since 9 tabs is too many for bottom navigation and a dashboard-first layout matches the planning doc's UX direction.

> [!WARNING]
> **Supabase migrations** (MC-13): Backend tables for `merchant_verifications`, `merchant_accounts`, etc. are listed in the planning doc. Should these be:
> - Planned and written now as migration files (mock-first, schema ready)?
> - Deferred entirely until backend sprint?

> [!IMPORTANT]
> **Phase priority**: The plan sequences phases 1→9 linearly. If you want to parallelise (e.g., Codex does Phase 1 foundation while Gemini starts Phase 3 dashboard redesign in parallel), confirm and I'll adjust dependencies.

## Open Questions

1. **Outlet switcher scope**: Should multi-outlet support be fully functional in mock mode (switchable mock outlets) or just a UI placeholder?
2. **Video walkaround**: Should the verification video capture use `expo-camera` for real recording, or mock the upload flow with a file picker only?
3. **AI features (Phase 8)**: Should AI service methods call a real LLM endpoint (e.g., Gemini API via Edge Function) or return canned mock responses?

---

## Existing State

| Asset | Status |
|---|---|
| `MerchantTabs.tsx` | 4-tab navigator (Dashboard, Menu, Analytics, Profile) |
| `MerchantDashboardScreen.tsx` | Skeletal — hardcoded "Uncle Tan" data, no service layer |
| `MerchantMenuScreen.tsx` | Basic placeholder |
| `MerchantAnalyticsScreen.tsx` | Basic placeholder |
| `MerchantProfileScreen.tsx` | Basic placeholder |
| `MerchantTabParamList` | 4 params only |
| `MerchantClaimExplainerScreen.tsx` | Exists — claim CTA flow done |
| Merchant domain types | **None** |
| Merchant Zustand store | **None** |
| Merchant service methods | **None** |
| Merchant mock data | **None** |
| Merchant feature flag | `merchantClaimCtaEnabled` exists; no `merchantCentreEnabled` |

---

## Phase 1: Shell & Foundation

> Foundation layer. All later phases depend on this.

---

### Codex Tasks

#### [NEW] MC-01 — Merchant domain types
- File: `src/types/domain.ts`
- Add: `MerchantAccount`, `MerchantOutlet`, `MerchantVerification`, `VerificationStatus`, `VerificationMethod`, `VerificationEvidence`, `MerchantRole`, `BusinessType`, `LocationPrivacy`, `MerchantAnalytics`, `MerchantPromotion`, `PromotionStatus`, `PromotionTarget`, `CustomerInteraction`, `InteractionType`, `OCRDishDraft`
- Gate: `npm run typecheck`

#### [NEW] MC-02 — Merchant Zustand store
- File: `src/store/useMerchantStore.ts`
- State: active merchant account, active outlet, verification status, merchant profile, analytics cache
- Actions: `setActiveOutlet`, `setVerificationStatus`, `updateMerchantProfile`, `clearMerchant`
- Persist via `hungryPersistStorage`
- Gate: `npm run typecheck`

#### [NEW] MC-03 — Extend HungryService with merchant namespace
- File: `src/lib/services/types.ts` — add `HungryService.merchant` interface
- Methods: `getMerchantAccount`, `getOutlets`, `switchOutlet`, `getVerificationStatus`, `submitVerification`, `updateBusinessProfile`, `getMenu`, `addDish`, `editDish`, `deleteDish`, `toggleSoldOut`, `toggleFeatured`, `getOCRDrafts`, `acceptOCRDraft`, `rejectOCRDraft`, `getInbox`, `replyToInteraction`, `getPromotions`, `createPromotion`, `getAnalytics`, `getAIInsights`, `generateAIDishDescription`, `generateAIReply`
- File: `src/lib/services/mock/mockService.ts` — implement mock merchant methods
- Gate: `npm run typecheck`

#### [NEW] MC-04 — Merchant mock data fixtures
- File: `src/lib/services/mock/data.ts`
- Add: mock merchant account (Uncle Tan — single stall), mock multi-outlet account, mock verification states, mock analytics data, mock promotions, mock customer interactions, mock OCR drafts, mock AI insights
- Gate: `npm run typecheck`

#### [NEW] MC-05 — Merchant navigation expansion
- File: `src/app/navigation/navigationTypes.ts` — expand `MerchantTabParamList` or replace with `MerchantStackParamList` (depending on navigator decision)
- Add params for all 9 sections + sub-screens (VerificationCentre, HomeBasedVerification, BusinessProfileEditor, DishEditor, OCRDrafts, CustomerInbox, PromotionBuilder, PromotionList, AIAssistant, OrdersComingSoon, MerchantSettings)
- File: `src/app/navigation/MerchantTabs.tsx` → refactor to `MerchantStack.tsx` or expand
- Gate: `npm run typecheck`

#### [NEW] MC-06 — Merchant feature flag + access gate
- File: `src/constants/featureFlags.ts` — add `merchantCentreEnabled`
- File: `src/features/merchant/merchantGuards.ts` — access gate logic (verified vs unverified merchant)
- Gate: `npm run typecheck` + feature flag test

---

### Gemini Tasks

#### [NEW] MC-07 — VerifiedBadge component
- File: `src/components/merchant/VerifiedBadge.tsx`
- Props: `status: VerificationStatus`, `size?: 'sm' | 'md' | 'lg'`
- Render verified checkmark only when status === 'verified'
- Tap → tooltip "Verified by Hungry"
- Integrate into: `StallDetailScreen`, search result cards, map marker cards

#### [NEW] MC-08 — OutletSwitcher component
- File: `src/components/merchant/OutletSwitcher.tsx`
- Header bar: "Currently managing: {outletName}" + "▼ Switch outlet"
- Bottom sheet picker for multi-outlet accounts
- Single-outlet accounts show outlet name without switcher

#### [NEW] MC-09 — Entry point UI wiring
- Profile tab → "Merchant Centre" row in ProfileHomeScreen
- Settings → "Business tools" row
- StallDetailScreen → "Manage this stall" button (only for owned stalls)

---

## Phase 2: Verification

---

### Gemini Tasks

#### [NEW] MC-10 — VerificationCentreScreen
- File: `src/app/screens/merchant/VerificationCentreScreen.tsx`
- Status tracker (timeline/stepper: Not started → Draft → Submitted → In review → Verified)
- Evidence upload cards (video walkaround, document/licence upload)
- Singpass/Myinfo Business option (CTA only, not integrated)
- Rejection/resubmission flow
- All verification states visible

#### [NEW] MC-11 — HomeBasedVerificationScreen
- File: `src/app/screens/merchant/HomeBasedVerificationScreen.tsx`
- Dedicated flow: business name, owner verification, operating/delivery/pickup area, address privacy setting (exact/approximate/hidden), menu photos, social proof link, food safety acknowledgement
- Default: approximate area

### Codex Tasks

#### [NEW] MC-12 — Verification state machine
- File: `src/features/merchant/verificationStateMachine.ts`
- Allowed transitions: not_started → draft → submitted → in_review → verified/rejected/more_info_needed
- Evidence upload mock service methods
- Video walkaround upload mock (file picker → mock processing → status update)
- Gate: `npm run typecheck` + unit test for state transitions

#### [NEW] MC-13 — Supabase merchant migrations (deferred or now — see review)
- Files: `supabase/migrations/` — merchant_accounts, merchant_verifications, merchant_verification_evidence, merchant_outlets, merchant_roles
- Badge fields: verification_status, verified_at, verified_method, verification_expires_at, verified_badge_visible

---

## Phase 3: Dashboard & Analytics

---

#### [NEW] MC-14 — MerchantDashboardScreen redesign (Gemini)
- Refactor existing screen to use service layer instead of hardcoded data
- Date range selector (Today / 7 days / 30 days)
- Analytics metric cards (profile visits, menu views, dish views, direction taps, saves, shares, review count, avg rating)
- Action cards (verification status, profile completion, menu completion, reviews needing replies, dishes missing info, suggested promotion, top dish insight)
- Empty/loading/error states
- OutletSwitcher header integration

#### [NEW] MC-15 — Mock analytics data (Codex)
- File: `src/lib/services/mock/data.ts` (extend)
- Generate mock analytics: daily/weekly/monthly metrics, top dishes, most saved, most searched keywords, peak discovery times, customer taste tag distribution
- Previous period comparison data

#### [NEW] MC-16 — MerchantAnalyticsScreen full redesign (Gemini)
- Detailed analytics: charts/trends, top dishes table, customer taste tags, peak hours, comparison to previous period
- Uses service layer from MC-03

---

## Phase 4: Profile Management

---

#### [NEW] MC-17 — BusinessProfileEditorScreen (Gemini)
- File: `src/app/screens/merchant/BusinessProfileEditorScreen.tsx`
- All editable fields: name, description, business type, cuisine/category, address/building/floor/unit, operating area (home-based), map pin + privacy level, opening hours, temp closure, profile/cover/gallery photos, contact info, social links, delivery/pickup links, dietary labels, taste/cuisine tags, signature dishes, verified badge preview
- "Preview as customer" mode
- React Hook Form

#### [NEW] MC-18 — Profile edit service methods (Codex)
- Mock service: `updateBusinessProfile`, `uploadProfilePhoto`, `uploadCoverPhoto`, `uploadGalleryPhoto`
- Validation: required fields, opening hours format
- Gate: `npm run typecheck`

---

## Phase 5: Menu & Dish Manager

---

#### [NEW] MC-19 — MerchantMenuScreen redesign (Gemini)
- Published menu list with search/filter
- Add dish FAB
- Dish cards: photo, name, price, sold out badge, featured badge
- Swipe actions or long-press: edit, archive, toggle sold out, toggle featured
- "Preview menu as customer" button

#### [NEW] MC-20 — DishEditorScreen (Gemini)
- File: `src/app/screens/merchant/DishEditorScreen.tsx`
- Full form: name, price, description, photo upload, ingredients, allergen info, dietary tags, taste tags, spicy level slider, available/sold out toggle, featured toggle
- AI assist buttons (description generator, ingredient suggestion) — calls service, shows draft for confirmation

#### [NEW] MC-21 — OCRDraftScreen (Gemini)
- File: `src/app/screens/merchant/OCRDraftScreen.tsx`
- Extracted dish cards: name, price, confidence %, source menu photo thumbnail
- Actions per card: Accept (→ published menu), Reject, Edit (→ DishEditorScreen pre-filled)
- Batch accept/reject

#### [NEW] MC-22 — Menu CRUD + OCR service methods (Codex)
- Mock: `getMenu`, `addDish`, `editDish`, `deleteDish`, `toggleSoldOut`, `toggleFeatured`, `getOCRDrafts`, `acceptOCRDraft`, `rejectOCRDraft`
- Gate: `npm run typecheck`

#### [NEW] MC-23 — AI dish tools service methods (Codex)
- Mock: `generateDishDescription(dishName, ingredients)`, `suggestIngredients(dishName)`, `suggestAllergens(ingredients)`, `suggestTags(dishName, description)`
- Returns canned mock responses
- Gate: `npm run typecheck`

---

## Phase 6: Customer Inbox

---

#### [NEW] MC-24 — CustomerInboxScreen (Gemini)
- File: `src/app/screens/merchant/CustomerInboxScreen.tsx`
- Tab/filter bar: All, Reviews, Comments, Mentions, Unreplied
- Interaction cards: author, rating (if review), text, timestamp, reply status
- Reply composer (inline or bottom sheet)
- AI reply suggestion chips
- Quick reply templates
- Report abusive content action
- "View original" link → navigate to review/post
- Sentiment summary card at top

#### [NEW] MC-25 — Inbox service methods + AI reply (Codex)
- Mock: `getInbox(filters)`, `replyToInteraction(id, text)`, `reportInteraction(id, reason)`, `generateAIReply(interactionId)`
- Mock data: 8-10 customer interactions with mix of ratings, sentiments
- Gate: `npm run typecheck`

#### [NEW] MC-26 — AI reply suggestion cards (Gemini)
- Inline suggestion chips below reply composer
- "Use this reply" → fills composer
- Disclaimer: "AI-generated suggestion — review before sending"

---

## Phase 7: Promotions

---

#### [NEW] MC-27 — PromotionBuilderScreen (Gemini)
- File: `src/app/screens/merchant/PromotionBuilderScreen.tsx`
- Form: title, description, dish/business target, start/end date pickers, target audience (nearby/saved/taste match/followers), preview card
- Save as draft or publish

#### [NEW] MC-28 — PromotionListScreen (Gemini)
- File: `src/app/screens/merchant/PromotionListScreen.tsx`
- Tab bar: Active, Scheduled, Draft, Ended
- Promotion cards with analytics (impressions, clicks, saves, profile visits, dish views)
- Create new promotion FAB

#### [NEW] MC-29 — Promotion service methods (Codex)
- Mock: `getPromotions(filter)`, `createPromotion`, `updatePromotion`, `getPromotionAnalytics(id)`
- Mock data: 3-4 promotions across states
- Gate: `npm run typecheck`

---

## Phase 8: AI Assistant

---

#### [NEW] MC-30 — AIAssistantScreen (Gemini)
- File: `src/app/screens/merchant/AIAssistantScreen.tsx`
- Insight cards: profile improvement, menu cleanup, demand insights, best time to post, photo enhancement
- Weekly summary card
- Each insight → action button that opens relevant section (e.g., "Fix missing ingredients" → Menu)
- All AI outputs are drafts — never auto-publish

#### [NEW] MC-31 — AI assistant service methods (Codex)
- Mock: `getAIInsights`, `getWeeklySummary`, `getProfileSuggestions`, `getMenuCleanupSuggestions`, `getDemandInsights`
- Canned mock responses
- Gate: `npm run typecheck`

---

## Phase 9: Orders Coming Soon

---

#### [NEW] MC-32 — OrdersComingSoonScreen (Gemini)
- File: `src/app/screens/merchant/OrdersComingSoonScreen.tsx`
- "Orders coming soon" hero state
- "Join pilot" CTA
- QR ordering preview illustration
- Printable QR code preview (mock)
- Payment setup checklist (all unchecked)
- Order lifecycle preview (placed → accepted → preparing → ready → collected)
- No fake orders

---

## Phase 10: Settings

---

#### [NEW] MC-33 — MerchantSettingsScreen (Gemini)
- File: `src/app/screens/merchant/MerchantSettingsScreen.tsx`
- Business account settings
- Staff/team management list (owner, manager, staff roles)
- Add/remove team member
- Role permissions matrix
- Notification preferences (toggles)
- Privacy settings (location privacy for home-based)
- Verification documents/status link → VerificationCentre
- Help/support
- Logout

#### [NEW] MC-34 — Settings service methods (Codex)
- Mock: `getTeamMembers`, `addTeamMember`, `removeTeamMember`, `updateRole`, `getNotificationPreferences`, `updateNotificationPreferences`
- Gate: `npm run typecheck`

---

## Cross-Cutting

---

#### [NEW] MC-35 — Merchant screen contract tests (Codex)
- File: `src/app/screens/merchant-screen-contracts.test.ts`
- Verify all merchant screens render without crash
- Verify service interface completeness
- Pattern: same as `sprint10-screen-contracts.test.ts`

#### [NEW] MC-36 — Typecheck gate (Codex)
- Run `npm run typecheck` after each phase completion
- Run `npm test -- --watch=false` after MC-35 lands

---

## Verification Plan

### Automated
- `npm run typecheck` after every phase
- `npm test -- --watch=false` after MC-35
- Feature flag tests for `merchantCentreEnabled`

### Manual
- iOS simulator walkthrough of complete merchant flow
- Verify all 9 sections accessible from dashboard
- Verify access gate blocks unverified merchants
- Verify verified badge appears on consumer-facing surfaces

---

## Task Summary

| Owner | Count | Task IDs |
|---|---|---|
| **Codex** | 17 | MC-01, MC-02, MC-03, MC-04, MC-05, MC-06, MC-12, MC-13, MC-15, MC-18, MC-22, MC-23, MC-25, MC-29, MC-31, MC-34, MC-35 |
| **Gemini** | 18 | MC-07, MC-08, MC-09, MC-10, MC-11, MC-14, MC-16, MC-17, MC-19, MC-20, MC-21, MC-24, MC-26, MC-27, MC-28, MC-30, MC-32, MC-33 |
| **Codex** (gate) | 1 | MC-36 |

**Execution order**: Phase 1 (MC-01→MC-09) is blocking. After Phase 1, phases 2–9 can parallelize with Codex landing service methods before Gemini implements screens within each phase.
