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
import { getCatalogRawService } from "@/lib/services/serviceProvider";
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
