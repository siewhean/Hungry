import assert from "node:assert/strict";
import test from "node:test";

import type { DishDetail, VenueSummary } from "@/types/domain";
import { compareHomeStalls, getStallRowOpenLabel, isStallClosed } from "./homeStalls";

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

test("a closed stall reads just 'Closed', never 'Closed · Closed for today'", () => {
  // Closed all day: the detail depends on the clock ("Opens 12am tomorrow" or none), never a repeat.
  const label = getStallRowOpenLabel(venue({ operatingHours: "Mon-Sun 00:00-00:01" }));
  assert.match(label ?? "", /^Closed/);
  assert.doesNotMatch(label ?? "", /Closed · Closed/);
  assert.equal(getStallRowOpenLabel(venue({ isOpen: false })), "Closed");
});

test("an open stall keeps its detail and unknown hours say nothing", () => {
  assert.equal(getStallRowOpenLabel(venue()), "Open · Open 24 hours");
  assert.equal(getStallRowOpenLabel(venue({ operatingHours: "" })), undefined);
});

test("isStallClosed is true only for a closed stall", () => {
  assert.equal(isStallClosed(venue({ isOpen: false })), true);
  assert.equal(isStallClosed(venue()), false);
  assert.equal(isStallClosed(venue({ operatingHours: "" })), false);
});

test("stalls sort open first, then with a menu, then nearest, then best rated", () => {
  const closedNear = { venue: venue({ id: "closedNear", isOpen: false, distanceMeters: 10 }) };
  const openFar = { venue: venue({ id: "openFar", distanceMeters: 900 }) };
  const openNear = { venue: venue({ id: "openNear", distanceMeters: 50 }) };
  const openFarWithMenu = {
    venue: venue({ id: "openFarWithMenu", distanceMeters: 2000 }),
    topDish: dish(4, 3),
  };
  const sameDistanceBetter = {
    venue: venue({ id: "better", distanceMeters: 300 }),
    topDish: dish(4.8, 20),
  };
  const sameDistanceWorse = {
    venue: venue({ id: "worse", distanceMeters: 300 }),
    topDish: dish(3.1, 2),
  };
  const sorted = [
    closedNear,
    openFar,
    sameDistanceWorse,
    openNear,
    openFarWithMenu,
    sameDistanceBetter,
  ].sort(compareHomeStalls);
  assert.deepEqual(
    sorted.map((card) => card.venue.id),
    ["better", "worse", "openFarWithMenu", "openNear", "openFar", "closedNear"],
  );
});

test("a stall without a distance sorts after one with a distance", () => {
  const unknown = { venue: venue({ id: "unknown" }) };
  const known = { venue: venue({ id: "known", distanceMeters: 5000 }) };
  assert.deepEqual(
    [unknown, known].sort(compareHomeStalls).map((card) => card.venue.id),
    ["known", "unknown"],
  );
});
