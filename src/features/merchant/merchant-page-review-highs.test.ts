// Page-review merchant highs H1-H10: source contracts plus mock behaviour.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { dishes } from "@/lib/services/mock/data";
import { hungryService } from "@/lib/services/mock/mockService";
import { useMerchantStore } from "@/store/useMerchantStore";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const readsMigration = read(
  "supabase/migrations/20261019220000_merchant_outlet_member_only_reads.sql",
);
const syncMigration = read(
  "supabase/migrations/20261019221000_merchant_profile_venue_sync_privacy.sql",
);

test("H1: merchant_outlets rows are team-only; anon has no table access", () => {
  assert.match(readsMigration, /drop policy if exists "merchant_outlets_anon_live_select"/);
  assert.match(readsMigration, /drop policy if exists "merchant_outlets_authenticated_select"/);
  const memberPolicy = readsMigration.slice(
    readsMigration.indexOf('create policy "merchant_outlets_member_select"'),
    readsMigration.indexOf("revoke all on table public.merchant_outlets from anon"),
  );
  assert.match(memberPolicy, /for select to authenticated/);
  assert.doesNotMatch(memberPolicy, /is_live/);
  assert.match(readsMigration, /revoke all on table public\.merchant_outlets from anon;/);
  // Diner promotion reads no longer need outlet row access.
  assert.match(readsMigration, /app_private\.merchant_outlet_is_live\(outlet_id\)/);
  assert.match(
    readsMigration,
    /function public\.list_customer_active_promotions[\s\S]*?security invoker[\s\S]*?app_private\.list_customer_active_promotions/,
  );
  assert.doesNotMatch(
    readsMigration,
    /create or replace function public\.[a-z_]+\([^)]*\)[\s\S]{0,400}?security definer/,
    "public functions stay SECURITY INVOKER",
  );
});

test("H2: dish options use a Dialog (all buttons on Android) and the editor can delete", () => {
  const menu = read("src/app/screens/merchant/MerchantMenuScreen.tsx");
  assert.doesNotMatch(menu, /Alert\.alert\("Dish Options"/);
  assert.match(menu, /<Dialog[\s\S]*buttons=\{dishDialogButtons\}/);
  assert.match(menu, /text: "Delete Dish"/);
  const editor = read("src/app/screens/merchant/DishEditorScreen.tsx");
  assert.match(editor, /merchant\.deleteDish\(activeOutlet\.id, dishId\)/);
  assert.match(editor, /label="Delete Dish"/);
});

test("H4/H5: editors open fresh and Back follows history in the merchant tabs", () => {
  const tabs = read("src/app/navigation/MerchantTabs.tsx");
  assert.match(tabs, /backBehavior="history"/);
  for (const name of ["DishEditor", "PromotionBuilder"]) {
    assert.match(
      tabs,
      new RegExp(`name="${name}"[\\s\\S]*?layout=\\{renderFreshEditorLayout\\}`),
      `${name} remounts on each open`,
    );
  }
  assert.match(tabs, /navigation\.addListener\("blur"/);
  assert.match(tabs, /key=\{`\$\{openCount\}:\$\{JSON\.stringify\(route\.params \?\? null\)\}`\}/);
});

test("H3/H7: verified profile edits sync name, hours, unit and floor with home-based privacy", () => {
  const body = syncMigration.slice(
    syncMigration.indexOf("create or replace function app_private.sync_merchant_outlet_to_venue"),
    syncMigration.indexOf("revoke all on function app_private.sync_merchant_outlet_to_venue"),
  );
  assert.match(body, /security definer/);
  assert.match(body, /not public\.merchant_outlet_is_verified\(new\.id\)/);
  for (const column of ["name", "operating_hours", "unit_number", "floor"]) {
    assert.match(body, new RegExp(`\\n    ${column} = case`), column);
  }
  assert.match(body, /when v_home_based then ''/);
  assert.match(body, /latitude = case when v_home_based then null/);
  assert.match(body, /address = case when v_hidden then null/);
  assert.match(syncMigration, /drop function if exists public\.sync_merchant_outlet_to_venue\(\);/);
  assert.match(
    syncMigration,
    /new\.location_privacy = 'exact' then\s+new\.location_privacy := 'approximate'/,
  );
  assert.match(syncMigration, /or new\.unit_number is distinct from old\.unit_number/);

  const service = read("src/lib/services/supabase/supabaseService.ts");
  const update = service.slice(
    service.indexOf("async updateBusinessProfile(outletId, updates) {"),
    service.indexOf("async getMenu(outletId) {"),
  );
  assert.doesNotMatch(update, /from\("venues"\)/, "the app never writes venues directly");
  const webRoute = read("marketing/website/web-v2/src/app/api/merchant/profile/route.ts");
  assert.doesNotMatch(webRoute, /rest\/v1\/venues/);
});

test("H6/H7: privacy is a home-based choice without Exact, and HBB marks the outlet", () => {
  const editor = read("src/app/screens/merchant/BusinessProfileEditorScreen.tsx");
  assert.doesNotMatch(editor, /Exact Location Privacy/);
  assert.doesNotMatch(editor, /onChange\(val \? "exact" : "hidden"\)/);
  assert.match(editor, /businessType === "home_based" \? \(/);
  assert.match(editor, /\{ id: "approximate", label: "Approximate area" \}/);
  const hbb = read("src/app/screens/merchant/HomeBasedVerificationScreen.tsx");
  assert.match(hbb, /businessType: "home_based",/);
  assert.doesNotMatch(hbb, /title="Exact Address"/);
});

test("H7: mock home-based outlets never show unit or floor to diners", async () => {
  const outletId = "outlet-wonton-mee";
  const venueId = `mock-venue-${outletId}`;
  const outlet = await hungryService.merchant.updateBusinessProfile(outletId, {
    businessType: "home_based",
  });
  try {
    assert.equal(outlet.locationPrivacy, "approximate");
    const venue = await hungryService.discovery.getVenue(venueId);
    assert.equal(venue?.unitNumber, "");
    assert.equal(venue?.floor, "");
  } finally {
    await hungryService.merchant.updateBusinessProfile(outletId, {
      businessType: "hawker_stall",
      locationPrivacy: "exact",
    });
  }
  assert.equal((await hungryService.discovery.getVenue(venueId))?.unitNumber, "#01-12");
});

test("H8: profile editor no longer collects fields that are never stored", () => {
  const editor = read("src/app/screens/merchant/BusinessProfileEditorScreen.tsx");
  assert.doesNotMatch(editor, /dietaryLabels|tasteTags/);
  const service = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(
    service,
    /galleryUrls: \[asString\(row\.profile_photo_url\), asString\(row\.cover_photo_url\)\]/,
  );
});

test("H9: scheduled promotions are diner-visible once their window opens", () => {
  const rpc = readsMigration.slice(
    readsMigration.indexOf(
      "create or replace function app_private.list_customer_active_promotions",
    ),
    readsMigration.indexOf("revoke all on function app_private.list_customer_active_promotions"),
  );
  assert.match(rpc, /mp\.status in \('active', 'scheduled'\)/);
  assert.match(rpc, /now\(\) >= mp\.start_date/);
  assert.match(
    readsMigration,
    /status in \('active', 'scheduled'\)\s+and coalesce\(is_available, true\)/,
  );
});

test("H10: promotions warn when the stall is hidden and offer Show on Hungry", async () => {
  const list = read("src/app/screens/merchant/PromotionListScreen.tsx");
  assert.match(list, /activeOutlet && !activeOutlet\.isLive \?/);
  assert.match(list, /Not visible to diners/);
  assert.match(list, /updateBusinessProfile\(activeOutlet\.id, \{\s+isLive: true,/);
  const builder = read("src/app/screens/merchant/PromotionBuilderScreen.tsx");
  assert.match(builder, /if \(publish && !activeOutlet\.isLive\)/);
  assert.match(builder, /text: "Show on Hungry"/);

  // Mock matches the RPC: a hidden outlet's promotions are not diner-visible.
  const dish = dishes.find((item) => item.id === "dish-chicken-rice");
  assert.ok(dish);
  const target = { venueId: dish.venueId, dishId: dish.id };
  assert.ok((await hungryService.discovery.listActivePromotionsForTarget(target)).length > 0);
  await hungryService.merchant.updateBusinessProfile("outlet-wonton-mee", { isLive: false });
  try {
    assert.deepEqual(await hungryService.discovery.listActivePromotionsForTarget(target), []);
  } finally {
    await hungryService.merchant.updateBusinessProfile("outlet-wonton-mee", { isLive: true });
  }
  assert.equal(typeof useMerchantStore.getState().updateOutletProfile, "function");
});
