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
import { useProfileStore } from "@/store/useProfileStore";
import { useStallFollowStore } from "@/store/useStallFollowStore";
import { cleanup, render, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import type { PortfolioItem, VenueSummary } from "@/types/domain";

const restores: (() => void)[] = [];
function stub<T extends object, K extends keyof T>(target: T, key: K, value: T[K]) {
  const original = target[key];
  target[key] = value;
  restores.push(() => {
    target[key] = original;
  });
}

beforeEach(async () => {
  await enterScenario("user");
  clearTrackedAnalyticsEvents();
});
afterEach(async () => {
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
  assert.ok(view.findByText(/Save to favourites|Remove from favourites/));
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
  assert.ok(view.findByText(/Save to favourites|Remove from favourites/));
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
  assert.ok(view.findByText("Saved Dishes"));
  await view.press(stallsTab);
  assert.ok(view.findByText("Saved Stalls"));
  assert.equal(view.findByText("Saved Dishes"), null);
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
  const search = view.findByLabel("Search your collections");
  await view.type(search, "nam sing");
  assert.ok(view.findByText("Hokkien Mee"));
  assert.match(view.text(), /1 item in your collections/);
});

test("Collections says it is searching while item details are still loading", async () => {
  const discovery = getHungryService().discovery;
  stub(discovery, "getItemDetails", () => new Promise<never>(() => undefined));
  const view = await renderScreen(CollectionsScreen as never, { name: "Collections" });
  await view.type(view.findByLabel("Search your collections"), "laksa");
  assert.match(view.text(), /Searching your collections…/);
  assert.doesNotMatch(view.text(), /Nothing in your collections matches/);
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
