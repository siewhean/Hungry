// Search home and the results grid, rendered against a stubbed catalog service.
// Run with `node scripts/test-render.mjs src/app/screens/search/search.render.test.tsx`.

import assert from "node:assert/strict";
import { act, createElement, useState } from "react";
import { NavigationRouteContext } from "@react-navigation/native";
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
import { useProfileStore } from "@/store/useProfileStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, render, renderScreen, type RenderResult } from "@/test/render";
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

/** Sets the jsdom window width and tells react-native-web, so useWindowDimensions follows. */
function resizeWindow(width: number) {
  window.innerWidth = width;
  window.dispatchEvent(new (window as unknown as { Event: typeof Event }).Event("resize"));
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

test("a card photo that fails to load shows the stall's initials instead (SR4-11)", async () => {
  stubCatalog({
    listDishes: async () =>
      page([
        dishCard("p1", { imageUrl: "https://example.com/broken.jpg", venueName: "Photo Stall" }),
      ]),
    listPlaces: async () => [],
  });
  const view = await renderResults({ browseMode: "dishes" });
  await wait(400);
  const image = document.querySelector('[data-stub="expo-image.Image"]') as
    | (HTMLElement & { __triggerError?: () => void })
    | null;
  assert.ok(image?.__triggerError, "the card draws its photo");
  assert.equal(view.findByLabel("Photo Stall stall logo unavailable"), null);
  await act(async () => {
    image.__triggerError?.();
  });
  assert.ok(view.findByLabel("Photo Stall stall logo unavailable"), "initials replace the photo");
  assert.equal(document.querySelector('[data-stub="expo-image.Image"]'), null);
});

test("the results header is one search row; modes, chips and the count scroll with the list (SR4-6)", async () => {
  stubCatalog({ listDishes: async () => page([dishCard("1")]), listPlaces: async () => [] });
  const view = await renderResults({ browseMode: "dishes", initialFilter: "Halal" });
  await wait(400);
  const row = view.findByTestId("search-sticky-row");
  assert.ok(row, "the sticky search row");
  assert.ok(row.contains(view.findByTestId("browse-results-search-input")));
  assert.ok(row.contains(view.findByLabel("Go back")));
  const filters = view.findByLabel("Filters and sort, 1 on");
  assert.ok(filters && row.contains(filters), "Filters sits in the search row with a count badge");
  assert.equal(view.findByTestId("search-filters-badge")?.textContent, "1");
  // The mode tabs, the selected chip and the count are in the list header, not the sticky row.
  const tabs = Array.from(view.container.querySelectorAll('[role="tab"]'));
  assert.equal(tabs.length, 2);
  assert.ok(tabs.every((tab) => !row.contains(tab)));
  const selected = view.findByLabel("Remove Halal filter");
  assert.ok(selected && !row.contains(selected));
  assert.ok(!row.contains(view.findByLabel(/^Sort by,/)));

  // A chip picked in the sheet counts on the badge; removing a selected chip counts it down.
  await view.press(view.findByText("Rice"));
  assert.ok(view.findByLabel("Filters and sort, 2 on"));
  await view.press(view.findByLabel("Remove Halal filter"));
  assert.ok(view.findByLabel("Filters and sort, 1 on"));
  assert.equal(view.findByLabel("Remove Halal filter"), null);
});

test("the Filters sheet offers the release's common food types and sends them as keywords (SR4-24)", async () => {
  const requests: CatalogPageRequest[] = [];
  stubCatalog({
    listDishes: async (request: CatalogPageRequest) => {
      requests.push(request);
      return page([dishCard("1")]);
    },
    listPlaces: async () => [],
    suggest: async () => [
      { kind: "food_type", label: "Laksa" },
      { kind: "food_type", label: "Chicken Rice" },
      { kind: "stall", label: "Some Stall" },
    ],
  });
  const view = await renderResults({ browseMode: "dishes" });
  await wait(400);
  assert.ok(view.findByText("Food type"));
  assert.equal(view.findByText("Some Stall"), null, "only food types become chips");
  assert.equal(view.findByText("Japanese"), null, "the fixed cuisine chips are gone");
  await view.press(view.findByText("Laksa"));
  await wait(400);
  assert.ok(view.findByLabel("Filters and sort, 1 on"));
  assert.ok(view.findByLabel("Remove Laksa filter"));
  assert.ok(requests.at(-1)?.foodKeywords?.includes("Laksa"));
  assert.ok(
    getTrackedAnalyticsEvents().some(
      (event) => event.event === "search_filter_changed" && event.properties.filter === "Laksa",
    ),
  );
  await view.press(view.findByLabel("Remove Laksa filter"));
  await wait(400);
  assert.equal(view.findByLabel("Remove Laksa filter"), null);
  assert.deepEqual(requests.at(-1)?.foodKeywords, []);
});

test("no filters on: Filters has no badge and the summary echoes the query (SR4-6, SR4-25)", async () => {
  stubCatalog({ listDishes: async () => page([dishCard("1")]), listPlaces: async () => [] });
  const view = await renderResults({ browseMode: "dishes", initialQuery: "laksa" });
  await wait(400);
  const filters = view.findByLabel("Filters and sort");
  assert.ok(filters);
  assert.equal(view.findByTestId("search-filters-badge"), null);
  assert.match(view.text(), /1 dish for “laksa”/);
});

test("the notes sit on one dismissible line with the rest behind +N more (SR4-6)", async () => {
  stubCatalog({
    listDishes: async () => ({ ...page([dishCard("1")]), releaseId: "excel-fallback-v1" }),
    listPlaces: async () => [],
  });
  const view = await renderResults({ browseMode: "dishes", initialFilter: "Halal" });
  await wait(400);
  // Offline copy first, then location, then the halal tags.
  assert.ok(view.findByTestId("search-offline-copy"));
  assert.doesNotMatch(view.text(), /MUIS/);
  assert.doesNotMatch(view.text(), /central Singapore/);
  await view.press(view.findByText("+2 more"));
  assert.match(view.text(), /MUIS/);
  assert.match(view.text(), /central Singapore/);
  assert.ok(view.findByLabel(/Turn on location$/));
  await view.press(view.findByLabel("Show fewer notes"));
  assert.doesNotMatch(view.text(), /MUIS/);
  await view.press(view.findByLabel("Dismiss notes"));
  assert.equal(view.findByTestId("search-offline-copy"), null);
  assert.equal(view.findByLabel("Notes about these results"), null);
});

test("the too-short hint is a live region (SR4-29)", async () => {
  stubCatalog({ listDishes: async () => page([dishCard("1")]), listPlaces: async () => [] });
  const view = await renderResults({ browseMode: "dishes" });
  await view.type(view.findByTestId("browse-results-search-input"), "l");
  await wait(50);
  const hint = view.findByText(/Type at least 2 letters/);
  assert.ok(hint);
  assert.equal(hint.closest("[aria-live]")?.getAttribute("aria-live"), "polite");
});

for (const [width, cardWidth] of [
  [320, "148px"],
  [390, "183px"],
] as const) {
  test(`at ${width} wide the cards share the width between the 12pt list gutters and the search row keeps Filters (SR4-6)`, async () => {
    resizeWindow(width);
    try {
      stubCatalog({ listDishes: async () => page([dishCard("1")]), listPlaces: async () => [] });
      const view = await renderResults({ browseMode: "dishes" });
      await wait(400);
      const card = view.findByLabel(/^Dish 1,/);
      assert.ok(card, "a card");
      assert.equal(card.parentElement?.style.width, cardWidth);
      const row = view.findByTestId("search-sticky-row");
      assert.ok(row?.contains(view.findByLabel(/^Filters and sort/)));
    } finally {
      resizeWindow(390);
    }
  });
}

test("a heart on a dish card saves it without opening it, and tapping again removes it (SR4-17)", async () => {
  stubCatalog({ listDishes: async () => page([dishCard("1")]), listPlaces: async () => [] });
  const view = await renderResults({ browseMode: "dishes" });
  await wait(400);
  const heart = view.findByLabel("Save Dish 1");
  assert.ok(heart, "a heart on the card");
  const openCard = view.findByLabel(/^Dish 1,/);
  assert.ok(
    openCard && !openCard.contains(heart),
    "the heart is beside the card button, not inside it",
  );
  const calls = view.navigation.calls.length;
  await view.press(heart);
  await wait(200);
  assert.equal(view.navigation.calls.length, calls, "the card did not open");
  assert.ok(view.findByLabel("Remove Dish 1 from saved"));
  assert.ok(useProfileStore.getState().profile.favouriteDishIds.includes("1"));
  assert.ok(
    getTrackedAnalyticsEvents().some(
      (event) => event.event === "dish_favourited" && event.properties.surface === "search",
    ),
  );
  await view.press(view.findByLabel("Remove Dish 1 from saved"));
  await wait(200);
  assert.ok(view.findByLabel("Save Dish 1"));
  assert.equal(useProfileStore.getState().profile.favouriteDishIds.includes("1"), false);
});

test("stall cards have no heart (SR4-17)", async () => {
  stubCatalog({ listVenues: async () => page([stallCard("v1")]), listPlaces: async () => [] });
  const view = await renderResults({ browseMode: "stalls" });
  await wait(400);
  assert.equal(view.findByLabel(/^Save /), null);
});

test("a search that arrives on an open results screen is recorded too (SR4-30)", async () => {
  stubCatalog({ listDishes: async () => page([dishCard("1")]), listPlaces: async () => [] });
  function RouteHarness() {
    const [query, setQuery] = useState("laksa");
    return createElement(
      "div",
      null,
      createElement("button", { onClick: () => setQuery("mee pok"), "aria-label": "New search" }),
      createElement(
        NavigationRouteContext.Provider,
        {
          value: {
            key: "r2",
            name: "SearchResults",
            params: { browseMode: "dishes", initialQuery: query },
          } as never,
        },
        createElement(SearchResultsScreen),
      ),
    );
  }
  const view = await render(createElement(RouteHarness));
  await wait(300);
  await view.press(view.findByLabel("New search"));
  await wait(300);
  const lengths = getTrackedAnalyticsEvents()
    .filter((event) => event.event === "search_query")
    .map((event) => event.properties.query_length);
  assert.deepEqual(lengths, ["laksa".length, "mee pok".length]);
});

test("a GPS refresh keeps the list; Update for new location reloads it (SR4-26)", async () => {
  const requests: CatalogPageRequest[] = [];
  stubCatalog({
    listDishes: async (request: CatalogPageRequest) => {
      requests.push(request);
      return page([dishCard("1")]);
    },
    listPlaces: async () => [],
  });
  withGps();
  const view = await renderResults({ browseMode: "dishes" });
  await wait(400);
  const loads = requests.length;
  assert.equal(requests.at(-1)?.coordinate?.latitude, 1.28);
  assert.equal(view.findByLabel("Update for new location"), null);

  await act(async () => {
    useLocationStore.setState({ currentLocation: { latitude: 1.31, longitude: 103.87 } });
  });
  await wait(400);
  assert.equal(requests.length, loads, "walking does not reload the list");
  assert.ok(view.findByLabel("Update for new location"));

  await view.press(view.findByLabel("Update for new location"));
  await wait(400);
  assert.equal(requests.at(-1)?.coordinate?.latitude, 1.31);
  assert.equal(view.findByLabel("Update for new location"), null);
});

test("a new search starts from where the diner is now (SR4-26)", async () => {
  const requests: CatalogPageRequest[] = [];
  stubCatalog({
    listDishes: async (request: CatalogPageRequest) => {
      requests.push(request);
      return page([dishCard("1")]);
    },
    listPlaces: async () => [],
  });
  withGps();
  const view = await renderResults({ browseMode: "dishes" });
  await wait(400);
  await act(async () => {
    useLocationStore.setState({ currentLocation: { latitude: 1.31, longitude: 103.87 } });
  });
  await view.type(view.findByTestId("browse-results-search-input"), "laksa");
  await wait(600);
  assert.equal(requests.at(-1)?.query, "laksa");
  assert.equal(requests.at(-1)?.coordinate?.latitude, 1.31);
  assert.equal(view.findByLabel("Update for new location"), null);
});

test("a card with no rating keeps the rating line's height, so a row of cards lines up (SR4-19)", async () => {
  stubCatalog({
    listDishes: async () =>
      page([dishCard("1"), dishCard("2", { rating: undefined, reviewCount: 0 })]),
    listPlaces: async () => [],
  });
  const view = await renderResults({ browseMode: "dishes" });
  await wait(400);
  for (const label of [/^Dish 1,/, /^Dish 2,/]) {
    const card = view.findByLabel(label);
    assert.ok(card, `${label}`);
    const reserved = Array.from(card.querySelectorAll<HTMLElement>("div")).filter(
      (el) => el.style.minHeight === "16px",
    );
    assert.equal(reserved.length, 1, `${label} reserves one rating line`);
  }
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

async function typeHome(view: RenderResult, text: string) {
  await view.type(view.findByLabel("Search dishes, stalls, or hawker centres"), text);
}

test("Search home types ahead: Search “xyz” first, then the top dishes and stalls (SR4-13)", async () => {
  const requests: { kind: string; request: CatalogPageRequest }[] = [];
  stubCatalog({
    suggest: async () => [{ kind: "food_type", label: "Laksa" }],
    listDishes: async (request: CatalogPageRequest) => {
      if (request.query) requests.push({ kind: "dishes", request });
      return page([dishCard("1", { name: "Curry Laksa", venueName: "Laksa House", price: 5.5 })]);
    },
    listVenues: async (request: CatalogPageRequest) => {
      requests.push({ kind: "stalls", request });
      return page([stallCard("v1", { name: "Laksa House", buildingName: "Maxwell Food Centre" })]);
    },
  });
  const view = await renderHome();
  await typeHome(view, "laksa");
  assert.ok(view.findByLabel("Finding matches"), "a skeleton while the matches load");
  await wait(700);
  assert.equal(view.findByLabel("Finding matches"), null);
  assert.deepEqual(
    requests.map((entry) => [entry.kind, entry.request.query, entry.request.limit]),
    [
      ["dishes", "laksa", 3],
      ["stalls", "laksa", 2],
    ],
  );
  // "Search “laksa”" is the first row of the panel.
  const panel = view.findByLabel("Search suggestions");
  assert.ok(panel);
  assert.equal(panel.querySelector("button")?.getAttribute("aria-label"), "Search for laksa");
  assert.match(view.text(), /Curry Laksa/);
  assert.match(view.text(), /Laksa House · S\$5\.50/);
  assert.match(view.text(), /Maxwell Food Centre/);

  await view.press(view.findByLabel("Open Curry Laksa from Laksa House"));
  assert.deepEqual(view.navigation.calls.at(-1), {
    method: "navigate",
    args: [
      "DishDetail",
      { dishId: "1", source: "search_typeahead", catalogFallback: { releaseId: "release-1" } },
    ],
  });
  await view.press(view.findByLabel("Open Laksa House at Maxwell Food Centre"));
  assert.deepEqual(view.navigation.calls.at(-1), {
    method: "navigate",
    args: ["StallDetail", { venueId: "v1" }],
  });
  const opened = getTrackedAnalyticsEvents().filter(
    (event) => event.event === "search_typeahead_opened",
  );
  assert.deepEqual(
    opened.map((event) => event.properties.kind),
    ["dish", "stall"],
  );

  await view.press(view.findByLabel("Search for laksa"));
  const call = view.navigation.calls.at(-1);
  assert.equal(call?.args[0], "SearchResults");
  assert.equal((call?.args[1] as { initialQuery?: string }).initialQuery, "laksa");
});

test("Search home typeahead: nothing found says so and the search row stays (SR4-13)", async () => {
  stubCatalog({
    suggest: async () => [],
    listDishes: async () => page<CatalogRawDishCard>([]),
    listVenues: async () => page<CatalogRawVenueCard>([]),
  });
  const view = await renderHome();
  await typeHome(view, "zzzzq");
  await wait(700);
  assert.match(view.text(), /No matches for “zzzzq”/);
  assert.ok(view.findByLabel("Search for zzzzq"), "the search row is still there");
});

test("Search home typeahead: a failed load says so, is reported once, and keeps the search row (SR4-13)", async () => {
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
      suggest: async () => [],
      listDishes: async (request: CatalogPageRequest) => {
        if (request.query) throw new Error("matches down");
        return page<CatalogRawDishCard>([]);
      },
      listVenues: async () => page<CatalogRawVenueCard>([]),
    });
    const view = await renderHome();
    await typeHome(view, "laksa");
    await wait(700);
    assert.match(view.text(), /Couldn't load matches/);
    assert.ok(view.findByLabel("Search for laksa"));
    assert.equal(view.findByLabel("Finding matches"), null);
    assert.deepEqual(
      errors.map((error) => (error as Error).message),
      ["matches down"],
    );
  } finally {
    console.error = original;
    globals.__DEV__ = previousDev;
  }
});

test("Search home: one Near me entry, a Halal chip without a check mark, 44 pt recents (SR4-20, SR4-22)", async () => {
  useSearchStore.setState({ recentSearches: ["laksa"] });
  stubCatalog({ suggest: async () => [], listDishes: async () => page<CatalogRawDishCard>([]) });
  const view = await renderHome();
  assert.ok(view.findByLabel("Search near me dishes"));
  assert.equal(view.findByText("Browse dishes near you"), null);
  assert.doesNotMatch(view.findByLabel("Search halal dishes")?.textContent ?? "", /✓/);
  const remove = view.findByLabel("Remove laksa from recent searches");
  assert.equal(remove?.style.width, "44px");
  assert.equal(remove?.style.height, "44px");
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

test("Search home says when it is showing the saved copy of the catalog (SR4-31)", async () => {
  stubCatalog({
    suggest: async () => [],
    listDishes: async () => ({ ...page([dishCard("1")]), releaseId: "excel-fallback-v1" }),
  });
  const view = await renderHome();
  assert.ok(view.findByTestId("search-home-offline-copy"));
});

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
