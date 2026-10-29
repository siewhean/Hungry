// Saved > Dishes (round four, SAVED4-1/2/3/4/6/8/9/13/15/16/17/22), checked in a real React tree
// (react-native-web + jsdom, mock data). Run with
// `node scripts/test-render.mjs src/app/screens/profile/savedDishes.render.test.tsx`.

import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { Linking } from "react-native";

import { FavouritesScreen } from "@/app/screens/profile/FavouritesScreen";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import {
  clearExperimentOverrides,
  resetExperimentSession,
  setExperimentFlagSource,
  setExperimentOverride,
} from "@/lib/experiments/experiments";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { SavedDishCard } from "@/lib/services/types";
import { useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

const restores: (() => void)[] = [];
function stub<T extends object, K extends keyof T>(target: T, key: K, value: T[K]) {
  const original = target[key];
  target[key] = value;
  restores.push(() => {
    target[key] = original;
  });
}

const LAKSA: SavedDishCard = {
  id: "d-laksa",
  name: "Laksa",
  venueId: "v-nam-sing",
  venueName: "Nam Sing",
  buildingName: "Maxwell Food Centre",
  unitNumber: "#01-23",
  address: "1 Kadayanallur Street",
  postalCode: "069184",
  price: 5.5,
  imageUrl: "https://example.com/laksa.jpg",
  rating: 4.6,
  reviewCount: 12,
  latitude: 1.2803,
  longitude: 103.8446,
};
const RICE: SavedDishCard = {
  id: "d-rice",
  name: "Chicken Rice",
  venueId: "v-tian-tian",
  venueName: "Tian Tian",
  buildingName: "Far Away Centre",
  unitNumber: "#02-01",
  price: 4.5,
  rating: 4.9,
  reviewCount: 80,
  latitude: 1.4,
  longitude: 103.9,
};
const FIXTURES = [LAKSA, RICE];

function saveDishes(ids: string[], tried: string[] = []) {
  useProfileStore.setState((state) => ({
    profile: { ...state.profile, favouriteDishIds: ids, reviewedDishIds: tried },
  }));
}

/** Stubs the batched read and records every call's ids. */
function stubCards(cards: SavedDishCard[] = FIXTURES) {
  const calls: string[][] = [];
  stub(getHungryService().discovery, "getSavedDishCards", async (ids: string[]) => {
    calls.push(ids);
    return cards.filter((card) => ids.includes(card.id));
  });
  return calls;
}

beforeEach(async () => {
  await enterScenario("user");
  clearTrackedAnalyticsEvents();
  useLocationStore.setState({ permission: "denied", manualCoordinate: undefined });
});
afterEach(async () => {
  await cleanup();
  while (restores.length) restores.pop()?.();
  clearExperimentOverrides();
  setExperimentFlagSource(undefined);
  resetExperimentSession();
});

const eventsNamed = (name: string) =>
  getTrackedAnalyticsEvents().filter((event) => event.event === name);

test("60 saved dishes load with one batched read, not 60 (SAVED4-3)", async () => {
  const ids = Array.from({ length: 60 }, (_, index) => `d${index}`);
  saveDishes(ids);
  const calls = stubCards(
    ids.map((id) => ({ id, name: `Dish ${id}`, venueId: "v1", venueName: "Stall" })),
  );
  const view = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  assert.equal(calls.length, 1);
  assert.equal(new Set(calls[0]).size, 60);
  assert.match(view.text(), /60 cravings saved for later/);
});

test("the live card has Directions, Tried and Review, and opens the dish page (SAVED4-1/2)", async () => {
  saveDishes([LAKSA.id]);
  stubCards();
  const view = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  assert.ok(view.findByText("Get directions"));
  assert.ok(view.findByText("Mark as tried"));
  assert.ok(view.findByText("Write a review"));
  assert.match(view.text(), /Nam Sing · #01-23 · Maxwell Food Centre/);
  assert.match(view.text(), /4\.6/);
  assert.match(view.text(), /S\$5\.50/);

  await view.press(view.findByLabel("Open Laksa at Nam Sing"));
  const open = view.navigation.calls.find((call) => call.method === "navigate");
  assert.deepEqual(open?.args, ["DishDetail", { dishId: LAKSA.id, source: "saved" }]);
  const opened = eventsNamed("saved_item_opened");
  assert.equal(opened.length, 1);
  assert.equal(opened[0].properties.position, 0);

  await view.press(view.findByText("Write a review"));
  const review = view.navigation.calls.find(
    (call) => call.method === "navigate" && call.args[0] === "ReviewStack",
  );
  assert.deepEqual(review?.args[1], {
    screen: "ReviewMain",
    params: { venueId: LAKSA.venueId, dishId: LAKSA.id },
  });
});

test("Get directions opens Google Maps by stall name, not raw coordinates (SAVED4-4)", async () => {
  saveDishes([LAKSA.id]);
  stubCards();
  const opened: string[] = [];
  stub(Linking, "openURL", async (url: string) => {
    opened.push(url);
  });
  const view = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  await view.press(view.findByText("Get directions"));
  assert.equal(opened.length, 1);
  const query = new URL(opened[0]).searchParams.get("query");
  assert.equal(query, "Nam Sing, Maxwell Food Centre, 1 Kadayanallur Street, Singapore 069184");
  assert.doesNotMatch(opened[0], /1\.28/);
  assert.equal(eventsNamed("saved_directions_opened").length, 1);
});

test("Remove shows Undo; Undo puts the dish back once, even when tapped twice (SAVED4-6)", async () => {
  saveDishes([LAKSA.id, RICE.id]);
  const calls = stubCards();
  const view = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  assert.ok(view.findByLabel("Open Laksa at Nam Sing"));

  await view.press(view.findByLabel("Remove Laksa from Saved"));
  assert.equal(view.findByLabel("Open Laksa at Nam Sing"), null);
  assert.ok(view.findByLabel("Open Chicken Rice at Tian Tian"));
  assert.deepEqual(useProfileStore.getState().profile.favouriteDishIds, [RICE.id]);
  const toast = useUIStore.getState().toast;
  assert.equal(toast?.message, "Removed from Saved.");
  assert.equal(toast?.action?.label, "Undo");
  assert.equal(toast?.duration, 5000);
  assert.equal(eventsNamed("dish_unfavourited").length, 1);

  const undo = toast?.action;
  undo?.onPress();
  undo?.onPress();
  await view.settle();
  assert.equal(
    useProfileStore.getState().profile.favouriteDishIds.filter((id) => id === LAKSA.id).length,
    1,
  );
  assert.ok(view.findByLabel("Open Laksa at Nam Sing"));
  assert.equal(eventsNamed("dish_favourited").length, 1);
  assert.equal(eventsNamed("saved_undo_used").length, 1);
  // Removing and undoing never re-read the list from the server.
  assert.equal(calls.length, 1);
});

test("without the Undo variant the remove toast has no action (SAVED4-6)", async () => {
  saveDishes([LAKSA.id]);
  stubCards();
  setExperimentOverride("saved_remove_undo_v1", "control");
  const view = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  await view.press(view.findByLabel("Remove Laksa from Saved"));
  assert.equal(useUIStore.getState().toast?.message, "Removed from Saved.");
  assert.equal(useUIStore.getState().toast?.action, undefined);
});

test("the Tried control shows its state and Undo restores it (SAVED4-13)", async () => {
  saveDishes([LAKSA.id]);
  stubCards();
  const view = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  const tried = () => view.findByText("Tried") ?? view.findByText("Mark as tried");
  assert.equal(view.findByText("Tried"), null);

  await view.press(view.findByText("Mark as tried"));
  assert.deepEqual(useProfileStore.getState().profile.reviewedDishIds, [LAKSA.id]);
  const checkbox = view.findByText("Tried")?.closest('[role="checkbox"]');
  assert.equal(checkbox?.getAttribute("aria-checked"), "true");

  await view.press(tried());
  assert.deepEqual(useProfileStore.getState().profile.reviewedDishIds, []);
  assert.equal(useUIStore.getState().toast?.message, "Removed from your tried dishes.");
  useUIStore.getState().toast?.action?.onPress();
  await view.settle();
  assert.deepEqual(useProfileStore.getState().profile.reviewedDishIds, [LAKSA.id]);
});

test("the Tried tab lists tried dishes and cannot un-save them (SAVED4-1)", async () => {
  saveDishes([LAKSA.id], [RICE.id]);
  const calls = stubCards();
  const view = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  // Saved and tried dishes arrive in the same batch.
  assert.equal(calls.length, 1);
  assert.ok(view.findByText("Want to try (1)"));
  assert.ok(view.findByText("Tried (1)"));

  await view.press(view.findByText("Tried (1)"));
  assert.ok(view.findByLabel("Open Chicken Rice at Tian Tian"));
  assert.equal(view.findByLabel("Open Laksa at Nam Sing"), null);
  assert.equal(view.findByLabel("Remove Chicken Rice from Saved"), null);
});

test("Nearest sorts by distance; with location off it says why and keeps the order (SAVED4-8)", async () => {
  saveDishes([RICE.id, LAKSA.id]);
  stubCards();
  const view = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  const order = () => {
    const text = view.text();
    return text.indexOf("Chicken Rice") < text.indexOf("Laksa") ? "rice-first" : "laksa-first";
  };
  // Recent order is newest save first: Laksa was saved last.
  assert.equal(order(), "laksa-first");

  await view.press(view.findByLabel("Sort by top rated"));
  assert.equal(order(), "rice-first");
  await view.press(view.findByLabel("Sort by recent"));

  await view.press(view.findByLabel("Sort by nearest. Turn on location to use this."));
  assert.equal(useUIStore.getState().toast?.message, "Turn on location to sort by nearest.");
  assert.equal(order(), "laksa-first");

  useLocationStore.setState({
    permission: "granted",
    currentLocation: { latitude: 1.401, longitude: 103.901 },
  });
  await view.settle();
  await view.press(view.findByLabel("Sort by nearest"));
  assert.equal(order(), "rice-first");
  assert.match(view.text(), /m away|km away/);
  assert.equal(eventsNamed("saved_sort_changed").length, 3);
});

test("a dish with no photo shows the placeholder, not a blank box (SAVED4-9)", async () => {
  saveDishes([RICE.id]);
  stubCards();
  const view = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  assert.ok(view.findByTestId("saved-dish-photo-placeholder"));
});

test("compact rows lay out the same dishes in the density variant (SAVED4-9)", async () => {
  saveDishes([LAKSA.id]);
  stubCards();
  setExperimentOverride("saved_card_density_v1", "compact_rows");
  const view = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  assert.ok(view.findByLabel("Open Laksa at Nam Sing"));
  assert.ok(view.findByLabel("Get directions to Nam Sing"));
  assert.ok(view.findByLabel("Write a review of Laksa"));
  assert.equal(view.findByText("Get directions"), null);
});

test("the count follows the cards and reads '1 craving' (SAVED4-15/16)", async () => {
  // Three ids are saved, but only one dish is still in the catalog.
  saveDishes([LAKSA.id, "gone-1", "gone-2"]);
  stubCards();
  const view = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  assert.match(view.text(), /1 craving saved for later/);
  assert.doesNotMatch(view.text(), /1 cravings/);
  assert.match(view.text(), /2 saved dishes are not in the current catalog/);
});

test("a search with no match offers Clear search (SAVED4-17)", async () => {
  saveDishes([LAKSA.id]);
  stubCards();
  const view = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  await view.type(view.findByLabel("Search your saved dishes"), "pizza");
  assert.ok(view.findByText("No matches"));
  await view.press(view.findByText("Clear search"));
  assert.ok(view.findByLabel("Open Laksa at Nam Sing"));
});

test("a failed read shows Retry, reports, and Retry loads the dishes", async () => {
  saveDishes([LAKSA.id]);
  let fail = true;
  stub(getHungryService().discovery, "getSavedDishCards", async (ids: string[]) => {
    if (fail) throw new Error("network request failed");
    return FIXTURES.filter((card) => ids.includes(card.id));
  });
  const view = await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  assert.ok(view.findByText("Couldn't load your saved dishes"));
  assert.equal(view.findByLabel("Open Laksa at Nam Sing"), null);
  fail = false;
  await view.press(view.findByText("Retry"));
  assert.ok(view.findByLabel("Open Laksa at Nam Sing"));
});

test("viewing Saved records saved_viewed once with the count", async () => {
  saveDishes([LAKSA.id, RICE.id]);
  stubCards();
  await renderScreen(FavouritesScreen as never, { name: "Favourites" });
  const viewed = eventsNamed("saved_viewed");
  assert.equal(viewed.length, 1);
  assert.equal(viewed[0].properties.count, 2);
  assert.equal(viewed[0].properties.tab, "want");
});
