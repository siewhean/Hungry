import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { isVerificationCurrent, resolveMerchantAccess } from "@/features/merchant/merchantGuards";
import {
  MERCHANT_REPLY_MAX_LENGTH,
  formatAverageRating,
  formatRatingChange,
  formatReviewCountLabel,
  getVerificationStatusInfo,
  resolvePromotionRuntimeStatus,
} from "@/features/merchant/merchantReadiness";

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const merchantScreens = [
  "AIAssistantScreen",
  "BusinessProfileEditorScreen",
  "CustomerInboxScreen",
  "DishEditorScreen",
  "FeaturedVisitorsScreen",
  "MerchantMenuScreen",
  "MerchantProfileScreen",
  "MerchantSettingsScreen",
  "OCRDraftScreen",
  "PromotionBuilderScreen",
  "PromotionListScreen",
];

test("an ended or draft promotion keeps its stored status (M5)", () => {
  const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const past = new Date(Date.now() - 7 * 86_400_000).toISOString();
  assert.equal(
    resolvePromotionRuntimeStatus({ status: "ended", startDate: past, endDate: future }),
    "ended",
  );
  assert.equal(
    resolvePromotionRuntimeStatus({ status: "draft", startDate: past, endDate: future }),
    "draft",
  );
  assert.equal(
    resolvePromotionRuntimeStatus({ status: "active", startDate: past, endDate: future }),
    "active",
  );
});

test("ratings read as stars and say so when there are no reviews (M11, L4)", () => {
  assert.equal(formatAverageRating(0, 0), "–");
  assert.equal(formatAverageRating(4.26, 3), "4.3");
  assert.equal(formatReviewCountLabel(0, "today"), "No reviews yet");
  assert.equal(formatReviewCountLabel(1, "today"), "1 review today");
  // MERCH-V4: the weekly summary sits next to an all-time unreplied count.
  assert.equal(
    formatReviewCountLabel(0, "in the last 7 days", { zeroLabel: "No reviews in the last 7 days" }),
    "No reviews in the last 7 days",
  );
  assert.equal(formatRatingChange(4.5, 4.3, 5, 4), "+0.2");
  assert.equal(formatRatingChange(4, 4.5, 5, 4), "-0.5");
  assert.equal(formatRatingChange(4, 4, 5, 4), "0.0");
  assert.equal(formatRatingChange(4, 0, 5, 0), "New");
  assert.equal(formatRatingChange(0, 4, 0, 4), "No reviews yet");
  assert.doesNotMatch(formatRatingChange(4.5, 4.3, 5, 4), /%/);
});

test("an expired verification is not verified access (L1, M17)", () => {
  const now = new Date("2026-10-21T00:00:00Z");
  const lapsed = { status: "verified" as const, expiresAt: "2026-10-01T00:00:00Z" };
  const current = { status: "verified" as const, expiresAt: "2027-10-01T00:00:00Z" };
  assert.equal(isVerificationCurrent(lapsed, now), false);
  assert.equal(isVerificationCurrent(current, now), true);
  assert.equal(isVerificationCurrent({ status: "verified" }, now), true);
  assert.equal(isVerificationCurrent({ status: "submitted" }, now), false);
  // With the Merchant Centre flag off every merchant resolves to "none".
  const flagOn = FEATURE_FLAGS.merchantCentreEnabled;
  assert.equal(
    resolveMerchantAccess(true, "verified", "2000-01-01T00:00:00Z"),
    flagOn ? "unverified" : "none",
  );
  assert.equal(
    resolveMerchantAccess(true, "verified", "2999-01-01T00:00:00Z"),
    flagOn ? "verified" : "none",
  );
  assert.equal(resolveMerchantAccess(true, "verified"), flagOn ? "verified" : "none");

  assert.equal(getVerificationStatusInfo(lapsed, now).label, "Expired");
  assert.equal(getVerificationStatusInfo(current, now).label, "Verified");
  assert.equal(getVerificationStatusInfo(undefined, now).label.length > 0, true);
  for (const status of ["submitted", "more_info_needed", "rejected"] as const) {
    const info = getVerificationStatusInfo({ status }, now);
    assert.equal(info.label.length > 0, true);
    assert.doesNotMatch(info.label, /^Pending$/);
  }
});

test("the reply limit is shared by the screen, services and database (L14)", () => {
  assert.equal(MERCHANT_REPLY_MAX_LENGTH, 1000);
  assert.match(
    read("src/app/screens/merchant/CustomerInboxScreen.tsx"),
    /MERCHANT_REPLY_MAX_LENGTH/,
  );
  assert.match(read("src/lib/services/supabase/supabaseService.ts"), /MERCHANT_REPLY_MAX_LENGTH/);
  assert.match(read("src/lib/services/mock/mockService.ts"), /MERCHANT_REPLY_MAX_LENGTH/);
  assert.match(
    read("supabase/migrations/20261022090000_merchant_reply_length_check.sql"),
    /char_length\(merchant_reply_text\) <= 1000/,
  );
});

test("merchant screens use the dialog hook, not Alert.alert, which does nothing on web (M7)", () => {
  assert.equal(existsSync(path.join(root, "src/features/merchant/useMerchantDialog.tsx")), true);
  for (const name of merchantScreens) {
    const source = read(`src/app/screens/merchant/${name}.tsx`);
    assert.doesNotMatch(source, /Alert\.alert/, `${name} still calls Alert.alert`);
    assert.doesNotMatch(source, /import \{[^}]*\bAlert\b[^}]*\} from "react-native"/, name);
  }
  assert.doesNotMatch(read("src/features/merchant/useUnsavedChangesGuard.ts"), /Alert\.alert/);
  assert.doesNotMatch(read("src/components/merchant/OpeningHoursEditor.tsx"), /Alert\.alert/);
});

test("AI helpers that were templates are no longer offered as AI (M4)", () => {
  const dish = read("src/app/screens/merchant/DishEditorScreen.tsx");
  assert.doesNotMatch(dish, /Suggest ingredients|Suggest taste tags|Draft description/);
  assert.doesNotMatch(read("src/app/screens/merchant/CustomerInboxScreen.tsx"), /Suggested reply/i);
});

test("the photo-drafts entry stays hidden until an upload pipeline exists (M3, L13)", () => {
  const menu = read("src/app/screens/merchant/MerchantMenuScreen.tsx");
  assert.match(menu, /MENU_PHOTO_DRAFTS_ENABLED = false/);
  assert.match(read("src/app/screens/merchant/OCRDraftScreen.tsx"), /Photo drafts/);
});

test("Menu switch is locked on live dishes and Preview needs a linked venue (M22, M23)", () => {
  const menu = read("src/app/screens/merchant/MerchantMenuScreen.tsx");
  assert.match(menu, /isLockedLiveDish/);
  assert.match(menu, /Verify to change live dishes/);
  assert.match(menu, /previewVenueId = activeOutlet\?\.venueId \|\| undefined/);
  const editor = read("src/app/screens/merchant/BusinessProfileEditorScreen.tsx");
  assert.doesNotMatch(editor, /getDataRepository/);
  assert.match(editor, /locked=\{isOutletVerified\}/);
});

test("the dashboard and analytics say 'Profile visits' and no longer ship dead cards (M10, L2, L3, L5, L10)", () => {
  const dashboard = read("src/app/screens/merchant/MerchantDashboardScreen.tsx");
  assert.match(dashboard, /Profile visits/);
  assert.match(dashboard, /RefreshControl/);
  assert.doesNotMatch(dashboard, /Verification Required/);
  const analytics = read("src/app/screens/merchant/MerchantAnalyticsScreen.tsx");
  assert.match(analytics, /merchant_analytics_range_changed/);
  assert.doesNotMatch(analytics, /PieChart/);
  assert.match(read("src/lib/analytics/types.ts"), /merchant_analytics_range_changed/);
  assert.equal(existsSync(path.join(root, "src/components/merchant/VerifiedBadge.tsx")), false);
  const guards = read("src/features/merchant/merchantGuards.ts");
  assert.doesNotMatch(guards, /canReplyAsBusinesss|canAccessDashboard|canViewAnalytics/);
});

test("'Today' analytics starts at Singapore midnight (L9)", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(service, /singaporeOffsetMs = 8 \* 60 \* 60 \* 1000/);
  // The same arithmetic the service uses, for a phone in another time zone.
  const offset = 8 * 60 * 60 * 1000;
  const now = new Date("2026-10-21T20:30:00Z"); // 04:30 on 22 Oct in Singapore
  const singaporeNow = new Date(now.getTime() + offset);
  const midnightUtc =
    Date.UTC(singaporeNow.getUTCFullYear(), singaporeNow.getUTCMonth(), singaporeNow.getUTCDate()) -
    offset;
  assert.equal(new Date(midnightUtc).toISOString(), "2026-10-21T16:00:00.000Z");
});

test("settings reads no longer write, and the device keeps no merchant contact details (M12, L16)", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  assert.doesNotMatch(service, /persist_merchant_weekly_summary/);
  const store = read("src/store/useMerchantStore.ts");
  assert.match(store, /toPersistedAccount/);
  assert.match(store, /contactEmail: undefined/);
  assert.match(store, /contactPhone: undefined/);
});

test("dish saves reload one venue, lists are paged (M14, M15)", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(service, /refreshSupabaseRepositoryVenueDishes\(/);
  assert.match(
    read("src/lib/services/supabase/supabaseRepository.ts"),
    /export async function refreshSupabaseRepositoryVenueDishes/,
  );
  assert.match(read("src/app/screens/merchant/MerchantMenuScreen.tsx"), /<SectionList/);
  assert.match(read("src/app/screens/merchant/CustomerInboxScreen.tsx"), /INBOX_PAGE_SIZE/);
  assert.match(read("src/app/screens/merchant/FeaturedVisitorsScreen.tsx"), /CANDIDATE_PAGE_SIZE/);
});

test("the merchant tab prefetch no longer fires discarded requests (M13)", () => {
  const prefetch = read("src/features/navigation/prefetch.ts");
  assert.doesNotMatch(prefetch, /merchant\.get|getHungryService/);
});

test("the outlet switcher hides with one outlet (L8)", () => {
  assert.match(read("src/components/merchant/OutletSwitcher.tsx"), /outlets\.length <= 1/);
});

test("a merchant deep link opens over Home and a failed sync offers Retry (M8, M9)", () => {
  assert.match(read("src/app/navigation/linking.ts"), /createStateOverHome\("MerchantTabs"/);
  const tabs = read("src/app/navigation/MerchantTabs.tsx");
  assert.match(tabs, /syncFailed/);
  assert.match(tabs, /label="Retry"/);
});

test("opening hours use a time picker on native and ask before copying Monday (L7)", () => {
  const editor = read("src/components/merchant/OpeningHoursEditor.tsx");
  assert.match(editor, /mode="time"/);
  assert.match(editor, /Copy Monday to every day\?/);
  assert.match(editor, /tomorrowSingapore/);
});

test("claim status is readable on the stall page (M1)", () => {
  assert.match(read("src/lib/services/types.ts"), /getMerchantClaimStatus\(venueId: string\)/);
  assert.match(read("src/app/screens/detail/StallDetailScreen.tsx"), /CLAIM_STATUS_LABELS/);
  assert.match(read("src/app/screens/detail/MerchantClaimExplainerScreen.tsx"), /Find your stall/);
});

test("featured visitor pins carry no diner avatar (L19)", () => {
  assert.match(read("src/lib/services/supabase/supabaseService.ts"), /author_avatar_url: null/);
  assert.match(
    read("supabase/migrations/20261022090700_featured_visitor_pin_no_avatar_copy.sql"),
    /new\.author_avatar_url := null/,
  );
});

test("promotion counters are never written by the client (L18)", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  assert.doesNotMatch(service, /payload\.impressions|impressions: analytics\.impressions/);
});

test("the round-two merchant migrations are in range and have a smoke file", () => {
  const migrations = [
    "20261022090000_merchant_reply_length_check.sql",
    "20261022090100_merchant_outlet_business_type_lock.sql",
    "20261022090200_merchant_claim_interest_own_select.sql",
    "20261022090300_dishes_draft_member_select.sql",
    "20261022090400_merchant_accounts_no_self_insert.sql",
    "20261022090500_merchant_media_upload_requires_membership.sql",
    "20261022090600_merchant_write_rate_limits.sql",
    "20261022090700_featured_visitor_pin_no_avatar_copy.sql",
  ];
  for (const file of migrations) {
    assert.equal(existsSync(path.join(root, "supabase/migrations", file)), true, file);
  }
  const smoke = read("supabase/smoke/merchant_r2_mediums_lows.sql");
  assert.match(smoke, /^begin;/m);
  assert.match(smoke, /^rollback;/m);

  assert.match(
    read("supabase/migrations/20261022090100_merchant_outlet_business_type_lock.sql"),
    /before update of business_type on public\.merchant_outlets/,
  );
  assert.match(
    read("supabase/migrations/20261022090400_merchant_accounts_no_self_insert.sql"),
    /drop policy if exists "merchant_accounts_insert_own"/,
  );
  const upload = read(
    "supabase/migrations/20261022090500_merchant_media_upload_requires_membership.sql",
  );
  assert.match(upload, /current_user_is_merchant_member\(\)/);
  assert.match(upload, /merchant-dish-images/);
  const limits = read("supabase/migrations/20261022090600_merchant_write_rate_limits.sql");
  assert.match(limits, /create or replace function app_private\.submit_merchant_claim_interest/);
  assert.match(limits, /interval '24 hours'/);
  assert.match(limits, /promotion counters are server-managed/);
});
