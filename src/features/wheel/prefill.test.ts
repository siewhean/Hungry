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

test("MD-W2 open stalls lead, stalls with no readable hours follow, and closed ones fill what is left", () => {
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
  // b is open; c and d have no hours, so they come after b, nearest first; a opens at 8pm and
  // fills the fourth place, marked with when it opens.
  assert.deepEqual(
    picks.map((pick) => pick.venueId),
    ["b", "d", "c", "a"],
  );
  assert.equal(picks[3].opensAt, "Opens 8pm");
  assert.equal(picks[0].opensAt, undefined);
});

test("R5-3 at night the wheel is filled with the stalls that open soonest, not left with one", () => {
  // 21:00 in Singapore (13:00 UTC): only the 24-hour stall is open.
  const night = new Date("2026-10-28T13:00:00Z");
  const dishes = ["a", "b", "c", "d", "e"].map((id, index) =>
    dish(`${id}1`, id, 100 * (index + 1)),
  );
  const venues = new Map<string, VenueSummary | undefined>([
    ["a", venue("a", "Daily 12am-11:59pm")],
    ["b", venue("b", "Daily 7am-3pm")],
    ["c", venue("c", "Daily 5am-3pm")],
    ["d", venue("d", "Daily 6pm-8pm")],
    ["e", venue("e", "Daily 11pm-11:30pm")],
  ]);
  const picks = pickPrefillStalls(dishes, venues, night);
  // a is open; the others open at 11pm (e), 5am (c), 7am (b): soonest first. d reopened at 6pm
  // and closed at 8pm, so it opens tomorrow evening and is last, past the four places.
  assert.deepEqual(
    picks.map((pick) => pick.venueId),
    ["a", "e", "c", "b"],
  );
  assert.equal(picks[0].opensAt, undefined, "the open stall is not marked");
  assert.deepEqual(
    picks.slice(1).map((pick) => pick.opensAt),
    ["Opens 11pm", "Opens 5am tomorrow", "Opens 7am tomorrow"],
  );
});

test("R5-3 a closed stall with no readable opening time is never offered", () => {
  const dishes = [dish("a1", "a", 100), dish("b1", "b", 200)];
  const venues = new Map<string, VenueSummary | undefined>([
    ["a", { ...venue("a", "Daily 8pm-11pm"), isOpen: false }],
    ["b", { ...venue("b", "Daily 8pm-11pm"), closedUntil: "2099-01-01T00:00:00Z" }],
  ]);
  const picks = pickPrefillStalls(dishes, venues, NOON);
  assert.deepEqual(picks, [], "a stall the merchant closed has no 'opens soon' to offer");
});

test("MD-W2 an empty search gives an empty wheel", () => {
  assert.deepEqual(pickPrefillStalls([], new Map(), NOON), []);
});
