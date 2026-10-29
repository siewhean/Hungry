import assert from "node:assert/strict";
import test from "node:test";

import { buildStallMapsUrl } from "@/features/detail/stallLocation";
import { loadCatalogFavourites } from "@/lib/services/catalog/favourites";
import type { SavedDishCard } from "@/lib/services/types";

import {
  buildSavedDirectionsUrl,
  formatSavedCount,
  formatSavedDishDistance,
  getSavedOrigin,
  matchesSavedDishQuery,
  savedDishPlaceLine,
  sortSavedDishes,
} from "./savedDishes";

const dish = (id: string, over: Partial<SavedDishCard> = {}): SavedDishCard => ({
  id,
  name: id,
  ...over,
});

const ORIGIN = { latitude: 1.3, longitude: 103.85 };
const NEAR = { latitude: 1.301, longitude: 103.851 };
const FAR = { latitude: 1.4, longitude: 103.9 };

test("sorting: Recent keeps the order, Nearest puts unknown distances last, Top rated needs reviews", () => {
  const list = [
    dish("far", { latitude: FAR.latitude, longitude: FAR.longitude, rating: 4.0, reviewCount: 5 }),
    dish("unknown", { rating: 5, reviewCount: 0 }),
    dish("near", {
      latitude: NEAR.latitude,
      longitude: NEAR.longitude,
      rating: 4.8,
      reviewCount: 3,
    }),
    dish("also-unknown"),
  ];
  const ids = (sort: "recent" | "nearest" | "top_rated") =>
    sortSavedDishes(list, sort, ORIGIN).map((entry) => entry.id);
  assert.deepEqual(ids("recent"), ["far", "unknown", "near", "also-unknown"]);
  assert.deepEqual(ids("nearest"), ["near", "far", "unknown", "also-unknown"]);
  // "unknown" has a 5 but no reviews, so it is not ranked above reviewed dishes.
  assert.deepEqual(ids("top_rated"), ["near", "far", "unknown", "also-unknown"]);
  // No position: Nearest cannot order anything and keeps the input order.
  assert.deepEqual(
    sortSavedDishes(list, "nearest", undefined).map((entry) => entry.id),
    ["far", "unknown", "near", "also-unknown"],
  );
  // The input is never mutated.
  assert.equal(list[0].id, "far");
});

test("Top rated breaks ties by review count", () => {
  const list = [
    dish("a", { rating: 4.5, reviewCount: 2 }),
    dish("b", { rating: 4.5, reviewCount: 40 }),
  ];
  assert.deepEqual(
    sortSavedDishes(list, "top_rated", undefined).map((entry) => entry.id),
    ["b", "a"],
  );
});

test("the origin is the picked place, else the device position once location is allowed", () => {
  const currentLocation = { latitude: 1.3, longitude: 103.8 };
  const manualCoordinate = { latitude: 1.4, longitude: 103.7 };
  assert.deepEqual(getSavedOrigin({ permission: "granted", currentLocation }), currentLocation);
  assert.equal(getSavedOrigin({ permission: "denied", currentLocation }), undefined);
  assert.equal(getSavedOrigin({ permission: "unknown", currentLocation }), undefined);
  assert.deepEqual(
    getSavedOrigin({ permission: "denied", currentLocation, manualCoordinate }),
    manualCoordinate,
  );
});

test("distance reads '450m away' and is absent without a position or a point", () => {
  const near = dish("near", { latitude: NEAR.latitude, longitude: NEAR.longitude });
  assert.match(formatSavedDishDistance(near, ORIGIN) ?? "", /^\d+m away$/);
  assert.equal(formatSavedDishDistance(near, undefined), undefined);
  assert.equal(formatSavedDishDistance(dish("none"), ORIGIN), undefined);
});

test("copy: one craving, the place line and the search match", () => {
  assert.equal(formatSavedCount(1), "1 craving saved for later");
  assert.equal(formatSavedCount(0), "0 cravings saved for later");
  assert.equal(formatSavedCount(5), "5 cravings saved for later");
  assert.equal(
    savedDishPlaceLine(dish("x", { unitNumber: " #01-23 ", buildingName: "Maxwell" })),
    "#01-23 · Maxwell",
  );
  assert.equal(savedDishPlaceLine(dish("x", { buildingName: "Maxwell" })), "Maxwell");
  assert.equal(matchesSavedDishQuery({ name: "Laksa", venueName: "Nam Sing" }, "NAM"), true);
  assert.equal(matchesSavedDishQuery({ name: "Laksa" }, "pizza"), false);
  assert.equal(matchesSavedDishQuery({ name: "Laksa" }, "  "), true);
});

test("directions search Google Maps by stall name and address, not by lat,lng (SAVED4-4)", () => {
  const full = dish("x", {
    venueName: "Nam Sing",
    buildingName: "Maxwell Food Centre",
    address: "1 Kadayanallur Street",
    postalCode: "069184",
    latitude: 1.2803,
    longitude: 103.8446,
  });
  const url = buildSavedDirectionsUrl(full) ?? "";
  assert.equal(
    new URL(url).searchParams.get("query"),
    "Nam Sing, Maxwell Food Centre, 1 Kadayanallur Street, Singapore 069184",
  );
  assert.doesNotMatch(url, /1\.2803/);

  // Name only, with a point: the point is the fallback.
  const bare = dish("y", { venueName: "Stall", latitude: 1.28, longitude: 103.84 });
  assert.equal(
    new URL(buildSavedDirectionsUrl(bare) ?? "").searchParams.get("query"),
    "1.28,103.84",
  );
  // No stall name at all: no directions.
  assert.equal(buildSavedDirectionsUrl(dish("z")), undefined);
});

test("buildStallMapsUrl searches by name and place; coordinates only when there is no place", () => {
  const pin = { latitude: 1.1, longitude: 103.1 };
  const query = (url: string) => new URL(url).searchParams.get("query");
  assert.equal(
    query(buildStallMapsUrl({ name: "Nam Sing", buildingName: "Maxwell" }, pin)),
    "Nam Sing, Maxwell",
  );
  assert.equal(query(buildStallMapsUrl({ name: "Nam Sing" }, pin)), "1.1,103.1");
  assert.equal(query(buildStallMapsUrl({ name: "Nam Sing" })), "Nam Sing");
  assert.match(buildStallMapsUrl({ name: "A & B" }), /query=A%20%26%20B$/);
});

test("the loader makes one batched card read for saved and tried dishes together (SAVED4-3)", async () => {
  const saved = Array.from({ length: 60 }, (_, index) => `d${index}`);
  const calls: string[][] = [];
  const result = await loadCatalogFavourites({
    getFavouriteDishIds: async () => [...saved, "d0"],
    extraDishIds: ["d1", "tried-only"],
    getSavedDishCards: async (ids) => {
      calls.push(ids);
      return ids.filter((id) => id !== "d5").map((id) => dish(id));
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].length, 61);
  assert.equal(result.status, "loaded");
  if (result.status === "loaded") {
    assert.equal(result.savedIds.length, 60);
    assert.equal(result.cards.length, 60);
    assert.equal(result.unavailableCount, 1);
  }
});

test("the loader reports each failed read to error tracking", async () => {
  const reported: string[] = [];
  const onError = (_error: unknown, step: string) => reported.push(step);
  await loadCatalogFavourites({
    getFavouriteDishIds: async () => {
      throw new Error("offline");
    },
    getSavedDishCards: async () => [],
    onError,
  });
  const result = await loadCatalogFavourites({
    getFavouriteDishIds: async () => ["d1"],
    getSavedDishCards: async () => {
      throw new Error("timeout");
    },
    onError,
  });
  assert.deepEqual(reported, ["read_saved_ids", "read_cards"]);
  assert.equal(result.status, "error");
});
