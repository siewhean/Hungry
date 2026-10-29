// The Home that Supabase builds ship: DiscoverEntryScreen renders the redesigned DiscoverHomeScreen
// on the live discovery feed, and the offline catalog Home only when that read fails. The real
// supabaseService runs against a fake supabase-js client, so the feed rows below are in the shape
// get_discovery_feed_by_location returns. Run with `node scripts/test-render.mjs <file>`.
import assert from "node:assert/strict";
import test, { afterEach, before, beforeEach } from "node:test";
import { act, createElement } from "react";

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

/** dish_taste_vectors rows the live feed's taste read returns; empty means no palate data. */
let tasteRows: Record<string, unknown>[] = [];

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
  fake.tables.dish_taste_vectors = () => ({ data: tasteRows, error: null });
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
  tasteRows = [];
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
  m.experiments.clearExperimentOverrides();
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

test("without a GPS fix or a pick the header says location is off and hides made-up distances", async () => {
  serveLiveFeed();
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  assert.match(view.text(), /Location is off\. Tap to choose your area\./);
  assert.ok(view.findByLabel(/Location is off, choose your area$/));
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

// ---- Round four, phase 1 (home-plan.md): filters, stall rows, refresh, tab press, impressions.

/** Prod-shaped row: the stall has no menu yet (26 of 29,611 prod venues have dishes). */
function coldRow(index: number, overrides: Record<string, unknown> = {}) {
  return feedRow(index, {
    top_dish_id: null,
    top_dish_name: null,
    top_dish_image: null,
    top_dish_rating: null,
    top_dish_review_count: 0,
    top_dish_price: null,
    operating_hours: null,
    ...overrides,
  });
}

/** A navigation whose focus, blur and tab-press events the test fires itself. */
function eventfulNavigation() {
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  let focused = true;
  const navigation = Object.assign(m.renderKit.createFakeNavigation(), {
    isFocused: () => focused,
    addListener: (type: string, listener: (event: unknown) => void) => {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
      return () => set.delete(listener);
    },
    getState: () => ({
      index: 0,
      key: "tabs",
      routeNames: ["Test"],
      routes: [{ key: "test-route", name: "Test" }],
      stale: false as const,
      type: "tab",
    }),
  });
  const emit = (type: string, event: unknown = { defaultPrevented: false }) => {
    for (const listener of [...(listeners.get(type) ?? [])]) listener(event);
  };
  return {
    navigation,
    setFocused: async (next: boolean) => {
      focused = next;
      await act(async () => emit(next ? "focus" : "blur"));
    },
    pressTab: async () => {
      await act(async () => emit("tabPress"));
      await new Promise((resolve) => setTimeout(resolve, 50));
    },
  };
}

/** Calls the ScrollView's onRefresh, the way a pull on a phone would. */
async function pullToRefresh(host: Element) {
  const fiberKey = Object.keys(host).find((key) => key.startsWith("__reactFiber$"))!;
  let fiber = (host as unknown as Record<string, unknown>)[fiberKey] as {
    memoizedProps?: { refreshControl?: { props: { onRefresh: () => void } } };
    return: unknown;
  } | null;
  while (fiber) {
    const refreshControl = fiber.memoizedProps?.refreshControl;
    if (refreshControl) {
      await act(async () => refreshControl.props.onRefresh());
      return;
    }
    fiber = fiber.return as typeof fiber;
  }
  throw new Error("Home has no refreshControl");
}

test("R4-B1: a chip filters the whole nearby pool, not just the first 6 cards", async () => {
  const rows = Array.from({ length: 10 }, (_, i) => feedRow(i + 1, { top_dish_review_count: 12 }));
  serveLiveFeed(rows);
  // Only the 9th stall's dish is halal: it is past the 6-card slice of "Dishes near you".
  fake.tables.dish_dietary_flags = () => ({
    data: [{ dish_id: "dish-9", dietary_flag_id: HALAL_FLAG_ID }],
    error: null,
  });
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  await view.press(view.findByLabel("Halal"));
  await m.renderKit.settle();
  assert.match(view.text(), /Dish 9/, "the halal dish nearby should show under Halal");
});

test("R4-B3: a stall that closed earlier today reads 'Closed', not 'Closed · Closed for today'", async () => {
  serveLiveFeed([feedRow(1, { operating_hours: "Mon-Sun 00:00-00:01" }), feedRow(2), feedRow(3)]);
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  assert.doesNotMatch(view.text(), /Closed · Closed for today/);
  assert.match(view.text(), /Closed/);
});

test("R4-B4: stalls nearby are ordered nearest first when nobody has rated them", async () => {
  serveLiveFeed([
    coldRow(1, { distance_meters: 900, venue_name: "Zeta Far Stall" }),
    coldRow(2, { distance_meters: 50, venue_name: "Alpha Close Stall" }),
  ]);
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  const text = view.text();
  assert.ok(
    text.indexOf("Alpha Close Stall") < text.indexOf("Zeta Far Stall"),
    "nearest stall should come first",
  );
});

test("H4-6: open stalls come before closed ones even when the closed one is nearer, and closed rows are dimmed", async () => {
  serveLiveFeed([
    coldRow(1, { distance_meters: 50, venue_name: "Near Closed Stall", is_open: false }),
    coldRow(2, {
      distance_meters: 900,
      venue_name: "Far Open Stall",
      operating_hours: "Mon-Sun 24 hours",
    }),
  ]);
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  const text = view.text();
  assert.ok(text.indexOf("Far Open Stall") < text.indexOf("Near Closed Stall"));
  const closedRow = view.findByLabel("Open Near Closed Stall details") as HTMLElement;
  assert.equal(closedRow.style.opacity, "0.7");
});

test("H4-16: a stall's rating sits in its own pill, apart from the open state", async () => {
  serveLiveFeed([feedRow(1, { operating_hours: "Mon-Sun 24 hours" }), feedRow(2), feedRow(3)]);
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  assert.ok(view.findByLabel("Rated 4.5"), "a rating pill is on the stall row");
  assert.doesNotMatch(view.text(), /Open · Open 24 hours ·\s*★/);
});

test("R4-B5: 'No matching results' is one page-level state with a one-tap way to clear the filters", async () => {
  serveLiveFeed();
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  await view.press(view.findByLabel("Spicy"));
  await view.press(view.findByLabel("Halal"));
  await m.renderKit.settle();
  const matches = view.text().match(/No matching results/g) ?? [];
  assert.equal(matches.length, 1, "one empty state for the page, not one per section");
  const clear = view.findByLabel(/Clear (all )?filters/);
  assert.ok(clear, "a Clear filters button should be offered");
  await view.press(clear);
  assert.doesNotMatch(view.text(), /No matching results/);
  assert.match(view.text(), /Dishes near you/);
  const cleared = m.analytics
    .getTrackedAnalyticsEvents()
    .filter((event) => event.event === "home_filters_cleared");
  assert.equal(cleared.length, 1);
});

test("H4-8: rails the filter empties collapse instead of each showing an empty block", async () => {
  serveLiveFeed();
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  await view.press(view.findByLabel("Halal"));
  await m.renderKit.settle();
  // One halal dish nearby: its rail and stall stay; nothing else shows "No matching results".
  assert.doesNotMatch(view.text(), /No matching results/);
  assert.match(view.text(), /Nasi Padang/);
});

test("H4-9: the Value chip is 'Under S$5' and keeps dishes under 5 dollars", async () => {
  serveLiveFeed([
    feedRow(1, { top_dish_price: 4, top_dish_name: "Cheap Noodles" }),
    feedRow(2, { top_dish_price: 4.5, top_dish_name: "Cheap Rice" }),
    feedRow(3, { top_dish_price: 4.8, top_dish_name: "Cheap Soup" }),
    feedRow(4, { top_dish_price: 7, top_dish_name: "Pricey Plate" }),
  ]);
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  assert.equal(view.findByLabel("Value"), null);
  await view.press(view.findByLabel("Under S$5"));
  await m.renderKit.settle();
  assert.match(view.text(), /Cheap Noodles/);
  assert.doesNotMatch(view.text(), /Pricey Plate/);
});

test("H4-12: the Halal chip uses no Arabic mark that could read as a certificate", async () => {
  serveLiveFeed();
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  assert.ok(view.findByLabel("Halal"));
  assert.doesNotMatch(view.html(), /حلال/);
});

test("H4-10: with no saved needs the Dietary needs chip opens the dietary settings", async () => {
  serveLiveFeed();
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  await view.press(view.findByLabel("Dietary needs"));
  assert.deepEqual(view.navigation.calls.at(-1), {
    method: "navigate",
    args: [
      "OnboardingStack",
      { screen: "TasteQuiz", params: { mode: "profile", initialPhase: "dietary", source: "home" } },
    ],
  });
  // It did not switch a filter on behind the diner's back.
  assert.doesNotMatch(view.text(), /No matching results/);
});

test("H4-10: saved needs name the chip, and a sparse feed explains itself instead of leaving Home empty", async () => {
  m.useProfileStore.setState((state) => ({
    profile: { ...state.profile, dietaryPreferences: ["halal", "vegetarian", "vegan"] },
  }));
  serveLiveFeed();
  // Nothing nearby carries a dietary flag yet.
  fake.tables.dish_dietary_flags = () => ({ data: [], error: null });
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  assert.ok(view.findByLabel("Halal · Vegetarian +1"), "the chip names the saved needs");
  assert.match(view.text(), /No matching results/);
  assert.match(view.text(), /Nothing nearby is confirmed Halal · Vegetarian \+1 yet/);
  const showAll = view.findByLabel("Show all dishes");
  assert.ok(showAll, "the way out is on screen");
  await view.press(showAll);
  assert.match(view.text(), /Stalls in /, "the stall list is back");
  // A palate-ranked rail keeps the dietary rule: no dish is confirmed yet, so none is offered.
  assert.doesNotMatch(view.text(), /Dishes near you/);
});

test("H4-10: clearing every saved need in Settings switches the dietary filter off", async () => {
  m.useProfileStore.setState((state) => ({
    profile: { ...state.profile, dietaryPreferences: ["halal"] },
  }));
  serveLiveFeed();
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  assert.doesNotMatch(view.text(), /Chicken Rice/, "halal only while the need is saved");
  m.useProfileStore.setState((state) => ({
    profile: { ...state.profile, dietaryPreferences: [] },
  }));
  await m.renderKit.settle();
  assert.match(view.text(), /Chicken Rice/);
});

test("H4-11: in a mall the chips filter 'For you' and 'What's here' too", async () => {
  serveLiveFeed();
  setLocation({ permission: "granted" });
  const service = m.provider.getCatalogRawService() as unknown as Record<string, unknown>;
  service.listPlaces = async () => [
    {
      id: "building-1",
      name: "Maxwell Food Centre",
      venueCount: 4,
      latitude: DEFAULT_LOCATION.latitude,
      longitude: DEFAULT_LOCATION.longitude,
    },
  ];
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  assert.match(view.text(), /For you at Maxwell Food Centre/);
  assert.match(view.text(), /Chicken Rice/);
  await view.press(view.findByLabel("Halal"));
  await m.renderKit.settle();
  assert.match(view.text(), /Nasi Padang/);
  assert.doesNotMatch(view.text(), /Chicken Rice/, "For you drops dishes the chip rules out");
  await view.press(view.findByLabel(/What's here/));
  await m.renderKit.settle();
  assert.match(view.text(), /Hajjah Mariam/);
  assert.doesNotMatch(view.text(), /Tian Tian/, "What's here lists only stalls with a halal dish");
});

test("H4-22: pulling to refresh keeps the cards on screen until the new ones land", async () => {
  serveLiveFeed();
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  assert.match(view.text(), /Hajjah Mariam/);
  let release: () => void = () => undefined;
  fake.rpc.get_discovery_feed_by_location = () =>
    new Promise((resolve) => {
      release = () =>
        resolve({
          data: [feedRow(1, { venue_name: "Fresh Stall", top_dish_name: "Fresh Dish" })],
          error: null,
        });
    });
  await pullToRefresh(view.findByText("Hawker classics")!);
  await view.settle();
  assert.match(view.text(), /Hajjah Mariam/, "the old cards stay during the refresh");
  assert.match(view.text(), /Dishes near you/);
  release();
  await view.settle();
  assert.match(view.text(), /Fresh Stall/);
  assert.doesNotMatch(view.text(), /Hajjah Mariam/);
});

test("H4-22: a different area still shows the loading skeleton, not the old area's cards", async () => {
  serveLiveFeed();
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  assert.match(view.text(), /Hajjah Mariam/);
  fake.rpc.get_discovery_feed_by_location = () => new Promise(() => undefined);
  await act(async () => {
    setLocation({
      permission: "granted",
      currentLocation: { latitude: 1.35, longitude: 103.95 },
    });
  });
  await view.settle();
  assert.doesNotMatch(view.text(), /Hajjah Mariam/);
});

test("H4-23: pressing the Home tab scrolls the page back to the top", async () => {
  serveLiveFeed();
  const scrolls: unknown[] = [];
  const events = eventfulNavigation();
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen), {
    navigation: events.navigation,
  });
  for (const element of Array.from(document.body.querySelectorAll("*"))) {
    const node = element as unknown as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(node, "scrollTo")) {
      node.scrollTo = (options: unknown) => scrolls.push(options);
    }
  }
  await events.pressTab();
  assert.ok(
    scrolls.some((options) => (options as { y?: number })?.y === 0),
    "tabPress calls scrollTo({ y: 0 })",
  );
  assert.ok(view.findByText("Dishes near you"));
});

test("H4-25: a rail counts one impression per visit, so leaving Home and coming back counts again", async () => {
  serveLiveFeed();
  const events = eventfulNavigation();
  await m.renderKit.render(createElement(m.DiscoverEntryScreen), { navigation: events.navigation });
  const impressions = () =>
    m.analytics
      .getTrackedAnalyticsEvents()
      .filter((event) => event.event === "discover_rail_impression");
  const railImpressions = () =>
    impressions().filter((event) => event.properties?.rail === "quickBites");
  assert.equal(railImpressions().length, 1);
  await events.setFocused(false);
  await events.setFocused(true);
  assert.equal(railImpressions().length, 2);
  assert.equal(impressions().filter((event) => event.properties?.rail === "area_stalls").length, 2);
});

// ---- Round four, phase 2 (home-plan.md): cold start, palate order, one rail per dish.

/** Rows for a nearby area where `menus` stalls have a menu and `bare` do not. */
function mixedFeed(menus: number, bare: number) {
  return [
    ...Array.from({ length: menus }, (_, i) =>
      feedRow(i + 1, { top_dish_review_count: 0, top_dish_rating: null }),
    ),
    ...Array.from({ length: bare }, (_, i) =>
      coldRow(menus + i + 1, { venue_name: `Bare Stall ${i + 1}` }),
    ),
  ];
}

function countOf(text: string, pattern: RegExp) {
  return (text.match(pattern) ?? []).length;
}

test("R4-B2: with no menus nearby the stalls stay in one list under a single note", async () => {
  serveLiveFeed(Array.from({ length: 12 }, (_, i) => coldRow(i + 1)));
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  const text = view.text();
  assert.equal(countOf(text, /Menu coming soon/g), 0, "no per-row repeat");
  assert.equal(countOf(text, /Menus are coming to these stalls/g), 1, "one note instead");
  assert.match(text, /Stall 1/);
  assert.doesNotMatch(text, /More stalls nearby/, "nothing to fold under: every stall is bare");
});

test("H4-1: with no dish rails the classics stand in as 'Popular dishes in Singapore'", async () => {
  serveLiveFeed(Array.from({ length: 12 }, (_, i) => coldRow(i + 1)));
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  assert.match(view.text(), /Popular dishes in Singapore/);
  assert.doesNotMatch(view.text(), /Hawker classics/);
});

test("H4-1: with dishes nearby the classics keep their name", async () => {
  serveLiveFeed(Array.from({ length: 8 }, (_, i) => feedRow(i + 1)));
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  assert.match(view.text(), /Hawker classics/);
  assert.doesNotMatch(view.text(), /Popular dishes in Singapore/);
});

test("H4-1: stalls without menus fold into one row under the stalls that have them", async () => {
  serveLiveFeed(mixedFeed(3, 5));
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  const before = view.text();
  assert.match(before, /Stall 1/);
  assert.doesNotMatch(before, /Bare Stall 1/, "folded until the diner opens the row");
  assert.equal(countOf(before, /Menu coming soon/g), 0);
  const group = view.findByLabel("More stalls nearby, menus coming. 5 stalls");
  assert.ok(group, "the folded row is on screen");
  assert.match(before, /More stalls nearby · menus coming/);

  await view.press(group);
  const after = view.text();
  for (let i = 1; i <= 5; i += 1) assert.match(after, new RegExp(`Bare Stall ${i}`));
  assert.deepEqual(
    m.analytics
      .getTrackedAnalyticsEvents()
      .filter((event) => event.event === "home_cold_start_group_opened")
      .map((event) => event.properties),
    [{ surface: "home", count: 5 }],
  );
});

test("H4-1: a stall with a menu and no reviews asks for the first one", async () => {
  serveLiveFeed(mixedFeed(2, 1));
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  assert.equal(countOf(view.text(), /Be the first to review/g), 2);
});

test("H4-1: the control arm keeps 'Menu coming soon' on every bare stall", async () => {
  m.experiments.setExperimentOverride("home_cold_start_v1", "control");
  serveLiveFeed(mixedFeed(3, 4));
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  assert.equal(countOf(view.text(), /Menu coming soon/g), 4);
  assert.doesNotMatch(view.text(), /More stalls nearby/);
  assert.doesNotMatch(view.text(), /Popular dishes in Singapore/);
});

test("H4-3: the review-count rail is called 'Most reviewed', as its See all page is", async () => {
  serveLiveFeed();
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  assert.match(view.text(), /Most reviewed in /);
  assert.doesNotMatch(view.text(), /Trending/);
});

test("H4-4: a dish shows in the first rail it qualifies for, not in every rail", async () => {
  // Twelve dishes, all rated 4.5 with reviews and under S$8: each qualifies for every rail.
  serveLiveFeed(
    Array.from({ length: 12 }, (_, i) => feedRow(i + 1, { top_dish_price: 4 + (i % 3) })),
  );
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  const text = view.text();
  const shown = [...text.matchAll(/Dish (\d+)/g)].map((match) => match[1]);
  assert.ok(shown.length >= 11, "the first rails are full");
  // The rails the repeats leave too thin to look like one (Top rated, Budget) are hidden.
  assert.equal(new Set(shown).size, shown.length, `repeated dishes: ${shown.join(",")}`);
});

test("H4-2: with a palate, Dishes near you follows it and says why", async () => {
  const rows = Array.from({ length: 8 }, (_, i) =>
    feedRow(i + 1, { top_dish_review_count: 0, top_dish_rating: null, top_dish_price: 9 + i }),
  );
  // Dish 7 is the spiciest, dish 8 the mildest; feed order would put dish 1 first.
  tasteRows = rows.map((row, i) => ({
    dish_id: row.top_dish_id,
    sweet: 5,
    spicy: i === 6 ? 9 : i === 7 ? 1 : 5,
    sour: 5,
    salty: 5,
    rich: 5,
    aromatic: 5,
  }));
  m.useProfileStore.setState((state) => ({
    profile: {
      ...state.profile,
      tasteVector: { sweet: 5, spicy: 9, sour: 5, salty: 5, rich: 5, aromatic: 5 },
    },
  }));
  serveLiveFeed(rows);
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  const text = view.text();
  const rail = text.slice(text.indexOf("Dishes near you"));
  assert.ok(rail.indexOf("Dish 7") < rail.indexOf("Dish 1"), "the spicy dish leads the rail");
  assert.match(rail, /Spicy, the way you like it/);
  assert.equal(
    fake.queries.filter((query) => query.table === "dish_taste_vectors").length,
    1,
    "the palate data is one batched read, not one per dish",
  );
});

const PALATE_ROWS = Array.from({ length: 8 }, (_, i) =>
  feedRow(i + 1, { top_dish_review_count: 0, top_dish_rating: null, top_dish_price: 9 + i }),
);

function givePalate(spicyDishIndex: number) {
  tasteRows = PALATE_ROWS.map((row, i) => ({
    dish_id: row.top_dish_id,
    sweet: 5,
    spicy: i === spicyDishIndex ? 9 : 5,
    sour: 5,
    salty: 5,
    rich: 5,
    aromatic: 5,
  }));
}

test("H4-2: a diner without a palate keeps feed order and sees no reason line", async () => {
  givePalate(6);
  m.useProfileStore.setState((state) => ({
    profile: {
      ...state.profile,
      tasteVector: { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 },
    },
  }));
  serveLiveFeed(PALATE_ROWS);
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  const text = view.text();
  assert.doesNotMatch(text, /the way you like it/);
  assert.match(text, /Dish 1/);
  assert.doesNotMatch(text, /Dish 7/, "the rail holds the first six dishes of the feed");
});

test("H4-2: the control arm keeps feed order even with a palate", async () => {
  givePalate(6);
  m.useProfileStore.setState((state) => ({
    profile: {
      ...state.profile,
      tasteVector: { sweet: 5, spicy: 9, sour: 5, salty: 5, rich: 5, aromatic: 5 },
    },
  }));
  m.experiments.setExperimentOverride("home_taste_rank_v1", "control");
  serveLiveFeed(PALATE_ROWS);
  const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
  const text = view.text();
  assert.doesNotMatch(text, /the way you like it/);
  assert.match(text, /Dish 1/);
  assert.doesNotMatch(text, /Dish 7/, "the rail holds the first six dishes of the feed");
});

test("H4-2: if the palate read fails, Home still shows the feed in its own order", async () => {
  m.useProfileStore.setState((state) => ({
    profile: {
      ...state.profile,
      tasteVector: { sweet: 5, spicy: 9, sour: 5, salty: 5, rich: 5, aromatic: 5 },
    },
  }));
  serveLiveFeed(PALATE_ROWS);
  fake.tables.dish_taste_vectors = () => ({ data: null, error: { message: "down" } });
  const warn = console.warn;
  console.warn = () => undefined;
  try {
    const view = await m.renderKit.render(createElement(m.DiscoverEntryScreen));
    assert.match(view.text(), /Dishes near you/);
    assert.match(view.text(), /Dish 1/);
  } finally {
    console.warn = warn;
  }
});
