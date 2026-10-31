// The Discover map's own controls and sheet, with a stubbed catalog read.
// Run with `node scripts/test-render.mjs src/app/screens/discover/HomeMapScreen.render.test.tsx`.
import assert from "node:assert/strict";
import fs from "node:fs";
import test, { afterEach, beforeEach } from "node:test";

import { HomeMapScreen } from "@/app/screens/discover/HomeMapScreen";
import { clearExperimentOverrides, setExperimentOverride } from "@/lib/experiments/experiments";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import { getCatalogRawService, getHungryService } from "@/lib/services/serviceProvider";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useLocationStore } from "@/store/useLocationStore";
import { cleanup, createFakeNavigation, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

// The services are rebuilt when a scenario starts, so they are read after enterScenario.
let catalog = getCatalogRawService();
let originals = { ...catalog };
let discovery = getHungryService().discovery;
let originalGetVenuesByIds = discovery.getVenuesByIds;

const noFilters = {
  nearMe: false,
  hawkerOnly: false,
  topRated: false,
  trendingOnly: false,
  mallOnly: false,
  openNow: false,
};

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
  catalog = getCatalogRawService();
  originals = { ...catalog };
  discovery = getHungryService().discovery;
  originalGetVenuesByIds = discovery.getVenuesByIds;
  useLocationStore.setState({
    permission: "granted",
    currentLocation: { latitude: 1.3521, longitude: 103.8198 },
  });
  catalog.getMapViewport = (async () => ({ releaseId: "r", items: [] })) as never;
  catalog.listVenues = (async () => ({ releaseId: "r", items: [card] })) as never;
});

const originalGrant = useLocationStore.getState().grantLocation;

afterEach(async () => {
  await cleanup();
  clearExperimentOverrides();
  Object.assign(catalog, originals);
  discovery.getVenuesByIds = originalGetVenuesByIds;
  useDiscoveryStore.setState({ mapFilters: noFilters });
  useLocationStore.setState({ grantLocation: originalGrant });
});

// The catalog read waits out the pan debounce (350 ms) before it starts.
const settleCatalogRead = async (view: { settle: () => Promise<void> }) => {
  await new Promise((resolve) => setTimeout(resolve, 420));
  await view.settle();
};

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

test("MD-M3 with no location the map asks for it, and the recentre button asks for the device location", async () => {
  useLocationStore.setState({ permission: "unknown", manualCoordinate: undefined });
  let asked = 0;
  useLocationStore.setState({
    grantLocation: async () => {
      asked += 1;
      return false;
    },
  });
  const navigation = createFakeNavigation();
  const view = await renderMap(navigation);
  assert.ok(view.findByTestId("location-gate"));
  assert.match(view.text(), /See places near you/);

  // The gate's own button and the floating recentre button share the label; the recentre one is last.
  const buttons = view.container.querySelectorAll<HTMLElement>('[aria-label="Use my location"]');
  assert.equal(buttons.length, 2);
  await view.press(buttons[1]);
  await view.settle();
  assert.equal(asked, 1, "the recentre button asks for the device location");
  assert.ok(
    !navigation.calls.some((call) => call.args[0] === "OnboardingStack"),
    "a refusal does not open an area search",
  );
});

test("with a location the map shows no location prompt", async () => {
  const view = await renderMap();
  assert.equal(view.findByTestId("location-gate"), null);
});

const openStall = {
  id: "venue-1",
  buildingId: "b",
  name: "Tian Tian Chicken Rice",
  unitNumber: "01-10",
  floor: "L1",
  isOpen: true,
  topDishId: "",
  operatingHours: "Daily 12am-11:59pm",
  deliveryLinks: [],
};

test("MD-M9 and M11 a card shows rating and open state, and a screen reader hears all of it", async () => {
  catalog.listVenues = (async () => ({
    releaseId: "r",
    items: [{ ...card, qualityRating: 4.6, qualityReviewCount: 23 }],
  })) as never;
  discovery.getVenuesByIds = (async () => [openStall]) as never;
  const view = await renderMap();
  await settleCatalogRead(view);
  assert.match(view.text(), /4\.6 \(23\) · Open · 120 m · Maxwell Food Centre/);
  assert.ok(
    view.findByLabel(
      "Open Tian Tian Chicken Rice. Chicken Rice · S$5.50. Rated 4.6 from 23 reviews. Open · 120 m · Maxwell Food Centre",
    ),
    "the card's label carries the dish, rating and distance",
  );
});

test("MD-M9 a failed hours read leaves the word out and the card in place", async () => {
  discovery.getVenuesByIds = (async () => {
    throw new Error("offline");
  }) as never;
  const originalConsoleError = console.error;
  console.error = () => undefined;
  try {
    const view = await renderMap();
    await settleCatalogRead(view);
    assert.match(view.text(), /120 m · Maxwell Food Centre/);
    assert.doesNotMatch(view.text(), /Closed|· Open ·/);
  } finally {
    console.error = originalConsoleError;
  }
});

test("map_card_rich_v1: the control arm shows the plain card, without rating or open state", async () => {
  setExperimentOverride("map_card_rich_v1", "control");
  catalog.listVenues = (async () => ({
    releaseId: "r",
    items: [{ ...card, qualityRating: 4.6, qualityReviewCount: 23 }],
  })) as never;
  discovery.getVenuesByIds = (async () => [openStall]) as never;
  const view = await renderMap();
  await settleCatalogRead(view);
  assert.match(view.text(), /120 m · Maxwell Food Centre/);
  assert.doesNotMatch(view.text(), /4\.6 \(23\)|· Open ·/);
});

test("map_default_sheet_v1: the list arm opens the map on the list", async () => {
  setExperimentOverride("map_default_sheet_v1", "list");
  const view = await renderMap();
  await view.settle();
  assert.match(view.text(), /Nearby stalls/);
});

test("MD-M8 a stall with no menu shows no '0 dishes' line", async () => {
  catalog.listVenues = (async () => ({
    releaseId: "r",
    items: [{ ...card, menuCount: 0, representativeDish: undefined }],
  })) as never;
  const view = await renderMap();
  await settleCatalogRead(view);
  assert.doesNotMatch(view.text(), /0 dishes/);
});

test("MD-M12 a full set of pins says to zoom in", async () => {
  const pins = Array.from({ length: 151 }, (_, index) => ({
    kind: "venue",
    id: `p${index}`,
    label: `Stall ${index}`,
    latitude: 1.28 + index * 0.0001,
    longitude: 103.84,
    buildingType: "hawker_centre",
  }));
  catalog.getMapViewport = (async () => ({ releaseId: "r", items: pins })) as never;
  const view = await renderMap();
  await settleCatalogRead(view);
  assert.match(view.text(), /Zoom in to see all places/);
});

test("MD-M10 'Loading places…' stays hidden for a quick read and appears for a slow one", async () => {
  let release: (() => void) | undefined;
  catalog.getMapViewport = (() =>
    new Promise((resolve) => {
      release = () => resolve({ releaseId: "r", items: [] });
    })) as never;
  const view = await renderMap();
  await new Promise((resolve) => setTimeout(resolve, 380));
  await view.settle();
  assert.doesNotMatch(view.text(), /Loading places/, "the read has been going for under 400 ms");
  await new Promise((resolve) => setTimeout(resolve, 450));
  await view.settle();
  assert.match(view.text(), /Loading places/);
  release?.();
  await view.settle();
  assert.doesNotMatch(view.text(), /Loading places/);
});

test("MD-M7 Top rated with nothing rated says why the map is empty", async () => {
  useDiscoveryStore.setState({ mapFilters: { ...noFilters, topRated: true } });
  catalog.listVenues = (async () => ({ releaseId: "r", items: [] })) as never;
  const view = await renderMap();
  await settleCatalogRead(view);
  assert.match(view.text(), /No places here have enough ratings yet/);
});

test("MD-A2 opening a card is counted, with its position and the sheet mode", async () => {
  clearTrackedAnalyticsEvents();
  const navigation = createFakeNavigation();
  const view = await renderMap(navigation);
  await settleCatalogRead(view);
  await view.press(view.findByLabel(/^Open Tian Tian Chicken Rice/));
  const opened = getTrackedAnalyticsEvents().filter((record) => record.event === "map_card_opened");
  assert.equal(opened.length, 1);
  assert.deepEqual(opened[0].properties, { position: 0, mode: "carousel" });
  assert.equal(navigation.calls.at(-1)?.method, "navigate");
});

test("MD-M11 the sheet handle can be moved without a drag", async () => {
  const view = await renderMap();
  const handle = view.findByLabel("Places sheet");
  assert.ok(handle, "the handle is reachable");
  assert.equal(handle.getAttribute("role"), "slider");
});

test("R5-12 Open now is the first chip and keeps only the stalls whose hours say open", async () => {
  const closedCard = { ...card, id: "venue-2", name: "Closed Kopitiam" };
  catalog.listVenues = (async () => ({ releaseId: "r", items: [card, closedCard] })) as never;
  discovery.getVenuesByIds = (async () => [
    openStall,
    { ...openStall, id: "venue-2", name: "Closed Kopitiam", isOpen: false },
  ]) as never;
  const view = await renderMap();
  await settleCatalogRead(view);
  assert.match(view.text(), /Tian Tian Chicken Rice/);
  assert.match(view.text(), /Closed Kopitiam/);
  assert.match(view.text(), /Open nowNear me|Open nowHawker/, "Open now leads the chip row");

  await view.press(view.findByLabel("Open now"));
  await view.settle();
  assert.match(view.text(), /Tian Tian Chicken Rice/);
  assert.doesNotMatch(view.text(), /Closed Kopitiam/);
});

test("R5-12 Open now says why the map is empty when nothing is open", async () => {
  discovery.getVenuesByIds = (async () => [{ ...openStall, isOpen: false }]) as never;
  useDiscoveryStore.setState({ mapFilters: { ...noFilters, openNow: true } });
  const view = await renderMap();
  await settleCatalogRead(view);
  assert.match(view.text(), /No places here are open right now/);
});

test("R5-12 a failed hours read leaves Open now showing every stall", async () => {
  discovery.getVenuesByIds = (async () => {
    throw new Error("offline");
  }) as never;
  useDiscoveryStore.setState({ mapFilters: { ...noFilters, openNow: true } });
  const originalConsoleError = console.error;
  console.error = () => undefined;
  try {
    const view = await renderMap();
    await settleCatalogRead(view);
    assert.match(view.text(), /Tian Tian Chicken Rice/);
    assert.doesNotMatch(view.text(), /No places here are open/);
  } finally {
    console.error = originalConsoleError;
  }
});

test("R5-1 a card with no photo shows the designed state, not 'Image unavailable'", async () => {
  const view = await renderMap();
  await settleCatalogRead(view);
  assert.ok(view.findByLabel("Tian Tian Chicken Rice, no photo yet"));
  assert.doesNotMatch(view.text(), /Image unavailable/);
});

test("R5-13 the card rating is a star symbol beside the number, not a text glyph", async () => {
  catalog.listVenues = (async () => ({
    releaseId: "r",
    items: [{ ...card, qualityRating: 4.6, qualityReviewCount: 23 }],
  })) as never;
  discovery.getVenuesByIds = (async () => [openStall]) as never;
  const view = await renderMap();
  await settleCatalogRead(view);
  assert.doesNotMatch(view.text(), /★/);
  assert.equal(view.container.querySelectorAll('[data-stub="lucide-react-native.Star"]').length, 1);
});

test("R5-2 the sheet is a bottom sheet with detents, not a hand-rolled PanResponder", () => {
  const src = fs.readFileSync("src/app/screens/discover/HomeMapScreen.tsx", "utf8");
  assert.match(src, /from "@gorhom\/bottom-sheet"/);
  assert.match(src, /snapPoints=\{snapPoints\}/);
  assert.match(src, /animatedPosition=\{sheetPosition\}/);
  assert.doesNotMatch(src, /Animated\.spring|Animated\.Value|useNativeDriver/);
  // No swipe-back handler: a pan to the left side of the map must never close the map.
  assert.doesNotMatch(src, /PanResponder/);
});
