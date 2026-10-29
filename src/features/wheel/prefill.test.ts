import assert from "node:assert/strict";
import test from "node:test";

import { pickPrefillStalls } from "./prefill";
import type { DishDetail, VenueSummary } from "@/types/domain";

// Wednesday 12:00 in Singapore (04:00 UTC).
const NOON = new Date("2026-10-28T04:00:00Z");

function dish(id: string, venueId: string, distanceMeters: number, rating = 4): DishDetail {
  return {
    id,
    venueId,
    buildingId: `b-${venueId}`,
    venueName: `Stall ${venueId}`,
    unitNumber: "01-01",
    floor: "L1",
    name: id,
    imageUrl: `https://img/${id}.jpg`,
    distanceMeters,
    rating,
    reviewCount: 1,
    price: 5,
    priceRange: "$",
    tasteTags: [],
    tasteVector: { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 },
    dietaryFlags: [],
    gallery: [],
    mustOrder: false,
    availabilityFlags: [],
    reviews: [],
  } as DishDetail;
}

function venue(id: string, operatingHours: string): VenueSummary {
  return {
    id,
    buildingId: `b-${id}`,
    name: `Venue ${id}`,
    unitNumber: "01-01",
    floor: "L1",
    isOpen: true,
    topDishId: "",
    operatingHours,
    deliveryLinks: [],
  };
}

test("MD-W2 a new wheel gets the nearest open stalls, one per stall", () => {
  const dishes = [
    dish("a1", "a", 300),
    dish("a2", "a", 120),
    dish("b1", "b", 200),
    dish("c1", "c", 150),
    dish("d1", "d", 400),
    dish("e1", "e", 500),
  ];
  const venues = new Map(
    ["a", "b", "c", "d", "e"].map((id) => [id, venue(id, "Daily 8am-10pm")] as const),
  );
  const picks = pickPrefillStalls(dishes, venues, NOON);
  assert.deepEqual(
    picks.map((pick) => pick.venueId),
    ["a", "c", "b", "d"],
  );
  assert.equal(picks[0].label, "Venue a");
  assert.equal(picks[0].imageUrl, "https://img/a2.jpg", "the nearest dish of the stall");
  assert.equal(picks[0].buildingId, "b-a");
});

test("MD-W2 closed stalls are left out, and stalls with no readable hours follow the open ones", () => {
  const dishes = [
    dish("a1", "a", 100),
    dish("b1", "b", 200),
    dish("c1", "c", 300),
    dish("d1", "d", 50),
  ];
  const venues = new Map<string, VenueSummary | undefined>([
    ["a", venue("a", "Daily 8pm-11pm")],
    ["b", venue("b", "Daily 8am-10pm")],
    ["c", undefined],
  ]);
  const picks = pickPrefillStalls(dishes, venues, NOON);
  // a is closed at noon; b is open; c and d have no hours, so they come after b, nearest first.
  assert.deepEqual(
    picks.map((pick) => pick.venueId),
    ["b", "d", "c"],
  );
});

test("MD-W2 an empty search gives an empty wheel", () => {
  assert.deepEqual(pickPrefillStalls([], new Map(), NOON), []);
});
