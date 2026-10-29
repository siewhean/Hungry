// The Home that Supabase builds ship: DiscoverEntryScreen renders the redesigned DiscoverHomeScreen
// on the live discovery feed, and the offline catalog Home only when that read fails. The real
// supabaseService runs against a fake supabase-js client, so the feed rows below are in the shape
// get_discovery_feed_by_location returns. Run with `node scripts/test-render.mjs <file>`.
import assert from "node:assert/strict";
import test, { afterEach, before, beforeEach } from "node:test";
import { createElement } from "react";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake } = installFakeSupabase();

type Imports = {
  DiscoverEntryScreen: typeof import("./DiscoverEntryScreen").DiscoverEntryScreen;
  QuickBitesScreen: typeof import("./QuickBitesScreen").QuickBitesScreen;
  FEATURE_FLAGS: typeof import("@/constants/featureFlags").FEATURE_FLAGS;
  analytics: typeof import("@/lib/analytics");
  experiments: typeof import("@/lib/experiments/experiments");
  provider: typeof import("@/lib/services/serviceProvider");
  useLifecycleStore: typeof import("@/store/useLifecycleStore").useLifecycleStore;
  useLocationStore: typeof import("@/store/useLocationStore").useLocationStore;
  useProfileStore: typeof import("@/store/useProfileStore").useProfileStore;
  renderKit: typeof import("@/test/render");
  sessions: typeof import("@/test/render/sessions");
};
let m: Imports;

before(async () => {
  m = {
    DiscoverEntryScreen: (await import("./DiscoverEntryScreen")).DiscoverEntryScreen,
    QuickBitesScreen: (await import("./QuickBitesScreen")).QuickBitesScreen,
    FEATURE_FLAGS: (await import("@/constants/featureFlags")).FEATURE_FLAGS,
    analytics: await import("@/lib/analytics"),
    experiments: await import("@/lib/experiments/experiments"),
    provider: await import("@/lib/services/serviceProvider"),
    useLifecycleStore: (await import("@/store/useLifecycleStore")).useLifecycleStore,
    useLocationStore: (await import("@/store/useLocationStore")).useLocationStore,
    useProfileStore: (await import("@/store/useProfileStore")).useProfileStore,
    renderKit: await import("@/test/render"),
    sessions: await import("@/test/render/sessions"),
  };
});

/** The built-in Maxwell point the store uses before any fix or pick. */
const DEFAULT_LOCATION = { latitude: 1.2813, longitude: 103.8458 };
const HALAL_FLAG_ID = "flag-halal";

/** One get_discovery_feed_by_location row (20261022040100 columns). */
function feedRow(index: number, overrides: Record<string, unknown> = {}) {
  return {
    venue_id: `venue-${index}`,
    venue_name: `Stall ${index}`,
    venue_logo_url: null,
    building_id: "building-1",
    building_name: "Maxwell Food Centre",
    planning_area: "Downtown Core",
    is_open: true,
    operating_hours: "Mon-Sun 10:00-20:00",
    distance_meters: 120 * index,
    top_dish_id: `dish-${index}`,
    top_dish_name: `Dish ${index}`,
    top_dish_image: `https://cdn.example.sg/dish-${index}.jpg`,
    top_dish_rating: 4.5,
    top_dish_review_count: 10 + index,
    top_dish_price: 5 + index,
    cuisine_tags: ["chinese"],
    rank_score: 10 - index,
    ...overrides,
  };
}

const FEED_ROWS = [
  feedRow(1, { venue_name: "Hajjah Mariam", top_dish_name: "Nasi Padang" }),
  feedRow(2, { venue_name: "Tian Tian", top_dish_name: "Chicken Rice" }),
  feedRow(3, { venue_name: "Zhen Zhen", top_dish_name: "Fish Porridge" }),
  feedRow(4, { venue_name: "Lao Ban", top_dish_name: "Beancurd" }),
];

function serveLiveFeed(rows: Record<string, unknown>[] = FEED_ROWS) {
  fake.rpc.get_discovery_feed_by_location = () => ({ data: rows, error: null });
  fake.rpc.count_venues_in_area = () => ({ data: rows.length, error: null });
  fake.rpc.get_item_details = (args) => ({
    data: ((args.p_dish_ids as string[]) ?? []).map((id) => ({
      dish_id: id,
      stall_id: null,
      name: "Laksa special",
      stall_name: "Somewhere",
      price: 6,
      image_url: null,
    })),
    error: null,
  });
  // Only "Hajjah Mariam"'s Nasi Padang is halal (the feed itself no longer returns flags).
  fake.tables.dish_dietary_flags = () => ({
    data: [{ dish_id: "dish-1", dietary_flag_id: HALAL_FLAG_ID }],
    error: null,
  });
  fake.tables.dietary_flags = () => ({
    data: [{ id: HALAL_FLAG_ID, slug: "halal" }],
    error: null,
  });
}

/** Tables the synchronous repository downloads in full when anything reads it. */
const FULL_TABLE_READS = ["buildings", "venues", "dishes", "dish_images", "stall_posts"];
function fullTableReads() {
  return fake.queries
    .map((query) => query.table)
    .filter((table) => FULL_TABLE_READS.includes(table));
}

function setLocation(state: Record<string, unknown> = {}) {
  m.useLocationStore.setState({
    permission: "denied",
    currentLocation: DEFAULT_LOCATION,
    manualCoordinate: undefined,
    manualLocation: undefined,
    manualPlaceName: undefined,
    ...state,
  });
}

function fakeFlags(flags: Record<string, string>) {
  const state = { exposures: [] as string[] };
  m.experiments.setExperimentFlagSource({
    peek: (key) => flags[key],
    expose: (key) => {
      state.exposures.push(key);
      return flags[key];
    },
    hasLoaded: () => true,
    onChange: () => () => undefined,
  });
  return state;
}

/** Swaps the catalog read service's page reads (the offline Home reads only these). */
function stubCatalog(releaseId: string) {
  const service = m.provider.getCatalogRawService() as unknown as Record<string, unknown>;
  const state = { calls: 0 };
  const card = {
    id: "dish-9",
    venueId: "venue-9",
    name: "Mee Rebus",
    venueName: "Offline Stall",
    buildingName: "Tekka Centre",
    price: 4,
    cuisineTags: [],
    dietaryFlags: [],
    sectionTags: [],
    verificationStatus: "approved",
  };
  service.listDishes = async () => {
    state.calls += 1;
    return { items: [card], releaseId, totals: { dishes: 1, venues: 1 } };
  };
  service.listVenues = async () => ({
    items: [{ id: "venue-9", name: "Offline Stall", menuCount: 1, buildingName: "Tekka Centre" }],
    releaseId,
    totals: { dishes: 1, venues: 1 },
  });
  service.clearCache = () => undefined;
  return state;
}

beforeEach(async () => {
  await m.sessions.enterScenario("user");
  m.provider.setSupabaseServiceProvider();
  fake.rpcCalls.length = 0;
  fake.queries.length = 0;
  fake.rpc = {};
  fake.tables = {};
  m.analytics.clearTrackedAnalyticsEvents();
  setLocation();
  m.useProfileStore.setState((state) => ({
    profile: {
      ...state.profile,
      dietaryPreferences: [],
      favouriteDishIds: ["dish-saved"],
      reviewedDishIds: [],
    },
  }));
  m.useLifecycleStore.setState({
    snapshot: null,
    welcomeBackDismissed: false,
    welcomeBackShown: false,
  });
});

afterEach(async () => {
  await m.renderKit.cleanup();
  // Let background work a test started (taste feedback after a tap) finish before the next
  // test resets the recorded calls.
  await m.renderKit.settle();
  (m.FEATURE_FLAGS as { release01CoreOnly: boolean }).release01CoreOnly = false;
  m.experiments.setExperimentFlagSource(undefined);
  m.experiments.resetExperimentSession();
  m.provider.setMockServiceProvider();
});

test("Supabase builds show the redesigned Home from the live feed, with no full-table reads", async () => {
  serveLiveFeed();
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));

  assert.match(view.text(), /You are at/);
  assert.match(view.text(), /Hawker classics/);
  assert.match(view.text(), /Dishes near you/);
  assert.match(view.text(), /Hajjah Mariam/);
  assert.match(view.text(), /Chicken Rice/);
  assert.equal(view.findByTestId("catalog-discover-root"), null, "not the offline Home");

  const feedCalls = fake.callsTo("get_discovery_feed_by_location");
  assert.equal(feedCalls.length, 1, "one feed read");
  assert.equal(feedCalls[0]!.args.p_limit, 100);
  assert.deepEqual(fullTableReads(), [], "Home never asks the synchronous repository (HOME-X5)");
  // Saved-dish names for the Hawker classics order: one batched read, not one per dish.
  assert.equal(fake.callsTo("get_item_details").length, 1);
  assert.deepEqual(fake.callsTo("get_item_details")[0]!.args.p_dish_ids, ["dish-saved"]);
  // "More from {area}" has no pool on one feed page, so it is not shown (HOME-X6).
  assert.doesNotMatch(view.text(), /More (in|near)/);
});

test("dish cards open the redesigned dish page and stall rows the stall page, with events", async () => {
  serveLiveFeed();
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));

  await view.press(view.findByLabel("Dish near you: Chicken Rice at Tian Tian"));
  assert.deepEqual(view.navigation.calls.at(-1)?.args, [
    "DishDetail",
    { dishId: "dish-2", source: "home" },
  ]);

  await view.press(view.findByLabel("Open Zhen Zhen details"));
  assert.deepEqual(view.navigation.calls.at(-1)?.args, ["StallDetail", { venueId: "venue-3" }]);

  await view.press(view.findByLabel("Search dishes, stalls, or hawker centres"));
  assert.deepEqual(view.navigation.calls.at(-1)?.args, ["SearchHome"]);

  const events = m.analytics.getTrackedAnalyticsEvents();
  const opened = events.filter((event) => event.event === "discover_card_opened");
  assert.deepEqual(
    opened.map((event) => [event.properties?.rail, event.properties?.kind]),
    [
      ["quickBites", "dish"],
      ["area_stalls", "stall"],
    ],
  );
  assert.ok(opened.every((event) => event.properties?.surface === "home"));
  assert.ok(
    events.some(
      (event) =>
        event.event === "discover_rail_impression" &&
        event.properties?.surface === "home" &&
        event.properties?.rail === "quickBites",
    ),
  );
  assert.ok(events.some((event) => event.event === "discover_search_opened"));
});

test("a halal diner's Home shows only halal dishes, also when the profile arrives late", async () => {
  serveLiveFeed();
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  assert.match(view.text(), /Chicken Rice/);

  // Sign-in on a new device: dietary needs land after Home mounted.
  m.useProfileStore.setState((state) => ({
    profile: { ...state.profile, dietaryPreferences: ["halal"] },
  }));
  await view.settle();
  assert.match(view.text(), /Nasi Padang/, "the halal dish (flag read in one batch) stays");
  assert.doesNotMatch(view.text(), /Chicken Rice/, "dishes without the halal flag are hidden");
  // One batched flags read for the feed page's top dishes (`in("dish_id", ids)`).
  const batchedFlagReads = fake
    .queriesOn("dish_dietary_flags")
    .filter((query) => query.ops.some(([op]) => op === "in"));
  assert.equal(batchedFlagReads.length, 1);
});

test("without a GPS fix or a pick the header says Singapore, offers to turn location on and hides made-up distances", async () => {
  serveLiveFeed();
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  assert.match(view.text(), /You are atSingapore/);
  assert.match(view.text(), /Location is off, so these are picks across Singapore\./);
  assert.ok(view.findByLabel("Turn on location"));
  assert.equal(view.findByLabel(/choose your area/i), null, "there is no area picker");
  // Stall rows name the building the stall is in, not its planning area.
  assert.match(view.text(), /Maxwell Food Centre/);
  assert.doesNotMatch(view.text(), /Downtown Core/);
  assert.doesNotMatch(view.text(), /\d+ ?m away|\d\.\d ?km/);
  await m.renderKit.cleanup();

  setLocation({
    manualLocation: "Tanjong Pagar",
    manualCoordinate: { latitude: 1.2764, longitude: 103.8458 },
  });
  const picked = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  assert.doesNotMatch(picked.text(), /Location is off/);
  assert.ok(picked.findByLabel("Use current location"));
});

test("a failed live feed hands Home to the offline catalog, and Retry tries the live Home again", async () => {
  fake.rpc.get_discovery_feed_by_location = () => ({
    data: null,
    error: { message: "network request failed" },
  });
  const catalog = stubCatalog("excel-fallback-v1");
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));

  assert.ok(view.findByTestId("catalog-source-excel"), "the offline copy is on screen");
  assert.match(view.text(), /Offline catalog/);
  assert.match(view.text(), /Mee Rebus/);
  assert.equal(catalog.calls, 1);

  await view.press(view.findByLabel(/^Mee Rebus, Offline Stall/));
  assert.deepEqual(view.navigation.calls.at(-1)?.args, [
    "CatalogRawDetail",
    { kind: "dish", id: "dish-9", releaseId: "excel-fallback-v1" },
  ]);

  serveLiveFeed();
  const feedReads = fake.callsTo("get_discovery_feed_by_location").length;
  // The empty state's Retry is not shown (there is content); pull-to-refresh is the gesture.
  const node = view.findByTestId("catalog-discover-screen") as unknown as Record<string, unknown>;
  const fiberKey = Object.keys(node).find((key) => key.startsWith("__reactFiber$"))!;
  let fiber = node[fiberKey] as { memoizedProps?: Record<string, unknown>; return?: unknown };
  while (fiber && !fiber.memoizedProps?.refreshControl) fiber = fiber.return as typeof fiber;
  const control = fiber.memoizedProps!.refreshControl as { props: { onRefresh(): void } };
  const { act } = await import("react");
  await act(async () => control.props.onRefresh());
  await view.settle();
  assert.equal(fake.callsTo("get_discovery_feed_by_location").length, feedReads + 1);
  assert.match(view.text(), /Hawker classics/, "back on the live Home");
  assert.equal(view.findByTestId("catalog-discover-root"), null);
});

test("welcome_back_v2 on the live Home: shown to the test arm once content is on screen", async () => {
  const exposures = fakeFlags({ welcome_back_v2: "test" });
  m.useLifecycleStore.setState({
    snapshot: {
      state: "resurrected",
      daysSincePrevious: 21,
      previousActiveDate: "2026-10-01",
    } as never,
  });
  fake.rpc.get_welcome_back_dishes = () => ({ data: [], error: null });

  // While the feed is still loading nothing is exposed.
  let releaseFeed: () => void = () => undefined;
  fake.rpc.get_discovery_feed_by_location = () =>
    new Promise((resolve) => {
      releaseFeed = () => resolve({ data: FEED_ROWS, error: null });
    });
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  assert.doesNotMatch(view.text(), /Welcome back/);
  assert.deepEqual(exposures.exposures, [], "no exposure behind the skeleton");

  releaseFeed();
  await view.settle();
  assert.match(view.text(), /Welcome back/);
  assert.deepEqual(exposures.exposures, ["welcome_back_v2"]);
});

test("welcome_back_v2 on the live Home: an unfocused Home (tab warm-up) exposes no one", async () => {
  const exposures = fakeFlags({ welcome_back_v2: "test" });
  m.useLifecycleStore.setState({
    snapshot: { state: "resurrected", daysSincePrevious: 21 } as never,
  });
  serveLiveFeed();
  const navigation = { ...m.renderKit.createFakeNavigation(), isFocused: () => false };
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen), { navigation });
  assert.doesNotMatch(view.text(), /Welcome back/);
  assert.deepEqual(exposures.exposures, []);
  const impressions = m.analytics
    .getTrackedAnalyticsEvents()
    .filter((event) => event.event === "discover_rail_impression");
  assert.deepEqual(impressions, [], "no rail impression while off screen");
});

test("release-01 core-only builds have no QuickBites route, so rail titles are not See all links", async () => {
  (m.FEATURE_FLAGS as { release01CoreOnly: boolean }).release01CoreOnly = true;
  serveLiveFeed();
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  assert.match(view.text(), /Dishes near you/);
  assert.equal(view.findByLabel("See all dishes near you"), null);
});

test("HOME-X7: QuickBites on Supabase lists the live feed only and never reads the local tables", async () => {
  serveLiveFeed();
  const view = await m.renderKit.renderScreen(m.QuickBitesScreen as never, {
    name: "QuickBites",
    params: { collection: "quickBites", latitude: 1.2813, longitude: 103.8458 },
  });
  assert.match(view.text(), /Chicken Rice/);
  assert.equal(fake.callsTo("get_discovery_feed_by_location").length, 1);
  assert.deepEqual(fullTableReads(), []);
});
