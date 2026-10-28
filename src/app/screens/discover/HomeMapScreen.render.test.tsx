// The Discover map's own controls and sheet, with a stubbed catalog read.
// Run with `node scripts/test-render.mjs src/app/screens/discover/HomeMapScreen.render.test.tsx`.
import assert from "node:assert/strict";
import fs from "node:fs";
import test, { afterEach, beforeEach } from "node:test";

import { HomeMapScreen } from "@/app/screens/discover/HomeMapScreen";
import { getCatalogRawService } from "@/lib/services/serviceProvider";
import { useLocationStore } from "@/store/useLocationStore";
import { cleanup, createFakeNavigation, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

const catalog = getCatalogRawService();
const originals = { getMapViewport: catalog.getMapViewport, listVenues: catalog.listVenues };

const card = {
  id: "venue-1",
  buildingId: "b",
  name: "Tian Tian Chicken Rice",
  buildingName: "Maxwell Food Centre",
  distanceMeters: 120,
  menuCount: 4,
  representativeDish: { id: "d", name: "Chicken Rice", price: 5.5, verificationStatus: "verified" },
  verificationStatus: "verified",
  menuRightsStatus: "licensed",
  mediaRightsStatus: "licensed",
};

beforeEach(async () => {
  await enterScenario("user");
  useLocationStore.setState({
    permission: "granted",
    currentLocation: { latitude: 1.3521, longitude: 103.8198 },
  });
  catalog.getMapViewport = (async () => ({ releaseId: "r", items: [] })) as never;
  catalog.listVenues = (async () => ({ releaseId: "r", items: [card] })) as never;
});

afterEach(async () => {
  await cleanup();
  Object.assign(catalog, originals);
});

const renderMap = (navigation = createFakeNavigation()) =>
  renderScreen(HomeMapScreen as never, { name: "HomeMap", navigation });

test("MD-M5 the map has a back button that returns to Discover", async () => {
  const navigation = createFakeNavigation();
  const view = await renderMap(navigation);
  await view.press(view.findByLabel("Go back"));
  assert.equal(navigation.calls.at(-1)?.method, "popTo");
});

test("MD-M4 one Cards / List switch drives the sheet; the legend has its own icon and label", async () => {
  const view = await renderMap();
  await view.settle();
  assert.match(view.text(), /Cards/);
  await view.press(view.findByLabel("Show list in the sheet"));
  assert.match(view.text(), /Nearby stalls/);
  await view.press(view.findByLabel("Show cards in the sheet"));
  assert.doesNotMatch(view.text(), /Nearby stalls/);
});

test("MD-M2 opening the legend leaves the List/Map and recentre buttons on screen", async () => {
  const view = await renderMap();
  await view.press(view.findByLabel("Show map legend"));
  assert.ok(view.findByTestId("map-legend"), view.html().slice(0, 200));
  assert.match(view.text(), /Hawker centre/);
  assert.ok(view.findByLabel("List view"));
  assert.ok(view.findByLabel("Recenter map on your location"));
  // The legend is its own row, not a sibling of the buttons in one space-between row.
  const legend = view.findByTestId("map-legend")!;
  const buttonsRow = view.findByLabel("List view")!.closest("[role='tablist']")!.parentElement!;
  assert.ok(!buttonsRow.contains(legend), "the legend does not share the buttons' row");
});

test("MD-M1 the carousel sheet is tall enough for a whole card", () => {
  const src = fs.readFileSync("src/app/screens/discover/HomeMapScreen.tsx", "utf8");
  const num = (name: string) => Number(new RegExp(`const ${name} = (\\d+)`).exec(src)?.[1]);
  // Name line 20, two detail lines 16, 4 between them, 12 padding above and below.
  assert.match(src, /const CARD_TEXT_HEIGHT = 12 \* 2 \+ 20 \+ 16 \* 2 \+ 4 \* 2;/);
  assert.match(
    src,
    /CAROUSEL_CONTENT_HEIGHT =\s*SHEET_CARD_TOP_PADDING \+ CARD_IMAGE_HEIGHT \+ CARD_TEXT_HEIGHT \+ CARD_BORDER_ALLOWANCE/,
  );
  assert.match(src, /CAROUSEL_BASE_HEIGHT = SHEET_HEADER_HEIGHT \+ CAROUSEL_CONTENT_HEIGHT/);
  assert.match(src, /height: CAROUSEL_CONTENT_HEIGHT \+ insets\.bottom/);
  assert.ok(num("CARD_IMAGE_HEIGHT") === 120 && num("SHEET_HEADER_HEIGHT") === 40);
});
