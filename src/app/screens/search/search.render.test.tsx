// Search home and the results grid, rendered against a stubbed catalog service.
// Run with `node scripts/test-render.mjs src/app/screens/search/search.render.test.tsx`.

import assert from "node:assert/strict";
import { act } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { DishSearchScreen } from "@/app/screens/search/DishSearchScreen";
import { SearchResultsScreen } from "@/app/screens/search/SearchResultsScreen";
import {
  clearTrackedAnalyticsEvents,
  getTrackedAnalyticsEvents,
} from "@/lib/analytics/mockAnalytics";
import {
  EXPERIMENTS,
  resetExperimentSession,
  setExperimentFlagSource,
  type ExperimentFlagSource,
} from "@/lib/experiments/experiments";
import type {
  CatalogPage,
  CatalogPageRequest,
  CatalogRawDishCard,
  CatalogRawVenueCard,
} from "@/lib/services/catalog";
import { CatalogRateLimitedError, CatalogReleaseExpiredError } from "@/lib/services/catalog";
import { getCatalogRawService } from "@/lib/services/serviceProvider";
import { useLocationStore } from "@/store/useLocationStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, renderScreen, type RenderResult } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

type Service = ReturnType<typeof getCatalogRawService>;
let restore: (() => void) | undefined;

beforeEach(async () => {
  await enterScenario("user");
  clearTrackedAnalyticsEvents();
});

afterEach(async () => {
  cleanup();
  restore?.();
  restore = undefined;
  setExperimentFlagSource(undefined);
  resetExperimentSession();
  useUIStore.setState({ allowSearchHistory: true });
});

function page<T>(items: T[]): CatalogPage<T> {
  return {
    items,
    releaseId: "release-1",
    matchCount: items.length,
    totals: { venues: items.length, dishes: items.length },
  };
}

function dishCard(id: string, overrides: Partial<CatalogRawDishCard> = {}): CatalogRawDishCard {
  return {
    id,
    venueId: `venue-${id}`,
    buildingId: "maxwell",
    name: `Dish ${id}`,
    venueName: `Stall ${id}`,
    buildingName: "Maxwell Food Centre",
    price: 5,
    rating: 4.5,
    reviewCount: 10,
    cuisineTags: [],
    dietaryFlags: [],
    sectionTags: [],
    verificationStatus: "raw",
    menuRightsStatus: "merchant_owned",
    mediaRightsStatus: "merchant_owned",
    ...overrides,
  };
}

/** Swaps catalog methods for the test; restored after each test. */
function stubCatalog(overrides: Partial<Service>) {
  const service = getCatalogRawService();
  const originals = Object.fromEntries(
    Object.keys(overrides).map((key) => [key, service[key as keyof Service]]),
  );
  Object.assign(service, overrides);
  restore = () => Object.assign(service, originals);
}

const wait = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

async function renderResults(params: Record<string, unknown>): Promise<RenderResult> {
  const view = await renderScreen(SearchResultsScreen as never, { name: "SearchResults", params });
  await wait(50);
  await view.settle();
  return view;
}

test("place-scoped results name the place and offer no radius widening (SEARCH-X2)", async () => {
  const requests: CatalogPageRequest[] = [];
  stubCatalog({
    listVenues: async (request) => {
      requests.push(request);
      return page<CatalogRawVenueCard>([]);
    },
    listPlaces: async () => [],
  });
  const view = await renderResults({
    browseMode: "stalls",
    placeId: "maxwell",
    placeName: "Maxwell Food Centre",
  });
  assert.equal(requests[0]?.buildingId, "maxwell");
  assert.match(view.text(), /No stalls at Maxwell Food Centre/);
  assert.doesNotMatch(view.text(), /within 3 km/);
  assert.equal(view.findByText("Search all Singapore"), null);
  // X8: without text inside a place the order is really "Top rated".
  assert.match(view.text(), /Top rated/);
});

test("browsing near the user still offers to widen, and the summary says within 3 km", async () => {
  stubCatalog({ listDishes: async () => page<CatalogRawDishCard>([]) });
  const view = await renderResults({ browseMode: "dishes" });
  assert.match(view.text(), /No dishes within 3 km/);
  assert.ok(view.findByText("Search all Singapore"));
  assert.match(view.text(), /Nearest/, "Best match without text is shown as Nearest");
  // SEARCH-16: the mode switch is a tablist of tabs; sort options are radios.
  const tabs = view.container.querySelectorAll('[role="tab"]');
  assert.deepEqual(
    Array.from(tabs).map((tab) => tab.textContent),
    ["Dishes", "Stalls"],
  );
  assert.equal(view.container.querySelectorAll('[role="radio"]').length, 4);
});

test("a signed-out grid says to sign in instead of an empty Retry (SEARCH-3)", async () => {
  useSessionStore.setState({ isAuthenticated: false });
  stubCatalog({ listDishes: async () => page([dishCard("1")]) });
  const view = await renderResults({ browseMode: "dishes" });
  assert.match(view.text(), /Sign in to search/);
  await view.press(view.findByText("Sign in"));
  assert.deepEqual(view.navigation.calls.at(-1), {
    method: "navigate",
    args: ["AuthStack", { screen: "Login" }],
  });
});

test("a one-letter query clears the old results (SEARCH-X3)", async () => {
  stubCatalog({ listDishes: async () => page([dishCard("1")]) });
  const view = await renderResults({ browseMode: "dishes", initialQuery: "laksa" });
  await wait(300);
  assert.match(view.text(), /Dish 1/);
  const input = view.findByTestId("browse-results-search-input");
  await view.type(input, "l");
  await wait(50);
  assert.match(view.text(), /Type at least 2 letters/);
  assert.doesNotMatch(view.text(), /Dish 1/);
});

test("with filters on, an empty result offers Clear filters and no Did you mean (SEARCH-18)", async () => {
  stubCatalog({
    listDishes: async () => page<CatalogRawDishCard>([]),
    suggest: async () => [{ kind: "food_type", label: "Laksa" }],
  });
  const view = await renderResults({
    browseMode: "dishes",
    initialQuery: "laksaa",
    initialFilter: "Halal",
  });
  await wait(400);
  assert.ok(view.findByText("Clear filters"));
  assert.equal(view.findByText(/Did you mean/), null);
});

test("without filters, an empty result offers Did you mean", async () => {
  stubCatalog({
    listDishes: async () => page<CatalogRawDishCard>([]),
    suggest: async () => [{ kind: "food_type", label: "Laksa" }],
  });
  const view = await renderResults({ browseMode: "dishes", initialQuery: "laksaa" });
  await wait(400);
  assert.ok(view.findByText('Did you mean "Laksa"?'));
});

test("zero-result events leave out the text when search history is off (SEARCH-8)", async () => {
  stubCatalog({
    listDishes: async () => page<CatalogRawDishCard>([]),
    suggest: async () => [],
  });
  useUIStore.setState({ allowSearchHistory: false });
  await renderResults({ browseMode: "dishes", initialQuery: "secret dish" });
  await wait(400);
  const zero = getTrackedAnalyticsEvents().find((event) => event.event === "search_zero_results");
  assert.ok(zero, "the zero-result event still fires");
  assert.equal("query" in zero.properties, false);
  assert.equal(zero.properties.query_length, "secret dish".length);
});

test("zero-result events keep the text when search history is on", async () => {
  stubCatalog({
    listDishes: async () => page<CatalogRawDishCard>([]),
    suggest: async () => [],
  });
  await renderResults({ browseMode: "dishes", initialQuery: "laksaa" });
  await wait(400);
  const zero = getTrackedAnalyticsEvents().find((event) => event.event === "search_zero_results");
  assert.equal(zero?.properties.query, "laksaa");
  assert.ok(zero?.properties.search_id, "the zero-result event carries the search id");
});

test("an offline copy of the catalog is disclosed (SEARCH-4)", async () => {
  stubCatalog({
    listDishes: async () => ({ ...page([dishCard("1")]), releaseId: "excel-fallback-v1" }),
  });
  const view = await renderResults({ browseMode: "dishes" });
  assert.ok(view.findByTestId("search-offline-copy"));
});

test("the share button is hidden until search links resolve (SEARCH-5)", async () => {
  stubCatalog({ listDishes: async () => page([dishCard("1")]) });
  const view = await renderResults({ browseMode: "dishes" });
  assert.match(view.text(), /Dish 1/);
  assert.equal(view.findByLabel("Share this search"), null);
});

test("stall cards show the top dish rating and keep same-name stalls apart (SEARCH-2, SEARCH-10)", async () => {
  const venue = (id: string, buildingName: string): CatalogRawVenueCard => ({
    id,
    buildingId: buildingName,
    name: "Chicken Rice",
    buildingName,
    menuCount: 3,
    qualityRating: 4.4,
    qualityReviewCount: 30,
    verificationStatus: "raw",
    menuRightsStatus: "merchant_owned",
    mediaRightsStatus: "merchant_owned",
  });
  stubCatalog({
    listVenues: async () => page([venue("v1", "Maxwell"), venue("v2", "Tiong Bahru")]),
    listPlaces: async () => [],
  });
  const view = await renderResults({ browseMode: "stalls" });
  assert.match(view.text(), /Maxwell/);
  assert.match(view.text(), /Tiong Bahru/);
  assert.doesNotMatch(view.text(), /outlet/);
  assert.equal((view.text().match(/4\.4 \(30\)/g) ?? []).length, 2);
  // SEARCH-V5: the pill says it is the top dish's rating, not the stall's.
  assert.equal((view.text().match(/Top dish 4\.4 \(30\)/g) ?? []).length, 2);
});

function stallCard(id: string, overrides: Partial<CatalogRawVenueCard> = {}): CatalogRawVenueCard {
  return {
    id,
    buildingId: "maxwell",
    name: `Laksa House ${id}`,
    buildingName: "Maxwell Food Centre",
    menuCount: 3,
    verificationStatus: "raw",
    menuRightsStatus: "merchant_owned",
    mediaRightsStatus: "merchant_owned",
    ...overrides,
  };
}

test("stall cards show the matched dish and the main price, and open the stall (SR4-3, SR4-4, SR4-8, SR4-9)", async () => {
  stubCatalog({
    listVenues: async () =>
      page([
        stallCard("v1", {
          logoUrl: "https://example.com/logo.png",
          mainPrice: 5,
          matchedDish: { id: "d1", name: "Signature Laksa", price: 6, verificationStatus: "raw" },
        }),
        stallCard("v2", { mainPrice: 7.5 }),
      ]),
    listPlaces: async () => [],
  });
  const view = await renderResults({ browseMode: "stalls", initialQuery: "laksa" });
  await wait(400);
  assert.match(view.text(), /Signature Laksa · S\$6\.00/, "the dish that matched the query");
  assert.match(view.text(), /Mains around S\$7\.50/, "the typical price of the mains");
  // A stall with a logo shows it; one without falls back to its initials.
  assert.equal(view.findByLabel("Laksa House v1 stall logo unavailable"), null);
  assert.ok(view.findByLabel("Laksa House v2 stall logo unavailable"));

  await view.press(view.findByLabel(/^Laksa House v1,/));
  assert.deepEqual(view.navigation.calls.at(-1), {
    method: "navigate",
    args: ["StallDetail", { venueId: "v1" }],
  });
  const opened = getTrackedAnalyticsEvents().find(
    (event) => event.event === "search_result_opened",
  );
  assert.equal(opened?.properties.mode, "stalls");
});

test("the offline copy keeps the catalog page for a stall tap", async () => {
  stubCatalog({
    listVenues: async () => ({
      ...page([stallCard("v1")]),
      releaseId: "excel-fallback-1",
    }),
    listPlaces: async () => [],
  });
  const view = await renderResults({ browseMode: "stalls" });
  await wait(400);
  await view.press(view.findByLabel(/^Laksa House v1,/));
  assert.deepEqual(view.navigation.calls.at(-1), {
    method: "navigate",
    args: ["CatalogRawDetail", { kind: "venue", id: "v1", releaseId: "excel-fallback-1" }],
  });
});

test("Search home: a stall suggestion with a venue id opens the stall; a chain's name searches", async () => {
  stubCatalog({
    suggest: async () => [
      { kind: "stall", label: "Sungei Road Laksa", venueId: "v9", subtitle: "Maxwell Food Centre" },
      { kind: "stall", label: "Ya Kun Kaya Toast" },
    ],
    listDishes: async () => page<CatalogRawDishCard>([]),
  });
  const view = await renderHome();
  await view.type(view.findByLabel("Search dishes, stalls, or hawker centres"), "sungei");
  await wait(400);
  assert.match(view.text(), /Stall · Maxwell Food Centre/);
  await view.press(view.findByLabel("Open Sungei Road Laksa, Stall at Maxwell Food Centre"));
  assert.deepEqual(view.navigation.calls.at(-1), {
    method: "navigate",
    args: ["StallDetail", { venueId: "v9" }],
  });

  await view.type(view.findByLabel("Search dishes, stalls, or hawker centres"), "ya kun");
  await wait(400);
  await view.press(view.findByLabel("Search Ya Kun Kaya Toast, Stall"));
  const call = view.navigation.calls.at(-1);
  assert.equal(call?.method, "navigate");
  assert.equal((call?.args[0] as string) ?? "", "SearchResults");
  assert.equal((call?.args[1] as { browseMode?: string }).browseMode, "stalls");
  assert.equal((call?.args[1] as { initialQuery?: string }).initialQuery, "Ya Kun Kaya Toast");
});

test("ParsedQueryChips: diet and price words become filters and removable chips (SR4-2)", async () => {
  const requests: CatalogPageRequest[] = [];
  stubCatalog({
    listDishes: async (request) => {
      requests.push(request);
      return page([dishCard("1")]);
    },
    listPlaces: async () => [],
  });
  const view = await renderResults({ browseMode: "dishes", initialQuery: "halal laksa under $5" });
  await wait(400);
  const first = requests.at(-1);
  assert.equal(first?.query, "laksa", "the filter words are not searched for");
  assert.deepEqual(first?.dietaryFlags, ["halal"]);
  assert.equal(first?.maxPrice, 5);
  const chips = view.findByTestId("search-parsed-chips");
  assert.ok(chips, "the parsed filters show as chips");
  assert.match(chips.textContent ?? "", /Halal/);
  assert.match(chips.textContent ?? "", /Under S\$5/);
  // The input keeps what was typed.
  const input = view.findByTestId("browse-results-search-input") as HTMLInputElement;
  assert.equal(input.value, "halal laksa under $5");
  const applied = getTrackedAnalyticsEvents().find(
    (event) => event.event === "search_parse_applied",
  );
  assert.equal(applied?.properties.part_count, 2);
  assert.equal(applied?.properties.part_kinds, "dietary,price");

  // Removing the Halal chip searches for the word "halal" instead; the price stays a filter.
  await view.press(view.findByLabel(/^Halal, from your search/));
  await wait(400);
  const after = requests.at(-1);
  assert.equal(after?.query, "halal laksa");
  assert.deepEqual(after?.dietaryFlags, []);
  assert.equal(after?.maxPrice, 5);
  assert.equal(view.findByLabel(/^Halal, from your search/), null);
  assert.ok(view.findByLabel(/^Under S\$5, from your search/));
  const removed = getTrackedAnalyticsEvents().find(
    (event) => event.event === "search_parse_removed",
  );
  assert.equal(removed?.properties.part_kind, "dietary");
});

test("parsed filters that find nothing fall back to the whole text, with a note and the chip kept (SR4-2)", async () => {
  const requests: CatalogPageRequest[] = [];
  stubCatalog({
    listDishes: async (request) => {
      requests.push(request);
      // Dietary tags are sparse: only the plain text finds the dish.
      const filtered = (request.dietaryFlags?.length ?? 0) > 0;
      return page(filtered ? [] : [dishCard("1", { name: "Vegetarian Bee Hoon" })]);
    },
    listPlaces: async () => [],
  });
  const view = await renderResults({ browseMode: "dishes", initialQuery: "vegetarian bee hoon" });
  // The empty result switches to the whole text in a second step, which loads after its own pause.
  await wait(500);
  await wait(500);
  const first = requests[0];
  assert.equal(first?.query, "bee hoon");
  assert.deepEqual(first?.dietaryFlags, ["vegetarian"]);
  const last = requests.at(-1);
  assert.equal(last?.query, "vegetarian bee hoon", "the whole text is searched");
  assert.deepEqual(last?.dietaryFlags, []);
  assert.match(view.text(), /Vegetarian Bee Hoon/);
  const note = view.findByTestId("search-parsed-relaxed-note");
  assert.ok(note, "the note says why the results changed");
  assert.match(note.textContent ?? "", /Nothing matched with Vegetarian/);
  assert.ok(view.findByLabel(/^Vegetarian, from your search/), "the chip stays");
  assert.equal(view.findByText("No dishes"), null);
  const relaxedEvent = getTrackedAnalyticsEvents().find(
    (event) => event.event === "search_parse_relaxed",
  );
  assert.equal(relaxedEvent?.properties.part_count, 1);
  assert.equal(
    getTrackedAnalyticsEvents().some((event) => event.event === "search_zero_results"),
    false,
    "a search that is retried with the whole text is not a zero-result search",
  );

  // Removing the chip searches "vegetarian" as a word, and the note goes away.
  await view.press(view.findByLabel(/^Vegetarian, from your search/));
  await wait(400);
  assert.equal(view.findByTestId("search-parsed-relaxed-note"), null);
  assert.equal(requests.at(-1)?.query, "vegetarian bee hoon");
  assert.deepEqual(requests.at(-1)?.dietaryFlags, []);
});

test("parsed filters that find results keep the filtered search and show no note", async () => {
  const requests: CatalogPageRequest[] = [];
  stubCatalog({
    listDishes: async (request) => {
      requests.push(request);
      return page([dishCard("1")]);
    },
    listPlaces: async () => [],
  });
  const view = await renderResults({ browseMode: "dishes", initialQuery: "halal laksa" });
  await wait(400);
  assert.equal(requests.at(-1)?.query, "laksa");
  assert.equal(view.findByTestId("search-parsed-relaxed-note"), null);
});

test("a typed price cap lower than the Under S$6 chip wins, and the chip stays on its own (SR4-2)", async () => {
  const requests: CatalogPageRequest[] = [];
  stubCatalog({
    listDishes: async (request) => {
      requests.push(request);
      return page([dishCard("1")]);
    },
    listPlaces: async () => [],
  });
  await renderResults({
    browseMode: "dishes",
    initialQuery: "laksa below 4",
    initialFilter: "Under S$6",
  });
  await wait(400);
  assert.equal(requests.at(-1)?.maxPrice, 4);
});

test("a query with no filter words has no chips and is sent as typed", async () => {
  const requests: CatalogPageRequest[] = [];
  stubCatalog({
    listDishes: async (request) => {
      requests.push(request);
      return page([dishCard("1")]);
    },
    listPlaces: async () => [],
  });
  const view = await renderResults({ browseMode: "dishes", initialQuery: "chicken rice" });
  await wait(400);
  assert.equal(requests.at(-1)?.query, "chicken rice");
  assert.equal(view.findByTestId("search-parsed-chips"), null);
  assert.equal(
    getTrackedAnalyticsEvents().some((event) => event.event === "search_parse_applied"),
    false,
  );
});

test("a rate-limited search says to wait, not to check the connection, and Retry waits (SR4-15)", async () => {
  let calls = 0;
  stubCatalog({
    listDishes: async () => {
      calls += 1;
      throw new CatalogRateLimitedError();
    },
    listPlaces: async () => [],
  });
  const view = await renderResults({ browseMode: "dishes", initialQuery: "laksa" });
  await wait(400);
  assert.match(view.text(), /Too many searches/);
  assert.doesNotMatch(view.text(), /Check your connection/);
  const retry = view.findByText(/^Try again in \d+s$/);
  assert.ok(retry, "Retry shows the wait");
  const before = calls;
  await view.press(retry);
  await wait(50);
  assert.equal(calls, before, "Retry does nothing until the wait is over");
});

// ---- Search home

function fakeFlags(flags: Record<string, string>) {
  const state = { exposures: 0 };
  const source: ExperimentFlagSource = {
    peek: (key) => flags[key],
    expose: (key) => {
      state.exposures += 1;
      return flags[key];
    },
    hasLoaded: () => true,
    onChange: () => () => undefined,
  };
  return { state, source };
}

/** The experiment ships as a draft; tests run it as if it were live. */
function runExperiment() {
  const definition = EXPERIMENTS.search_home_featured_v1 as { status: string };
  const previous = definition.status;
  definition.status = "running";
  const previousRestore = restore;
  restore = () => {
    definition.status = previous;
    previousRestore?.();
  };
}

/** A real GPS fix, so the near arm is in play (SEARCH-V3); restored after the test. */
function withGps() {
  const previous = useLocationStore.getState();
  useLocationStore.setState({
    permission: "granted",
    currentLocation: { latitude: 1.2804, longitude: 103.8448 },
    manualCoordinate: undefined,
    manualLocation: undefined,
  });
  const previousRestore = restore;
  restore = () => {
    useLocationStore.setState({
      permission: previous.permission,
      currentLocation: previous.currentLocation,
      manualCoordinate: previous.manualCoordinate,
      manualLocation: previous.manualLocation,
    });
    previousRestore?.();
  };
}

async function renderHome() {
  const view = await renderScreen(DishSearchScreen as never, { name: "DishSearch" });
  await wait(50);
  await view.settle();
  return view;
}

test("Search home control: the island-wide top 3, no star for an unreviewed dish (SEARCH-7)", async () => {
  const requests: CatalogPageRequest[] = [];
  stubCatalog({
    suggest: async () => [],
    listDishes: async (request) => {
      requests.push(request);
      return page([dishCard("1"), dishCard("2", { rating: 0, reviewCount: 0 }), dishCard("3")]);
    },
  });
  runExperiment();
  withGps();
  const flags = fakeFlags({ search_home_featured_v1: "control" });
  setExperimentFlagSource(flags.source);
  const view = await renderHome();
  assert.match(view.text(), /Dishes to Discover/);
  assert.deepEqual(requests[0], { limit: 3, sort: "quality" });
  assert.equal((view.text().match(/★/g) ?? []).length, 2, "no ★ 0.0 for the unreviewed dish");
  assert.equal(flags.state.exposures, 1, "exposed once the section is on screen");
  await view.press(view.findByLabel("View Dish 1 from Stall 1"));
  const opened = getTrackedAnalyticsEvents().find(
    (event) => event.event === "search_home_featured_opened",
  );
  assert.deepEqual(opened?.properties, { position: 0, variant: "control" });
});

test("Search home near: the best dishes within 1.5 km, with distance", async () => {
  const requests: CatalogPageRequest[] = [];
  stubCatalog({
    suggest: async () => [],
    listDishes: async (request) => {
      requests.push(request);
      return page([1, 2, 3, 4].map((n) => dishCard(String(n), { distanceMeters: 300 * n })));
    },
  });
  runExperiment();
  withGps();
  const flags = fakeFlags({ search_home_featured_v1: "near" });
  setExperimentFlagSource(flags.source);
  const view = await renderHome();
  assert.equal(requests[0]?.radiusMeters, 1_500);
  assert.equal(requests[0]?.limit, 6);
  assert.ok(requests[0]?.coordinate);
  assert.match(view.text(), /Dish 4/);
  assert.match(view.text(), /1\.2 km/);
  assert.equal(flags.state.exposures, 1);
});

test("Search home near falls back to the island-wide list when little is nearby", async () => {
  const requests: CatalogPageRequest[] = [];
  stubCatalog({
    suggest: async () => [],
    listDishes: async (request) => {
      requests.push(request);
      return request.radiusMeters ? page([dishCard("near")]) : page([dishCard("a"), dishCard("b")]);
    },
  });
  runExperiment();
  withGps();
  setExperimentFlagSource(fakeFlags({ search_home_featured_v1: "near" }).source);
  const view = await renderHome();
  assert.equal(requests.length, 2);
  assert.match(view.text(), /Dish a/);
  assert.doesNotMatch(view.text(), /Dish near/);
});

test("Search home: nobody is exposed when the featured section never shows", async () => {
  stubCatalog({
    suggest: async () => [],
    listDishes: async () => page<CatalogRawDishCard>([]),
  });
  runExperiment();
  const flags = fakeFlags({ search_home_featured_v1: "near" });
  setExperimentFlagSource(flags.source);
  const view = await renderHome();
  assert.doesNotMatch(view.text(), /Dishes to Discover/);
  assert.equal(flags.state.exposures, 0);
});

test("Search home back button does not name a tab (SEARCH-X5)", async () => {
  stubCatalog({ suggest: async () => [], listDishes: async () => page<CatalogRawDishCard>([]) });
  const view = await renderHome();
  assert.ok(view.findByLabel("Go back"));
  assert.equal(view.findByLabel("Go back to Discover"), null);
});

test("Search home reports a failed load once (SEARCH-21)", async () => {
  const errors: unknown[] = [];
  const original = console.error;
  const globals = globalThis as { __DEV__?: boolean };
  const previousDev = globals.__DEV__;
  // reportError logs to the console in development; that is what this test reads.
  globals.__DEV__ = true;
  console.error = (...args: unknown[]) => {
    if (args[0] === "[reportError]") errors.push(args[1]);
  };
  try {
    stubCatalog({
      suggest: async () => {
        throw new Error("suggest down");
      },
      listDishes: async () => {
        throw new Error("featured down");
      },
    });
    const view = await renderHome();
    assert.doesNotMatch(view.text(), /Dishes to Discover/);
    assert.deepEqual(errors.map((error) => (error as Error).message).sort(), [
      "featured down",
      "suggest down",
    ]);
  } finally {
    console.error = original;
    globals.__DEV__ = previousDev;
  }
});

test("SEARCH-V2: Search home waits for flags, so a late load never exposes an arm nobody saw", async () => {
  const requests: CatalogPageRequest[] = [];
  let resolveNear: () => void = () => undefined;
  stubCatalog({
    suggest: async () => [],
    listDishes: (request) => {
      requests.push(request);
      if (!request.radiusMeters) return Promise.resolve(page([dishCard("island")]));
      return new Promise((resolve) => {
        resolveNear = () => resolve(page([1, 2, 3].map((n) => dishCard(`near-${n}`))));
      });
    },
  });
  runExperiment();
  withGps();
  let loaded = false;
  let exposures = 0;
  const listeners: (() => void)[] = [];
  setExperimentFlagSource({
    peek: () => (loaded ? "near" : undefined),
    expose: () => {
      exposures += 1;
      return loaded ? "near" : undefined;
    },
    hasLoaded: () => loaded,
    onChange: (listener) => {
      listeners.push(listener);
      return () => undefined;
    },
  });
  const view = await renderHome();
  assert.equal(requests.length, 0, "no island-wide list is fetched before flags load");
  await act(async () => {
    loaded = true;
    for (const listener of listeners) listener();
  });
  await view.settle();
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.radiusMeters, 1_500, "the first list fetched is the user's arm");
  // The diner starts typing before the near list arrives: the section never showed.
  await view.type(view.findByLabel("Search dishes, stalls, or hawker centres"), "laksa");
  await act(async () => resolveNear());
  await view.settle();
  assert.equal(exposures, 0);
});

test("SEARCH-V2: when flags never load, the island-wide list shows after a short wait, unexposed", async () => {
  stubCatalog({
    suggest: async () => [],
    listDishes: async () => page([dishCard("1"), dishCard("2"), dishCard("3")]),
  });
  runExperiment();
  withGps();
  let exposures = 0;
  setExperimentFlagSource({
    peek: () => undefined,
    expose: () => {
      exposures += 1;
      return undefined;
    },
    hasLoaded: () => false,
    onChange: () => () => undefined,
  });
  const view = await renderHome();
  assert.doesNotMatch(view.text(), /Dishes to Discover/);
  await wait(1_600);
  await view.settle();
  assert.match(view.text(), /Dishes to Discover/);
  assert.equal(exposures, 0);
});

test("SEARCH-V3: without a GPS fix or a picked area the near arm is not served or exposed", async () => {
  const requests: CatalogPageRequest[] = [];
  stubCatalog({
    suggest: async () => [],
    listDishes: async (request) => {
      requests.push(request);
      return page([dishCard("1"), dishCard("2"), dishCard("3")]);
    },
  });
  runExperiment();
  useLocationStore.setState({
    permission: "denied",
    manualCoordinate: undefined,
    manualLocation: undefined,
  });
  const flags = fakeFlags({ search_home_featured_v1: "near" });
  setExperimentFlagSource(flags.source);
  const view = await renderHome();
  assert.match(view.text(), /Dishes to Discover/);
  assert.ok(
    requests.every((request) => !request.radiusMeters),
    "no radius request",
  );
  assert.deepEqual(requests[0], { limit: 3, sort: "quality" });
  assert.equal(flags.state.exposures, 0);
});

/** Calls the grid's onEndReached (the jsdom FlashList stub never scrolls). */
async function reachEnd(view: RenderResult) {
  const node = view.container.querySelector('[data-stub="FlashList"]') as unknown as Record<
    string,
    unknown
  >;
  assert.ok(node, "the grid renders");
  const fiberKey = Object.keys(node).find((key) => key.startsWith("__reactFiber$"));
  let fiber = fiberKey
    ? (node[fiberKey] as { memoizedProps?: Record<string, unknown>; return?: unknown })
    : undefined;
  while (fiber && typeof fiber.memoizedProps?.onEndReached !== "function") {
    fiber = fiber.return as typeof fiber;
  }
  const onEndReached = fiber?.memoizedProps?.onEndReached as (() => void) | undefined;
  assert.ok(onEndReached, "the grid pages on reaching the end");
  await act(async () => onEndReached());
  await view.settle();
}

test("SEARCH-20: an expired release mid-scroll reloads page 1 on the active release", async () => {
  const requests: CatalogPageRequest[] = [];
  stubCatalog({
    listDishes: async (request) => {
      requests.push({ ...request });
      if (requests.length === 1) {
        return { ...page([dishCard("old")]), releaseId: "release-old", nextCursor: "c1" };
      }
      if (request.cursor) throw new CatalogReleaseExpiredError();
      return { ...page([dishCard("fresh")]), releaseId: "release-new" };
    },
  });
  const view = await renderResults({ browseMode: "dishes" });
  assert.match(view.text(), /Dish old/);
  await reachEnd(view);
  assert.equal(requests[1]?.cursor, "c1");
  assert.equal(requests[1]?.releaseId, "release-old");
  assert.equal(requests[2]?.cursor, undefined, "page 1 again");
  assert.equal(requests[2]?.releaseId, undefined, "not pinned to the expired release");
  assert.match(view.text(), /Dish fresh/);
  assert.doesNotMatch(view.text(), /Dish old/);
  assert.equal(view.findByText(/Couldn't load more|Retry/), null);
});

test("SEARCH-19: Search all Singapore applies only to the scope it was tapped for", async () => {
  const requests: { mode: string; request: CatalogPageRequest }[] = [];
  stubCatalog({
    listDishes: async (request) => {
      requests.push({ mode: "dishes", request });
      return page<CatalogRawDishCard>([]);
    },
    listVenues: async (request) => {
      requests.push({ mode: "stalls", request });
      return page<CatalogRawVenueCard>([]);
    },
    listPlaces: async () => [],
  });
  const view = await renderResults({ browseMode: "dishes" });
  await view.press(view.findByText("Search all Singapore"));
  await wait(100);
  await view.settle();
  assert.equal(requests.at(-1)?.request.radiusMeters, 30_000, "widened for this browse");
  const stallsTab = Array.from(view.container.querySelectorAll('[role="tab"]')).find(
    (tab) => tab.textContent === "Stalls",
  ) as HTMLElement;
  await view.press(stallsTab);
  await wait(100);
  await view.settle();
  await wait(100);
  const last = requests.at(-1);
  assert.equal(last?.mode, "stalls");
  assert.notEqual(last?.request.radiusMeters, 30_000, "a new scope starts at the normal radius");
  assert.ok(view.findByText("Search all Singapore"), "and offers to widen again");
});

test("SEARCH-9: a typed query that settles sends one search_query; quick typing sends none", async () => {
  stubCatalog({
    listDishes: async () => page([dishCard("1")]),
    suggest: async () => [],
  });
  const view = await renderResults({ browseMode: "dishes", initialQuery: "mee" });
  // act() flushes renders when it ends: one short wait lands the debounced load, the next
  // covers the 1.5 s settle timer that load arms.
  const settleTyping = async () => {
    await wait(400);
    await wait(1_800);
  };
  // Looked up each time: the field can re-mount as the screen state changes.
  const input = () => view.findByTestId("browse-results-search-input");
  await view.type(input(), "me");
  await wait(300);
  await view.type(input(), "");
  await settleTyping();
  const typed = () =>
    getTrackedAnalyticsEvents().filter(
      (event) => event.event === "search_query" && event.properties.source === "results_typed",
    );
  assert.equal(typed().length, 0, "text cleared before it settled is not a search");

  await view.type(input(), "lak");
  await wait(300);
  await view.type(input(), "laksa");
  await settleTyping();
  assert.equal(typed().length, 1);
  assert.equal(typed()[0].properties.query_length, 5);
  await settleTyping();
  assert.equal(typed().length, 1, "staying on the results does not log it again");
});
