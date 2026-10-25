// The Home every Supabase build ships (CatalogDiscoverHome), rendered against a stubbed catalog
// service shaped like the catalog RPC pages. Run with `node scripts/test-render.mjs <file>`.
import assert from "node:assert/strict";
import { act, createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { CatalogDiscoverHome } from "@/app/screens/discover/CatalogDiscoverHome";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import {
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
import { CatalogNetworkError } from "@/lib/services/catalog";
import { getCatalogRawService } from "@/lib/services/serviceProvider";
import { useLifecycleStore } from "@/store/useLifecycleStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useStallFollowStore } from "@/store/useStallFollowStore";
import { cleanup, createFakeNavigation, render } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

/** The built-in Maxwell point the store uses before any fix or pick. */
const DEFAULT_LOCATION = { latitude: 1.2813, longitude: 103.8458 };
const safeArea = require("react-native-safe-area-context") as {
  useSafeAreaInsets: () => { top: number; bottom: number; left: number; right: number };
};
const originalInsets = safeArea.useSafeAreaInsets;
const flags = FEATURE_FLAGS as { catalogDiagnosticsEnabled: boolean };
const originalDiagnostics = flags.catalogDiagnosticsEnabled;

function dish(overrides: Partial<CatalogRawDishCard> = {}): CatalogRawDishCard {
  return {
    id: "dish-1",
    venueId: "venue-1",
    buildingId: "building-1",
    name: "Laksa",
    venueName: "Sungei Road Laksa",
    buildingName: "Jalan Berseh Food Centre",
    price: 4.5,
    distanceMeters: 1234,
    rating: 4.6,
    reviewCount: 12,
    cuisineTags: [],
    dietaryFlags: [],
    sectionTags: [],
    verificationStatus: "approved",
    menuRightsStatus: "merchant_owned",
    mediaRightsStatus: "merchant_owned",
    ...overrides,
  };
}

function venue(overrides: Partial<CatalogRawVenueCard> = {}): CatalogRawVenueCard {
  return {
    id: "venue-1",
    buildingId: "building-1",
    name: "Sungei Road Laksa",
    buildingName: "Jalan Berseh Food Centre",
    distanceMeters: 420,
    menuCount: 3,
    representativeDish: { id: "dish-1", name: "Laksa", price: 4.5, verificationStatus: "approved" },
    verificationStatus: "raw",
    menuRightsStatus: "merchant_owned",
    mediaRightsStatus: "merchant_owned",
    ...overrides,
  };
}

function page<T>(items: T[]): CatalogPage<T> {
  return { items, releaseId: "release-1", totals: { venues: 9000, dishes: 40000 } };
}

/** Swaps the catalog service's page reads; `fail` makes the next calls throw. */
function stubCatalog(
  options: { dishes?: CatalogRawDishCard[]; venues?: CatalogRawVenueCard[] } = {},
) {
  const service = getCatalogRawService() as unknown as {
    listDishes(request: CatalogPageRequest): Promise<CatalogPage<CatalogRawDishCard>>;
    listVenues(request: CatalogPageRequest): Promise<CatalogPage<CatalogRawVenueCard>>;
    clearCache(): void;
  };
  const state = {
    requests: [] as CatalogPageRequest[],
    cacheClears: 0,
    fail: null as Error | null,
  };
  service.listDishes = async (request) => {
    state.requests.push(request);
    if (state.fail) throw state.fail;
    return page(options.dishes ?? [dish()]);
  };
  service.listVenues = async () => {
    if (state.fail) throw state.fail;
    return page(options.venues ?? [venue()]);
  };
  service.clearCache = () => {
    state.cacheClears += 1;
  };
  return state;
}

function setLocation(state: Partial<ReturnType<typeof useLocationStore.getState>>) {
  useLocationStore.setState({
    permission: "denied",
    currentLocation: DEFAULT_LOCATION,
    manualCoordinate: undefined,
    manualLocation: undefined,
    manualPlaceName: undefined,
    ...state,
  });
}

beforeEach(async () => {
  await enterScenario("user");
  clearTrackedAnalyticsEvents();
  setLocation({});
  useLifecycleStore.setState({
    snapshot: null,
    welcomeBackDismissed: false,
    welcomeBackShown: false,
  });
});

afterEach(async () => {
  await cleanup();
  safeArea.useSafeAreaInsets = originalInsets;
  flags.catalogDiagnosticsEnabled = originalDiagnostics;
  setExperimentFlagSource(undefined);
  resetExperimentSession();
});

test("Home sits below the status bar in every state", async () => {
  safeArea.useSafeAreaInsets = () => ({ top: 47, bottom: 34, left: 0, right: 0 });
  stubCatalog();
  const view = await render(createElement(CatalogDiscoverHome));
  const root = view.findByTestId("catalog-discover-root");
  assert.ok(root, "the root view renders");
  assert.match(root!.getAttribute("style") ?? "", /padding-top: 47px/);
});

test("without a GPS fix or a pick it names an area, asks to choose one and hides made-up distances", async () => {
  stubCatalog();
  const view = await render(createElement(CatalogDiscoverHome));
  assert.match(view.text(), /You are at/);
  assert.match(view.text(), /Location is off\. Tap to choose your area\./);
  assert.doesNotMatch(view.text(), /\d+(\.\d)? ?(m|km) away|1\.2 km/);
  assert.match(view.text(), /Jalan Berseh Food Centre/);

  const navigation = view.navigation;
  await view.press(view.findByTestId("catalog-discover-area"));
  assert.deepEqual(navigation.calls.at(-1), {
    method: "navigate",
    args: ["OnboardingStack", { screen: "ManualLocationPicker" }],
  });
});

test("with a manual pick it names the area, formats km and offers current location", async () => {
  setLocation({
    manualLocation: "Tanjong Pagar",
    manualCoordinate: { latitude: 1.2764, longitude: 103.8458 },
  });
  stubCatalog();
  const view = await render(createElement(CatalogDiscoverHome));
  assert.match(view.text(), /You are atTanjong Pagar/);
  assert.match(view.text(), /1\.2 km/);
  assert.match(view.text(), /420 m away/);
  assert.match(view.text(), /★ 4\.6 \(12\)/);
  assert.ok(view.findByLabel("Use current location"));
});

test("diners see no catalog debug pill or data-quality badges", async () => {
  flags.catalogDiagnosticsEnabled = false;
  stubCatalog({ dishes: [dish({ verificationStatus: "raw" })] });
  const view = await render(createElement(CatalogDiscoverHome));
  assert.doesNotMatch(view.text(), /Live catalog|Unverified|Source verified/);
  assert.doesNotMatch(view.text(), /40,000 dishes/, "release-wide totals are not shown");
});

test("HOME-V1: a failed filter change shows the full error, not the previous filter's cards", async () => {
  const catalog = stubCatalog();
  const view = await render(createElement(CatalogDiscoverHome));
  assert.match(view.text(), /Laksa/);

  catalog.fail = new Error("PGRST301 JWT expired at row 4");
  await view.press(view.findByText("Japanese"));
  assert.doesNotMatch(view.text(), /Sungei Road Laksa/, "the All page is not shown under Japanese");
  assert.match(view.text(), /Couldn't load Home/);
  assert.doesNotMatch(view.text(), /PGRST301/, "the raw error is not shown");

  catalog.fail = null;
  const clears = catalog.cacheClears;
  await view.press(view.findByText("Retry"));
  assert.equal(catalog.cacheClears, clears + 1, "Retry bypasses the page cache");
  assert.match(view.text(), /Sungei Road Laksa/);
  assert.equal(view.findByTestId("catalog-discover-error-banner"), null);
});

/** Calls the Home ScrollView's pull-to-refresh handler (react-native-web cannot pull). */
async function pullToRefresh(view: Awaited<ReturnType<typeof render>>) {
  const node = view.findByTestId("catalog-discover-screen") as unknown as Record<string, unknown>;
  const fiberKey = Object.keys(node).find((key) => key.startsWith("__reactFiber$"));
  let fiber = fiberKey
    ? (node[fiberKey] as { memoizedProps?: Record<string, unknown>; return?: unknown })
    : undefined;
  while (fiber && !fiber.memoizedProps?.refreshControl) {
    fiber = fiber.return as typeof fiber;
  }
  const control = fiber?.memoizedProps?.refreshControl as
    | { props: { onRefresh(): void } }
    | undefined;
  assert.ok(control, "Home has a pull-to-refresh control");
  await act(async () => control.props.onRefresh());
  await view.settle();
}

test("HOME-V1: a failed refresh of the same request keeps the last good page under an inline banner", async () => {
  const catalog = stubCatalog();
  const view = await render(createElement(CatalogDiscoverHome));
  assert.match(view.text(), /Sungei Road Laksa/);
  catalog.fail = new Error("timeout");
  await pullToRefresh(view);
  assert.match(view.text(), /Sungei Road Laksa/, "the page for this same request stays");
  assert.ok(view.findByTestId("catalog-discover-error-banner"));
});

test("HOME-V1 + V2: while a new filter loads the old cards are hidden, and its impression has its own counts", async () => {
  stubCatalog();
  const service = getCatalogRawService() as unknown as {
    listDishes(request: CatalogPageRequest): Promise<CatalogPage<CatalogRawDishCard>>;
  };
  const view = await render(createElement(CatalogDiscoverHome));
  assert.match(view.text(), /Sungei Road Laksa/);

  let release: () => void = () => undefined;
  service.listDishes = () =>
    new Promise((resolve) => {
      release = () =>
        resolve(
          page([
            dish({ id: "dish-r", name: "Ramen", venueName: "Ramen Stall" }),
            dish({ id: "dish-s", name: "Sushi", venueName: "Sushi Stall" }),
          ]),
        );
    });
  await view.press(view.findByText("Japanese"));
  assert.ok(view.findByTestId("catalog-discover-skeleton"), "a loading state shows");
  assert.doesNotMatch(view.text(), /Sungei Road Laksa/, "no stale cards under the new chip");

  await act(async () => release());
  await view.settle();
  assert.match(view.text(), /Ramen/);
  const dishImpressions = getTrackedAnalyticsEvents().filter(
    (event) =>
      event.event === "discover_rail_impression" && event.properties?.rail === "nearby_dishes",
  );
  assert.deepEqual(
    dishImpressions.map((event) => event.properties?.count),
    [1, 2],
    "one impression per page, each with that page's own count",
  );
});

test("a first-load failure keeps the header and chips and shows plain copy", async () => {
  const catalog = stubCatalog();
  catalog.fail = new CatalogNetworkError("fetch failed: ECONNRESET");
  const view = await render(createElement(CatalogDiscoverHome));
  assert.match(view.text(), /Couldn't load Home/);
  assert.match(view.text(), /Check your connection/);
  assert.doesNotMatch(view.text(), /ECONNRESET/);
  assert.ok(view.findByLabel("Halal filter"), "chips stay usable");
  assert.ok(view.findByLabel("Search dishes and stalls"));
});

test("cards open the real dish and stall pages and are tracked", async () => {
  stubCatalog({
    dishes: [dish(), dish({ id: "dish-2", name: "Otah", verificationStatus: "raw" })],
  });
  const navigation = createFakeNavigation();
  const view = await render(createElement(CatalogDiscoverHome), { navigation });

  const laksa = view.findByLabel(/^Laksa, Sungei Road Laksa, S\$4\.50, rated 4\.6 from 12 reviews/);
  assert.ok(laksa, "the card label carries venue, price and rating");
  await view.press(laksa);
  assert.deepEqual(navigation.calls.at(-1)?.args, [
    "DishDetail",
    { dishId: "dish-1", source: "home", catalogFallback: { releaseId: "release-1" } },
  ]);

  // Unverified catalog dishes open the dish page too; it shows the catalog record if the dish
  // page can't load (see DishDetailScreenV2.render.test.tsx).
  await view.press(view.findByLabel(/^Otah,/));
  assert.deepEqual(navigation.calls.at(-1)?.args, [
    "DishDetail",
    { dishId: "dish-2", source: "home", catalogFallback: { releaseId: "release-1" } },
  ]);

  await view.press(view.findByLabel(/^Sungei Road Laksa, Laksa/));
  assert.deepEqual(navigation.calls.at(-1)?.args, ["StallDetail", { venueId: "venue-1" }]);

  const events = getTrackedAnalyticsEvents().map((event) => event.event);
  assert.ok(events.includes("discover_rail_impression"));
  assert.equal(events.filter((event) => event === "discover_card_opened").length, 3);
});

test("HOME-V3: on the offline copy a stall row opens the read-only catalog page", async () => {
  stubCatalog();
  const service = getCatalogRawService() as unknown as {
    listDishes(request: CatalogPageRequest): Promise<CatalogPage<CatalogRawDishCard>>;
    listVenues(request: CatalogPageRequest): Promise<CatalogPage<CatalogRawVenueCard>>;
  };
  service.listDishes = async () => ({ ...page([dish()]), releaseId: "excel-fallback-v1" });
  service.listVenues = async () => ({ ...page([venue()]), releaseId: "excel-fallback-v1" });
  const navigation = createFakeNavigation();
  const view = await render(createElement(CatalogDiscoverHome), { navigation });
  await view.press(view.findByLabel(/^Sungei Road Laksa, Laksa/));
  assert.deepEqual(navigation.calls.at(-1)?.args, [
    "CatalogRawDetail",
    { kind: "venue", id: "venue-1", releaseId: "excel-fallback-v1" },
  ]);
  // Dish cards on the offline copy open the read-only catalog page as well.
  await view.press(view.findByLabel(/^Laksa, Sungei Road Laksa/));
  assert.deepEqual(navigation.calls.at(-1)?.args, [
    "CatalogRawDetail",
    { kind: "dish", id: "dish-1", releaseId: "excel-fallback-v1" },
  ]);
});

test("as the offline Home, Retry and pull-to-refresh try the live Home again", async () => {
  const catalog = stubCatalog();
  catalog.fail = new Error("catalog down");
  let liveRetries = 0;
  const view = await render(
    createElement(CatalogDiscoverHome, {
      onRetryLive: () => {
        liveRetries += 1;
      },
    }),
  );
  assert.match(view.text(), /Couldn't load Home/);
  const requests = catalog.requests.length;
  await view.press(view.findByText("Retry"));
  assert.equal(liveRetries, 1, "Retry hands back to the live Home");
  assert.equal(catalog.requests.length, requests, "the offline Home does not reload itself");
  await pullToRefresh(view);
  assert.equal(liveRetries, 2);
});

test("a halal diner's first request already filters for halal", async () => {
  useProfileStore.setState((state) => ({
    profile: { ...state.profile, dietaryPreferences: ["halal"] },
  }));
  const catalog = stubCatalog();
  await render(createElement(CatalogDiscoverHome));
  assert.deepEqual(catalog.requests[0]?.dietaryFlags, ["halal"]);
  assert.equal(catalog.requests.length, 1, "no unfiltered request first");
});

test("HOME-V5: a halal preference that arrives after Home mounts applies the Halal chip once", async () => {
  useProfileStore.setState((state) => ({ profile: { ...state.profile, dietaryPreferences: [] } }));
  const catalog = stubCatalog();
  const view = await render(createElement(CatalogDiscoverHome));
  assert.ok(!catalog.requests.at(-1)?.dietaryFlags?.length, "starts on All");
  await act(async () => {
    useProfileStore.setState((state) => ({
      profile: { ...state.profile, dietaryPreferences: ["halal"] },
    }));
  });
  await view.settle();
  assert.deepEqual(catalog.requests.at(-1)?.dietaryFlags, ["halal"]);
});

test("HOME-V5: a diner who already picked a chip keeps it when the profile arrives", async () => {
  useProfileStore.setState((state) => ({ profile: { ...state.profile, dietaryPreferences: [] } }));
  const catalog = stubCatalog();
  const view = await render(createElement(CatalogDiscoverHome));
  await view.press(view.findByText("Japanese"));
  const japanese = catalog.requests.at(-1);
  await act(async () => {
    useProfileStore.setState((state) => ({
      profile: { ...state.profile, dietaryPreferences: ["halal"] },
    }));
  });
  await view.settle();
  assert.equal(catalog.requests.at(-1), japanese, "no halal request over the diner's pick");
});

test("GPS jitter of a few metres does not refetch", async () => {
  setLocation({
    permission: "granted",
    currentLocation: { latitude: 1.3001, longitude: 103.8001 },
  });
  const catalog = stubCatalog();
  const view = await render(createElement(CatalogDiscoverHome));
  const before = catalog.requests.length;
  useLocationStore.setState({ currentLocation: { latitude: 1.30012, longitude: 103.80015 } });
  await view.settle();
  assert.equal(catalog.requests.length, before);
});

function fakeFlags(flagValues: Record<string, string> | undefined) {
  const state = { flags: flagValues, exposures: [] as string[] };
  const source: ExperimentFlagSource = {
    peek: (key) => state.flags?.[key],
    expose: (key) => {
      state.exposures.push(key);
      return state.flags?.[key];
    },
    hasLoaded: () => state.flags !== undefined,
    onChange: () => () => undefined,
  };
  return { state, source };
}

const returning = {
  state: "resurrected" as const,
  daysSincePrevious: 21,
  previousActiveDate: "2026-10-01",
};

test("welcome_back_v2: a returning diner in the test arm sees the card on Home", async () => {
  const fake = fakeFlags({ welcome_back_v2: "test" });
  setExperimentFlagSource(fake.source);
  useLifecycleStore.setState({ snapshot: returning as never });
  stubCatalog();
  const view = await render(createElement(CatalogDiscoverHome));
  assert.match(view.text(), /Welcome back/);
  assert.deepEqual(fake.state.exposures, ["welcome_back_v2"]);
});

test("welcome_back_v2: control and the pre-load render show no card", async () => {
  useLifecycleStore.setState({ snapshot: returning as never });
  stubCatalog();

  const control = fakeFlags({ welcome_back_v2: "control" });
  setExperimentFlagSource(control.source);
  let view = await render(createElement(CatalogDiscoverHome));
  assert.doesNotMatch(view.text(), /Welcome back/);
  await cleanup();

  const notLoaded = fakeFlags(undefined);
  setExperimentFlagSource(notLoaded.source);
  view = await render(createElement(CatalogDiscoverHome));
  assert.doesNotMatch(view.text(), /Welcome back/);
  assert.deepEqual(notLoaded.state.exposures, [], "no exposure before flags load");
});

test("welcome_back_v2: a diner who is not returning is never exposed", async () => {
  const fake = fakeFlags({ welcome_back_v2: "test" });
  setExperimentFlagSource(fake.source);
  useLifecycleStore.setState({ snapshot: { ...returning, state: "current" } as never });
  stubCatalog();
  const view = await render(createElement(CatalogDiscoverHome));
  assert.doesNotMatch(view.text(), /Welcome back/);
  assert.deepEqual(fake.state.exposures, []);
});

test("section titles are announced as headings", async () => {
  stubCatalog();
  const view = await render(createElement(CatalogDiscoverHome));
  assert.equal(view.findByText("Nearby dishes")?.getAttribute("role"), "heading");
  assert.notEqual(view.findByText("Browse the full directory")?.getAttribute("role"), "heading");
});

test("HOME-V3: on the offline copy a stall row opens the catalog record, not StallDetail", async () => {
  stubCatalog();
  const service = getCatalogRawService() as unknown as {
    listDishes(request: CatalogPageRequest): Promise<CatalogPage<CatalogRawDishCard>>;
    listVenues(request: CatalogPageRequest): Promise<CatalogPage<CatalogRawVenueCard>>;
  };
  const offline = <T,>(items: T[]): CatalogPage<T> => ({
    ...page(items),
    releaseId: "excel-fallback-v1",
  });
  service.listDishes = async () => offline([dish()]);
  service.listVenues = async () => offline([venue()]);
  const navigation = createFakeNavigation();
  const view = await render(createElement(CatalogDiscoverHome), { navigation });

  await view.press(view.findByLabel(/^Sungei Road Laksa, Laksa/));
  assert.deepEqual(navigation.calls.at(-1)?.args, [
    "CatalogRawDetail",
    { kind: "venue", id: "venue-1", releaseId: "excel-fallback-v1" },
  ]);
});

test("welcome_back_v2: control is exposed exactly once, and an unfocused Home exposes no one", async () => {
  useLifecycleStore.setState({ snapshot: returning as never });
  stubCatalog();
  const control = fakeFlags({ welcome_back_v2: "control" });
  setExperimentFlagSource(control.source);
  await render(createElement(CatalogDiscoverHome));
  assert.deepEqual(control.state.exposures, ["welcome_back_v2"]);
  await cleanup();
  resetExperimentSession();

  const unfocused = fakeFlags({ welcome_back_v2: "test" });
  setExperimentFlagSource(unfocused.source);
  const navigation = { ...createFakeNavigation(), isFocused: () => false };
  const view = await render(createElement(CatalogDiscoverHome), { navigation });
  assert.doesNotMatch(view.text(), /Welcome back/);
  assert.deepEqual(unfocused.state.exposures, []);
});

test("HOME-V6: a returning diner with no saved dishes and no followed stalls is not exposed", async () => {
  useProfileStore.setState((state) => ({ profile: { ...state.profile, favouriteDishIds: [] } }));
  useStallFollowStore.setState({ followedStallIds: [] });
  const fake = fakeFlags({ welcome_back_v2: "test" });
  setExperimentFlagSource(fake.source);
  useLifecycleStore.setState({ snapshot: returning as never });
  stubCatalog();
  const view = await render(createElement(CatalogDiscoverHome));
  assert.doesNotMatch(view.text(), /Welcome back/);
  assert.deepEqual(fake.state.exposures, []);
});

test("HOME-V6: welcome_back_shown is sent once per session, even when the card remounts", async () => {
  const fake = fakeFlags({ welcome_back_v2: "test" });
  setExperimentFlagSource(fake.source);
  useLifecycleStore.setState({ snapshot: returning as never });
  stubCatalog();
  await render(createElement(CatalogDiscoverHome));
  await cleanup();
  const view = await render(createElement(CatalogDiscoverHome));
  assert.match(view.text(), /Welcome back/);
  const shown = getTrackedAnalyticsEvents().filter((event) => event.event === "welcome_back_shown");
  assert.equal(shown.length, 1);
});
