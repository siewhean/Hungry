import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { MERCHANT_DEEP_LINKS, MERCHANT_LINK_SCREENS } from "./merchantDeepLinks";
import {
  UNVERIFIED_ALLOWED_SCREENS,
  VERIFIED_ONLY_SCREENS,
  canEditProfile,
} from "./merchantGuards";
import {
  formatPeakHour,
  getMerchantOutletStatusLabel,
  getMerchantProfileGaps,
  getPromotionPricing,
} from "./merchantReadiness";
import type { MerchantOutlet } from "@/types/domain";

function read(file: string): string {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

const MIGRATIONS = "supabase/migrations";

test("peak hours read as Singapore clock hours, with midnight as 12 AM", () => {
  assert.equal(formatPeakHour(0), "12 AM");
  assert.equal(formatPeakHour(9), "9 AM");
  assert.equal(formatPeakHour(12), "12 PM");
  assert.equal(formatPeakHour(15), "3 PM");
  assert.equal(formatPeakHour(23), "11 PM");

  const migration = read(`${MIGRATIONS}/20261020060000_merchant_analytics_sgt_peak_hours.sql`);
  assert.match(migration, /extract\(hour from occurred_at at time zone 'Asia\/Singapore'\)/);
  assert.match(read("src/app/screens/merchant/MerchantAnalyticsScreen.tsx"), /formatPeakHour\(/);
});

test("a live outlet without readable hours is labelled live on Hungry, not open", () => {
  assert.equal(getMerchantOutletStatusLabel("live"), "Live on Hungry");
  assert.equal(getMerchantOutletStatusLabel("open"), "Open now");
});

test("a floor alone does not count as a set location", () => {
  const outlet = {
    name: "Stall",
    businessType: "hawker_stall",
    description: "d",
    profilePhotoUrl: "p",
    coverPhotoUrl: "c",
    floor: "2",
    contactPhone: "8888",
    operatingHours: "Daily",
    socialLinks: [],
  } as unknown as MerchantOutlet;
  const gaps = getMerchantProfileGaps(outlet, { menuCount: 1, dishesWithoutImages: 0 });
  assert.ok(gaps.some((gap) => gap.id === "location"));
});

test("an empty promotion price yields no label, and diner and merchant cards hide it", () => {
  assert.equal(getPromotionPricing({}).label, "");
  assert.equal(getPromotionPricing({ originalPrice: 6, finalPrice: 5 }).label, "S$6.00 → S$5.00");
  assert.match(
    read("src/components/promotion/CustomerPromotionCard.tsx"),
    /\) : pricing\.label \? \(/,
  );
  assert.match(read("src/app/screens/merchant/PromotionListScreen.tsx"), /\{pricing\.label \? \(/);
});

test("merchant notification links resolve to Merchant Centre screens", () => {
  for (const link of Object.values(MERCHANT_DEEP_LINKS)) {
    const segment = link.replace("hungry://merchant/", "");
    assert.ok(MERCHANT_LINK_SCREENS[segment], `${link} has no Merchant Centre screen`);
  }
  assert.match(read("src/app/navigation/linking.ts"), /CustomerInbox: "inbox"/);
  const migration = read(`${MIGRATIONS}/20261020060400_merchant_notification_deep_links.sql`);
  assert.match(migration, /'hungry:\/\/merchant\/inbox'/);
  assert.doesNotMatch(read("src/lib/services/supabase/supabaseService.ts"), /"MerchantTabs\//);
});

test("unverified merchants can prepare their profile and always reach an exit", () => {
  for (const route of ["Profile", "BusinessProfileEditor", "MerchantSettings"]) {
    assert.ok((UNVERIFIED_ALLOWED_SCREENS as readonly string[]).includes(route));
    assert.ok(!(VERIFIED_ONLY_SCREENS as readonly string[]).includes(route));
  }
  assert.equal(canEditProfile("unverified"), true);
  // Outlet edits only reach the diner venue once the outlet is verified.
  assert.match(
    read(`${MIGRATIONS}/20261019221000_merchant_profile_venue_sync_privacy.sql`),
    /not public\.merchant_outlet_is_verified\(new\.id\)/,
  );

  const tabs = read("src/app/navigation/MerchantTabs.tsx");
  assert.match(tabs, /function useMerchantAccessLevel\(\)/);
  assert.match(tabs, /function MerchantSignInGate\(/);
  assert.equal(tabs.match(/label="Sign In as Mock Merchant"/g)?.length, 1);
  const gate = tabs.slice(tabs.indexOf("function MerchantAccessGate("));
  assert.match(gate, /const access = useMerchantAccessLevel\(\);/);
  assert.match(gate, /label="Switch to Customer Mode"/);
  assert.match(gate, /label="Sign Out"/);
});

test("merchant dish writes are atomic, idempotent and rebuild the catalog once", () => {
  const writes = read(`${MIGRATIONS}/20261020060200_merchant_dish_atomic_writes.sql`);
  assert.match(writes, /function public\.merchant_save_dish\(/);
  assert.match(writes, /function public\.merchant_set_dish_availability_flag\(/);
  assert.match(writes, /on conflict \(id\) do nothing/);
  assert.doesNotMatch(writes, /security definer/i);
  assert.match(
    writes,
    /revoke all on function public\.merchant_save_dish\([^)]*\)\s+from public, anon;/,
  );

  const refresh = read(`${MIGRATIONS}/20261020060300_catalog_refresh_once_per_transaction.sql`);
  assert.match(refresh, /app_private\.catalog_raw_refresh_venue_deferred\(\)/);
  assert.match(refresh, /deferrable initially deferred/);
  assert.match(refresh, /set search_path = ''/);

  const editor = read("src/app/screens/merchant/DishEditorScreen.tsx");
  assert.match(editor, /useState\(createMerchantDishId\)/);
  assert.match(editor, /id: newDishId/);
  assert.doesNotMatch(editor, /TASTE_DIMENSIONS|tasteVector/);
  assert.match(editor, /tasteTags: parseCommaSeparated\(tags\)/);
  assert.match(editor, /<Skeleton/);
});

test("dashboard counts come from one summary RPC and reviews are indexed by venue", () => {
  const summary = read(`${MIGRATIONS}/20261020060500_merchant_dashboard_summary.sql`);
  assert.match(summary, /function public\.get_merchant_dashboard_summary\(p_outlet_id uuid\)/);
  assert.match(summary, /security invoker/);
  const index = read(`${MIGRATIONS}/20261020060100_reviews_venue_created_index.sql`);
  assert.match(index, /on public\.reviews \(venue_id, created_at desc/);

  const dashboard = read("src/app/screens/merchant/MerchantDashboardScreen.tsx");
  assert.match(dashboard, /merchant\.getDashboardSummary\(/);
  assert.doesNotMatch(
    dashboard,
    /merchant\.getMenu\(|merchant\.getInbox\(|syncLowRatingNotifications/,
  );
  assert.match(
    read("src/features/navigation/prefetch.ts"),
    /merchant\.getAnalytics\(outletId, "today"\)/,
  );
});

test("sold-out is an inline optimistic switch with rollback and a bulk reset", () => {
  const menu = read("src/app/screens/merchant/MerchantMenuScreen.tsx");
  assert.match(menu, /<Switch/);
  assert.match(menu, /accessibilityLabel=\{`\$\{dish\.name\} available`\}/);
  assert.match(menu, /toggleSoldOut\(activeOutlet\.id, dish\.id, nextSoldOut\)/);
  assert.match(menu, /withSoldOut\(d, !nextSoldOut\)/);
  assert.match(menu, /Mark all available/);
});

test("editors guard unsaved changes and the profile form seeds once per outlet", () => {
  for (const file of [
    "src/app/screens/merchant/DishEditorScreen.tsx",
    "src/app/screens/merchant/BusinessProfileEditorScreen.tsx",
    "src/app/screens/merchant/PromotionBuilderScreen.tsx",
  ]) {
    const source = read(file);
    assert.match(source, /useUnsavedChangesGuard\(/, file);
    assert.match(source, /onBackPress=\{confirmLeave\}/, file);
  }
  const profile = read("src/app/screens/merchant/BusinessProfileEditorScreen.tsx");
  assert.match(profile, /seededOutletId\.current === activeOutlet\.id && isDirty/);
  assert.doesNotMatch(profile, /setValue\("name"/);
});

test("promotion builder derives the discount and offers end, delete and duplicate", () => {
  const builder = read("src/app/screens/merchant/PromotionBuilderScreen.tsx");
  assert.match(builder, /<PromotionDateField/);
  assert.match(builder, /<CustomerPromotionCard/);
  assert.match(builder, /computeDiscount\(originalPrice, promotionalPrice\)/);
  assert.match(builder, /updatePromotion\(promotionId, \{ status: "ended" \}\)/);
  assert.match(builder, /merchant\.deletePromotion\(promotionId\)/);
  assert.match(builder, /duplicateFromId: promotionId/);
  assert.match(
    read("src/lib/services/types.ts"),
    /deletePromotion\(promoId: string\): Promise<void>;/,
  );
});

test("merchant actions are instrumented with the outlet id only", () => {
  const tracking = read("src/features/merchant/merchantTracking.ts");
  assert.match(tracking, /outlet_id: outletId/);
  for (const [file, event] of [
    ["src/app/screens/merchant/MerchantMenuScreen.tsx", "merchant_dish_sold_out_toggled"],
    ["src/app/screens/merchant/DishEditorScreen.tsx", "merchant_dish_created"],
    ["src/app/screens/merchant/PromotionBuilderScreen.tsx", "merchant_promotion_published"],
    ["src/app/screens/merchant/VerificationCentreScreen.tsx", "merchant_verification_submitted"],
    ["src/app/screens/merchant/CustomerInboxScreen.tsx", "merchant_customer_reply_sent"],
    ["src/app/screens/merchant/BusinessProfileEditorScreen.tsx", "merchant_profile_updated"],
  ]) {
    assert.match(read(file), new RegExp(`trackMerchantEvent\\(\\s*"${event}"`), file);
  }
});
