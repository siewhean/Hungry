import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  CatalogAuthenticationRequiredError,
  CatalogContractError,
  CatalogNetworkError,
  CatalogUnavailableError,
  type CatalogPage,
  type CatalogRawDishDetail,
  type catalogRawService,
} from "@/lib/services/catalog";
import { excelCatalogFallbackService } from "@/lib/services/catalog/excelFallback";
import { loadCatalogFavourites } from "@/lib/services/catalog/favourites";
import { appendUniqueById, settleWithConcurrency } from "@/lib/services/catalog/paging";
import {
  CatalogPaginationError,
  createResilientCatalogReadService,
} from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";

type CatalogReadService = typeof catalogRawService;

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function page<T>(items: T[], releaseId: string, nextCursor?: string): CatalogPage<T> {
  return { items, nextCursor, releaseId, totals: { venues: 0, dishes: items.length } };
}

function fakeService(overrides: Partial<CatalogReadService>, calls: string[], label: string) {
  const unexpected = (name: string) => async () => {
    calls.push(`${label}.${name}`);
    throw new Error(`${label}.${name} not stubbed`);
  };
  return {
    clearCache() {},
    listDishes: unexpected("listDishes"),
    listVenues: unexpected("listVenues"),
    getDish: unexpected("getDish"),
    getVenue: unexpected("getVenue"),
    listVenueMenu: unexpected("listVenueMenu"),
    getMapViewport: unexpected("getMapViewport"),
    ...overrides,
  } as unknown as CatalogReadService;
}

async function withSignedInSession(run: () => Promise<void>) {
  const previous = useSessionStore.getState();
  try {
    useSessionStore.setState({
      isAuthReady: true,
      isAuthenticated: true,
      authenticatedUserId: "00000000-0000-4000-8000-000000000001",
      authDataSource: "supabase",
    });
    await run();
  } finally {
    useSessionStore.setState(previous);
  }
}

test("a failed live continuation page never falls back to Excel or restarts the list", async () => {
  await withSignedInSession(async () => {
    const calls: string[] = [];
    const primary = fakeService(
      {
        async listDishes(request) {
          calls.push(`primary.listDishes:${request.cursor ?? "first"}`);
          throw new CatalogNetworkError("network request failed");
        },
      },
      calls,
      "primary",
    );
    const fallback = fakeService(
      {
        async listDishes() {
          calls.push("fallback.listDishes");
          return page([{ id: "excel-1" }] as never[], "excel-fallback-v1");
        },
      },
      calls,
      "fallback",
    );
    const service = createResilientCatalogReadService(primary, fallback);

    await assert.rejects(
      service.listDishes({ cursor: "live-cursor-2", releaseId: "release-uuid" }),
      (error: unknown) =>
        error instanceof CatalogPaginationError && error instanceof CatalogUnavailableError,
    );
    assert.deepEqual(calls, ["primary.listDishes:live-cursor-2"]);

    // First page keeps the classified, authenticated Excel fallback.
    calls.length = 0;
    const first = await service.listDishes({});
    assert.equal(first.releaseId, "excel-fallback-v1");
    assert.deepEqual(calls, ["primary.listDishes:first", "fallback.listDishes"]);
  });
});

test("Excel cursors and releases stay on Excel; non-transient live failures propagate", async () => {
  await withSignedInSession(async () => {
    const calls: string[] = [];
    const primary = fakeService(
      {
        async listVenues() {
          calls.push("primary.listVenues");
          throw new CatalogContractError();
        },
        async listVenueMenu() {
          calls.push("primary.listVenueMenu");
          return page([], "release-uuid");
        },
      },
      calls,
      "primary",
    );
    const fallback = fakeService(
      {
        async listVenues() {
          calls.push("fallback.listVenues");
          return page([], "excel-fallback-v1");
        },
        async listVenueMenu() {
          calls.push("fallback.listVenueMenu");
          return page([], "excel-fallback-v1");
        },
      },
      calls,
      "fallback",
    );
    const service = createResilientCatalogReadService(primary, fallback);

    await service.listVenues({ cursor: "excel:24" });
    await service.listVenueMenu("venue-1", { cursor: "excel:24" });
    assert.deepEqual(calls, ["fallback.listVenues", "fallback.listVenueMenu"]);

    calls.length = 0;
    await assert.rejects(
      service.listVenues({ cursor: "live-cursor", releaseId: "release-uuid" }),
      (error: unknown) => error instanceof CatalogContractError,
    );
    assert.deepEqual(calls, ["primary.listVenues"]);
  });
});

test("a live continuation cursor still requires an authenticated session", async () => {
  const previous = useSessionStore.getState();
  try {
    useSessionStore.setState({ isAuthenticated: false, authenticatedUserId: null });
    const calls: string[] = [];
    const service = createResilientCatalogReadService(
      fakeService({}, calls, "primary"),
      fakeService({}, calls, "fallback"),
    );
    await assert.rejects(
      service.listDishes({ cursor: "live-cursor" }),
      (error: unknown) => error instanceof CatalogAuthenticationRequiredError,
    );
    assert.deepEqual(calls, []);
  } finally {
    useSessionStore.setState(previous);
  }
});

test("the Excel adapter rejects a live cursor instead of treating it as offset 0", async () => {
  await assert.rejects(
    excelCatalogFallbackService.listDishes({ cursor: "eyJvZmZzZXQiOjI0fQ", limit: 12 }),
    (error: unknown) => error instanceof CatalogContractError,
  );
  await assert.rejects(
    excelCatalogFallbackService.listVenues({ cursor: "excel:-3", limit: 12 }),
    (error: unknown) => error instanceof CatalogContractError,
  );
  const second = await excelCatalogFallbackService.listDishes({ cursor: "excel:12", limit: 12 });
  assert.equal(second.releaseId, "excel-fallback-v1");
});

test("appendUniqueById keeps list keys unique across pages", () => {
  const current = [{ id: "a" }, { id: "b" }];
  const merged = appendUniqueById(current, [{ id: "b" }, { id: "c" }, { id: "c" }]);
  assert.deepEqual(
    merged.map((item) => item.id),
    ["a", "b", "c"],
  );
  assert.equal(appendUniqueById(current, [{ id: "a" }]), current);
});

test("settleWithConcurrency caps in-flight work and preserves order", async () => {
  let inFlight = 0;
  let peak = 0;
  const results = await settleWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (value) => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((resolveTimer) => setTimeout(resolveTimer, 2));
    inFlight -= 1;
    if (value === 4) throw new Error("boom");
    return value * 10;
  });
  assert.ok(peak <= 3, `peak concurrency ${peak} exceeded the cap`);
  assert.deepEqual(
    results.map((result) => (result.status === "fulfilled" ? result.value : "rejected")),
    [10, 20, 30, "rejected", 50, 60, 70],
  );
});

test("favourites report a failed saved-id read as a retryable error, not an empty list", async () => {
  const failedIds = await loadCatalogFavourites({
    getFavouriteDishIds: async () => {
      throw new Error("network request failed");
    },
    getDish: async () => {
      throw new Error("not called");
    },
  });
  assert.equal(failedIds.status, "error");

  const empty = await loadCatalogFavourites({
    getFavouriteDishIds: async () => [],
    getDish: async () => {
      throw new Error("not called");
    },
  });
  assert.deepEqual(empty, { status: "loaded", dishes: [], unavailableCount: 0 });

  const outage = await loadCatalogFavourites({
    getFavouriteDishIds: async () => ["d1", "d2"],
    getDish: async () => {
      throw new CatalogNetworkError();
    },
  });
  assert.equal(outage.status, "error");

  const partial = await loadCatalogFavourites({
    getFavouriteDishIds: async () => ["d1", "d2", "d1"],
    getDish: async (id) => {
      if (id === "d2") throw new Error("Dish not found in the bundled Excel catalog.");
      return { id } as CatalogRawDishDetail;
    },
  });
  assert.equal(partial.status, "loaded");
  if (partial.status === "loaded") {
    assert.deepEqual(
      partial.dishes.map((dish) => dish.id),
      ["d1"],
    );
    assert.equal(partial.unavailableCount, 1);
  }
});

test("catalog detail pushes nested records and never dead-ends", () => {
  const detail = read("src/app/screens/catalog/CatalogRawDetailScreen.tsx");
  const dishDetail = read("src/app/screens/detail/DishDetailScreenV2.tsx");

  assert.doesNotMatch(detail, /navigation\.navigate\("CatalogRawDetail"/);
  assert.match(detail, /navigation\.push\("CatalogRawDetail", \{ kind, id, releaseId \}\)/);
  assert.match(detail, /openRecord\("dish", item\.id, menu\.releaseId\)/);
  assert.match(detail, /openRecord\(\s*"venue",\s*\(detail as CatalogRawDishDetail\)\.venueId/);
  assert.doesNotMatch(dishDetail, /navigation\.navigate\("DishDetail", \{ dishId: item\.id \}\)/);
  assert.match(dishDetail, /navigation\.push\("DishDetail", \{ dishId: item\.id \}\)/);

  // Loading and error states keep a back control; Back works without history.
  assert.equal((detail.match(/<DetailHeader onBack=\{goBackOrHome\} \/>/g) ?? []).length, 2);
  assert.match(detail, /navigation\.canGoBack\(\)[\s\S]*?navigation\.navigate\("MainTabs"/);
  assert.match(detail, /ctaLabel="Retry"/);

  // The venue menu pages through the catalog RPC instead of a dead-end notice.
  assert.doesNotMatch(detail, /More menu items are available/);
  assert.match(detail, /cursor: menu\.nextCursor/);
  assert.match(detail, /label=\{menuError \? "Retry" : "Show more dishes"\}/);
  assert.match(detail, /appendUniqueById\(current\.items, nextPage\.items\)/);
});

test("release tab redirects stay inert and never mount Discover", () => {
  const tabs = read("src/app/navigation/SwipeableTabNavigator.tsx");
  const redirect = tabs.slice(
    tabs.indexOf("function ReleaseLandingRedirect"),
    tabs.indexOf("function CustomTabBar"),
  );

  assert.doesNotMatch(redirect, /<DiscoverWrapper/);
  assert.match(redirect, /useFocusEffect\(/);
  assert.match(redirect, /return <TabScreenLoadingPlaceholder \/>/);
  assert.doesNotMatch(redirect, /useEffect\(/);
  assert.match(tabs, /<Tab\.Screen name="Discover" component=\{DiscoverWrapper\} \/>/);
});

test("browse grid keeps rows on a failed continuation and offers retry", () => {
  const grid = read("src/app/screens/search/SearchResultsScreen.tsx");

  assert.match(grid, /appendUniqueById\(current, page\.items\)/);
  assert.match(grid, /if \(append\) \{\s*setLoadMoreFailed\(true\);/);
  assert.match(grid, /Couldn.t load more\./);
  assert.match(grid, /onPress=\{\(\) => void loadPage\(nextCursor, true\)\}/);
});

test("favourites rows use sibling Open and Remove controls", () => {
  const favourites = read("src/app/screens/profile/FavouritesScreen.tsx");
  const legacy = favourites.slice(favourites.indexOf("Want to try ("));
  const openStart = legacy.indexOf("accessibilityLabel={`Open ${dish.name}");
  const openEnd = legacy.indexOf("</Pressable>", openStart);
  const removeAt = legacy.indexOf("accessibilityLabel={`Remove ${dish.name}");

  assert.ok(openStart > 0 && removeAt > 0);
  assert.ok(removeAt > openEnd, "Remove must not be nested inside the Open pressable");
  assert.match(favourites, /title="Couldn't load favourites"/);
  assert.match(favourites, /loadCatalogFavourites\(/);
});

test("Discover header hides the area count when no in-area venues are known", () => {
  const discover = read("src/app/screens/discover/DiscoverHomeScreen.tsx");
  assert.match(
    discover,
    /discoverAreaCountLabel !== "0" \? \([\s\S]{0,200}places to eat \$\{[\s\S]{0,160}\) : null/,
  );
});
