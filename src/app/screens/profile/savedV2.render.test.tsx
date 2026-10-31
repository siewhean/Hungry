// Saved page, round two: one search across everything saved, the map view, the segmented
// control and sort menu, swipe to remove, stall rows, list covers and the remembered section.
// Checked in a real React tree (react-native-web + jsdom, mock data). Run with
// `node scripts/test-render.mjs src/app/screens/profile/savedV2.render.test.tsx`.

import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";
import { Text } from "react-native";

import { FavouritesScreen } from "@/app/screens/profile/FavouritesScreen";
import {
  SavedMapView,
  SavedSearchBox,
  SavedSearchResults,
  SavedSortMenu,
  SavedStallRow,
  SwipeToRemove,
} from "@/components/saved";
import { SegmentedControl } from "@/components/ui";
import { PortfolioCreateScreen } from "@/app/screens/portfolio/PortfolioCreateScreen";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { SavedDishCard } from "@/lib/services/types";
import { useLocationStore } from "@/store/useLocationStore";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSavedViewStore } from "@/store/useSavedViewStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, render, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import type {
  Portfolio,
  PortfolioItem,
  Review,
  StallInteraction,
  VenueSummary,
} from "@/types/domain";

const restores: (() => void)[] = [];
function stub<T extends object, K extends keyof T>(target: T, key: K, value: T[K]) {
  const original = target[key];
  target[key] = value;
  restores.push(() => {
    target[key] = original;
  });
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const SEARCH_WAIT_MS = 320;

const LAKSA: SavedDishCard = {
  id: "d-laksa",
  name: "Laksa",
  venueId: "v-nam-sing",
  venueName: "Nam Sing",
  buildingName: "Maxwell Food Centre",
  unitNumber: "#01-23",
  imageUrl: "https://example.com/laksa.jpg",
  latitude: 1.2803,
  longitude: 103.8446,
};
const LAKSA_2: SavedDishCard = {
  id: "d-mee",
  name: "Prawn Mee",
  venueId: "v-nam-sing",
  venueName: "Nam Sing",
  buildingName: "Maxwell Food Centre",
  imageUrl: "https://example.com/mee.jpg",
  latitude: 1.2803,
  longitude: 103.8446,
};
const RICE: SavedDishCard = {
  id: "d-rice",
  name: "Chicken Rice",
  venueId: "v-tian-tian",
  venueName: "Tian Tian",
  buildingName: "Far Away Centre",
  latitude: 1.4,
  longitude: 103.9,
};
const NOWHERE: SavedDishCard = { id: "d-nowhere", name: "Mystery Noodles", venueName: "No Pin" };

function saveDishes(ids: string[]) {
  useProfileStore.setState((state) => ({
    profile: { ...state.profile, favouriteDishIds: ids, reviewedDishIds: [] },
  }));
}
function stubCards(cards: SavedDishCard[]) {
  const calls: string[][] = [];
  stub(getHungryService().discovery, "getSavedDishCards", async (ids: string[]) => {
    calls.push(ids);
    return cards.filter((card) => ids.includes(card.id));
  });
  return calls;
}
const eventsNamed = (name: string) =>
  getTrackedAnalyticsEvents().filter((event) => event.event === name);

beforeEach(async () => {
  await enterScenario("user");
  useSavedViewStore.getState().reset();
  clearTrackedAnalyticsEvents();
  useLocationStore.setState({ permission: "denied", manualCoordinate: undefined });
});
afterEach(async () => {
  await cleanup();
  while (restores.length) restores.pop()?.();
  useUIStore.getState().hideToast?.();
});

// ─── SegmentedControl ────────────────────────────────────────────────────────────────────────

test("SegmentedControl shows the chosen segment as checked and only reports a change", async () => {
  const changes: string[] = [];
  const view = await render(
    createElement(SegmentedControl<"a" | "b">, {
      accessibilityLabel: "Pick one",
      value: "a",
      onChange: (value: "a" | "b") => changes.push(value),
      options: [
        { value: "a", label: "Want to try (2)" },
        { value: "b", label: "Tried (1)" },
      ],
    }),
  );
  assert.equal(view.findByLabel("Want to try (2)")?.getAttribute("aria-checked"), "true");
  assert.equal(view.findByLabel("Tried (1)")?.getAttribute("aria-checked"), "false");
  await view.press(view.findByLabel("Want to try (2)"));
  assert.deepEqual(changes, [], "tapping the chosen segment changes nothing");
  await view.press(view.findByLabel("Tried (1)"));
  assert.deepEqual(changes, ["b"]);
});

// ─── SavedSortMenu ───────────────────────────────────────────────────────────────────────────

test("SavedSortMenu opens as radio rows, checks the current sort and closes on a choice", async () => {
  const chosen: string[] = [];
  const view = await render(
    createElement(SavedSortMenu, {
      value: "recent",
      hasLocation: false,
      onChange: (sort: string) => chosen.push(sort),
    } as never),
  );
  assert.equal(view.findByLabel("Top rated"), null, "closed until the button is pressed");
  await view.press(view.findByLabel("Sort: Recent"));
  assert.equal(view.findByLabel("Recent")?.getAttribute("aria-checked"), "true");
  assert.ok(view.findByLabel("Nearest. Turn on location to use this."));
  await view.press(view.findByLabel("Top rated"));
  assert.deepEqual(chosen, ["top_rated"]);
  assert.equal(view.findByLabel("Top rated"), null, "closes after a choice");
});

// ─── SwipeToRemove ───────────────────────────────────────────────────────────────────────────

test("SwipeToRemove offers Remove behind the row, and not at all when disabled", async () => {
  let removed = 0;
  const row = (enabled: boolean) =>
    createElement(SwipeToRemove, {
      label: "Laksa",
      enabled,
      onRemove: () => (removed += 1),
      children: createElement(Text, null, "Laksa row"),
    });
  const view = await render(row(true));
  assert.ok(view.findByText("Laksa row"));
  await view.press(view.findByLabel("Remove Laksa from Saved"));
  assert.equal(removed, 1);
  await view.rerender(row(false));
  assert.ok(view.findByText("Laksa row"));
  assert.equal(view.findByLabel("Remove Laksa from Saved"), null);
});

// ─── SavedStallRow ───────────────────────────────────────────────────────────────────────────

test("a saved stall row shows its place and open state, with Remove only when it can be removed", async () => {
  const venue = {
    id: "s1",
    name: "Nam Sing",
    unitNumber: "#01-23",
    buildingName: "Maxwell Food Centre",
    isOpen: true,
  } as VenueSummary;
  let opened = 0;
  const view = await render(
    createElement(SavedStallRow, {
      venue,
      distanceLabel: "450m away",
      onOpen: () => (opened += 1),
    }),
  );
  assert.match(view.text(), /Nam Sing/);
  assert.match(view.text(), /#01-23 · Maxwell Food Centre/);
  assert.match(view.text(), /Open now/);
  assert.match(view.text(), /450m away/);
  assert.ok(view.findByTestId("saved-stall-logo"));
  assert.equal(view.findByLabel("Remove Nam Sing from Saved"), null);
  await view.press(view.findByLabel("Open Nam Sing"));
  assert.equal(opened, 1);
});

// ─── SavedMapView ────────────────────────────────────────────────────────────────────────────

test("SavedMapView opens a bottom card for a pin and names the items that are not on the map", async () => {
  const opened: string[] = [];
  let showList = 0;
  const view = await render(
    createElement(SavedMapView, {
      pins: [
        {
          id: "v1",
          coordinate: { latitude: 1.28, longitude: 103.84 },
          title: "Nam Sing",
          count: 2,
        },
      ],
      noun: "dish",
      notOnMapCount: 1,
      onPinOpened: (pin: { id: string }) => opened.push(pin.id),
      onShowNotOnMap: () => (showList += 1),
      renderPinCard: (id: string) => createElement(Text, null, `Card for ${id}`),
    }),
  );
  assert.ok(view.findByTestId("saved-map"));
  assert.equal(view.findByTestId("saved-map-card"), null, "no card until a pin is tapped");
  await view.press(view.findByLabel("Nam Sing, 2 saved dishes"));
  assert.ok(view.findByTestId("saved-map-card"));
  assert.ok(view.findByText("Card for v1"));
  assert.deepEqual(opened, ["v1"]);
  assert.match(view.text(), /1 not on the map/);
  await view.press(view.findByLabel("1 saved dish is not on the map. Show the list."));
  assert.equal(showList, 1);
  await view.press(view.findByLabel("Close"));
  assert.equal(view.findByTestId("saved-map-card"), null);
});

// ─── SavedSearchBox and SavedSearchResults ───────────────────────────────────────────────────

test("the search box names what it searches and clears with one tap", async () => {
  let value = "laksa";
  const view = await render(
    createElement(SavedSearchBox, { value, onChangeText: (next: string) => (value = next) }),
  );
  assert.ok(view.findByLabel("Search everything you saved"));
  await view.press(view.findByLabel("Clear search"));
  assert.equal(value, "");
});

test("search results with an error offer Retry", async () => {
  let retried = 0;
  const view = await render(
    createElement(SavedSearchResults, {
      search: {
        query: "x",
        status: "error",
        results: { dishes: [], stalls: [], lists: [], reviews: [], total: 0 },
      },
      onOpenDish: () => undefined,
      onOpenStall: () => undefined,
      onOpenList: () => undefined,
      onOpenReview: () => undefined,
      onClear: () => undefined,
      onRetry: () => (retried += 1),
    }),
  );
  await view.press(view.findByText("Retry"));
  assert.equal(retried, 1);
});

// ─── The Saved page ──────────────────────────────────────────────────────────────────────────

test("one title, 'Saved', and the sections are Dishes, Stalls and Lists", async () => {
  saveDishes([LAKSA.id]);
  stubCards([LAKSA]);
  const view = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  assert.ok(view.findByLabel("Saved dishes"));
  assert.ok(view.findByLabel("Saved stalls"));
  assert.ok(view.findByLabel("Saved lists"));
  assert.equal(view.findByLabel("Saved collections"), null);
  assert.equal(view.findByText("Saved dishes"), null, "no second heading");
  assert.ok(view.findByLabel("Search everything you saved"));
  assert.equal(view.findByText("Search all saved"), null);
});

test("while most saved dishes have no photo the page uses rows with the stall's logo placeholder", async () => {
  saveDishes([RICE.id]);
  stubCards([{ ...RICE, logoUrl: "https://example.com/logo.png" }]);
  const view = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  assert.ok(view.findByLabel("Get directions to Tian Tian"), "row layout");
  assert.equal(view.findByText("Get directions"), null, "not the big card");
  assert.ok(view.findByTestId("saved-dish-photo-placeholder"));
});

test("a photo-rich list keeps the photo cards", async () => {
  saveDishes([LAKSA.id, LAKSA_2.id]);
  stubCards([LAKSA, LAKSA_2]);
  const view = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  assert.ok(view.findByText("Get directions"), "the big card has a labelled button");
  assert.equal(view.findByLabel("Get directions to Nam Sing"), null, "not the compact row");
});

test("Want to try and Tried are a segmented control with counts", async () => {
  saveDishes([LAKSA.id]);
  stubCards([LAKSA]);
  const view = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  assert.equal(view.findByLabel("Want to try (1)")?.getAttribute("role"), "radio");
  assert.equal(view.findByLabel("Tried (0)")?.getAttribute("aria-checked"), "false");
  assert.equal(view.findByLabel("Sort by recent"), null, "no chip row for sort");
  assert.equal(view.findByLabel("Sort: Recent"), null, "one dish needs no sort menu");
});

test("one search looks across dishes, lists and reviews with one read each, not one per row", async () => {
  saveDishes([LAKSA.id]);
  stubCards([LAKSA]);
  const lists: Portfolio[] = [{ id: "l-date", name: "Date night", ownerId: "user" } as Portfolio];
  const items: Record<string, PortfolioItem[]> = {
    "l-date": [
      {
        id: "i1",
        portfolioId: "l-date",
        itemType: "dish",
        dishId: LAKSA.id,
        position: 0,
      } as PortfolioItem,
    ],
  };
  usePortfolioStore.setState({
    portfolios: lists,
    scopeIds: { mine: ["l-date"] },
    items,
  });
  stub(usePortfolioStore.getState(), "loadPortfolioScope", async () => undefined);
  stub(usePortfolioStore.getState(), "loadItemsForPortfolios", async () => undefined);
  let reviewReads = 0;
  stub(getHungryService().reviews, "getUserReviews", async () => {
    reviewReads += 1;
    return [
      {
        id: "r1",
        dishId: LAKSA.id,
        venueId: LAKSA.venueId,
        text: "Rich broth",
        rating: 5,
      } as Review,
    ];
  });
  const detailReads: { dishIds: string[]; stallIds: string[] }[] = [];
  stub(getHungryService().discovery, "getItemDetails", async (input) => {
    detailReads.push(input);
    return [
      { dishId: LAKSA.id, name: "Laksa", imageUrl: "https://example.com/laksa.jpg" },
      { stallId: LAKSA.venueId, name: "Nam Sing" },
    ];
  });

  const view = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  const searchReads = () => detailReads.filter((read) => read.stallIds.length > 0);
  await view.type(view.findByLabel("Search everything you saved"), "laksa");
  await sleep(SEARCH_WAIT_MS);
  await view.settle();
  assert.match(view.text(), /Dishes \(1\)/);
  assert.match(view.text(), /Lists \(1\)/);
  assert.match(view.text(), /Reviews \(1\)/);
  assert.match(view.text(), /3 results/);
  assert.equal(reviewReads, 1);
  assert.equal(searchReads().length, 1, "one detail read names every list item and review");

  // Typing on filters what is already in memory: no new reads.
  await view.type(view.findByLabel("Search everything you saved"), "laksa broth");
  await sleep(SEARCH_WAIT_MS);
  await view.settle();
  assert.equal(reviewReads, 1);
  assert.equal(searchReads().length, 1);
  assert.match(view.text(), /1 result/);

  const event = eventsNamed("saved_search_used").at(-1);
  assert.equal(event?.properties.scope, "all");
});

test("search results open the dish, the list and the review", async () => {
  saveDishes([LAKSA.id]);
  stubCards([LAKSA]);
  usePortfolioStore.setState({
    portfolios: [{ id: "l-laksa", name: "Laksa crawl", ownerId: "user" } as Portfolio],
    scopeIds: { mine: ["l-laksa"] },
    items: { "l-laksa": [] },
  });
  stub(usePortfolioStore.getState(), "loadPortfolioScope", async () => undefined);
  stub(usePortfolioStore.getState(), "loadItemsForPortfolios", async () => undefined);
  stub(getHungryService().reviews, "getUserReviews", async () => [
    { id: "r1", dishId: LAKSA.id, text: "Laksa was great", rating: 5 } as Review,
  ]);
  stub(getHungryService().discovery, "getItemDetails", async () => [
    { dishId: LAKSA.id, name: "Laksa" },
  ]);
  const view = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  await view.type(view.findByLabel("Search everything you saved"), "laksa");
  await sleep(SEARCH_WAIT_MS);
  await view.settle();
  await view.press(view.findByLabel("Open Laksa at Nam Sing"));
  await view.press(view.findByLabel("Open list Laksa crawl"));
  await view.press(view.findByLabel("Open your review of Laksa"));
  const calls = view.navigation.calls.filter((call) => call.method === "navigate");
  assert.deepEqual(
    calls.map((call) => call.args[0]),
    ["DishDetail", "PortfolioDetail", "ReviewDetail"],
  );
  assert.equal(eventsNamed("saved_item_opened").at(-1)?.properties.source, "search");
});

test("a search with no match says so and clears", async () => {
  saveDishes([LAKSA.id]);
  stubCards([LAKSA]);
  stub(getHungryService().reviews, "getUserReviews", async () => []);
  const view = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  await view.type(view.findByLabel("Search everything you saved"), "pizza");
  await sleep(SEARCH_WAIT_MS);
  await view.settle();
  assert.ok(view.findByText("No matches"));
  await view.press(view.findByText("Clear search"));
  assert.ok(view.findByLabel("Saved dishes"));
});

test("the map view pins saved dishes by stall, opens a card with directions, and counts dishes with no point", async () => {
  saveDishes([LAKSA.id, LAKSA_2.id, RICE.id, NOWHERE.id]);
  stubCards([LAKSA, LAKSA_2, RICE, NOWHERE]);
  const view = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  await view.press(view.findByLabel("Map view"));
  assert.ok(view.findByTestId("saved-map"));
  assert.equal(eventsNamed("saved_map_opened").length, 1);
  assert.equal(eventsNamed("saved_map_opened")[0].properties.pin_count, 2);
  assert.equal(eventsNamed("saved_map_opened")[0].properties.not_on_map, 1);
  assert.match(view.text(), /1 not on the map/);

  // Two dishes at Nam Sing share one pin with a count.
  await view.press(view.findByLabel("Nam Sing, 2 saved dishes"));
  assert.ok(view.findByTestId("saved-map-card"));
  assert.ok(view.findByLabel("Open Prawn Mee at Nam Sing"));
  assert.ok(view.findByLabel("Get directions to Nam Sing"));
  await view.press(view.findByLabel("Open Laksa at Nam Sing"));
  const open = eventsNamed("saved_item_opened").at(-1);
  assert.equal(open?.properties.source, "map");
  assert.equal(open?.properties.dish_id, LAKSA.id);

  // The List view is one tap back, and the choice is kept.
  await view.press(view.findByLabel("List view"));
  assert.equal(view.findByTestId("saved-map"), null);
  assert.equal(useSavedViewStore.getState().mode, "list");
});

test("the section is remembered, and a route section wins", async () => {
  saveDishes([]);
  stubCards([]);
  const first = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  await first.press(first.findByLabel("Saved stalls"));
  assert.equal(useSavedViewStore.getState().section, "stalls");
  assert.equal(eventsNamed("saved_section_changed").at(-1)?.properties.section, "stalls");
  await cleanup();

  const again = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  await again.settle();
  assert.match(again.text(), /No saved stalls yet|Couldn't load saved stalls|Nam Sing|Stall/);
  assert.equal(again.findByText("Nothing saved yet"), null, "not the Dishes section");
  await cleanup();

  const linked = await renderScreen(FavouritesScreen as never, {
    name: "Favourites",
    params: { section: "lists" },
  });
  await linked.settle();
  assert.match(linked.text(), /Make lists like|Shared and followed lists/);
});

test("list covers come from one batched read of the server, not the local cache", async () => {
  saveDishes([]);
  stubCards([]);
  usePortfolioStore.setState({
    portfolios: [
      { id: "l1", name: "Date night", ownerId: "user" } as Portfolio,
      { id: "l2", name: "Supper spots", ownerId: "user" } as Portfolio,
    ],
    scopeIds: { mine: ["l1", "l2"] },
    items: {
      l1: [
        {
          id: "a",
          portfolioId: "l1",
          itemType: "dish",
          dishId: "d1",
          position: 0,
        } as PortfolioItem,
      ],
      l2: [
        {
          id: "b",
          portfolioId: "l2",
          itemType: "dish",
          dishId: "d2",
          position: 0,
        } as PortfolioItem,
      ],
    },
  });
  stub(usePortfolioStore.getState(), "loadPortfolioScope", async () => undefined);
  const loaded: string[][] = [];
  stub(usePortfolioStore.getState(), "loadItemsForPortfolios", async (ids: string[]) => {
    loaded.push(ids);
  });
  const detailReads: string[][] = [];
  stub(getHungryService().discovery, "getItemDetails", async (input) => {
    detailReads.push(input.dishIds);
    return [];
  });
  const view = await renderScreen(FavouritesScreen as never, {
    name: "Favourites",
    params: { section: "lists" },
  });
  await view.settle();
  assert.ok(view.findByText("Date night") || view.text().includes("Date night"));
  assert.deepEqual(loaded, [["l1", "l2"]], "the items of every list in one call");
  assert.deepEqual(detailReads, [["d1", "d2"]], "the cover photos in one call");
  assert.equal(view.findByText("Search all saved"), null);
  assert.ok(view.findByText("Shared and followed lists"));
});

test("removing a saved stall shows Undo, and Undo saves it again", async () => {
  const interactions: Record<string, StallInteraction> = {
    s1: {
      userId: "user",
      stallId: "s1",
      isSaved: true,
      isTried: false,
      isReviewed: false,
      savedAt: "2026-10-01T00:00:00.000Z",
    },
  };
  useStallInteractionStore.setState({ interactions, isLoaded: true });
  stub(getHungryService().discovery, "getVenuesByIds", async (ids: string[]) =>
    ids.map((id) => ({ id, name: "Nam Sing", buildingName: "Maxwell" }) as VenueSummary),
  );
  const toggles: string[] = [];
  stub(useStallInteractionStore.getState(), "toggleSaved", async (_user: string, id: string) => {
    toggles.push(id);
  });
  const view = await renderScreen(FavouritesScreen as never, {
    name: "Favourites",
    params: { section: "stalls" },
  });
  await view.settle();
  await view.press(view.findByLabel("Remove Nam Sing from Saved"));
  assert.deepEqual(toggles, ["s1"]);
  const toast = useUIStore.getState().toast;
  assert.equal(toast?.message, "Removed from Saved.");
  assert.equal(toast?.action?.label, "Undo");
  toast?.action?.onPress();
  await view.settle();
  assert.deepEqual(toggles, ["s1", "s1"]);
});

// ─── Polish (item 7) ─────────────────────────────────────────────────────────────────────────

test("a list that can't be created says why in a Dialog, not an Alert", async () => {
  stub(usePortfolioStore.getState(), "createPortfolio", async () => {
    throw new Error("offline");
  });
  const view = await renderScreen(PortfolioCreateScreen as never, { name: "PortfolioCreate" });
  const inputs = Array.from(view.container.querySelectorAll("input")) as HTMLInputElement[];
  await view.type(inputs[0], "Date night");
  // "Create list" is the page title and the button: press the last one.
  const createButtons = Array.from(view.container.querySelectorAll<HTMLElement>("*")).filter(
    (element) => element.textContent === "Create list",
  );
  await view.press(createButtons.at(-1) ?? null);
  assert.ok(view.findByText("Couldn't create the list"));
  await view.press(view.findByText("OK"));
  assert.equal(view.findByText("Couldn't create the list"), null);
});
