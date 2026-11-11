// The Foodpanda and Grab buttons on the stall and dish pages: one button per app the stall has a
// link for, none when it has none. Run with
// `HUNGRY_DATA_SOURCE=mock node scripts/test-render.mjs src/components/dish/DeliveryPlatformButton.render.test.tsx`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { afterEach } from "node:test";

import { cleanup, render } from "@/test/render";
import type { DeliveryLink } from "@/types/domain";

import { DeliveryButtonRow } from "./DeliveryPlatformButton";

afterEach(cleanup);

const foodpanda: DeliveryLink = {
  platform: "foodpanda",
  nativeUrl: "",
  webUrl: "https://www.foodpanda.sg/restaurant/abcd/stall",
  affiliateEligible: false,
};
const grab: DeliveryLink = {
  platform: "grabfood",
  nativeUrl: "",
  webUrl: "https://food.grab.com/sg/en/restaurant/stall/4-C0000000",
  affiliateEligible: false,
};

test("a stall with both links shows a Foodpanda and a GrabFood button", async () => {
  const view = await render(<DeliveryButtonRow links={[foodpanda, grab]} venueId="v1" />);
  assert.ok(view.findByLabel("Order on Foodpanda"));
  assert.ok(view.findByLabel("Order on GrabFood"));
});

test("a stall with one link shows only that button", async () => {
  const onlyFoodpanda = await render(<DeliveryButtonRow links={[foodpanda]} venueId="v1" />);
  assert.ok(onlyFoodpanda.findByLabel("Order on Foodpanda"));
  assert.equal(onlyFoodpanda.findByLabel("Order on GrabFood"), null);
  await cleanup();

  const onlyGrab = await render(<DeliveryButtonRow links={[grab]} venueId="v1" />);
  assert.ok(onlyGrab.findByLabel("Order on GrabFood"));
  assert.equal(onlyGrab.findByLabel("Order on Foodpanda"), null);
});

test("a stall with no links shows no button", async () => {
  const view = await render(<DeliveryButtonRow links={[]} venueId="v1" />);
  assert.equal(view.findByLabel(/^Order on/), null);
});

test("the stall and dish pages only show the row when the stall has a link", () => {
  for (const file of [
    "src/app/screens/detail/StallDetailScreen.tsx",
    "src/app/screens/detail/DishDetailScreenV2.tsx",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /deliveryLinks\.length > 0/, file);
    assert.match(source, /<DeliveryButtonRow/, file);
  }
});

test("the live stall read turns a Foodpanda or Grab menu link into a delivery link", () => {
  const migration = readFileSync(
    "supabase/migrations/20261111150000_venue_detail_delivery_from_menu_links.sql",
    "utf8",
  );
  assert.match(migration, /foodpanda\\\.sg/);
  assert.match(migration, /grab\\\.com/);
  assert.match(migration, /v\.menu_url/);
  assert.match(migration, /v\.menu_source_url/);
  // Only the two apps are recognised: any other host maps to null and gets no button.
  assert.match(migration, /else null/);
});
