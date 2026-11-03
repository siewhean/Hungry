import assert from "node:assert/strict";
import test from "node:test";

import { groupNearbyPlaces, pickOpenNowStalls } from "@/features/discover/homeRails";
import type { BuildingSummary, DishDetail, VenueSummary } from "@/types/domain";

const OPEN_ALWAYS = "Mon-Sun 24 hours";

function venue(overrides: Partial<VenueSummary> = {}): VenueSummary {
  return {
    id: "v",
    buildingId: "b",
    name: "Stall",
    unitNumber: "",
    floor: "",
    isOpen: true,
    topDishId: "",
    operatingHours: OPEN_ALWAYS,
    deliveryLinks: [],
    ...overrides,
  };
}

function dish(rating: number, reviewCount: number, distanceMeters = 0): DishDetail {
  return { rating, reviewCount, distanceMeters } as DishDetail;
}

const CLOSED_ALWAYS = "Mon-Sun 00:00-00:01";

test("open now lists only open stalls, nearest first, up to the limit", () => {
  const far = { venue: venue({ id: "far", distanceMeters: 900 }) };
  const near = { venue: venue({ id: "near", distanceMeters: 100 }) };
  const closed = {
    venue: venue({ id: "closed", operatingHours: CLOSED_ALWAYS, distanceMeters: 50 }),
  };
  assert.deepEqual(
    pickOpenNowStalls([far, closed, near]).map((card) => card.venue.id),
    ["near", "far"],
  );
  assert.equal(pickOpenNowStalls([far, near], 1).length, 1);
});

function building(id: string, name = id): BuildingSummary {
  return {
    id,
    name,
    type: "food_court",
    coordinate: { latitude: 0, longitude: 0 },
    floors: [],
    venueCount: 0,
    isClosedToday: false,
    heroDishId: "",
  };
}

test("nearby places group the feed's stalls by building, nearest first, without the current one", () => {
  const cards = [
    {
      building: building("here"),
      venue: venue({ id: "a", buildingId: "here", distanceMeters: 10 }),
    },
    {
      building: building("far"),
      venue: venue({ id: "b", buildingId: "far", distanceMeters: 800 }),
    },
    {
      building: building("near"),
      venue: venue({ id: "c", buildingId: "near", distanceMeters: 300 }),
    },
    {
      building: building("near"),
      venue: venue({ id: "d", buildingId: "near", distanceMeters: 250 }),
    },
  ];
  const places = groupNearbyPlaces(cards, "here");
  assert.deepEqual(
    places.map((place) => [place.building.id, place.stallCount, place.distanceMeters]),
    [
      ["near", 2, 250],
      ["far", 1, 800],
    ],
  );
  assert.equal(groupNearbyPlaces(cards, "here", 1).length, 1);
});

test("nearby places skip stalls with no building and fall back to the top dish distance", () => {
  const cards = [
    { building: building("none"), venue: venue({ id: "a", buildingId: undefined }) },
    {
      building: building("mall"),
      venue: venue({ id: "b", buildingId: "mall", distanceMeters: undefined }),
      topDish: { distanceMeters: 420 } as DishDetail,
    },
    {
      building: building("mall"),
      venue: venue({ id: "c", buildingId: "mall", distanceMeters: 500 }),
    },
  ];
  const places = groupNearbyPlaces(cards, null);
  assert.deepEqual(
    places.map((place) => [place.building.id, place.stallCount, place.distanceMeters]),
    [["mall", 2, 420]],
  );
});

test("open now breaks a distance tie by rating, and stalls with no distance come last", () => {
  const lower = { venue: venue({ id: "lower", distanceMeters: 100 }), topDish: dish(3, 5) };
  const higher = { venue: venue({ id: "higher", distanceMeters: 100 }), topDish: dish(4.5, 20) };
  const unknown = { venue: venue({ id: "unknown" }) };
  assert.deepEqual(
    pickOpenNowStalls([unknown, lower, higher]).map((card) => card.venue.id),
    ["higher", "lower", "unknown"],
  );
});

test("a place whose first stall has no distance takes the next stall's, and unknown distances sort last", () => {
  const cards = [
    { building: building("a"), venue: venue({ id: "a1", buildingId: "a" }) },
    { building: building("b"), venue: venue({ id: "b1", buildingId: "b", distanceMeters: 700 }) },
    { building: building("a"), venue: venue({ id: "a2", buildingId: "a", distanceMeters: 900 }) },
    { building: building("a"), venue: venue({ id: "a3", buildingId: "a", distanceMeters: 200 }) },
    { building: building("c"), venue: venue({ id: "c1", buildingId: "c" }) },
  ];
  const places = groupNearbyPlaces(cards, undefined);
  assert.deepEqual(
    places.map((place) => [place.building.id, place.distanceMeters]),
    [
      ["a", 200],
      ["b", 700],
      ["c", undefined],
    ],
  );
});
