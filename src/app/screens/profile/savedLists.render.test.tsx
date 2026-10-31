// Saved and Lists fixes, checked in a real React tree (react-native-web + jsdom, mock data).
// Run with `node scripts/test-render.mjs src/app/screens/profile/savedLists.render.test.tsx`.

import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { CatalogRawDetailScreen } from "@/app/screens/catalog/CatalogRawDetailScreen";
import { PortfolioPublicViewScreen } from "@/app/screens/portfolio/PortfolioPublicViewScreen";
import { CollectionsScreen } from "@/app/screens/profile/CollectionsScreen";
import { FavouritesScreen } from "@/app/screens/profile/FavouritesScreen";
import { FollowedStallsScreen } from "@/app/screens/profile/FollowedStallsScreen";
import { PortfolioItemEditSheet, PortfolioItemRow } from "@/components/portfolio";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import {
  resetExperimentSession,
  setExperimentFlagSource,
  type ExperimentFlagSource,
} from "@/lib/experiments/experiments";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { useSavedViewStore } from "@/store/useSavedViewStore";
import { useProfileStore } from "@/store/useProfileStore";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useStallFollowStore } from "@/store/useStallFollowStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { cleanup, render, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import type { PortfolioItem, StallInteraction, VenueSummary } from "@/types/domain";

const restores: (() => void)[] = [];
function stub<T extends object, K extends keyof T>(target: T, key: K, value: T[K]) {
  const original = target[key];
  target[key] = value;
  restores.push(() => {
    target[key] = original;
  });
}

const originalMapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

beforeEach(async () => {
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN = "test-token"; // a build that can draw the map
  await enterScenario("user");
  useSavedViewStore.getState().reset();
  clearTrackedAnalyticsEvents();
});
afterEach(async () => {
  if (originalMapboxToken === undefined) delete process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  else process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN = originalMapboxToken;
  await cleanup();
  while (restores.length) restores.pop()?.();
  setExperimentFlagSource(undefined);
  resetExperimentSession();
});

function fakeFlags(flags: Record<string, string>) {
  const state = { exposures: [] as string[] };
  const source: ExperimentFlagSource = {
    peek: (key) => flags[key],
    expose: (key) => {
      state.exposures.push(key);
      return flags[key];
    },
    hasLoaded: () => true,
    onChange: () => () => undefined,
  };
  setExperimentFlagSource(source);
  return state;
}

const catalogDishParams = () => {
  const dish = getDataRepository().listPopularNearby()[0];
  return { dish, params: { kind: "dish", id: dish.id, releaseId: "r1" } };
};

// ─── SAVED-X1 + catalog_save_to_list_v1 ─────────────────────────────────────────────────────

test("catalog dish page, control arm: one Save button, no Save to list; the viewer is exposed", async () => {
  const flags = fakeFlags({ catalog_save_to_list_v1: "control" });
  const { dish, params } = catalogDishParams();
  const view = await renderScreen(CatalogRawDetailScreen as never, {
    name: "CatalogRawDetail",
    params,
  });
  assert.match(view.text(), new RegExp(dish.name));
  assert.ok(view.findByText(/Save to Want to try|Saved to Want to try/));
  assert.equal(view.findByText("Save to list"), null);
  assert.deepEqual(flags.exposures, ["catalog_save_to_list_v1"]);
});

test("catalog dish page, save_with_lists arm: Save to list sits next to Save", async () => {
  fakeFlags({ catalog_save_to_list_v1: "save_with_lists" });
  const { params } = catalogDishParams();
  const view = await renderScreen(CatalogRawDetailScreen as never, {
    name: "CatalogRawDetail",
    params,
  });
  assert.ok(view.findByText(/Save to Want to try|Saved to Want to try/));
  assert.ok(view.findByText("Save to list"));
});

test("guests and stall pages are never exposed to catalog_save_to_list_v1", async () => {
  const flags = fakeFlags({ catalog_save_to_list_v1: "save_with_lists" });
  const { dish } = catalogDishParams();
  const venueView = await renderScreen(CatalogRawDetailScreen as never, {
    name: "CatalogRawDetail",
    params: { kind: "venue", id: dish.venueId, releaseId: "r1" },
  });
  assert.equal(venueView.findByText("Save to list"), null);
  await venueView.unmount();

  await enterScenario("guest");
  const guestView = await renderScreen(CatalogRawDetailScreen as never, {
    name: "CatalogRawDetail",
    params: { kind: "dish", id: dish.id, releaseId: "r1" },
  });
  assert.equal(guestView.findByText("Save to list"), null);
  assert.deepEqual(flags.exposures, []);
});

test("SAVED-X6: the catalog dish page records dish_viewed once, with its source", async () => {
  const { dish, params } = catalogDishParams();
  await renderScreen(CatalogRawDetailScreen as never, { name: "CatalogRawDetail", params });
  const views = getTrackedAnalyticsEvents().filter((event) => event.event === "dish_viewed");
  assert.equal(views.length, 1);
  assert.equal(views[0].properties.dish_id, dish.id);
  assert.equal(views[0].properties.source, "catalog_detail");
});

// ─── SAVED-2 ─────────────────────────────────────────────────────────────────────────────────

test("Followed stalls lists a stall the local catalog cache does not have", async () => {
  const profile = getHungryService().profile;
  const discovery = getHungryService().discovery;
  stub(profile, "getFollowedStallIds", async () => ["far-away-stall"]);
  const asked: string[][] = [];
  stub(discovery, "getVenuesByIds", async (ids: string[]) => {
    asked.push(ids);
    return [
      {
        id: "far-away-stall",
        name: "Far Away Laksa",
        unitNumber: "#02-11",
        floor: "2",
        buildingName: "Bedok Interchange",
      } as VenueSummary,
    ];
  });
  useStallFollowStore.setState({ followedStallIds: [], isLoaded: false });
  assert.equal(getDataRepository().getVenueById("far-away-stall"), undefined);

  const view = await renderScreen(FollowedStallsScreen as never, { name: "FollowedStalls" });
  assert.ok(view.findByText("Far Away Laksa"));
  assert.match(view.text(), /#02-11 · Bedok Interchange/);
  assert.deepEqual(asked, [["far-away-stall"]]);
});

// ─── SAVED-4, SAVED-16, SAVED-18 ─────────────────────────────────────────────────────────────

test("Saved has no Posts tab with the social feed off; tabs are tabs; the heading follows the tab", async () => {
  const view = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  assert.equal(view.findByLabel("Saved posts"), null);
  const stallsTab = view.findByLabel("Saved stalls");
  assert.ok(stallsTab);
  assert.equal(stallsTab?.getAttribute("role"), "tab");
  // One title, "Saved": the section tab names the section, so there is no second heading.
  assert.equal(view.findByText("Saved dishes"), null);
  assert.equal(view.findByLabel("Saved collections"), null);
  assert.ok(view.findByLabel("Saved lists"));
  await view.press(stallsTab);
  await view.settle();
  assert.ok(view.findByLabel("Show saved stalls as a list or on a map"));
  assert.equal(view.findByText("Nothing saved yet"), null);
});

// ─── SAVED-1, SAVED-5 ────────────────────────────────────────────────────────────────────────

test("Collections search finds a saved dish outside the local cache by its server name", async () => {
  const discovery = getHungryService().discovery;
  stub(discovery, "getItemDetails", async ({ dishIds }: { dishIds: string[] }) =>
    dishIds.includes("server-only-dish")
      ? [{ dishId: "server-only-dish", name: "Hokkien Mee", stallName: "Nam Sing" }]
      : [],
  );
  useProfileStore.setState((state) => ({
    profile: { ...state.profile, favouriteDishIds: ["server-only-dish"] },
  }));
  assert.equal(getDataRepository().getDishById("server-only-dish"), undefined);

  const view = await renderScreen(CollectionsScreen as never, { name: "Collections" });
  const search = view.findByLabel("Search your lists");
  await view.type(search, "nam sing");
  assert.ok(view.findByText("Hokkien Mee"));
  assert.match(view.text(), /1 item in your lists/);
});

test("Collections says it is searching while item details are still loading", async () => {
  const discovery = getHungryService().discovery;
  stub(discovery, "getItemDetails", () => new Promise<never>(() => undefined));
  const view = await renderScreen(CollectionsScreen as never, { name: "Collections" });
  await view.type(view.findByLabel("Search your lists"), "laksa");
  assert.match(view.text(), /Searching your lists…/);
  assert.doesNotMatch(view.text(), /Nothing in your lists matches/);
});

// ─── SAVED-X4, SAVED-14 ──────────────────────────────────────────────────────────────────────

test("a shared recommendation list shows no ranks", async () => {
  const portfolioService = getHungryService().portfolio;
  stub(portfolioService, "getPublicPortfolio", async () => ({
    id: "p-rec",
    name: "Weekend picks",
    type: "recommendation",
    items: [
      { itemType: "stall", stallId: "s1", name: "Ah Seng Durian", mapQuery: "Ah Seng Durian" },
    ],
  }));
  const view = await renderScreen(PortfolioPublicViewScreen as never, {
    name: "PortfolioPublicView",
    params: { portfolioId: "p-rec" },
  });
  assert.ok(view.findByText("Ah Seng Durian"));
  assert.doesNotMatch(view.text(), /#1/);
});

// ─── SAVED-19 ────────────────────────────────────────────────────────────────────────────────

test("list item controls name the item they act on", async () => {
  const item = { id: "i1", portfolioId: "p1", itemType: "dish", dishId: "d1" } as PortfolioItem;
  const view = await render(
    createElement(PortfolioItemRow, {
      item,
      index: 1,
      totalCount: 3,
      label: "Laksa",
      canEdit: true,
      onOpen: () => undefined,
      onMoveUp: () => undefined,
      onMoveDown: () => undefined,
      onEdit: () => undefined,
      onDelete: () => undefined,
    }),
  );
  assert.ok(view.findByLabel("Move Laksa up"));
  assert.ok(view.findByLabel("Move Laksa down"));
  assert.ok(view.findByLabel("Remove Laksa from this list"));
});

// ─── SAVED-20, SAVED-10 ──────────────────────────────────────────────────────────────────────

test("the item edit sheet keeps typed text when the title loads, and will not clear a saved score", async () => {
  const sheet = (title: string) =>
    createElement(PortfolioItemEditSheet, {
      visible: true,
      title,
      itemKey: "i1",
      scoreCanBeCleared: false,
      confirmLabel: "Save",
      initialScore: 7,
      onSubmit: () => undefined,
      onClose: () => undefined,
    });
  const view = await render(sheet("Loading…"));
  const inputs = () =>
    Array.from(document.querySelectorAll("textarea, input")) as HTMLInputElement[];
  const note = inputs().find((input) => input.placeholder === "Visible when this list is shared");
  await view.type(note ?? null, "Go before noon");
  await view.rerender(sheet("Laksa"));
  assert.equal(
    inputs().find((input) => input.placeholder === "Visible when this list is shared")?.value,
    "Go before noon",
  );

  const score = inputs().find((input) => input.value === "7");
  assert.ok(
    score,
    `score input: ${inputs()
      .map((input) => JSON.stringify(input.value))
      .join(",")}`,
  );
  await view.type(score ?? null, "");
  assert.match(view.text(), /A saved score can't be removed yet/);
});

// ─── Post-verify: SAVED-V1/V2/V3/V4 (MAP-V2, STALL-V2) ───────────────────────────────────────

function savedStalls(count: number) {
  const interactions: Record<string, StallInteraction> = {};
  for (let index = 0; index < count; index += 1) {
    const stallId = `saved-stall-${index}`;
    interactions[stallId] = {
      userId: "user",
      stallId,
      isSaved: true,
      isTried: false,
      isReviewed: false,
      savedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, count - index)).toISOString(),
    };
  }
  useStallInteractionStore.setState({ interactions, isLoaded: true });
}

const venueFor = (id: string) =>
  ({ id, name: `Stall ${id}`, buildingName: "Bedok" }) as VenueSummary;

async function openSavedStalls() {
  const view = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  await view.press(view.findByLabel("Saved stalls"));
  return view;
}

test("Saved > Stalls shows all 60 saved stalls, in 50-id batches (SAVED-V2)", async () => {
  savedStalls(60);
  const asked: string[][] = [];
  stub(getHungryService().discovery, "getVenuesByIds", async (ids: string[]) => {
    asked.push(ids);
    return ids.map(venueFor);
  });
  const view = await openSavedStalls();
  assert.ok(view.findByText("Stall saved-stall-0"));
  assert.ok(view.findByText("Stall saved-stall-59"), "the 60th stall shows");
  assert.deepEqual(
    asked.map((ids) => ids.length),
    [50, 10],
  );
});

test("Saved > Stalls offline shows Retry and reports, not No saved stalls (SAVED-V1)", async () => {
  savedStalls(2);
  let fail = true;
  stub(getHungryService().discovery, "getVenuesByIds", async (ids: string[]) => {
    if (fail) throw new Error("Couldn't load these stalls.");
    return ids.map(venueFor);
  });
  const reports = captureReports();
  const view = await openSavedStalls();
  assert.ok(view.findByText("Couldn't load saved stalls"));
  assert.doesNotMatch(view.text(), /No saved stalls yet|may have closed/);
  assert.ok(reports.some((report) => report.action === "load_saved_stalls"));
  fail = false;
  await view.press(view.findByText("Retry"));
  assert.ok(view.findByText("Stall saved-stall-0"));
});

test("Saved > Stalls says some stalls are gone when lookups miss, even when all miss", async () => {
  savedStalls(3);
  stub(getHungryService().discovery, "getVenuesByIds", async (ids: string[]) =>
    ids.slice(0, 1).map(venueFor),
  );
  const partial = await openSavedStalls();
  assert.match(partial.text(), /2 stalls couldn't be loaded/);
  await cleanup();

  savedStalls(2);
  stub(getHungryService().discovery, "getVenuesByIds", async () => []);
  const none = await openSavedStalls();
  assert.match(none.text(), /2 stalls couldn't be loaded/);
  assert.doesNotMatch(none.text(), /No saved stalls yet/);
});

test("Followed stalls offline shows Retry, not 'may have closed' (SAVED-V1)", async () => {
  stub(getHungryService().profile, "getFollowedStallIds", async () => ["s-1", "s-2"]);
  stub(getHungryService().discovery, "getVenuesByIds", async () => {
    throw new Error("Couldn't load these stalls.");
  });
  useStallFollowStore.setState({ followedStallIds: [], isLoaded: false });
  const reports = captureReports();
  const view = await renderScreen(FollowedStallsScreen as never, { name: "FollowedStalls" });
  assert.ok(view.findByText("Couldn't load followed stalls"));
  assert.doesNotMatch(view.text(), /may have closed|No followed stalls yet/);
  assert.ok(reports.some((report) => report.screen === "FollowedStalls"));
});

test("Followed stalls whose lookups all miss say so, not 'No followed stalls yet' (SAVED-V3)", async () => {
  stub(getHungryService().profile, "getFollowedStallIds", async () => ["s-1", "s-2"]);
  stub(getHungryService().discovery, "getVenuesByIds", async () => []);
  useStallFollowStore.setState({ followedStallIds: [], isLoaded: false });
  const view = await renderScreen(FollowedStallsScreen as never, { name: "FollowedStalls" });
  assert.match(view.text(), /2 stalls couldn't be loaded/);
  assert.doesNotMatch(view.text(), /No followed stalls yet/);
  assert.ok(view.findByText("Retry"));
});

test("Saved > Collections shows an error with Retry and reports when lists fail (SAVED-V4)", async () => {
  const original = usePortfolioStore.getState().loadPortfolioScope;
  restores.push(() => usePortfolioStore.setState({ loadPortfolioScope: original }));
  let fail = true;
  usePortfolioStore.setState({
    scopeIds: { ...usePortfolioStore.getState().scopeIds, mine: [] },
    loadPortfolioScope: (async (...args: Parameters<typeof original>) => {
      if (fail) throw new Error("lists down");
      return original(...args);
    }) as typeof original,
  });
  const reports = captureReports();
  const view = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  await view.press(view.findByLabel("Saved lists"));
  assert.ok(view.findByText("Couldn't load your lists"));
  assert.doesNotMatch(view.text(), /Make lists like/);
  assert.ok(reports.some((report) => report.label === "saved lists"));
  fail = false;
  await view.press(view.findByText("Retry"));
  assert.equal(view.findByText("Couldn't load your lists"), null);
});

/** reportError logs `[reportError]`, error, context in development; this collects the contexts. */
function captureReports() {
  const reports: Record<string, unknown>[] = [];
  const original = console.error;
  const globals = globalThis as { __DEV__?: boolean };
  const previousDev = globals.__DEV__;
  globals.__DEV__ = true;
  console.error = (...args: unknown[]) => {
    if (args[0] === "[reportError]") reports.push((args[2] ?? {}) as Record<string, unknown>);
  };
  restores.push(() => {
    console.error = original;
    globals.__DEV__ = previousDev;
  });
  return reports;
}
